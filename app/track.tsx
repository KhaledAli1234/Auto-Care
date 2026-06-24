import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavbar } from '@/components/bottom-navbar';
import { NotificationBell } from '@/components/notification-bell';
import { AppColors, useThemeColors } from '@/context/theme-context';

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isDark && (
        <LinearGradient colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      )}

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
        <Pressable style={styles.playCircle} onPress={() => router.push('/record-trip')}>
          <Ionicons name="play-outline" size={110} color={COLORS.text} />
        </Pressable>
        <Text style={styles.heading}>Ready to Drive</Text>
        <Text style={styles.subtitle}>Start tracking to monitor your driving</Text>
        <Text style={styles.subtitle}>performance in real-time</Text>
        <Pressable style={styles.startButton} onPress={() => router.push('/record-trip')}>
          <Text style={styles.startButtonText}>Start Driving</Text>
        </Pressable>
      </View>

      <BottomNavbar activeTab="track" />
    </View>
  );
}

const createStyles = (COLORS: AppColors) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:           { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon:      { width: 40, height: 40, borderRadius: 20, borderWidth: 1, backgroundColor: COLORS.surfaceLight, borderColor: 'rgba(96,165,250,0.25)', alignItems: 'center', justifyContent: 'center' },
  divider:         { height: 1, backgroundColor: 'rgba(96,165,250,0.15)' },
  content:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 26 },
  orbGlow:         { position: 'absolute', top: '22%', width: 310, height: 310, borderRadius: 155, backgroundColor: COLORS.primarySoft, opacity: 0.28, transform: [{ scale: 1.28 }] },
  playCircle:      { width: 230, height: 230, borderRadius: 115, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 14, marginBottom: 44 },
  heading:         { color: COLORS.text, fontSize: 34, lineHeight: 40, fontWeight: '800', textAlign: 'center', marginBottom: 18 },
  subtitle:        { color: COLORS.muted, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  startButton:     { marginTop: 42, width: '100%', maxWidth: 310, borderRadius: 22, backgroundColor: COLORS.primary, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  startButtonText: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
});