import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BottomNavbar } from '@/components/bottom-navbar';
import { BASE_URL } from '@/constants/api';
import { ApiTrip } from '../trips';
import { authHeaders } from '@/constants/api-client';

/* ════════════════════════════════════════
   COLORS
════════════════════════════════════════ */
const COLORS = {
  background:   '#09182d',
  surface:      '#13243a',
  surfaceLight: '#172b44',
  border:       'rgba(255,255,255,0.07)',
  divider:      'rgba(255,255,255,0.06)',
  text:         '#f8fafc',
  muted:        '#aebbd0',
  mutedDark:    '#74849a',
  primary:      '#3268f7',
  input:        '#0f1f34',
  danger:       '#ef4444',
  green:        '#22c55e',
  yellow:       '#f59e0b',
};

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function formatDuration(min?: number) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function scoreLabel(score?: number): { text: string; color: string } {
  if (!score) return { text: 'N/A', color: COLORS.mutedDark };
  if (score >= 90) return { text: 'Excellent', color: COLORS.green };
  if (score >= 75) return { text: 'Good',      color: COLORS.green };
  if (score >= 60) return { text: 'Fair',       color: COLORS.yellow };
  return { text: 'Poor', color: COLORS.danger };
}

function healthColor(score?: number) {
  if (!score) return COLORS.mutedDark;
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.yellow;
  return COLORS.danger;
}

