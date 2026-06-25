import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authHeaders, apiGet } from '@/constants/api-client';
import { BottomNavbar } from '@/components/bottom-navbar';
import { BASE_URL } from '@/constants/api';
import { AppColors, useThemeColors } from '@/context/theme-context';

export interface ApiTrip {
  _id: string; user: string; trip_id?: string; date?: string;
  trip_summary?: { distance_km: number; duration_min: number; avg_speed: number; max_speed: number };
  driving_behavior?: { driver_score: number; driver_style: string; harsh_brake_count: number; harsh_accel_count: number };
  vehicle_health?: { vehicle_health_score: number; health_status: string; maintenance_risk: string; engine_health: number; brake_health: number; tire_health: number; alerts: string[] };
  fuel_efficiency?: { actual_fuel_l_100km: number; base_fuel_l_100km: number; efficiency_label: string; trend: string };
  vehicle_info?: { engine_cc: number; engine_power_hp: number; weight_kg: number; fuel_combined_l_100km: number; year: number };
  confirmed: boolean; createdAt: string;
}

function formatDuration(min?: number) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return `${h}h ${m}min`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreLabel(score: number | undefined, COLORS: AppColors): { text: string; color: string } {
  if (!score)      return { text: 'N/A',       color: COLORS.mutedDark };
  if (score >= 90) return { text: 'Excellent',  color: COLORS.green };
  if (score >= 75) return { text: 'Good',        color: COLORS.green };
  if (score >= 60) return { text: 'Fair',        color: COLORS.yellow };
  return { text: 'Poor', color: COLORS.danger };
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  const [trips,       setTrips]       = useState<ApiTrip[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [userId,      setUserId]      = useState('');
  const [totalTrips,  setTotalTrips]  = useState(0);

  const fetchTrips = useCallback(async (pageNum = 1, replace = true) => {
    try {
      pageNum === 1 ? setLoading(true) : setLoadingMore(true);
      const uid = await AsyncStorage.getItem('userId').then(v => v?.replace(/"/g, '') ?? '');
      if (uid) setUserId(uid);
      const data = await apiGet(`/trips/user/${uid}?page=${pageNum}&size=10`);
      const result: ApiTrip[] = data?.data?.trips ?? [];
      setTrips(prev => replace ? result : [...prev, ...result]);
      setTotalTrips(data?.data?.docCount ?? result.length);
      setTotalPages(data?.data?.pages ?? 1);
      setPage(pageNum);
    } catch (err) { console.log('fetchTrips error:', err); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchTrips(1); }, [fetchTrips]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isDark && (
        <LinearGradient colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      )}

      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/account')}>
            <Ionicons name="person-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.divider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
          if (isBottom && !loadingMore && page < totalPages) fetchTrips(page + 1, false);
        }}
        scrollEventThrottle={400}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.totalLabel}>Total Trips</Text>
            <Text style={styles.totalValue}>{totalTrips}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" size="large" style={{ marginTop: 40 }} />
        ) : trips.length > 0 ? (
          <>
            {trips.map(trip => <TripCard key={trip._id} trip={trip} onDeleted={() => fetchTrips(1)} />)}
            {loadingMore && <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} />}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={34} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>Your trip history will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <BottomNavbar activeTab="trips" />
    </View>
  );
}

