import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavbar } from '@/components/bottom-navbar';
import { BASE_URL } from '@/constants/api';
import { authHeaders } from '@/constants/api-client';
import { AppColors, useThemeColors } from '@/context/theme-context';
import { ApiTrip } from '../trips';

function formatDuration(min?: number) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function scoreLabel(score: number | undefined, COLORS: AppColors): { text: string; color: string } {
  if (!score)      return { text: 'N/A',      color: COLORS.mutedDark };
  if (score >= 90) return { text: 'Excellent', color: COLORS.green };
  if (score >= 75) return { text: 'Good',       color: COLORS.green };
  if (score >= 60) return { text: 'Fair',        color: COLORS.yellow };
  return { text: 'Poor', color: COLORS.danger };
}

function healthColor(score: number | undefined, COLORS: AppColors) {
  if (!score)      return COLORS.mutedDark;
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.yellow;
  return COLORS.danger;
}

function scoreCardBackground(score: number | undefined, COLORS: AppColors) {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');
  if (!score)      return isDark ? 'rgba(7,16,32,0.90)' : COLORS.surface;
  if (score >= 75) return isDark ? 'rgba(37,99,235,0.38)' : COLORS.primary;
  if (score >= 60) return isDark ? 'rgba(245,158,11,0.32)' : COLORS.warning;
  return isDark ? 'rgba(239,68,68,0.34)' : COLORS.danger;
}

