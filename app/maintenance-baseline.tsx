import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserProfile } from '@/context/user-profile-context';
import { BottomNavbar } from '@/components/bottom-navbar';
import { AppColors, useThemeColors } from '@/context/theme-context';

type MaintenanceColors = AppColors & {
  surfaceAlt: string;
  borderFocus: string;
  textMuted: string;
  textSubtle: string;
  primaryDark: string;
  accent: string;
  green: string;
  cardBorder: string;
  maintenanceIconBg: string;
};

function createMaintenanceColors(colors: AppColors): MaintenanceColors {
  return {
    ...colors,
    surfaceAlt: colors.surfaceDark,
    borderFocus: colors.primary,
    textMuted: colors.mutedDark,
    textSubtle: colors.mutedDark,
    primaryDark: colors.primarySoft,
    accent: colors.star,
    green: colors.success,
    cardBorder: colors.divider,
    maintenanceIconBg: colors.success + '22',
  };
}

// Generate year options from 2000 to current year
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 1999 }, (_, i) =>
  String(currentYear - i)
);

export default function MaintenanceBaselineScreen() {
  const insets = useSafeAreaInsets();
  const baseColors = useThemeColors();
  const C = useMemo(() => createMaintenanceColors(baseColors), [baseColors]);
  const styles = useMemo(() => createStyles(C), [C]);
  const { updateProfile } = useUserProfile();

  const [lastOilChange, setLastOilChange] = useState('42000');
  const [lastTireChange, setLastTireChange] = useState('');
  const [lastBatteryYear, setLastBatteryYear] = useState('');
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleCompleteSetup = () => {
    const newErrors: Record<string, string> = {};

    if (!lastOilChange.trim()) {
      newErrors.lastOilChange = 'الرجاء إدخال قراءة عداد آخر تغيير زيت.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    updateProfile({
      lastOilChange: lastOilChange.trim(),
      lastTireChange: lastTireChange.trim(),
      lastBatteryYear,
    });
    router.push('/account');
  };

  const handleSkip = () => {
    router.push('/account');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>B</Text>
            </View>
            <Text style={styles.logoAi}>AI</Text>
          </View>
          <Text style={styles.appTitle} numberOfLines={1}>
            Smart Car AI Assistant App
          </Text>
        </View>
        <Pressable style={styles.viewChatButton} onPress={() => router.push('/account')}>
          <Ionicons name="person-circle-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Title */}
          <View style={styles.titleRow}>
            <View style={styles.titleIconWrapper}>
              <Ionicons name="build" size={26} color={C.green} />
            </View>
            <Text style={styles.title}>Maintenance{'\n'}Baseline</Text>
          </View>
          <Text style={styles.subtitle}>Optional - But highly recommended</Text>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>✦</Text>
            <Text style={styles.infoText}>
              Providing your last maintenance dates improves AI prediction accuracy from day one and
              helps prevent unexpected breakdowns
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Last Oil Change */}
            <Text style={styles.label}>Last Oil Change (Mileage)</Text>
            <TextInput
              style={[styles.input, errors.lastOilChange && styles.inputError, lastOilChange ? styles.inputFocused : null]}
              placeholder="42000"
              placeholderTextColor={C.textMuted}
              value={lastOilChange}
              onChangeText={(t) => { setLastOilChange(t); clearError('lastOilChange'); }}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>AI will predict your next oil change</Text>
            {errors.lastOilChange ? (
              <Text style={styles.errorText}>{errors.lastOilChange}</Text>
            ) : null}

            {/* Last Tire Change */}
            <Text style={styles.label}>Last Tire Change (Mileage)</Text>
            <TextInput
              style={[styles.input, errors.lastTireChange && styles.inputError]}
              placeholder="35000"
              placeholderTextColor={C.textMuted}
              value={lastTireChange}
              onChangeText={(t) => { setLastTireChange(t); clearError('lastTireChange'); }}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>Helps track tire wear patterns</Text>
            {errors.lastTireChange ? (
              <Text style={styles.errorText}>{errors.lastTireChange}</Text>
            ) : null}

            {/* Last Battery Change */}
            <Text style={styles.label}>Last Battery Change (Date)</Text>
            <Pressable
              style={[styles.selectBox, errors.lastBatteryYear && styles.selectBoxError]}
              onPress={() => { setShowBatteryModal(true); clearError('lastBatteryYear'); }}>
              <Text style={[styles.inputPlaceholder, lastBatteryYear && { color: C.text }]}>
                {lastBatteryYear || ''}
              </Text>
              <Ionicons name="chevron-down" size={20} color={C.textMuted} />
            </Pressable>
            <Text style={styles.hint}>Average battery life is 3-5 years</Text>
            {errors.lastBatteryYear ? (
              <Text style={styles.errorText}>{errors.lastBatteryYear}</Text>
            ) : null}
          </View>

          {/* Buttons */}
          <Pressable style={styles.completeButton} onPress={handleCompleteSetup}>
            <Text style={styles.completeText}>Complete Setup</Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for Now</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavbar activeTab="community" />

      {/* Battery Year Modal */}
      <Modal visible={showBatteryModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowBatteryModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {YEAR_OPTIONS.map((year) => (
                <Pressable
                  key={year}
                  style={styles.modalOption}
                  onPress={() => {
                    setLastBatteryYear(year);
                    setShowBatteryModal(false);
                  }}>
                  <Text style={styles.modalOptionText}>{year}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (C: MaintenanceColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  backLabel: {
    color: C.text,
    fontSize: 15,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  logoAi: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  appTitle: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  viewChatButton: {
    backgroundColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  viewChatText: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  titleIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.maintenanceIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    lineHeight: 34,
  },
  subtitle: {
    color: C.textMuted,
    fontSize: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primary + '55',
    padding: 16,
    marginBottom: 28,
  },
  infoIcon: {
    fontSize: 20,
    color: C.accent,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    color: C.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    marginBottom: 8,
  },
  label: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: C.borderFocus,
  },
  inputError: {
    borderColor: C.error,
  },
  selectBox: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxError: {
    borderColor: C.error,
  },
  inputPlaceholder: {
    color: C.textMuted,
    fontSize: 16,
  },
  hint: {
    color: C.textSubtle,
    fontSize: 12,
    marginTop: 6,
  },
  errorText: {
    color: C.error,
    fontSize: 12,
    marginTop: 4,
  },
  completeButton: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 32,
  },
  completeText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  skipText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.surfaceAlt,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: 320,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalOptionText: {
    color: C.text,
    fontSize: 16,
    textAlign: 'center',
  },
});
