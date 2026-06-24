import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BASE_URL } from '@/constants/api';

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();

  const email = String(params.email ?? '');
  const mode = String(params.mode ?? 'confirm-email');
  const isForgotPassword = mode === 'forgot-password';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputs = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) text = text[0];
    setError('');
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
  };

  const verifyConfirmEmailOtp = async (otpCode: string) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/confirm-Email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
        setError(message || 'رمز التحقق غير صحيح.');
        Alert.alert('Error', message || 'رمز التحقق غير صحيح.');
        return;
      }
      const accessToken = data?.data?.credentials?.access_token || data?.credentials?.access_token || data?.access_token;
      const refreshToken = data?.data?.credentials?.refresh_token || data?.credentials?.refresh_token || data?.refresh_token;
      await AsyncStorage.setItem('needs_vehicle_setup', 'true');
      if (!accessToken) {
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        Alert.alert('Success', 'تم تأكيد الحساب. سجل دخولك الآن.');
        router.replace('/sign-in');
        return;
      }
      await AsyncStorage.setItem('access_token', accessToken);
      if (refreshToken) await AsyncStorage.setItem('refresh_token', refreshToken);
      router.replace('/vehicle-setup');
    } catch (err) {
      setError('حدث خطأ في الاتصال بالسيرفر.');
    }
  };

  const verifyForgotPasswordOtp = async (otpCode: string) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-forgot-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
        setError(message || 'رمز التحقق غير صحيح.');
        Alert.alert('Error', message || 'رمز التحقق غير صحيح.');
        return;
      }
      router.replace({ pathname: '/reset-password', params: { email, otp: otpCode } });
    } catch (err) {
      setError('حدث خطأ في الاتصال بالسيرفر.');
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (!email) { setError('البريد الإلكتروني غير موجود.'); return; }
    if (otpCode.length !== 6) { setError('اكتب رمز مكون من 6 أرقام.'); return; }
    try {
      setIsSubmitting(true);
      if (isForgotPassword) await verifyForgotPasswordOtp(otpCode);
      else await verifyConfirmEmailOtp(otpCode);
    } finally {
      setIsSubmitting(false);
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

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          Auto<Text style={styles.headerTitleAccent}>Care</Text>
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.title}>
          {isForgotPassword ? 'Reset Password' : 'Verify Email'}
        </Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.box, !!error && styles.boxError, !!digit && styles.boxFilled]}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isSubmitting && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={isSubmitting}>
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Verifying...' : 'Verify Code'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Didn't receive a code? </Text>
          <Pressable hitSlop={8}>
            <Text style={styles.resendLink}>Resend</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#080A0F' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)', zIndex: 1 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  headerTitleAccent:  { color: '#60A5FA' },
  content:            { flex: 1, paddingHorizontal: 24, paddingTop: 36 },
  title:              { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: 0.3 },
  subtitle:           { fontSize: 14, color: 'rgba(186,214,255,0.75)', marginBottom: 36, lineHeight: 22 },
  emailHighlight:     { color: '#60A5FA', fontWeight: '600' },
  otpContainer:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  box: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(10,20,45,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.30)',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  boxFilled:          { borderColor: 'rgba(96,165,250,0.7)', backgroundColor: 'rgba(37,99,235,0.15)' },
  boxError:           { borderColor: 'rgba(239,68,68,0.6)' },
  errorText:          { fontSize: 12, color: '#FCA5A5', marginTop: 4, marginBottom: 8 },
  button:             { height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 24 },
  buttonText:         { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  footer:             { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:         { fontSize: 13, color: 'rgba(186,214,255,0.7)' },
  resendLink:         { fontSize: 13, color: '#60A5FA', fontWeight: '700' },
});