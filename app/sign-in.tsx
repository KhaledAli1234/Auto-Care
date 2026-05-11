import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserProfile } from '@/context/user-profile-context';
import { APP_COLORS } from '@/constants/app-colors';
import { signInStyles as styles } from '@/styles/sign-in.styles';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateProfile } = useUserProfile();

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();

    const newErrors: Record<string, string> = {};

    if (!trimmedEmail) {
      newErrors.email = 'الرجاء إدخال البريد الإلكتروني.';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح.';
    }

    if (!password) {
      newErrors.password = 'الرجاء إدخال كلمة المرور.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      console.log('BASE_URL:', BASE_URL);
      console.log('Sending to:', `${BASE_URL}/auth/login`);
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors({
          email: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
          password: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        });

        return;
      }

      const credentials = getCredentials(data);

      const accessToken = credentials?.access_token;
      const refreshToken = credentials?.refresh_token;

      if (!accessToken) {
        setErrors({
          email: 'لم يتم استلام التوكن من السيرفر.',
        });

        return;
      }

      await AsyncStorage.setItem('access_token', accessToken);

      if (refreshToken) {
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }

      const decoded: any = jwtDecode(accessToken);

      const userId = decoded?.sub;

      if (!userId) {
        throw new Error('User ID not found in token');
      }

      await AsyncStorage.setItem('userId', userId);

      const savedUserProfile = await AsyncStorage.getItem('user_profile');

      const oldUserProfile = savedUserProfile
        ? JSON.parse(savedUserProfile)
        : {};

      const userProfile = {
        user: {
          firstName: oldUserProfile.user?.firstName || '',

          lastName: oldUserProfile.user?.lastName || '',

          email: oldUserProfile.user?.email || trimmedEmail,

          phone: oldUserProfile.user?.phone || '',

          drivingExperience:
            oldUserProfile.user?.drivingExperience ?? null,
        },
      };

      updateProfile(userProfile);

      await AsyncStorage.setItem(
        'user_profile',
        JSON.stringify(userProfile)
      );

      const needsVehicleSetup = await AsyncStorage.getItem(
        'needs_vehicle_setup'
      );

      const savedVehicleProfile = await AsyncStorage.getItem(
        'vehicle_profile'
      );

      console.log('NEEDS VEHICLE SETUP:', needsVehicleSetup);

      console.log('SAVED VEHICLE PROFILE:', savedVehicleProfile);

      if (needsVehicleSetup === 'true' || !savedVehicleProfile) {
        router.replace('/vehicle-setup');
      } else {
        router.replace('/profile');
      }
    } catch (err) {
      console.log('LOGIN ERROR:', err);

      setErrors({
        email: 'حدث خطأ في الاتصال بالسيرفر.',
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <View style={styles.backButton} />

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

        <Pressable style={styles.viewChatButton}>
          <Text style={styles.viewChatText}>View chat</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: insets.bottom + 110,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome Back</Text>

          <Text style={styles.subtitle}>
            Sign in to continue to your dashboard
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>

            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="john@example.com"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearError('email');
              }}
              onFocus={() => clearError('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            <Text style={styles.label}>Password</Text>

            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearError('password');
              }}
              onFocus={() => clearError('password')}
              secureTextEntry
            />

            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            <View style={styles.optionsRow}>
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.rememberRow}
                hitSlop={8}>
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}>
                  {rememberMe && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={C.text}
                    />
                  )}
                </View>

                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotLink}>
                  Forgot Password?
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={isSubmitting}>
            <Text style={styles.signInButtonText}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don&apos;t have an account?{' '}
            </Text>

            <Link href="/create-account" asChild>
              <Pressable>
                <Text style={styles.createAccountLink}>
                  Create Account
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}