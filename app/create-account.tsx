import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_COLORS } from '@/constants/app-colors';
import { useUserProfile } from '@/context/user-profile-context';
import { BASE_URL } from '@/constants/api';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUserProfile();
  const C = APP_COLORS;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinueToVehicleSetup = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const newErrors: Record<string, string> = {};

    if (!trimmedName) newErrors.fullName = 'Please enter your full name.';
    if (!trimmedEmail) newErrors.email = 'Please enter your email.';
    else if (!isValidEmail(trimmedEmail)) newErrors.email = 'Invalid email format.';
    if (!trimmedPhone) newErrors.phone = 'Please enter your phone number.';
    if (!password) newErrors.password = 'Please enter your password.';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password.';
    if (password && confirmPassword && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedName, email: trimmedEmail, phone: trimmedPhone, password, confirmPassword, drivingExperience: 0 }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = Array.isArray(data.message) ? data.message.join(' ') : data.message || '';
        const lowerMessage = message.toLowerCase();
        const backendErrors: Record<string, string> = {};
        if (lowerMessage.includes('email')) backendErrors.email = message;
        else if (lowerMessage.includes('password')) backendErrors.password = message;
        else if (lowerMessage.includes('phone')) backendErrors.phone = message;
        else if (lowerMessage.includes('name') || lowerMessage.includes('username')) backendErrors.fullName = message;
        else backendErrors.email = message || 'Signup failed.';
        setErrors(backendErrors);
        return;
      }

      const names = trimmedName.split(' ');
      const userProfile = {
        user: {
          firstName: names[0] || '',
          lastName: names.slice(1).join(' ') || '',
          email: trimmedEmail,
          phone: trimmedPhone,
          drivingExperience: null,
        },
      };
      updateProfile(userProfile);
      await AsyncStorage.setItem('user_profile', JSON.stringify(userProfile));
      await AsyncStorage.setItem('needs_vehicle_setup', 'true');
      router.push({ pathname: '/verify-otp', params: { email: trimmedEmail } });
    } catch (err) {
      console.log('SIGNUP ERROR:', err);
      setErrors({ email: 'Server connection error.' });
    } finally { setIsSubmitting(false); }
  };

  const clearError = (field: string) => setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Auto<Text style={styles.headerTitleAccent}>Care</Text></Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Let&apos;s get to know you better</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={[styles.input, errors.fullName && styles.inputError]} value={fullName} placeholder="John Smith" placeholderTextColor="rgba(96,130,165,0.5)" onChangeText={(t) => { setFullName(t); clearError('fullName'); }} onFocus={() => clearError('fullName')} />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput style={[styles.input, errors.email && styles.inputError]} value={email} placeholder="john@example.com" placeholderTextColor="rgba(96,130,165,0.5)" onChangeText={(t) => { setEmail(t); clearError('email'); }} onFocus={() => clearError('email')} keyboardType="email-address" autoCapitalize="none" />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <Text style={styles.label}>Phone</Text>
            <TextInput style={[styles.input, errors.phone && styles.inputError]} value={phone} placeholder="01012345678" placeholderTextColor="rgba(96,130,165,0.5)" onChangeText={(t) => { setPhone(t); clearError('phone'); }} onFocus={() => clearError('phone')} keyboardType="phone-pad" />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

            <Text style={styles.label}>Password</Text>
            <TextInput style={[styles.input, errors.password && styles.inputError]} value={password} placeholder="••••••••" placeholderTextColor="rgba(96,130,165,0.5)" secureTextEntry onChangeText={(t) => { setPassword(t); clearError('password'); }} onFocus={() => clearError('password')} />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput style={[styles.input, errors.confirmPassword && styles.inputError]} value={confirmPassword} placeholder="••••••••" placeholderTextColor="rgba(96,130,165,0.5)" secureTextEntry onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }} onFocus={() => clearError('confirmPassword')} />
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          <Pressable style={[styles.continueButton, isSubmitting && { opacity: 0.7 }]} onPress={handleContinueToVehicleSetup} disabled={isSubmitting}>
            <Text style={styles.continueText}>{isSubmitting ? 'Creating Account...' : 'Continue'}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/sign-in" asChild><Pressable><Text style={styles.signInLink}>Sign In</Text></Pressable></Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#080A0F' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)', zIndex: 1 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  headerTitleAccent:  { color: '#60A5FA' },
  keyboardView:       { flex: 1, zIndex: 1 },
  scroll:             { flex: 1 },
  scrollContent:      { paddingHorizontal: 24, paddingTop: 36 },
  title:              { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: 0.3 },
  subtitle:           { fontSize: 14, color: 'rgba(186,214,255,0.75)', marginBottom: 32 },
  form:               { gap: 6, marginBottom: 24 },
  label:              { fontSize: 13, fontWeight: '600', color: 'rgba(186,214,255,0.85)', marginBottom: 6, marginTop: 14 },
  input:              { height: 52, backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)', paddingHorizontal: 16, fontSize: 15, color: '#FFFFFF' },
  inputError:         { borderColor: 'rgba(239,68,68,0.6)' },
  errorText:          { fontSize: 12, color: '#FCA5A5', marginTop: 4 },
  continueButton:     { height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  continueText:       { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  footer:             { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:         { fontSize: 13, color: 'rgba(186,214,255,0.7)' },
  signInLink:         { fontSize: 13, color: '#60A5FA', fontWeight: '700' },
});