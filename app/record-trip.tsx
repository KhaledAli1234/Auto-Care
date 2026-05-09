// app/record-trip.tsx
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/api';

const COLORS = {
  background: '#09182d', surface: '#13243a',
  surfaceLight: '#172b44', border: 'rgba(255,255,255,0.07)',
  text: '#f8fafc', muted: '#aebbd0', mutedDark: '#74849a',
  primary: '#3268f7', danger: '#ef4444', green: '#22c55e',
};

interface SensorReading { x: number; y: number; z: number; }
interface LocationPoint { speed: number; timestamp: number; }

export default function RecordTripScreen() {
  const insets = useSafeAreaInsets();

  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused,    setIsPaused]      = useState(false);
  const [elapsed,     setElapsed]       = useState(0);
  const [distance,    setDistance]      = useState(0);
  const [currentSpeed,setCurrentSpeed] = useState(0);
  const [sending,     setSending]       = useState(false);

  // Sensor data refs — don't need re-render
  const accelData    = useRef<SensorReading[]>([]);
  const gyroData     = useRef<SensorReading[]>([]);
  const locationData = useRef<LocationPoint[]>([]);
  const harshBrakes  = useRef(0);
  const harshAccels  = useRef(0);
  const maxSpeed     = useRef(0);
  const lastSpeed    = useRef(0);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);

  // Subscriptions
  const accelSub    = useRef<any>(null);
  const gyroSub     = useRef<any>(null);
  const locationSub = useRef<any>(null);
  const timer       = useRef<any>(null);
  

  // ── Timer ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timer.current);
    }
    return () => clearInterval(timer.current);
  }, [isRecording, isPaused]);

  // ── Start Recording ──
  const startRecording = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location access is required to track your trip.');
      return;
    }

    // Reset all data
    accelData.current    = [];
    gyroData.current     = [];
    locationData.current = [];
    harshBrakes.current  = 0;
    harshAccels.current  = 0;
    maxSpeed.current     = 0;
    lastSpeed.current    = 0;
    lastLocation.current = null;
    setElapsed(0);
    setDistance(0);

    // Accelerometer
    Accelerometer.setUpdateInterval(100); // 10 readings/sec
    accelSub.current = Accelerometer.addListener(data => {
      accelData.current.push(data);
      // Detect harsh events
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      if (magnitude > 1.8) harshBrakes.current  += 1;
      if (magnitude > 2.0) harshAccels.current  += 1;
    });

    // Gyroscope
    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener(data => {
      gyroData.current.push(data);
    });

    // Location
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
      loc => {
        const speed = (loc.coords.speed ?? 0) * 3.6; // m/s → km/h
        setCurrentSpeed(Math.round(speed));
        locationData.current.push({ speed, timestamp: loc.timestamp });

        if (speed > maxSpeed.current) maxSpeed.current = speed;

        // Calculate distance
        if (lastLocation.current) {
          const d = haversineDistance(
            lastLocation.current.lat, lastLocation.current.lng,
            loc.coords.latitude, loc.coords.longitude,
          );
          setDistance(prev => prev + d);
        }
        lastLocation.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        lastSpeed.current = speed;
      },
    );

    setIsRecording(true);
    setIsPaused(false);
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
      const token = await AsyncStorage.getItem('access_token');

      const speeds     = locationData.current.map(l => l.speed);
      const avgSpeed   = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const speedVar   = speeds.length ? Math.sqrt(speeds.map(s => (s - avgSpeed) ** 2).reduce((a, b) => a + b, 0) / speeds.length) : 0;
      const overspeed  = speeds.filter(s => s > 120).length / (speeds.length || 1);
      const accel = accelData.current.slice(-100);
      const gyro  = gyroData.current.slice(-100);

      const payload = {
        trip_id:              `trip_${Date.now()}`,
        date:                 new Date().toISOString().split('T')[0],
        accelerometer_data:   accel,
        gyroscope_data:       gyro,
        avg_speed:            Math.round(avgSpeed),
        max_speed:            Math.round(maxSpeed.current),
        distance_km:          Math.round(distance * 10) / 10,
        trip_duration_min:    Math.round(elapsed / 60),
        overspeed_ratio:      Math.round(overspeed * 100) / 100,
        speed_variance:       Math.round(speedVar * 10) / 10,
        harsh_brake_count:    harshBrakes.current,
        harsh_accel_count:    harshAccels.current,
      };

      const res = await fetch(`${BASE_URL}/trips/end`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token?.replace(/"/g, '') ?? ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('Trip Saved! ✅', 'Your trip has been analyzed and saved.', [
          { text: 'View Trips', onPress: () => router.replace('/trips') },
        ]);
      } else {
        throw new Error('Failed to save trip');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Record Trip</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        {/* Timer */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Duration</Text>
          <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
          {isRecording && (
            <View style={styles.recordingDot}>
              <View style={styles.dot} />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="speedometer-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{currentSpeed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{distance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="warning-outline" size={20} color={COLORS.danger} />
            <Text style={styles.statValue}>{harshBrakes.current + harshAccels.current}</Text>
            <Text style={styles.statLabel}>events</Text>
          </View>
        </View>

        {/* Buttons */}
        {!isRecording ? (
          <Pressable style={styles.startBtn} onPress={startRecording}>
            <Ionicons name="play" size={28} color={COLORS.text} />
            <Text style={styles.startBtnText}>Start Trip</Text>
          </Pressable>
        ) : (
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.stopBtn, sending && { opacity: 0.6 }]}
              onPress={stopAndSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color={COLORS.text} />
                : <>
                    <Ionicons name="stop" size={24} color={COLORS.text} />
                    <Text style={styles.stopBtnText}>End Trip</Text>
                  </>
              }
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.mutedDark} />
          <Text style={styles.infoText}>
            Keep the app open while driving. Your trip will be analyzed by AI when you end it.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Haversine distance formula ──
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  title:     { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  content:   { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 16 },

  timerCard:      { backgroundColor: COLORS.surface, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  timerLabel:     { color: COLORS.muted, fontSize: 16, marginBottom: 8 },
  timerValue:     { color: COLORS.text, fontSize: 64, fontWeight: '800', letterSpacing: 2 },
  recordingDot:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot:            { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  recordingText:  { color: COLORS.danger, fontSize: 14, fontWeight: '700' },

  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: COLORS.muted, fontSize: 13 },

  startBtn:     { height: 64, borderRadius: 20, backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  startBtnText: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  controlsRow: { gap: 12 },
  stopBtn:     { height: 64, borderRadius: 20, backgroundColor: COLORS.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  stopBtnText: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.surfaceLight, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  infoText: { color: COLORS.mutedDark, fontSize: 13, lineHeight: 20, flex: 1 },
});