export default function TripDetailsScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip,    setTrip]    = useState<ApiTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const headers = await authHeaders();
        const res  = await fetch(`${BASE_URL}/trips/${id}`, { headers });
        const text = await res.text();
        const json = JSON.parse(text);
        if (!res.ok) throw new Error(json?.message ?? 'Failed to load trip');
        setTrip(json?.data?.trip ?? json?.data ?? null);
      } catch (err: any) { setError(err.message ?? 'Something went wrong'); }
      finally { setLoading(false); }
    };
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Trip not found.'}</Text>
        <Pressable style={styles.backAction} onPress={() => router.back()}>
          <Text style={styles.backActionText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const score     = trip.driving_behavior?.driver_score;
  const scoreMeta = scoreLabel(score, COLORS);
  const scoreBg   = scoreCardBackground(score, COLORS);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isDark && (
        <LinearGradient colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      )}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          <Text style={styles.backText}>Back to Trips</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Trip Details</Text>
        <Text style={styles.dateSubtitle}>{formatDate(trip.date ?? trip.createdAt)}</Text>

        {/* Driving Score */}
        <View style={[styles.scoreCard, { backgroundColor: scoreBg }]}>
          <Text style={styles.scoreCardLabel}>Driving Score</Text>
          <Text style={styles.scoreCardValue}>{score ?? '—'}</Text>
          <Text style={styles.scoreCardStatus}>{scoreMeta.text}</Text>
          {trip.driving_behavior?.driver_style && <Text style={styles.scoreCardStyle}>{trip.driving_behavior.driver_style} Driver</Text>}
        </View>

        {/* Trip Summary */}
        {trip.trip_summary && (
          <>
            <Text style={styles.sectionTitle}>Trip Summary</Text>
            <View style={styles.metricsGrid}>
              <MetricCard label="Distance"  value={`${trip.trip_summary.distance_km} km`}    icon="location-outline"    styles={styles} COLORS={COLORS} />
              <MetricCard label="Duration"  value={formatDuration(trip.trip_summary.duration_min)} icon="time-outline"   styles={styles} COLORS={COLORS} />
              <MetricCard label="Avg Speed" value={`${trip.trip_summary.avg_speed} km/h`}    icon="speedometer-outline" styles={styles} COLORS={COLORS} />
              <MetricCard label="Max Speed" value={`${trip.trip_summary.max_speed} km/h`}    icon="trending-up-outline" styles={styles} COLORS={COLORS} />
            </View>
          </>
        )}

        {/* Driving Behavior */}
        {trip.driving_behavior && (
          <>
            <Text style={styles.sectionTitle}>Driving Behavior</Text>
            <View style={styles.card}>
              <BehaviorRow label="Harsh Brakes"        value={trip.driving_behavior.harsh_brake_count} icon="warning-outline" good={trip.driving_behavior.harsh_brake_count === 0} styles={styles} COLORS={COLORS} />
              <View style={styles.rowDivider} />
              <BehaviorRow label="Harsh Accelerations" value={trip.driving_behavior.harsh_accel_count} icon="flash-outline"   good={trip.driving_behavior.harsh_accel_count === 0} styles={styles} COLORS={COLORS} />
            </View>
          </>
        )}

        {/* Vehicle Health */}
        {trip.vehicle_health && (
          <>
            <Text style={styles.sectionTitle}>Vehicle Health</Text>
            <View style={styles.card}>
              <View style={styles.healthOverviewRow}>
                <View>
                  <Text style={styles.healthStatusText}>{trip.vehicle_health.health_status}</Text>
                  <Text style={styles.healthRiskText}>Risk: {trip.vehicle_health.maintenance_risk}</Text>
                </View>
                <Text style={[styles.healthScore, { color: healthColor(trip.vehicle_health.vehicle_health_score, COLORS) }]}>{trip.vehicle_health.vehicle_health_score}</Text>
              </View>
              <View style={styles.rowDivider} />
              <HealthBar label="Engine" value={trip.vehicle_health.engine_health} styles={styles} COLORS={COLORS} />
              <HealthBar label="Brakes" value={trip.vehicle_health.brake_health} styles={styles} COLORS={COLORS} />
              <HealthBar label="Tires"  value={trip.vehicle_health.tire_health}  styles={styles} COLORS={COLORS} />
              {trip.vehicle_health.alerts.length > 0 && (
                <>
                  <View style={styles.rowDivider} />
                  <Text style={styles.alertsLabel}>⚠️ Alerts</Text>
                  {trip.vehicle_health.alerts.map((alert, i) => <Text key={i} style={styles.alertText}>• {alert}</Text>)}
                </>
              )}
            </View>
          </>
        )}

        {/* Fuel Efficiency */}
        {trip.fuel_efficiency && (
          <>
            <Text style={styles.sectionTitle}>Fuel Efficiency</Text>
            <View style={styles.card}>
              <View style={styles.fuelRow}>
                <View style={styles.fuelItem}>
                  <Text style={styles.fuelLabel}>Actual</Text>
                  <Text style={styles.fuelValue}>{trip.fuel_efficiency.actual_fuel_l_100km} L/100km</Text>
                </View>
                <View style={styles.fuelDivider} />
                <View style={styles.fuelItem}>
                  <Text style={styles.fuelLabel}>Baseline</Text>
                  <Text style={styles.fuelValue}>{trip.fuel_efficiency.base_fuel_l_100km} L/100km</Text>
                </View>
              </View>
              <View style={styles.rowDivider} />
              <View style={styles.fuelBadgesRow}>
                <View style={styles.fuelBadge}><Ionicons name="flash-outline" size={13} color={COLORS.yellow} /><Text style={styles.fuelBadgeText}>{trip.fuel_efficiency.efficiency_label}</Text></View>
                <View style={styles.fuelBadge}><Ionicons name="trending-up-outline" size={13} color="#60A5FA" /><Text style={styles.fuelBadgeText}>{trip.fuel_efficiency.trend}</Text></View>
              </View>
            </View>
          </>
        )}

        {/* Status */}
        <View style={[styles.statusBadge, { backgroundColor: trip.confirmed ? `${COLORS.green}1A` : `${COLORS.yellow}1A`, borderColor: trip.confirmed ? COLORS.green : COLORS.yellow }]}>
          <Ionicons name={trip.confirmed ? 'checkmark-circle-outline' : 'time-outline'} size={16} color={trip.confirmed ? COLORS.green : COLORS.yellow} />
          <Text style={[styles.statusText, { color: trip.confirmed ? COLORS.green : COLORS.yellow }]}>{trip.confirmed ? 'Trip Confirmed' : 'Pending Confirmation'}</Text>
        </View>
      </ScrollView>

      <BottomNavbar activeTab="trips" />
    </View>
  );
}

function MetricCard({ label, value, icon, styles, COLORS }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; styles: ReturnType<typeof createStyles>; COLORS: AppColors }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricLabelRow}><Ionicons name={icon} size={14} color="#60A5FA" /><Text style={styles.metricLabel}>{label}</Text></View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function BehaviorRow({ label, value, icon, good, styles, COLORS }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; good: boolean; styles: ReturnType<typeof createStyles>; COLORS: AppColors }) {
  const color = good ? COLORS.green : COLORS.danger;
  return (
    <View style={styles.behaviorRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.behaviorLabel}>{label}</Text>
      <Text style={[styles.behaviorValue, { color }]}>{value}</Text>
    </View>
  );
}

