import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserProfile } from '@/context/user-profile-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/api';
import { CAR_DATA } from '@/constants/car-data';

type ModalType = 'brand' | 'model' | 'year' | null;

/* ════════════════════════════════════════
   SELECT MODAL
════════════════════════════════════════ */
function SelectModal({ visible, title, options, selected, onSelect, onClose }: {
  visible: boolean; title: string; options: string[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{title}</Text>

        {options.length > 8 && (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color="rgba(96,130,165,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${title.toLowerCase()}...`}
              placeholderTextColor="rgba(96,130,165,0.5)"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(96,130,165,0.7)" />
              </Pressable>
            )}
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.length > 0 ? filtered.map(opt => (
            <Pressable key={opt} style={styles.modalOption} onPress={() => { onSelect(opt); onClose(); setSearch(''); }}>
              <Text style={[styles.modalOptionText, opt === selected && styles.modalOptionTextActive]}>{opt}</Text>
              {opt === selected && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
            </Pressable>
          )) : (
            <Text style={[styles.modalOptionText, { textAlign: 'center', paddingVertical: 24 }]}>No results found</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ════════════════════════════════════════
   SELECT FIELD
════════════════════════════════════════ */
function SelectField({ label, value, placeholder, onPress, error, disabled }: {
  label: string; value: string; placeholder: string;
  onPress: () => void; error?: string; disabled?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.selectBox, !!error && styles.selectBoxError, !!disabled && styles.selectBoxDisabled]}
        onPress={disabled ? undefined : onPress}
      >
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={disabled ? 'rgba(96,130,165,0.3)' : 'rgba(96,130,165,0.7)'} />
      </Pressable>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

/* ════════════════════════════════════════
   SPEC ROW
════════════════════════════════════════ */
function SpecRow({ icon, label, value, highlight }: {
  icon: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={styles.specRow}>
      <View style={[styles.specIconWrap, highlight && styles.specIconWrapHighlight]}>
        <Ionicons name={icon as any} size={15} color={highlight ? '#60A5FA' : 'rgba(186,214,255,0.6)'} />
      </View>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, highlight && { color: '#60A5FA' }]}>{value}</Text>
    </View>
  );
}

/* ════════════════════════════════════════
   SCREEN
════════════════════════════════════════ */
export default function VehicleSetupScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUserProfile();

  const [brand,     setBrand]     = useState('');
  const [model,     setModel]     = useState('');
  const [year,      setYear]      = useState('');
  const [mileage,   setMileage]   = useState('');
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    (async () => {
      const done = await AsyncStorage.getItem('vehicle_setup_done');
      if (done === 'true') router.replace('/profile');
    })();
  }, []);

  const brands = useMemo(() => Object.keys(CAR_DATA).sort(), []);
  const models = useMemo(() => {
    if (!brand) return [];
    return Object.keys((CAR_DATA as any)[brand] ?? {}).sort();
  }, [brand]);
  const years = useMemo(() => {
    if (!brand || !model) return [];
    return Object.keys((CAR_DATA as any)[brand]?.[model] ?? {})
      .map(Number).sort((a, b) => b - a).map(String);
  }, [brand, model]);
  const selectedCar = useMemo(() => {
    if (!brand || !model || !year) return null;
    return (CAR_DATA as any)[brand]?.[model]?.[year] ?? null;
  }, [brand, model, year]);

  const handleBrandSelect = (v: string) => { setBrand(v); setModel(''); setYear(''); setErrors(e => ({ ...e, brand: '' })); };
  const handleModelSelect = (v: string) => { setModel(v); setYear(''); setErrors(e => ({ ...e, model: '' })); };
  const handleYearSelect  = (v: string) => { setYear(v); setErrors(e => ({ ...e, year: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!brand)   e.brand   = 'Please select a brand.';
    if (!model)   e.model   = 'Please select a model.';
    if (!year)    e.year    = 'Please select a year.';
    if (!mileage || isNaN(Number(mileage)) || Number(mileage) < 0) e.mileage = 'Please enter a valid mileage.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = async () => {
    if (!validate() || !selectedCar) return;
    setLoading(true);
    try {
      const { authHeaders } = await import('@/constants/api-client');
      const headers = await authHeaders();
      const vehicleData = {
        brand: selectedCar.brand, model: selectedCar.model, year: selectedCar.year,
        engineCapacity: selectedCar.engineCapacity, mileage: Number(mileage),
        fuelType: selectedCar.fuelType, transmission: selectedCar.transmission,
        tankCapacity: selectedCar.tankCapacity, enginePowerHp: selectedCar.enginePowerHp,
        weightKg: selectedCar.weightKg, fuelCombined: selectedCar.fuelCombined,
        bodyType: selectedCar.bodyType,
      };
      const res = await fetch(`${BASE_URL}/vehicle`, { method: 'POST', headers, body: JSON.stringify(vehicleData) });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message ?? 'Failed'); }
      updateProfile({ vehicle: vehicleData });
      await AsyncStorage.setItem('vehicle_profile', JSON.stringify(vehicleData));
      await AsyncStorage.removeItem('needs_vehicle_setup');
      await AsyncStorage.setItem('vehicle_setup_done', 'true');
      router.replace('/profile');
    } catch (err: any) {
      setErrors({ submit: err.message ?? 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          Auto<Text style={styles.headerTitleAccent}>Care</Text>
        </Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.titleRow}>
            <View style={styles.titleIconWrap}>
              <Ionicons name="car-sport-outline" size={24} color="#60A5FA" />
            </View>
            <View>
              <Text style={styles.title}>Vehicle Profile</Text>
              <Text style={styles.subtitle}>Select your car for AI-powered insights</Text>
            </View>
          </View>

          {/* Car Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Car Details</Text>

            <SelectField label="Brand" value={brand} placeholder="Select brand..."
              onPress={() => setOpenModal('brand')} error={errors.brand} />
            <SelectField label="Model" value={model}
              placeholder={brand ? 'Select model...' : 'Select brand first'}
              onPress={() => setOpenModal('model')} error={errors.model} disabled={!brand} />
            <SelectField label="Year" value={year}
              placeholder={model ? 'Select year...' : 'Select model first'}
              onPress={() => setOpenModal('year')} error={errors.year} disabled={!model} />

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Current Mileage (km)</Text>
              <TextInput
                style={[styles.selectBox, styles.textInput, !!errors.mileage && styles.selectBoxError]}
                placeholder="e.g. 45000"
                placeholderTextColor="rgba(96,130,165,0.5)"
                value={mileage}
                onChangeText={v => { setMileage(v); setErrors(e => ({ ...e, mileage: '' })); }}
                keyboardType="number-pad"
              />
              {!!errors.mileage && <Text style={styles.errorText}>{errors.mileage}</Text>}
            </View>
          </View>

          {/* Specs Card */}
          {selectedCar && (
            <View style={styles.specsCard}>
              <View style={styles.specsHeader}>
                <View style={styles.specsHeaderLeft}>
                  <View style={styles.specsCheckIcon}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.specsCarName}>{selectedCar.brand} {selectedCar.model} {selectedCar.year}</Text>
                    <Text style={styles.specsSubtitle}>{selectedCar.bodyType} · Specs loaded</Text>
                  </View>
                </View>
              </View>
              <View style={styles.specsDivider} />
              <View style={styles.specsGrid}>
                <View style={styles.specsColumn}>
                  <SpecRow icon="flash-outline"            label="Engine"       value={`${selectedCar.engineCapacity} CC`} />
                  <SpecRow icon="speedometer-outline"      label="Power"        value={`${selectedCar.enginePowerHp} HP`} highlight />
                  <SpecRow icon="cog-outline"              label="Transmission" value={selectedCar.transmission} />
                  <SpecRow icon="water-outline"            label="Fuel Type"    value={selectedCar.fuelType} />
                </View>
                <View style={styles.specsColumnDivider} />
                <View style={styles.specsColumn}>
                  <SpecRow icon="analytics-outline"        label="Economy"      value={`${selectedCar.fuelCombined} L/100`} highlight />
                  <SpecRow icon="battery-charging-outline" label="Tank"         value={`${selectedCar.tankCapacity} L`} />
                  <SpecRow icon="barbell-outline"          label="Weight"       value={`${selectedCar.weightKg} kg`} />
                  <SpecRow icon="car-outline"              label="Body"         value={selectedCar.bodyType} />
                </View>
              </View>
            </View>
          )}

          {/* Empty placeholder */}
          {!selectedCar && brand && model && (
            <View style={styles.specsPlaceholder}>
              <Ionicons name="information-circle-outline" size={20} color="rgba(96,130,165,0.6)" />
              <Text style={styles.specsPlaceholderText}>Select brand, model & year to see full specs</Text>
            </View>
          )}

          {/* Submit error */}
          {errors.submit && (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          )}

          {/* Continue button */}
          <Pressable
            style={[styles.continueBtn, (!selectedCar || !mileage || loading) && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!selectedCar || !mileage || loading}
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.continueBtnText}>{loading ? 'Saving...' : 'Continue'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <SelectModal visible={openModal === 'brand'} title="Select Brand" options={brands}
        selected={brand} onSelect={handleBrandSelect} onClose={() => setOpenModal(null)} />
      <SelectModal visible={openModal === 'model'} title="Select Model" options={models}
        selected={model} onSelect={handleModelSelect} onClose={() => setOpenModal(null)} />
      <SelectModal visible={openModal === 'year'} title="Select Year" options={years}
        selected={year} onSelect={handleYearSelect} onClose={() => setOpenModal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#080A0F' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)', zIndex: 1 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  headerTitleAccent:  { color: '#60A5FA' },
  content:            { paddingHorizontal: 20, paddingTop: 24, gap: 16 },

  titleRow:           { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  titleIconWrap:      { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(37,99,235,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' },
  title:              { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  subtitle:           { color: 'rgba(186,214,255,0.75)', fontSize: 13, marginTop: 2 },

  card:               { backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(96,165,250,0.15)', gap: 4 },
  cardTitle:          { color: 'rgba(186,214,255,0.85)', fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  fieldWrap:          { gap: 6, marginBottom: 4 },
  label:              { fontSize: 13, fontWeight: '600', color: 'rgba(186,214,255,0.85)', marginBottom: 2 },
  selectBox:          { height: 52, backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  selectBoxError:     { borderColor: 'rgba(239,68,68,0.6)' },
  selectBoxDisabled:  { opacity: 0.4 },
  selectText:         { color: '#FFFFFF', fontSize: 15, flex: 1 },
  selectPlaceholder:  { color: 'rgba(96,130,165,0.5)' },
  textInput:          { color: '#FFFFFF', fontSize: 15 },
  errorText:          { fontSize: 12, color: '#FCA5A5' },

  // Specs card
  specsCard:          { backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', overflow: 'hidden' },
  specsHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(37,99,235,0.1)' },
  specsHeaderLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  specsCheckIcon:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  specsCarName:       { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  specsSubtitle:      { color: 'rgba(186,214,255,0.6)', fontSize: 12, marginTop: 2 },
  specsDivider:       { height: 1, backgroundColor: 'rgba(96,165,250,0.08)' },
  specsGrid:          { flexDirection: 'row', padding: 16 },
  specsColumn:        { flex: 1, gap: 14 },
  specsColumnDivider: { width: 1, backgroundColor: 'rgba(96,165,250,0.08)', marginHorizontal: 16 },

  specRow:               { flexDirection: 'row', alignItems: 'center', gap: 8 },
  specIconWrap:          { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(96,165,250,0.06)', alignItems: 'center', justifyContent: 'center' },
  specIconWrapHighlight: { backgroundColor: 'rgba(37,99,235,0.15)' },
  specLabel:             { color: 'rgba(186,214,255,0.6)', fontSize: 12, flex: 1 },
  specValue:             { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  specsPlaceholder:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(96,165,250,0.15)' },
  specsPlaceholderText: { color: 'rgba(96,130,165,0.7)', fontSize: 13 },

  submitError:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  submitErrorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },

  continueBtn:         { height: 54, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  continueBtnDisabled: { opacity: 0.45 },
  continueBtnText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d1a35', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, maxHeight: '75%', borderWidth: 1, borderColor: 'rgba(96,165,250,0.15)' },
  modalHandle:   { width: 40, height: 4, backgroundColor: 'rgba(96,130,165,0.4)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:    { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 12, letterSpacing: 0.3 },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,20,45,0.8)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.20)' },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 14 },

  modalOption:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.06)' },
  modalOptionText:       { color: 'rgba(186,214,255,0.7)', fontSize: 16 },
  modalOptionTextActive: { color: '#FFFFFF', fontWeight: '700' },
});