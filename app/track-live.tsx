import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LocationObject, LocationSubscription } from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavbar } from '@/components/bottom-navbar';
import { NotificationBell } from '@/components/notification-bell';

const COLORS = {
  background: '#09182d',
  backgroundSoft: '#122745',
  border: 'rgba(255,255,255,0.08)',
  surfaceLight: '#172b44',
  text: '#f8fafc',
  muted: '#b8c3d6',
  primary: '#2f6dff',
  primarySoft: 'rgba(47,109,255,0.20)',
  green: '#00d56f',
  greenSoft: 'rgba(0, 213, 111, 0.16)',
  red: '#ff5d6c',
  redSoft: 'rgba(255, 93, 108, 0.18)',
  yellow: '#ffd400',
};

function toRadians(v: number) { return (v * Math.PI) / 180; }

function calculateDistanceInKm(from: LocationObject, to: LocationObject) {
  const R = 6371;
  const dLat = toRadians(to.coords.latitude - from.coords.latitude);
  const dLon = toRadians(to.coords.longitude - from.coords.longitude);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRadians(from.coords.latitude)) * Math.cos(toRadians(to.coords.latitude)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDuration(s: number) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDistance(km: number) {
  if (km >= 10) return km.toFixed(0);
  if (km >= 1)  return km.toFixed(1);
  return km.toFixed(2);
}

export default function TrackLiveScreen() {
  const insets = useSafeAreaInsets();
  const [speedKmh,       setSpeedKmh]       = useState(0);
  const [distanceKm,     setDistanceKm]     = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStarting,     setIsStarting]     = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const [errorMessage,   setErrorMessage]   = useState<string | null>(null);

  const watchRef    = useRef<LocationSubscription | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const prevLocRef  = useRef<LocationObject | null>(null);

  const statusText = useMemo(() => {
    if (errorMessage)   return 'GPS Permission Needed';
    if (isStarting)     return 'Starting GPS...';
    if (trackingActive) return 'Driving Detected';
    return 'Tracking Stopped';
  }, [errorMessage, isStarting, trackingActive]);

  useEffect(() => {
    const start = async () => {
      try {
        setIsStarting(true);
        setErrorMessage(null);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setErrorMessage('Location permission was denied.'); Alert.alert('Permission required', 'Please allow location access.'); return; }
        const ok = await Location.hasServicesEnabledAsync();
        if (!ok) { setErrorMessage('Please turn on GPS.'); Alert.alert('Location off', 'Turn on GPS then reopen.'); return; }
        if (Platform.OS === 'android') { try { await Location.enableNetworkProviderAsync(); } catch {} }

        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        prevLocRef.current = cur;
        startTimeRef.current = Date.now();
        setSpeedKmh(Math.max(0, Math.round((cur.coords.speed ?? 0) * 3.6)));
        setDistanceKm(0); setElapsedSeconds(0); setTrackingActive(true);

        timerRef.current = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);

        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 1, mayShowUserSettingsDialog: true },
          (next) => {
            const prev = prevLocRef.current;
            if (prev) {
              const d = calculateDistanceInKm(prev, next);
              if (Number.isFinite(d) && d > 0.0005) setDistanceKm(cur => cur + d);
            }
            let spd = (next.coords.speed ?? 0) > 0 ? next.coords.speed! * 3.6 : 0;
            if (spd === 0 && prev) {
              const dt = (new Date(next.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
              if (dt > 0) spd = (calculateDistanceInKm(prev, next) / dt) * 3600;
            }
            setSpeedKmh(Math.max(0, Math.round(spd)));
            prevLocRef.current = next;
          }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unable to start GPS.';
        setErrorMessage(msg); Alert.alert('Tracking error', msg);
      } finally { setIsStarting(false); }
    };
    void start();
    return () => {
      watchRef.current?.remove(); watchRef.current = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, []);

  const handleStop = () => {
    watchRef.current?.remove(); watchRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTrackingActive(false);
    router.replace('/track');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Tracking</Text>
        <View style={styles.headerActions}>
          <NotificationBell iconSize={22} color={COLORS.text} />
          <Pressable style={styles.headerIcon} onPress={() => router.push('/account')}>
            <Ionicons name="person-outline" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.speedGlow} />
        <View style={styles.speedCircle}>
          {isStarting ? <ActivityIndicator size="large" color={COLORS.text} /> : (
            <><Text style={styles.speedValue}>{speedKmh}</Text><Text style={styles.speedUnit}>km/h</Text></>
          )}
        </View>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, !!errorMessage && styles.statusDotError]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{formatDistance(distanceKm)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle-outline" size={28} color={COLORS.yellow} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>

        <Pressable style={styles.stopButton} onPress={handleStop}>
          <Ionicons name="stop-outline" size={28} color={COLORS.red} />
          <Text style={styles.stopButtonText}>Stop Tracking</Text>
        </Pressable>
      </ScrollView>

      <BottomNavbar activeTab="track" />
    </View>
  );
}
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  headerActions:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  divider:      { height: 1, backgroundColor: COLORS.border },
  scrollContent:{ flexGrow: 1, paddingHorizontal: 26, paddingBottom: 26, paddingTop: 28 },
  speedGlow:    { position: 'absolute', top: 120, alignSelf: 'center', width: 320, height: 320, borderRadius: 160, backgroundColor: COLORS.primarySoft, opacity: 0.8, transform: [{ scale: 1.4 }] },
  speedCircle:  { alignSelf: 'center', width: 320, height: 320, borderRadius: 160, borderWidth: 5, borderColor: COLORS.primary, backgroundColor: 'rgba(9,24,45,0.56)', alignItems: 'center', justifyContent: 'center', marginTop: 76 },
  speedValue:   { color: COLORS.text, fontSize: 84, fontWeight: '800', lineHeight: 90 },
  speedUnit:    { color: COLORS.muted, fontSize: 26, fontWeight: '400', marginTop: 6 },
  statusPill:   { marginTop: 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 999, backgroundColor: COLORS.greenSoft, borderWidth: 1, borderColor: 'rgba(0,213,111,0.28)', paddingHorizontal: 20, paddingVertical: 14 },
  statusDot:    { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.green },
  statusDotError:{ backgroundColor: COLORS.red },
  statusText:   { color: '#d3ffdd', fontSize: 17, fontWeight: '700' },
  errorText:    { color: '#ffb3bc', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 14, paddingHorizontal: 10 },
  statsRow:     { flexDirection: 'row', gap: 14, marginTop: 28 },
  statCard:     { flex: 1, borderRadius: 22, paddingVertical: 22, paddingHorizontal: 10, backgroundColor: 'rgba(18,39,69,0.84)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', minHeight: 130 },
  statValue:    { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 12 },
  statLabel:    { color: COLORS.muted, fontSize: 16, marginTop: 8 },
  stopButton:   { marginTop: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,93,108,0.45)', backgroundColor: COLORS.redSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 22 },
  stopButtonText:{ color: COLORS.red, fontSize: 20, fontWeight: '700' },
});