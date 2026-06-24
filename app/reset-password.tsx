import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BASE_URL } from '@/constants/api';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; otp?: string }>();
  const email = String(params.email ?? '');
  const otp = String(params.otp ?? '');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};

    if (!email || !otp) {
      newErrors.password = 'بيانات التحقق ناقصة. ارجع واطلب OTP مرة أخرى.';
    }
    if (!password) {
      newErrors.password = 'الرجاء إدخال كلمة المرور الجديدة.';
    } else if (password.length < 6) {
      newErrors.password = 'كلمة المرور يجب ألا تقل عن 6 حروف.';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'الرجاء تأكيد كلمة المرور.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'كلمتا المرور غير متطابقتين.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`${BASE_URL}/auth/reset-forgot-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.message || 'رمز التحقق غير صحيح أو انتهت صلاحيته.';
        setErrors({ password: message });
        return;
      }
      Alert.alert('Done', 'تم تغيير كلمة المرور بنجاح.');
      router.replace('/sign-in');
    } catch (err) {
      setErrors({ password: 'حدث خطأ في الاتصال بالسيرفر.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = (field: string) => {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Set a new password for{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.passwordWrapper, !!errors.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="rgba(96,130,165,0.5)"
                value={password}
                onChangeText={(t) => { setPassword(t); clearError('password'); }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(96,130,165,0.7)" />
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.passwordWrapper, !!errors.confirmPassword && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="rgba(96,130,165,0.5)"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
                secureTextEntry={!showConfirm}
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(96,130,165,0.7)" />
              </Pressable>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          <Pressable
            style={[styles.button, isSubmitting && { opacity: 0.7 }]}
            onPress={handleResetPassword}
            disabled={isSubmitting}>
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Saving...' : 'Save New Password'}
            </Text>
          </Pressable>
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
  subtitle:           { fontSize: 14, color: 'rgba(186,214,255,0.75)', marginBottom: 32, lineHeight: 22 },
  emailHighlight:     { color: '#60A5FA', fontWeight: '600' },
  form:               { gap: 6, marginBottom: 24 },
  label:              { fontSize: 13, fontWeight: '600', color: 'rgba(186,214,255,0.85)', marginBottom: 6, marginTop: 14 },
  passwordWrapper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)', height: 52, paddingHorizontal: 16 },
  passwordInput:      { flex: 1, fontSize: 15, color: '#FFFFFF', height: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  inputError:         { borderColor: 'rgba(239,68,68,0.6)' },
  eyeBtn:             { padding: 4 },
  errorText:          { fontSize: 12, color: '#FCA5A5', marginTop: 4 },
  button:             { height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  buttonText:         { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});