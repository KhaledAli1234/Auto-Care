import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNavbar } from '@/components/bottom-navbar';
import { PressableScale } from '@/components/pressable-scale';
import { apiGet } from '@/constants/api-client';
import { useThemeColors, AppColors } from '@/context/theme-context';
import { NotificationBell } from '@/components/notification-bell';

interface DashboardData {
  totalTrips: number;
  totalDistance: number;
  fuel: { totalCost: number; totalLiters: number; consumption: number };
  maintenance: { totalRecords: number; upcomingCount: number; riskLevel: 'low' | 'medium' | 'high' };
  streak: { safeDriving: number; maintenance: number; badges: number };
  healthScore: number;
  monthlyCost: number;
  monthlyCostByMonth: Record<string, number>;
  avgDriverScore: number;
}

interface Notification {
  id: string; title: string; body: string;
  tone: 'warning' | 'danger' | 'success' | 'info';
  icon: string; time: string;
}

function riskTone(level?: string): 'success' | 'warning' | 'danger' {
  if (level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  return 'success';
}

function healthTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

function toneColor(tone: string, COLORS: AppColors) {
  if (tone === 'success') return COLORS.success;
  if (tone === 'warning') return COLORS.warning;
  if (tone === 'danger')  return COLORS.danger;
  return '#60A5FA';
}

function trendIcon(tone: string) {
  if (tone === 'success') return 'trending-up'   as const;
  if (tone === 'danger')  return 'trending-down'  as const;
  return 'remove' as const;
}

function buildNotifications(d: DashboardData): Notification[] {
  const notes: Notification[] = [];
  if (d.maintenance.riskLevel === 'high')
    notes.push({ id: 'maint-high', title: 'High Maintenance Risk', body: `You have ${d.maintenance.upcomingCount} upcoming maintenance tasks. Schedule service soon.`, tone: 'danger', icon: 'build-outline', time: 'Now' });
  else if (d.maintenance.riskLevel === 'medium')
    notes.push({ id: 'maint-med', title: 'Maintenance Due Soon', body: `${d.maintenance.upcomingCount} maintenance tasks coming up. Stay on schedule.`, tone: 'warning', icon: 'build-outline', time: 'Now' });
  if (d.healthScore < 60)
    notes.push({ id: 'health-low', title: 'Vehicle Health Alert', body: `Your health score is ${d.healthScore}/100. Check fuel consumption and maintenance records.`, tone: 'danger', icon: 'pulse-outline', time: 'Now' });
  else if (d.healthScore < 80)
    notes.push({ id: 'health-med', title: 'Health Score Declining', body: `Your vehicle health is at ${d.healthScore}/100. Consider reviewing driving habits.`, tone: 'warning', icon: 'pulse-outline', time: 'Now' });
  if (d.fuel.consumption > 12)
    notes.push({ id: 'fuel-high', title: 'High Fuel Consumption', body: `Consuming ${d.fuel.consumption} L/100km. Aggressive driving or maintenance needed.`, tone: 'warning', icon: 'water-outline', time: 'Now' });
  if (d.streak.safeDriving >= 7)
    notes.push({ id: 'streak-good', title: '🔥 Safe Driving Streak', body: `${d.streak.safeDriving} days of safe driving! Keep it up.`, tone: 'success', icon: 'shield-checkmark-outline', time: 'Now' });
  if (d.totalTrips === 0)
    notes.push({ id: 'no-trips', title: 'No Trips Recorded', body: 'Start your first trip to see driving insights and scores.', tone: 'info', icon: 'car-outline', time: 'Now' });
  return notes;
}

function TrendRow({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const color = toneColor(tone, COLORS);
  return (
    <View style={styles.trendRow}>
      <Ionicons name={trendIcon(tone)} size={15} color={color} />
      <Text style={[styles.trendText, { color }]}>{label}</Text>
    </View>
  );
}

function MetricCard({ title, value, unit, icon, trendLabel, trendTone, description, onPress }: {
  title: string; value: string; unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
  trendLabel: string; trendTone: 'success' | 'warning' | 'danger';
  description: string; onPress?: () => void;
}) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <PressableScale style={styles.metricCard} onPress={onPress}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>{title}</Text>
        <Ionicons name={icon} size={16} color="#60A5FA" />
      </View>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
      <TrendRow label={trendLabel} tone={trendTone} />
      <Text style={styles.metricDescription}>{description}</Text>
    </PressableScale>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  const [dashboard,      setDashboard]      = useState<DashboardData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [userId,         setUserId]         = useState('');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications,  setNotifications]  = useState<Notification[]>([]);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const uid = await AsyncStorage.getItem('userId').then(v => v?.replace(/"/g, '') ?? '');
      if (uid) setUserId(uid);
      const data = await apiGet(`/dashboard/${uid}`);
      const d: DashboardData = data?.data?.dashboard;
      if (d) { setDashboard(d); setNotifications(buildNotifications(d)); }
    } catch (err) { console.log('dashboard error:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  const d = dashboard;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* gradient background — dark mode only */}
      {isDark && (
        <LinearGradient
          colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <View style={styles.headerActions}>
        <NotificationBell color={COLORS.text} />
          <PressableScale style={styles.headerIcon} onPress={() => router.push('/account')}>
            <Ionicons name="person-outline" size={20} color={COLORS.text} />
          </PressableScale>
        </View>
      </View>
      <View style={styles.divider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboard(true)} tintColor="#2563EB" />}
      >
        {/* ── MAINTENANCE ALERT ── */}
        {d && d.maintenance.upcomingCount > 0 && (
          <PressableScale style={styles.alertCard} scaleTo={0.985} onPress={() => router.push('/maintenance-baseline')}>
            <View style={styles.alertTitleRow}>
              <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
              <Text style={styles.alertTitle}>Maintenance Alert</Text>
            </View>
            <Text style={styles.alertBody}>
              {d.maintenance.upcomingCount} upcoming maintenance task{d.maintenance.upcomingCount > 1 ? 's' : ''}. Risk level is{' '}
              <Text style={{ color: toneColor(riskTone(d.maintenance.riskLevel), COLORS), fontWeight: '700' }}>
                {d.maintenance.riskLevel.toUpperCase()}
              </Text>. Schedule service soon.
            </Text>
          </PressableScale>
        )}

        {/* ── METRICS GRID ── */}
        {d ? (
          <View style={styles.metricsGrid}>
            <MetricCard title="Health Score" value={`${d.healthScore}`} unit="/100" icon="pulse-outline"
              trendLabel={d.healthScore >= 80 ? 'Good' : d.healthScore >= 60 ? 'Fair' : 'Poor'}
              trendTone={healthTone(d.healthScore)}
              description={d.healthScore >= 80 ? 'All systems performing well.' : d.healthScore >= 60 ? 'Some areas need attention.' : 'Immediate attention recommended.'} />
            <MetricCard title="Fuel Efficiency" value={d.fuel.consumption > 0 ? `${d.fuel.consumption}` : '—'} unit={d.fuel.consumption > 0 ? 'L/100km' : ''} icon="water-outline"
              trendLabel={d.fuel.consumption > 12 ? 'High' : d.fuel.consumption > 8 ? 'Average' : d.fuel.consumption > 0 ? 'Efficient' : 'No data'}
              trendTone={d.fuel.consumption > 12 ? 'danger' : d.fuel.consumption > 8 ? 'warning' : 'success'}
              description={d.fuel.consumption === 0 ? 'Log fuel entries to track efficiency.' : d.fuel.consumption > 12 ? 'Higher than average. Check driving habits.' : 'Fuel efficiency is looking good.'} />
            <MetricCard title="Maintenance Risk" value={d.maintenance.riskLevel.charAt(0).toUpperCase() + d.maintenance.riskLevel.slice(1)} icon="build-outline"
              trendLabel={`${d.maintenance.upcomingCount} upcoming`} trendTone={riskTone(d.maintenance.riskLevel)}
              description={d.maintenance.totalRecords === 0 ? 'No maintenance records yet.' : `${d.maintenance.totalRecords} total records. ${d.maintenance.upcomingCount} upcoming.`} />
            <MetricCard title="Avg Driver Score" value={d.avgDriverScore > 0 ? `${d.avgDriverScore}` : '—'} unit={d.avgDriverScore > 0 ? '/100' : ''} icon="speedometer-outline"
              trendLabel={d.avgDriverScore >= 80 ? 'Safe Driver' : d.avgDriverScore >= 60 ? 'Normal' : 'Needs Improvement'}
              trendTone={d.avgDriverScore >= 80 ? 'success' : d.avgDriverScore >= 60 ? 'warning' : 'danger'}
              description={d.avgDriverScore === 0 ? 'Complete trips to see your score.' : d.avgDriverScore >= 80 ? 'Great driving habits!' : d.avgDriverScore >= 60 ? 'Room for improvement.' : 'Consider safer driving habits.'} />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptyText}>Start logging trips and fuel to see your dashboard.</Text>
          </View>
        )}

        {/* ── DRIVING STREAK ── */}
        {d && (
          <PressableScale style={styles.streakCard} scaleTo={0.985} onPress={() => router.push('/track')}>
            <View style={styles.streakTopRow}>
              <View>
                <Text style={styles.streakLabel}>Safe Driving Streak</Text>
                <Text style={styles.streakValue}>{d.streak.safeDriving}<Text style={styles.streakUnit}> days</Text></Text>
              </View>
              <View style={styles.streakIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.success} />
              </View>
            </View>
            <View style={styles.streakBarTrack}>
              <View style={[styles.streakBarFill, { width: `${Math.min((d.streak.safeDriving / 30) * 100, 100)}%` as any }]} />
            </View>
            <View style={styles.streakBottomRow}>
              <Text style={styles.streakDescription}>
                {d.streak.safeDriving === 0 ? 'Start your safe driving streak today!' : d.streak.safeDriving >= 14 ? '🔥 Excellent! Keep the streak alive.' : 'Great start! Aim for 14 days.'}
              </Text>
              {d.streak.badges > 0 && (
                <View style={styles.badgesChip}>
                  <Ionicons name="medal-outline" size={13} color={COLORS.warning} />
                  <Text style={styles.badgesChipText}>{d.streak.badges} badges</Text>
                </View>
              )}
            </View>
          </PressableScale>
        )}

        {/* ── BOTTOM STATS ── */}
        {d && (
          <View style={styles.bottomStatsRow}>
            <PressableScale style={styles.bottomStatCard} onPress={() => router.push('/trips')}>
              <Text style={styles.bottomStatTitle}>Total Trips</Text>
              <Text style={styles.bottomStatValue}>{d.totalTrips}</Text>
              <Text style={styles.bottomStatUnit}>recorded</Text>
            </PressableScale>
            <PressableScale style={styles.bottomStatCard} onPress={() => router.push('/trips')}>
              <Text style={styles.bottomStatTitle}>Distance</Text>
              <Text style={styles.bottomStatValue}>{d.totalDistance > 999 ? `${(d.totalDistance / 1000).toFixed(1)}k` : d.totalDistance}</Text>
              <Text style={styles.bottomStatUnit}>km total</Text>
            </PressableScale>
            <PressableScale style={styles.bottomStatCard}>
              <Text style={styles.bottomStatTitle}>Maintenance</Text>
              <Text style={styles.bottomStatValue}>{d.streak.maintenance}</Text>
              <Text style={styles.bottomStatUnit}>streak days</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>

      <BottomNavbar activeTab="home" />

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal visible={showNotifModal} transparent animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifModal(false)} />
        <View style={[styles.notifSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>Notifications</Text>
            <PressableScale onPress={() => setShowNotifModal(false)} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </PressableScale>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.length > 0 ? notifications.map(n => (
              <View key={n.id} style={[styles.notifItem, { borderLeftColor: toneColor(n.tone, COLORS) }]}>
                <View style={[styles.notifIconWrap, { backgroundColor: `${toneColor(n.tone, COLORS)}18` }]}>
                  <Ionicons name={n.icon as any} size={20} color={toneColor(n.tone, COLORS)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifItemTitle}>{n.title}</Text>
                  <Text style={styles.notifItemBody}>{n.body}</Text>
                  <Text style={styles.notifItemTime}>{n.time}</Text>
                </View>
              </View>
            )) : (
              <View style={styles.notifEmpty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.success} />
                <Text style={styles.notifEmptyText}>All clear! No alerts right now.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS: AppColors) => {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  // Dark-only block colors. Light mode still uses the original theme colors.
  const blockBg       = isDark ? 'rgba(7,16,32,0.90)'       : COLORS.card;
  const blockSoftBg   = isDark ? 'rgba(9,21,42,0.88)'       : COLORS.cardSoft;
  const smallBlockBg  = isDark ? 'rgba(10,24,48,0.92)'      : COLORS.surfaceLight;
  const modalBg       = isDark ? 'rgba(8,18,36,0.98)'       : COLORS.surface;
  const blockBorder   = isDark ? 'rgba(96,165,250,0.18)'    : 'rgba(96,165,250,0.12)';
  const softBorder    = isDark ? 'rgba(96,165,250,0.16)'    : COLORS.border;
  const dividerColor  = isDark ? 'rgba(96,165,250,0.18)'    : 'rgba(96,165,250,0.15)';
  const alertBg       = isDark ? 'rgba(56,43,12,0.72)'      : 'rgba(245,200,76,0.07)';
  const alertBorder   = isDark ? 'rgba(245,200,76,0.28)'    : 'rgba(245,200,76,0.22)';
  const streakTrackBg = isDark ? 'rgba(148,163,184,0.18)'   : COLORS.divider;

  return StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  scroll:             { flex: 1 },
  content:            { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  title:              { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  headerActions:      { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1, backgroundColor: smallBlockBg, borderColor: isDark ? 'rgba(96,165,250,0.22)' : 'rgba(96,165,250,0.25)', alignItems: 'center', justifyContent: 'center' },
  divider:            { height: 1, backgroundColor: dividerColor },

  alertCard:          { backgroundColor: alertBg, borderWidth: 1, borderColor: alertBorder, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14 },
  alertTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  alertTitle:         { color: COLORS.warning, fontSize: 17, fontWeight: '700' },
  alertBody:          { color: COLORS.muted, lineHeight: 20, fontSize: 14 },

  metricsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard:         { width: '48%', flexGrow: 1, backgroundColor: blockBg, borderRadius: 18, borderWidth: 1, borderColor: blockBorder, padding: 12, minHeight: 168 },
  metricHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  metricTitle:        { color: COLORS.muted, fontSize: 14, fontWeight: '500' },
  metricValueRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  metricValue:        { color: COLORS.text, fontSize: 34, fontWeight: '700' },
  metricUnit:         { color: COLORS.muted, fontSize: 15, marginBottom: 5, fontWeight: '600' },
  trendRow:           { marginTop: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendText:          { fontSize: 15, fontWeight: '700' },
  metricDescription:  { color: COLORS.muted, fontSize: 13, lineHeight: 18 },

  streakCard:         { borderRadius: 16, borderWidth: 1, borderColor: blockBorder, backgroundColor: blockBg, padding: 16 },
  streakTopRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  streakLabel:        { color: COLORS.muted, fontSize: 14, marginBottom: 4 },
  streakValue:        { color: COLORS.text, fontSize: 44, fontWeight: '700' },
  streakUnit:         { color: COLORS.muted, fontSize: 18, fontWeight: '500' },
  streakIconWrap:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(51,209,122,0.12)' },
  streakBarTrack:     { height: 8, backgroundColor: streakTrackBg, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  streakBarFill:      { height: '100%', backgroundColor: COLORS.success, borderRadius: 4 },
  streakBottomRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakDescription:  { color: COLORS.muted, fontSize: 14, lineHeight: 20, flex: 1, marginRight: 8 },
  badgesChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,200,76,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgesChipText:     { color: COLORS.warning, fontSize: 12, fontWeight: '700' },

  bottomStatsRow:     { flexDirection: 'row', gap: 10, marginTop: 2 },
  bottomStatCard:     { flex: 1, borderRadius: 12, backgroundColor: blockBg, borderWidth: 1, borderColor: blockBorder, paddingVertical: 12, paddingHorizontal: 10 },
  bottomStatTitle:    { color: COLORS.muted, fontSize: 12, marginBottom: 4 },
  bottomStatValue:    { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  bottomStatUnit:     { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  emptyCard:          { backgroundColor: blockSoftBg, borderWidth: 1, borderColor: softBorder, borderRadius: 18, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle:         { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  emptyText:          { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  modalBackdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  notifSheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: modalBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '75%', borderWidth: 1, borderColor: softBorder },
  sheetHandle:        { width: 40, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, alignSelf: 'center', marginBottom: 16, opacity: 0.5 },
  notifHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  notifTitle:         { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  closeBtn:           { width: 32, height: 32, borderRadius: 16, backgroundColor: smallBlockBg, alignItems: 'center', justifyContent: 'center' },
  notifItem:          { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: dividerColor, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 2 },
  notifIconWrap:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifItemTitle:     { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  notifItemBody:      { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  notifItemTime:      { color: COLORS.mutedDark, fontSize: 11, marginTop: 4 },
  notifEmpty:         { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifEmptyText:     { color: COLORS.muted, fontSize: 15 },
  });
};