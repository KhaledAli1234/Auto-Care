import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavbar } from '@/components/bottom-navbar';
import { NotificationBell } from '@/components/notification-bell';

const COLORS = {
  background: '#09182d',
  border: 'rgba(255,255,255,0.08)',
  surfaceLight: "#172b44",
  text: '#f8fafc',
  muted: '#b8c3d6',
  primary: '#3f7cff',
  primarySoft: '#5b8cff',
  shadow: 'rgba(41, 98, 255, 0.32)',
};

export default function TrackScreen() {
  const insets = useSafeAreaInsets();

  const handleStartDriving = () => {
    router.push('/record-trip');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Text style={styles.title}>Live Tracking</Text>

        <View style={styles.headerActions}>
          <NotificationBell iconSize={20} color={COLORS.text} />
          <Pressable style={styles.headerIcon} onPress={() => router.push('/account')}>
            <Ionicons name="person-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.orbGlow} />
        <Pressable style={styles.playCircle} onPress={handleStartDriving}>
          <Ionicons name="play-outline" size={110} color={COLORS.text} />
        </Pressable>

        <Text style={styles.heading}>Ready to Drive</Text>
        <Text style={styles.subtitle}>Start tracking to monitor your driving</Text>
        <Text style={styles.subtitle}>performance in real-time</Text>

        <Pressable style={styles.startButton} onPress={handleStartDriving}>
          <Text style={styles.startButtonText}>Start Driving</Text>
        </Pressable>
      </View>

      <BottomNavbar activeTab="track" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header:{ paddingHorizontal: 22,paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: { width: 40, height: 40, borderRadius: 20,borderWidth: 1,backgroundColor: COLORS.surfaceLight,borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 26,
  },
  orbGlow: {
    position: 'absolute',
    top: '22%',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: COLORS.shadow,
    opacity: 0.28,
    transform: [{ scale: 1.28 }],
  },
  playCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primarySoft,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
    marginBottom: 44,
  },
  heading: {
    color: COLORS.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
  },
  startButton: {
    marginTop: 42,
    width: '100%',
    maxWidth: 310,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primarySoft,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  startButtonText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
});