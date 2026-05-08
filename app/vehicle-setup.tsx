import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_COLORS } from '@/constants/app-colors';
import { useUserProfile } from '@/context/user-profile-context';
import { vehicleSetupStyles as styles } from '@/styles/vehicle-setup.styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/api';

const FUEL_TYPE_OPTIONS = ['Gasoline 92', 'Gasoline 95', 'Diesel'];

const TRANSMISSION_OPTIONS = ['Automatic', 'Manual'];

export default function VehicleSetupScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUserProfile();
  const [vehicleBrand, setVehicleBrand] = useState('Toyota');
  const [modelName, setModelName] = useState('Camry');
  const [manufacturingYear, setManufacturingYear] = useState('2022');
  const [engineCapacity, setEngineCapacity] = useState('2500');
  const [odometerMileage, setOdometerMileage] = useState('45000');
  const [fuelType, setFuelType] = useState('');
  const [tankCapacity, setTankCapacity] = useState('60');
  const [transmission, setTransmission] = useState('');
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showTransmissionModal, setShowTransmissionModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleContinue = async () => {
    const newErrors: Record<string, string> = {};

    if (!vehicleBrand.trim()) newErrors.vehicleBrand = 'الرجاء إدخال ماركة المركبة.';
    if (!modelName.trim()) newErrors.modelName = 'الرجاء إدخال اسم الموديل.';
    if (!manufacturingYear.trim()) newErrors.manufacturingYear = 'الرجاء إدخال سنة التصنيع.';
    if (!engineCapacity.trim()) newErrors.engineCapacity = 'الرجاء إدخال سعة المحرك.';
    if (!odometerMileage.trim()) newErrors.odometerMileage = 'الرجاء إدخال قراءة العداد.';
    if (!fuelType) newErrors.fuelType = 'الرجاء اختيار نوع الوقود.';
    if (!tankCapacity.trim()) newErrors.tankCapacity = 'الرجاء إدخال سعة الخزان.';
    if (!transmission) newErrors.transmission = 'الرجاء اختيار ناقل الحركة.';

    const year = parseInt(manufacturingYear, 10);
    if (manufacturingYear && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      newErrors.manufacturingYear = 'سنة التصنيع غير صحيحة.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
      const mapFuelType = (value: string) => {
        if (value.includes('Gasoline')) return 'petrol';
        if (value === 'Diesel') return 'diesel';
        return value;
      };
      const createVehicle = async (vehicleData: any) => {
  try {
      const token = await AsyncStorage.getItem('access_token');

      if (!token) {
        throw new Error('No token found');
      }

      const res = await fetch(`${BASE_URL}/vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, 
        },
        body: JSON.stringify(vehicleData),
      });

    const data = await res.json();

    if (!res.ok) {
      console.log('Vehicle API Error:', data);
      throw new Error(data?.message || 'Failed to create vehicle');
    }

    return data;
  } catch (err) {
    console.log('Vehicle Error:', err);
    throw err;
  }
};

      const vehicleData = {
        brand: vehicleBrand.trim(),
        model: modelName.trim(),
        year: Number(manufacturingYear),
        engineCapacity: Number(engineCapacity),
        mileage: Number(odometerMileage),
        fuelType: mapFuelType(fuelType), // مهم
        transmission: transmission.toLowerCase(), // مهم
        tankCapacity: Number(tankCapacity),
      };

      await createVehicle(vehicleData);
      updateProfile({
        vehicle: {
          brand: vehicleData.brand,
          model: vehicleData.model,
          year: vehicleData.year,
          engineCapacity: vehicleData.engineCapacity,
          mileage: vehicleData.mileage,
          transmission: vehicleData.transmission,
          fuelType: vehicleData.fuelType,
        },
      });

        await AsyncStorage.setItem('vehicle_profile', JSON.stringify(vehicleData));

        await AsyncStorage.removeItem('needs_vehicle_setup');

        router.replace('/profile');
            
      };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const C = APP_COLORS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        hitSlop={12}>
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

      {/* Right side removed (empty for balance) */}
      <View style={styles.backButton} />
    </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Ionicons name="car-outline" size={28} color={C.text} />
            <Text style={styles.title}>Vehicle Profile</Text>
          </View>
          <Text style={styles.subtitle}>Tell us about your car to enable AI baseline</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Vehicle Brand</Text>
            <TextInput
              style={[styles.input, errors.vehicleBrand && styles.inputError]}
              placeholder="e.g. Toyota"
              placeholderTextColor={C.textMuted}
              value={vehicleBrand}
              onChangeText={(t) => { setVehicleBrand(t); clearError('vehicleBrand'); }}
            />
            <Text style={styles.hint}>AI will learn your vehicle&apos;s behavior patterns</Text>
            {errors.vehicleBrand ? <Text style={styles.errorText}>{errors.vehicleBrand}</Text> : null}

            <Text style={styles.label}>Model Name</Text>
            <TextInput
              style={[styles.input, errors.modelName && styles.inputError]}
              placeholder="e.g. Camry"
              placeholderTextColor={C.textMuted}
              value={modelName}
              onChangeText={(t) => { setModelName(t); clearError('modelName'); }}
            />
            {errors.modelName ? <Text style={styles.errorText}>{errors.modelName}</Text> : null}

            <Text style={styles.label}>Manufacturing Year</Text>
            <TextInput
              style={[styles.input, errors.manufacturingYear && styles.inputError]}
              placeholder="e.g. 2022"
              placeholderTextColor={C.textMuted}
              value={manufacturingYear}
              onChangeText={(t) => { setManufacturingYear(t); clearError('manufacturingYear'); }}
              keyboardType="number-pad"
            />
            {errors.manufacturingYear ? (
              <Text style={styles.errorText}>{errors.manufacturingYear}</Text>
            ) : null}

            <Text style={styles.label}>Engine Capacity (CC)</Text>
            <TextInput
              style={[styles.input, errors.engineCapacity && styles.inputError]}
              placeholder="e.g. 2500"
              placeholderTextColor={C.textMuted}
              value={engineCapacity}
              onChangeText={(t) => { setEngineCapacity(t); clearError('engineCapacity'); }}
              keyboardType="number-pad"
            />
            {errors.engineCapacity ? (
              <Text style={styles.errorText}>{errors.engineCapacity}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionSubtitle}>Used for fuel efficiency calculations</Text>
          <View style={styles.form}>
            <Text style={styles.label}>Current Odometer Mileage</Text>
            <TextInput
              style={[styles.input, errors.odometerMileage && styles.inputError]}
              placeholder="e.g. 45000"
              placeholderTextColor={C.textMuted}
              value={odometerMileage}
              onChangeText={(t) => { setOdometerMileage(t); clearError('odometerMileage'); }}
              keyboardType="number-pad"
            />
            {errors.odometerMileage ? (
              <Text style={styles.errorText}>{errors.odometerMileage}</Text>
            ) : null}

            <Text style={styles.label}>Fuel Type</Text>
            <Pressable
              style={[styles.selectBox, errors.fuelType && styles.selectBoxError]}
              onPress={() => { setShowFuelModal(true); clearError('fuelType'); }}>
              <Text style={[styles.inputPlaceholder, fuelType && { color: C.text }]}>
                {fuelType || 'Select...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={C.textMuted} />
            </Pressable>
            {errors.fuelType ? <Text style={styles.errorText}>{errors.fuelType}</Text> : null}
          </View>

          <Text style={styles.sectionSubtitle}>Helps optimize fuel consumption tracking</Text>
          <View style={styles.form}>
            <Text style={styles.label}>Tank Capacity (Liters)</Text>
            <TextInput
              style={[styles.input, errors.tankCapacity && styles.inputError]}
              placeholder="e.g. 60"
              placeholderTextColor={C.textMuted}
              value={tankCapacity}
              onChangeText={(t) => { setTankCapacity(t); clearError('tankCapacity'); }}
              keyboardType="decimal-pad"
            />
            {errors.tankCapacity ? (
              <Text style={styles.errorText}>{errors.tankCapacity}</Text>
            ) : null}

            <Text style={styles.label}>Transmission</Text>
            <Pressable
              style={[styles.selectBox, errors.transmission && styles.selectBoxError]}
              onPress={() => { setShowTransmissionModal(true); clearError('transmission'); }}>
              <Text style={[styles.inputPlaceholder, transmission && { color: C.text }]}>
                {transmission || 'Select...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={C.textMuted} />
            </Pressable>
            <Text style={styles.hint}>AI adapts insights based on transmission type</Text>
            {errors.transmission ? (
              <Text style={styles.errorText}>{errors.transmission}</Text>
            ) : null}
          </View>

          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showFuelModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFuelModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {FUEL_TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={styles.modalOption}
                onPress={() => {
                  setFuelType(opt);
                  setShowFuelModal(false);
                }}>
                <Text style={styles.modalOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTransmissionModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTransmissionModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {TRANSMISSION_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={styles.modalOption}
                onPress={() => {
                  setTransmission(opt);
                  setShowTransmissionModal(false);
                }}>
                <Text style={styles.modalOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}