/* ════════════════════════════════════════
   SCREEN
════════════════════════════════════════ */
export default function TripDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip,    setTrip]    = useState<ApiTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const headers = await authHeaders();
        const res = await fetch(`${BASE_URL}/trips/${id}`, { headers });
        const text = await res.text();
        const json = JSON.parse(text);
        if (!res.ok) throw new Error(json?.message ?? 'Failed to load trip');
        setTrip(json?.data?.trip ?? json?.data ?? null);
      } catch (err: any) {
        setError(err.message ?? 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
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
  const scoreMeta = scoreLabel(score);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          <Text style={styles.backText}>Back to Trips</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Trip Details</Text>
        <Text style={styles.dateSubtitle}>{formatDate(trip.date ?? trip.createdAt)}</Text>

        {/* ── DRIVING SCORE ── */}
        <View style={[styles.scoreCard, { backgroundColor: score && score >= 75 ? COLORS.primary : score && score >= 60 ? '#7c5c00' : '#7c1d1d' }]}>
          <Text style={styles.scoreCardLabel}>Driving Score</Text>
          <Text style={styles.scoreCardValue}>{score ?? '—'}</Text>
          <Text style={[styles.scoreCardStatus, { color: score && score >= 75 ? '#dbeafe' : COLORS.yellow }]}>{scoreMeta.text}</Text>
          {trip.driving_behavior?.driver_style && (
            <Text style={styles.scoreCardStyle}>{trip.driving_behavior.driver_style} Driver</Text>
          )}
        </View>

        {/* ── TRIP SUMMARY ── */}
        {trip.trip_summary && (
          <>
            <Text style={styles.sectionTitle}>Trip Summary</Text>
            <View style={styles.metricsGrid}>
              <MetricCard label="Distance"  value={`${trip.trip_summary.distance_km} km`}     icon="location-outline" />
              <MetricCard label="Duration"  value={formatDuration(trip.trip_summary.duration_min)} icon="time-outline" />
              <MetricCard label="Avg Speed" value={`${trip.trip_summary.avg_speed} km/h`}     icon="speedometer-outline" />
              <MetricCard label="Max Speed" value={`${trip.trip_summary.max_speed} km/h`}     icon="trending-up-outline" />
            </View>
          </>
        )}

        {/* ── DRIVING BEHAVIOR ── */}
        {trip.driving_behavior && (
          <>
            <Text style={styles.sectionTitle}>Driving Behavior</Text>
            <View style={styles.card}>
              <BehaviorRow
                label="Harsh Brakes"
                value={trip.driving_behavior.harsh_brake_count}
                icon="warning-outline"
                good={trip.driving_behavior.harsh_brake_count === 0}
              />
              <View style={styles.rowDivider} />
              <BehaviorRow
                label="Harsh Accelerations"
                value={trip.driving_behavior.harsh_accel_count}
                icon="flash-outline"
                good={trip.driving_behavior.harsh_accel_count === 0}
              />
            </View>
          </>
        )}

        {/* ── VEHICLE HEALTH ── */}
        {trip.vehicle_health && (
          <>
            <Text style={styles.sectionTitle}>Vehicle Health</Text>
            <View style={styles.card}>
              <View style={styles.healthOverviewRow}>
                <View>
                  <Text style={styles.healthStatusText}>{trip.vehicle_health.health_status}</Text>
                  <Text style={styles.healthRiskText}>Risk: {trip.vehicle_health.maintenance_risk}</Text>
                </View>
                <Text style={[styles.healthScore, { color: healthColor(trip.vehicle_health.vehicle_health_score) }]}>
                  {trip.vehicle_health.vehicle_health_score}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <HealthBar label="Engine"  value={trip.vehicle_health.engine_health} />
              <HealthBar label="Brakes"  value={trip.vehicle_health.brake_health} />
              <HealthBar label="Tires"   value={trip.vehicle_health.tire_health} />

              {trip.vehicle_health.alerts.length > 0 && (
                <>
                  <View style={styles.rowDivider} />
                  <Text style={styles.alertsLabel}>⚠️ Alerts</Text>
                  {trip.vehicle_health.alerts.map((alert, i) => (
                    <Text key={i} style={styles.alertText}>• {alert}</Text>
                  ))}
                </>
              )}
            </View>
          </>
        )}

        {/* ── FUEL EFFICIENCY ── */}
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
                <View style={styles.fuelBadge}>
                  <Ionicons name="flash-outline" size={13} color={COLORS.yellow} />
                  <Text style={styles.fuelBadgeText}>{trip.fuel_efficiency.efficiency_label}</Text>
                </View>
                <View style={styles.fuelBadge}>
                  <Ionicons name="trending-up-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.fuelBadgeText}>{trip.fuel_efficiency.trend}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── CONFIRMATION STATUS ── */}
        <View style={[styles.statusBadge, { backgroundColor: trip.confirmed ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', borderColor: trip.confirmed ? COLORS.green : COLORS.yellow }]}>
          <Ionicons name={trip.confirmed ? 'checkmark-circle-outline' : 'time-outline'} size={16} color={trip.confirmed ? COLORS.green : COLORS.yellow} />
          <Text style={[styles.statusText, { color: trip.confirmed ? COLORS.green : COLORS.yellow }]}>
            {trip.confirmed ? 'Trip Confirmed' : 'Pending Confirmation'}
          </Text>
        </View>
      </ScrollView>

      <BottomNavbar activeTab="trips" />
    </View>
  );
}

/* ════════════════════════════════════════
   SUB COMPONENTS
════════════════════════════════════════ */
function MetricCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricLabelRow}>
        <Ionicons name={icon} size={14} color={COLORS.primary} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function BehaviorRow({ label, value, icon, good }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; good: boolean }) {
  return (
    <View style={styles.behaviorRow}>
      <Ionicons name={icon} size={16} color={good ? COLORS.green : COLORS.danger} />
      <Text style={styles.behaviorLabel}>{label}</Text>
      <Text style={[styles.behaviorValue, { color: good ? COLORS.green : COLORS.danger }]}>{value}</Text>
    </View>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
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

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  centered:   { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 16 },
  errorText:  { color: COLORS.text, fontSize: 16, textAlign: 'center' },
  backAction: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  backActionText: { color: COLORS.text, fontWeight: '700' },

  header:   { paddingHorizontal: 18, paddingVertical: 10 },
  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: COLORS.text, fontSize: 15 },
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 18 },

  title:        { color: COLORS.text, fontSize: 30, fontWeight: '800', marginBottom: 4 },
  dateSubtitle: { color: COLORS.muted, fontSize: 14, marginBottom: 16 },

  scoreCard:       { borderRadius: 20, alignItems: 'center', paddingVertical: 22, marginBottom: 20 },
  scoreCardLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 },
  scoreCardValue:  { color: COLORS.text, fontSize: 60, fontWeight: '800', lineHeight: 64 },
  scoreCardStatus: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  scoreCardStyle:  { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },

  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 4 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  metricCard:  { width: '48.5%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricLabel: { color: COLORS.muted, fontSize: 13 },
  metricValue: { color: COLORS.text, fontSize: 26, fontWeight: '800', lineHeight: 30 },

  card:       { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 12 },

  behaviorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  behaviorLabel: { flex: 1, color: COLORS.muted, fontSize: 15 },
  behaviorValue: { fontSize: 22, fontWeight: '800' },

  healthOverviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthStatusText:  { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  healthRiskText:    { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  healthScore:       { fontSize: 42, fontWeight: '800' },

  healthBarWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  healthBarLabel: { color: COLORS.muted, fontSize: 14, width: 55 },
  healthBarTrack: { flex: 1, height: 8, backgroundColor: COLORS.input, borderRadius: 4, overflow: 'hidden' },
  healthBarFill:  { height: '100%', borderRadius: 4 },
  healthBarValue: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },

  alertsLabel: { color: COLORS.yellow, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  alertText:   { color: COLORS.muted, fontSize: 14, lineHeight: 22 },

  fuelRow:      { flexDirection: 'row', alignItems: 'center' },
  fuelItem:     { flex: 1, alignItems: 'center' },
  fuelLabel:    { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
  fuelValue:    { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  fuelDivider:  { width: 1, height: 40, backgroundColor: COLORS.divider },
  fuelBadgesRow:{ flexDirection: 'row', gap: 10 },
  fuelBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  fuelBadgeText:{ color: COLORS.text, fontSize: 13, fontWeight: '600' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  statusText:  { fontSize: 14, fontWeight: '700' },

});