function TripCard({ trip, onDeleted }: { trip: ApiTrip; onDeleted: () => void }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [showOptions,   setShowOptions]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const score     = trip.driving_behavior?.driver_score;
  const scoreMeta = scoreLabel(score, COLORS);
  const distance  = trip.trip_summary?.distance_km;
  const duration  = trip.trip_summary?.duration_min;
  const avgSpeed  = trip.trip_summary?.avg_speed;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const headers = await authHeaders();
      await fetch(`${BASE_URL}/trips/${trip._id}`, { method: 'DELETE', headers });
      onDeleted();
    } catch (err) { console.log('deleteTrip error:', err); }
    finally { setDeleting(false); setShowOptions(false); setConfirmDelete(false); }
  };

  const handleClose = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <>
      <Pressable style={styles.card} onPress={() => router.push({ pathname: '/trip-details/[id]', params: { id: trip._id } })}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>{formatDate(trip.date ?? trip.createdAt)}</Text>
            {trip.driving_behavior?.driver_style ? <Text style={styles.styleText}>{trip.driving_behavior.driver_style} Driver</Text> : null}
          </View>
          <View style={styles.scoreWrap}>
            {score !== undefined ? (
              <>
                <Text style={styles.scoreText}>{score}</Text>
                <Text style={[styles.scoreLabel, { color: scoreMeta.color }]}>{scoreMeta.text}</Text>
              </>
            ) : <Text style={styles.scoreNA}>N/A</Text>}
          </View>
          <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={12} style={styles.dotsBtn}>
            <Ionicons name="ellipsis-vertical" size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          {distance !== undefined && <View style={styles.metricChip}><Ionicons name="location-outline" size={13} color="#60A5FA" /><Text style={styles.metricChipText}>{distance} km</Text></View>}
          {duration !== undefined && <View style={styles.metricChip}><Ionicons name="time-outline" size={13} color="#60A5FA" /><Text style={styles.metricChipText}>{formatDuration(duration)}</Text></View>}
          {avgSpeed !== undefined && <View style={styles.metricChip}><Ionicons name="speedometer-outline" size={13} color="#60A5FA" /><Text style={styles.metricChipText}>Avg {avgSpeed} km/h</Text></View>}
        </View>

        <View style={styles.badgesRow}>
          {trip.vehicle_health?.health_status && <View style={styles.badge}><Ionicons name="construct-outline" size={12} color={COLORS.green} /><Text style={styles.badgeText}>{trip.vehicle_health.health_status}</Text></View>}
          {trip.fuel_efficiency?.efficiency_label && <View style={styles.badge}><Ionicons name="flash-outline" size={12} color={COLORS.yellow} /><Text style={styles.badgeText}>{trip.fuel_efficiency.efficiency_label} Fuel</Text></View>}
          {!trip.confirmed && <View style={[styles.badge, { borderColor: COLORS.yellow }]}><Text style={[styles.badgeText, { color: COLORS.yellow }]}>Unconfirmed</Text></View>}
        </View>
      </Pressable>

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Trip Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { handleClose(); router.push({ pathname: '/trip-details/[id]', params: { id: trip._id } }); }}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(37,99,235,0.12)' }]}><Ionicons name="eye-outline" size={20} color="#60A5FA" /></View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>View Details</Text><Text style={styles.optionSub}>See full trip analysis</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Trip</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleClose}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={COLORS.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Trip?</Text>
                <Text style={styles.confirmSub}>This trip will be permanently deleted and cannot be recovered.</Text>
                <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
                  {deleting ? <ActivityIndicator color={COLORS.text} size="small" /> : <Text style={styles.deleteBtnText}>Yes, Delete</Text>}
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}><Text style={styles.cancelText}>Go Back</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (COLORS: AppColors) => {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  // Dark-only block colors. Light mode still uses the original theme colors.
  const blockBg      = isDark ? 'rgba(7,16,32,0.90)'    : COLORS.surface;
  const chipBg       = isDark ? 'rgba(10,24,48,0.92)'   : COLORS.surfaceLight;
  const sheetBg      = isDark ? 'rgba(8,18,36,0.98)'    : COLORS.surface;
  const blockBorder  = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.12)';
  const iconBorder   = isDark ? 'rgba(96,165,250,0.20)' : 'rgba(96,165,250,0.25)';

  return StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  scroll:         { flex: 1 },
  content:        { paddingHorizontal: 20, paddingTop: 8 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16 },
  title:          { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: iconBorder, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' },
  divider:        { height: 1, backgroundColor: 'rgba(96,165,250,0.15)' },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel:     { color: COLORS.muted, fontSize: 14 },
  totalValue:     { color: COLORS.text, fontSize: 34, fontWeight: '800', marginTop: 2 },
  card:           { backgroundColor: blockBg, borderWidth: 1, borderColor: blockBorder, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  dateText:       { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  styleText:      { color: COLORS.muted, fontSize: 13, marginTop: 3 },
  scoreWrap:      { alignItems: 'flex-end', marginRight: 4 },
  scoreText:      { color: COLORS.text, fontSize: 32, fontWeight: '800', lineHeight: 34 },
  scoreLabel:     { fontSize: 13, fontWeight: '700' },
  scoreNA:        { color: COLORS.mutedDark, fontSize: 20, fontWeight: '700' },
  dotsBtn:        { padding: 4, marginLeft: 4 },
  metricsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metricChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: chipBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  metricChipText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  badgesRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: isDark ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.15)', backgroundColor: isDark ? 'rgba(10,24,48,0.55)' : 'transparent', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:      { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  emptyCard:      { backgroundColor: blockBg, borderWidth: 1, borderColor: blockBorder, borderRadius: 18, padding: 32, alignItems: 'center', gap: 10, marginTop: 20 },
  emptyTitle:     { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  emptyText:      { color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderWidth: 1, borderColor: blockBorder },
  handle:         { width: 40, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, alignSelf: 'center', marginBottom: 20, opacity: 0.5 },
  sheetTitle:     { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 16 },
  optionRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconWrap:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionText:     { flex: 1 },
  optionLabel:    { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  optionSub:      { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  separator:      { height: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  cancelBtn:      { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' },
  cancelText:     { color: COLORS.muted, fontSize: 15, fontWeight: '700' },
  confirmIcon:    { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  confirmTitle:   { color: COLORS.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  confirmSub:     { color: COLORS.mutedDark, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  deleteBtn:      { height: 50, borderRadius: 14, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:  { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  });
};
