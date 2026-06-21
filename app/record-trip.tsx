import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { BASE_URL } from '@/constants/api';
import { authHeaders } from '@/constants/api-client';
import { AppColors, useThemeColors } from '@/context/theme-context';

interface SensorReading {
  x: number;
  y: number;
  z: number;
}

interface LocationPoint {
  speed: number;
  timestamp: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function scoreColor(events: number, COLORS: AppColors) {
  if (events === 0) return COLORS.green;
  if (events < 5) return COLORS.yellow;
  return COLORS.danger;
}

export default function RecordTripScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [sending, setSending] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  const accelData = useRef<SensorReading[]>([]);
  const gyroData = useRef<SensorReading[]>([]);
  const locationData = useRef<LocationPoint[]>([]);
  const harshBrakes = useRef(0);
  const harshAccels = useRef(0);
  const maxSpeed = useRef(0);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);

  const accelSub = useRef<any>(null);
  const gyroSub = useRef<any>(null);
  const locationSub = useRef<any>(null);
  const timer = useRef<any>(null);
  const lastEventTime = useRef(0);

  useEffect(() => {
    if (isRecording) {
      timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timer.current);
    }

    return () => clearInterval(timer.current);
  }, [isRecording]);

  const startRecording = async () => {
    console.log('[startRecording] called');

    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    console.log('[startRecording] location status:', status, 'canAskAgain:', canAskAgain);

    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access in your device Settings to track trips.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission needed', 'Location access is required to track your trip.');
      }

      return;
    }

    accelData.current = [];
    gyroData.current = [];
    locationData.current = [];
    harshBrakes.current = 0;
    harshAccels.current = 0;
    maxSpeed.current = 0;
    lastLocation.current = null;
    setElapsed(0);
    setDistance(0);
    setCurrentSpeed(0);
    setEventCount(0);

    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener((data) => {
      accelData.current.push(data);

      const now = Date.now();
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

      if (now - lastEventTime.current > 1000) {
        if (magnitude > 4.0) {
          harshBrakes.current += 1;
          setEventCount(harshBrakes.current + harshAccels.current);
          lastEventTime.current = now;
        } else if (magnitude > 2.8) {
          harshAccels.current += 1;
          setEventCount(harshBrakes.current + harshAccels.current);
          lastEventTime.current = now;
        }
      }
    });

    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener((data) => {
      gyroData.current.push(data);
    });

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (loc) => {
        const speed = Math.max(0, (loc.coords.speed ?? 0) * 3.6);

        setCurrentSpeed(Math.round(speed));

        locationData.current.push({
          speed,
          timestamp: loc.timestamp,
        });

        if (speed > maxSpeed.current) {
          maxSpeed.current = speed;
        }

        if (lastLocation.current) {
          const d = haversineDistance(
            lastLocation.current.lat,
            lastLocation.current.lng,
            loc.coords.latitude,
            loc.coords.longitude
          );

          setDistance((prev) => prev + d);
        }

        lastLocation.current = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        };
      }
    );

    setIsRecording(true);
  };

  const stopAndSend = async () => {
    accelSub.current?.remove();
    gyroSub.current?.remove();
    locationSub.current?.remove();
    setIsRecording(false);

    if (elapsed < 30) {
      Alert.alert('Trip too short', 'Minimum trip duration is 30 seconds.');
      return;
    }

    setSending(true);

    try {
      const headers = await authHeaders();

      const speeds = locationData.current.map((l) => l.speed);
      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const speedVar = speeds.length
        ? Math.sqrt(speeds.map((s) => (s - avgSpeed) ** 2).reduce((a, b) => a + b, 0) / speeds.length)
        : 0;
      const overspeed = speeds.filter((s) => s > 120).length / (speeds.length || 1);

      const payload = {
        trip_id: `trip_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],

        accelerometer_data: accelData.current.slice(-100),
        gyroscope_data: gyroData.current.slice(-100),

        trip_summary: {
          avg_speed: Math.round(avgSpeed),
          max_speed: Math.round(maxSpeed.current),
          distance_km: Math.round(distance * 10) / 10,
          duration_min: Math.round(elapsed / 60),
          overspeed_ratio: Math.round(overspeed * 100) / 100,
          speed_variance: Math.round(speedVar * 10) / 10,
        },

        driving_behavior: {
          harsh_brake_count: harshBrakes.current,
          harsh_accel_count: harshAccels.current,
        },

        avg_speed: Math.round(avgSpeed),
        max_speed: Math.round(maxSpeed.current),
        distance_km: Math.round(distance * 10) / 10,
        trip_duration_min: Math.round(elapsed / 60),
        overspeed_ratio: Math.round(overspeed * 100) / 100,
        speed_variance: Math.round(speedVar * 10) / 10,
        harsh_brake_count: harshBrakes.current,
        harsh_accel_count: harshAccels.current,
      };

      const res = await fetch(`${BASE_URL}/trips/end`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert(
          '✅ Trip Saved',
          `Distance: ${distance.toFixed(1)} km\nDuration: ${formatTime(elapsed)}\nEvents: ${harshBrakes.current + harshAccels.current}`,
          [{ text: 'View Trips', onPress: () => router.replace('/trips') }]
        );
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? 'Failed to save trip');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save trip. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const eventColor = scoreColor(eventCount, COLORS);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        <Text style={styles.title}>Record Trip</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.timerCard, isRecording && styles.timerCardActive]}>
          <Text style={styles.timerLabel}>Duration</Text>
          <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>

          {isRecording && (
            <View style={styles.recordingPill}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
          )}

          {!isRecording && elapsed === 0 && (
            <Text style={styles.timerHint}>Press Start to begin recording</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="speedometer-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{currentSpeed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{distance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: `${eventColor}18` }]}> 
              <Ionicons name="warning-outline" size={18} color={eventColor} />
            </View>
            <Text style={[styles.statValue, { color: eventColor }]}>{eventCount}</Text>
            <Text style={styles.statLabel}>events</Text>
          </View>
        </View>

        {isRecording && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.breakdownLabel}>Harsh Brakes</Text>
                <Text style={[styles.breakdownValue, { color: harshBrakes.current > 0 ? COLORS.danger : COLORS.green }]}> 
                  {harshBrakes.current}
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownItem}>
                <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.yellow} />
                <Text style={styles.breakdownLabel}>Harsh Accels</Text>
                <Text style={[styles.breakdownValue, { color: harshAccels.current > 0 ? COLORS.yellow : COLORS.green }]}> 
                  {harshAccels.current}
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownItem}>
                <Ionicons name="trending-up-outline" size={16} color={COLORS.primary} />
                <Text style={styles.breakdownLabel}>Max Speed</Text>
                <Text style={styles.breakdownValue}>{Math.round(maxSpeed.current)} km/h</Text>
              </View>
            </View>
          </View>
        )}

        {!isRecording ? (
          <Pressable style={styles.startBtn} onPress={startRecording} disabled={sending}>
            <View style={styles.startBtnInner}>
              <Ionicons name="play" size={26} color="#fff" />
              <Text style={styles.startBtnText}>Start Trip</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable style={[styles.stopBtn, sending && styles.btnDisabled]} onPress={stopAndSend} disabled={sending}>
            {sending ? (
              <View style={styles.startBtnInner}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.stopBtnText}>Analyzing trip...</Text>
              </View>
            ) : (
              <View style={styles.startBtnInner}>
                <Ionicons name="stop" size={26} color="#fff" />
                <Text style={styles.stopBtnText}>End Trip</Text>
              </View>
            )}
          </Pressable>
        )}

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Keep the app open while driving. Your trip will be analyzed by AI when you end it and saved to your history.
          </Text>
        </View>

        {!isRecording && (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips for accurate tracking</Text>

            <View style={styles.tipRow}>
              <Ionicons name="phone-portrait-outline" size={14} color={COLORS.mutedDark} />
              <Text style={styles.tipText}>Keep your phone stable (in a mount or pocket)</Text>
            </View>

            <View style={styles.tipRow}>
              <Ionicons name="wifi-outline" size={14} color={COLORS.mutedDark} />
              <Text style={styles.tipText}>GPS works best outdoors and in open areas</Text>
            </View>

            <View style={styles.tipRow}>
              <Ionicons name="battery-half-outline" size={14} color={COLORS.mutedDark} />
              <Text style={styles.tipText}>Ensure battery is charged for long trips</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
    title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
    content: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

    timerCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    timerCardActive: { borderColor: `${COLORS.danger}66`, backgroundColor: COLORS.surface },
    timerLabel: { color: COLORS.muted, fontSize: 14, fontWeight: '600', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
    timerValue: { color: COLORS.text, fontSize: 68, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },
    timerHint: { color: COLORS.mutedDark, fontSize: 13, marginTop: 10 },
    recordingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: `${COLORS.danger}1A`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: `${COLORS.danger}4D` },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
    recordingText: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },

    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
    statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${COLORS.primary}1F` },
    statValue: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
    statLabel: { color: COLORS.muted, fontSize: 12 },

    breakdownCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
    breakdownRow: { flexDirection: 'row', alignItems: 'center' },
    breakdownItem: { flex: 1, alignItems: 'center', gap: 6 },
    breakdownDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
    breakdownLabel: { color: COLORS.muted, fontSize: 11, textAlign: 'center' },
    breakdownValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

    startBtn: { height: 64, borderRadius: 20, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
    startBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    stopBtn: { height: 64, borderRadius: 20, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
    stopBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    btnDisabled: { opacity: 0.6 },

    infoCard: { flexDirection: 'row', gap: 10, backgroundColor: `${COLORS.primary}14`, borderRadius: 14, padding: 14, alignItems: 'flex-start', borderWidth: 1, borderColor: `${COLORS.primary}33` },
    infoText: { color: COLORS.muted, fontSize: 13, lineHeight: 20, flex: 1 },

    tipsCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
    tipsTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tipText: { color: COLORS.mutedDark, fontSize: 13, flex: 1 },
  });
