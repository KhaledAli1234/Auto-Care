import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BASE_URL } from '@/constants/api';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('الرجاء إدخال البريد الإلكتروني.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('البريد الإلكتروني غير صحيح.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const res = await fetch(`${BASE_URL}/auth/send-forgot-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.log('SEND OTP ERROR:', data);
        const message =
          data?.message || 'البريد الإلكتروني غير صحيح أو غير مسجل.';
        setError(message);
        return;
      }

      console.log('OTP SENT SUCCESS:', data);

      router.push({
        pathname: '/verify-otp',
        params: {
          email: trimmedEmail,
          mode: 'forgot-password',
        },
      });
    } catch (err) {
      console.log('FORGOT PASSWORD ERROR:', err);
      setError('حدث خطأ في الاتصال بالسيرفر.');
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you an OTP to reset your password.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="john@example.com"
              placeholderTextColor="rgba(96,130,165,0.5)"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <Pressable
            style={[styles.sendButton, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSendOtp}
            disabled={isSubmitting}>
            <Text style={styles.sendButtonText}>
              {isSubmitting ? 'Sending...' : 'Send OTP'}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.signInLink}>Sign In</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#080A0F' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)', zIndex: 1 },
  backBtn:              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:          { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  headerTitleAccent:    { color: '#60A5FA' },
  keyboardView:         { flex: 1, zIndex: 1 },
  scroll:               { flex: 1 },
  scrollContent:        { paddingHorizontal: 24, paddingTop: 36 },
  title:                { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: 0.3 },
  subtitle:             { fontSize: 14, color: 'rgba(186,214,255,0.75)', marginBottom: 32 },
  form:                 { gap: 6, marginBottom: 24 },
  label:                { fontSize: 13, fontWeight: '600', color: 'rgba(186,214,255,0.85)', marginBottom: 6, marginTop: 14 },
  input:                { height: 52, backgroundColor: 'rgba(10,20,45,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)', paddingHorizontal: 16, fontSize: 15, color: '#FFFFFF' },
  inputError:           { borderColor: 'rgba(239,68,68,0.6)' },
  errorText:            { fontSize: 12, color: '#FCA5A5', marginTop: 4 },
  sendButton:           { height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  sendButtonText:       { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  footer:               { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:           { fontSize: 13, color: 'rgba(186,214,255,0.7)' },
  signInLink:           { fontSize: 13, color: '#60A5FA', fontWeight: '700' },
});