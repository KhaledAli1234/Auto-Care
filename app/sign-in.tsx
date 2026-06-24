import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserProfile } from '@/context/user-profile-context';
import { APP_COLORS } from '@/constants/app-colors';
import { BASE_URL } from '@/constants/api';
import { jwtDecode } from 'jwt-decode';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getCredentials(data: any) {
  return data?.data?.credentials ?? data?.credentials ?? data?.data ?? data;
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateProfile } = useUserProfile();

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    const newErrors: Record<string, string> = {};
    if (!trimmedEmail) newErrors.email = 'الرجاء إدخال البريد الإلكتروني.';
    else if (!isValidEmail(trimmedEmail)) newErrors.email = 'البريد الإلكتروني غير صحيح.';
    if (!password) newErrors.password = 'الرجاء إدخال كلمة المرور.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ email: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', password: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        return;
      }
      const credentials = getCredentials(data);
      const accessToken = credentials?.access_token;
      const refreshToken = credentials?.refresh_token;
      if (!accessToken) { setErrors({ email: 'لم يتم استلام التوكن من السيرفر.' }); return; }
      await AsyncStorage.setItem('access_token', accessToken);
      if (refreshToken) await AsyncStorage.setItem('refresh_token', refreshToken);
      const decoded: any = jwtDecode(accessToken);
      const userId = decoded?.sub;
      if (!userId) throw new Error('User ID not found in token');
      await AsyncStorage.setItem('userId', userId);
      const savedUserProfile = await AsyncStorage.getItem('user_profile');
      const oldUserProfile = savedUserProfile ? JSON.parse(savedUserProfile) : {};
      const userProfile = {
        user: {
          firstName: oldUserProfile.user?.firstName || '',
          lastName: oldUserProfile.user?.lastName || '',
          email: oldUserProfile.user?.email || trimmedEmail,
          phone: oldUserProfile.user?.phone || '',
          drivingExperience: oldUserProfile.user?.drivingExperience ?? null,
        },
      };
      updateProfile(userProfile);
      await AsyncStorage.setItem('user_profile', JSON.stringify(userProfile));
      const prefix = decoded?.role === 'admin' ? 'System' : 'Bearer';
      const vehicleRes = await fetch(`${BASE_URL}/vehicle/user/${userId}`, {
        headers: { Authorization: `${prefix} ${accessToken}`, 'ngrok-skip-browser-warning': 'true' },
      });
      if (vehicleRes.ok) {
        const resData = await vehicleRes.json();
        const vehicleData = resData?.data?.vehicles?.[0];
        if (vehicleData) {
          await AsyncStorage.setItem('vehicle_profile', JSON.stringify(vehicleData));
          await AsyncStorage.setItem('vehicle_setup_done', 'true');
          router.replace('/profile');
        } else { router.replace('/vehicle-setup'); }
      } else { router.replace('/vehicle-setup'); }
    } catch (err) {
      console.log('LOGIN ERROR:', err);
      setErrors({ email: 'حدث خطأ في الاتصال بالسيرفر.' });
    } finally { setIsSubmitting(false); }
  };

  const clearError = (field: string) => setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Auto<Text style={styles.headerTitleAccent}>Care</Text></Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue to your dashboard</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput style={[styles.input, errors.email && styles.inputError]} placeholder="john@example.com" placeholderTextColor="rgba(96,130,165,0.5)" value={email} onChangeText={(t) => { setEmail(t); clearError('email'); }} onFocus={() => clearError('email')} keyboardType="email-address" autoCapitalize="none" />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput style={[styles.passwordInput, errors.password && styles.inputError]} placeholder="••••••••" placeholderTextColor="rgba(96,130,165,0.5)" value={password} onChangeText={(t) => { setPassword(t); clearError('password'); }} onFocus={() => clearError('password')} secureTextEntry={!showPassword} />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(96,130,165,0.7)" />
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <View style={styles.optionsRow}>
              <Pressable onPress={() => setRememberMe(!rememberMe)} style={styles.rememberRow} hitSlop={8}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={[styles.signInButton, isSubmitting && { opacity: 0.7 }]} onPress={handleSignIn} disabled={isSubmitting}>
            <Text style={styles.signInButtonText}>{isSubmitting ? 'Signing In...' : 'Sign In'}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/create-account" asChild><Pressable><Text style={styles.createAccountLink}>Create Account</Text></Pressable></Link>
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
  passwordWrapper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)', height: 52, paddingHorizontal: 16 },
  passwordInput:      { flex: 1, fontSize: 15, color: '#FFFFFF', height: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  eyeBtn:             { padding: 4 },
  optionsRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  rememberRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:           { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(96,165,250,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkboxChecked:    { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  rememberText:       { fontSize: 13, color: 'rgba(186,214,255,0.75)' },
  forgotLink:         { fontSize: 13, color: '#60A5FA', fontWeight: '600' },
  signInButton:       { height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  signInButtonText:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  footer:             { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:         { fontSize: 13, color: 'rgba(186,214,255,0.7)' },
  createAccountLink:  { fontSize: 13, color: '#60A5FA', fontWeight: '700' },
});