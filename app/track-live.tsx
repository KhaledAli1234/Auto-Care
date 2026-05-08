import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LocationObject, LocationSubscription } from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavbar } from '@/components/bottom-navbar';

const COLORS = {
  background: '#09182d',
  backgroundSoft: '#122745',
  border: 'rgba(255,255,255,0.08)',
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceInKm(from: LocationObject, to: LocationObject) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.coords.latitude - from.coords.latitude);
  const deltaLon = toRadians(to.coords.longitude - from.coords.longitude);
  const startLat = toRadians(from.coords.latitude);
  const endLat = toRadians(to.coords.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(remainingSeconds).padStart(2, '0');

  return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatDistance(distanceInKm: number) {
  if (distanceInKm >= 10) return distanceInKm.toFixed(0);
  if (distanceInKm >= 1) return distanceInKm.toFixed(1);
  return distanceInKm.toFixed(2);
}

export default function TrackLiveScreen() {
  const insets = useSafeAreaInsets();
  const [speedKmh, setSpeedKmh] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchRef = useRef<LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const previousLocationRef = useRef<LocationObject | null>(null);

  const statusText = useMemo(() => {
    if (errorMessage) return 'GPS Permission Needed';
    if (isStarting) return 'Starting GPS...';
    if (trackingActive) return 'Driving Detected';
    return 'Tracking Stopped';
  }, [errorMessage, isStarting, trackingActive]);

  useEffect(() => {
    const startTracking = async () => {
      try {
        setIsStarting(true);
        setErrorMessage(null);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMessage('Location permission was denied.');
          Alert.alert(
            'Location permission required',
            'Please allow location access so the app can track your trip and speed.'
          );
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setErrorMessage('Please turn on GPS or Location Services on your phone.');
          Alert.alert(
            'Location services are off',
            'Turn on GPS or Location Services, then open the tracking screen again.'
          );
          return;
        }

        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            // User may keep current provider settings; foreground GPS tracking can still continue.
          }
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        previousLocationRef.current = currentLocation;
        startTimeRef.current = Date.now();
        setSpeedKmh(Math.max(0, Math.round((currentLocation.coords.speed ?? 0) * 3.6)));
        setDistanceKm(0);
        setElapsedSeconds(0);
        setTrackingActive(true);

        timerRef.current = setInterval(() => {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 1,
            mayShowUserSettingsDialog: true,
          },
          (nextLocation) => {
            const previousLocation = previousLocationRef.current;

            if (previousLocation) {
              const segmentDistanceKm = calculateDistanceInKm(previousLocation, nextLocation);
              if (Number.isFinite(segmentDistanceKm) && segmentDistanceKm > 0.0005) {
                setDistanceKm((currentDistance) => currentDistance + segmentDistanceKm);
              }
            }

            const reportedSpeedMetersPerSecond = nextLocation.coords.speed ?? 0;
            let nextSpeedKmh = reportedSpeedMetersPerSecond > 0
              ? reportedSpeedMetersPerSecond * 3.6
              : 0;

            if (nextSpeedKmh === 0 && previousLocation) {
              const timeDeltaSeconds =
                (new Date(nextLocation.timestamp).getTime() -
                  new Date(previousLocation.timestamp).getTime()) /
                1000;

              if (timeDeltaSeconds > 0) {
                const segmentDistanceKm = calculateDistanceInKm(previousLocation, nextLocation);
                nextSpeedKmh = (segmentDistanceKm / timeDeltaSeconds) * 3600;
              }
            }

            setSpeedKmh(Math.max(0, Math.round(nextSpeedKmh)));
            previousLocationRef.current = nextLocation;
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start GPS tracking.';
        setErrorMessage(message);
        Alert.alert('Tracking error', message);
      } finally {
        setIsStarting(false);
      }
    };

    void startTracking();

    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleStopTracking = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setTrackingActive(false);
    router.replace('/track');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Text style={styles.title}>Live Tracking</Text>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/account')}>
            <Ionicons name="person-outline" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.speedGlow} />

        <View style={styles.speedCircle}>
          {isStarting ? (
            <ActivityIndicator size="large" color={COLORS.text} />
          ) : (
            <>
              <Text style={styles.speedValue}>{speedKmh}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </>
          )}
        </View>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, errorMessage && styles.statusDotError]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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

        <Pressable style={styles.stopButton} onPress={handleStopTracking}>
          <Ionicons name="stop-outline" size={28} color={COLORS.red} />
          <Text style={styles.stopButtonText}>Stop Tracking</Text>
        </Pressable>
      </ScrollView>

      <BottomNavbar activeTab="track" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingBottom: 26,
    paddingTop: 28,
  },
  speedGlow: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.primarySoft,
    opacity: 0.8,
    transform: [{ scale: 1.4 }],
  },
  speedCircle: {
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(9, 24, 45, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 76,
  },
  speedValue: {
    color: COLORS.text,
    fontSize: 84,
    fontWeight: '800',
    lineHeight: 90,
  },
  speedUnit: {
    color: COLORS.muted,
    fontSize: 26,
    fontWeight: '400',
    marginTop: 6,
  },
  statusPill: {
    marginTop: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(0,213,111,0.28)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  statusDotError: {
    backgroundColor: COLORS.red,
  },
  statusText: {
    color: '#d3ffdd',
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    color: '#ffb3bc',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(18, 39, 69, 0.84)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 16,
    marginTop: 8,
  },
  stopButton: {
    marginTop: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,93,108,0.45)',
    backgroundColor: COLORS.redSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 22,
  },
  stopButtonText: {
    color: COLORS.red,
    fontSize: 20,
    fontWeight: '700',
  },
});