function HealthBar({ label, value, styles, COLORS }: { label: string; value: number; styles: ReturnType<typeof createStyles>; COLORS: AppColors }) {
  const color = value >= 80 ? COLORS.green : value >= 60 ? COLORS.yellow : COLORS.danger;
  return (
    <View style={styles.healthBarWrap}>
      <Text style={styles.healthBarLabel}>{label}</Text>
      <View style={styles.healthBarTrack}>
        <View style={[styles.healthBarFill, { width: `${Math.min(value, 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.healthBarValue, { color }]}>{value}%</Text>
    </View>
  );
}

const createStyles = (COLORS: AppColors) => {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  // Dark-only colors. Light mode keeps the original theme colors.
  const blockBg     = isDark ? 'rgba(7,16,32,0.90)'    : COLORS.surface;
  const chipBg      = isDark ? 'rgba(10,24,48,0.92)'   : COLORS.surfaceLight;
  const blockBorder = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.12)';
  const softBorder  = isDark ? 'rgba(96,165,250,0.22)' : 'rgba(96,165,250,0.25)';
  const dividerBg   = isDark ? 'rgba(96,165,250,0.14)' : COLORS.divider;
  const trackBg     = isDark ? 'rgba(148,163,184,0.16)' : COLORS.input;

  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: COLORS.background },
    centered:         { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 16 },
    errorText:        { color: COLORS.text, fontSize: 16, textAlign: 'center' },
    backAction:       { borderWidth: 1, borderColor: softBorder, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: blockBg },
    backActionText:   { color: COLORS.text, fontWeight: '700' },

    header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
    backRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
    backText:         { color: COLORS.text, fontSize: 15 },
    headerActions:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIcon:       {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: softBorder,
      backgroundColor: chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    scroll:           { flex: 1 },
    content:          { paddingHorizontal: 18 },
    title:            { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 4 },
    dateSubtitle:     { color: COLORS.muted, fontSize: 14, marginBottom: 16 },
    scoreCard:        { borderRadius: 20, alignItems: 'center', paddingVertical: 22, marginBottom: 20, borderWidth: 1, borderColor: blockBorder },
    scoreCardLabel:   { color: 'rgba(255,255,255,0.78)', fontSize: 14, marginBottom: 4 },
    scoreCardValue:   { color: '#fff', fontSize: 60, fontWeight: '800', lineHeight: 64 },
    scoreCardStatus:  { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
    scoreCardStyle:   { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginTop: 4 },

    sectionTitle:     { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 4 },
    metricsGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
    metricCard:       { width: '48.5%', backgroundColor: blockBg, borderWidth: 1, borderColor: blockBorder, borderRadius: 14, padding: 14 },
    metricLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    metricLabel:      { color: COLORS.muted, fontSize: 13 },
    metricValue:      { color: COLORS.text, fontSize: 26, fontWeight: '800', lineHeight: 30 },

    card:             { backgroundColor: blockBg, borderWidth: 1, borderColor: blockBorder, borderRadius: 16, padding: 16, marginBottom: 16 },
    rowDivider:       { height: 1, backgroundColor: dividerBg, marginVertical: 12 },
    behaviorRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
    behaviorLabel:    { flex: 1, color: COLORS.muted, fontSize: 15 },
    behaviorValue:    { fontSize: 22, fontWeight: '800' },

    healthOverviewRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    healthStatusText: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    healthRiskText:   { color: COLORS.muted, fontSize: 13, marginTop: 4 },
    healthScore:      { fontSize: 42, fontWeight: '800' },
    healthBarWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    healthBarLabel:   { color: COLORS.muted, fontSize: 14, width: 55 },
    healthBarTrack:   { flex: 1, height: 8, backgroundColor: trackBg, borderRadius: 4, overflow: 'hidden' },
    healthBarFill:    { height: '100%', borderRadius: 4 },
    healthBarValue:   { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
    alertsLabel:      { color: COLORS.yellow, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    alertText:        { color: COLORS.muted, fontSize: 14, lineHeight: 22 },

    fuelRow:          { flexDirection: 'row', alignItems: 'center' },
    fuelItem:         { flex: 1, alignItems: 'center' },
    fuelLabel:        { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
    fuelValue:        { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    fuelDivider:      { width: 1, height: 40, backgroundColor: dividerBg },
    fuelBadgesRow:    { flexDirection: 'row', gap: 10 },
    fuelBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: chipBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    fuelBadgeText:    { color: COLORS.text, fontSize: 13, fontWeight: '600' },

    statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
    statusText:       { fontSize: 14, fontWeight: '700' },
  });
};
