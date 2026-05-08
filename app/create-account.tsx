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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_COLORS } from '@/constants/app-colors';
import { useUserProfile } from '@/context/user-profile-context';
import { createAccountStyles as styles } from '@/styles/create-account.styles';
import { BASE_URL } from '@/constants/api';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useUserProfile();

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

    // -------------------------
    // Client-side validation
    // -------------------------
    const newErrors: Record<string, string> = {};

    if (!trimmedName) newErrors.fullName = 'Please enter your full name.';

    if (!trimmedEmail) {
      newErrors.email = 'Please enter your email.';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Invalid email format.';
    }

    if (!trimmedPhone) newErrors.phone = 'Please enter your phone number.';
    if (!password) newErrors.password = 'Please enter your password.';
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    }

    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);

      // -------------------------
      // API request
      // -------------------------
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          password,
          confirmPassword,
          drivingExperience: 0,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // -------------------------
      // Backend error handling (mapped to fields)
      // -------------------------
      if (!res.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(' ')
          : data.message || '';

        const lowerMessage = message.toLowerCase();

        const backendErrors: Record<string, string> = {};

        if (lowerMessage.includes('email')) {
          backendErrors.email = message;
        } else if (lowerMessage.includes('password')) {
          backendErrors.password = message;
        } else if (lowerMessage.includes('phone')) {
          backendErrors.phone = message;
        } else if (
          lowerMessage.includes('name') ||
          lowerMessage.includes('username')
        ) {
          backendErrors.fullName = message;
        } else {
          backendErrors.email = message || 'Signup failed.';
        }

        setErrors(backendErrors);
        return;
      }

      // -------------------------
      // Build local profile
      // -------------------------
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

      // Save to local storage
      await AsyncStorage.setItem('user_profile', JSON.stringify(userProfile));
      await AsyncStorage.setItem('needs_vehicle_setup', 'true');

      // Navigate to OTP verification
      router.push({
        pathname: '/verify-otp',
        params: { email: trimmedEmail },
      });
    } catch (err) {
      console.log('SIGNUP ERROR:', err);

      setErrors({
        email: 'Server connection error.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove specific field error
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
      {/* Header */}
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

          <Text style={styles.appTitle}>
            Smart Car AI Assistant App
          </Text>
        </View>

        <View style={styles.backButton} />
      </View>

      {/* Form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Let&apos;s get to know you better
          </Text>

          <View style={styles.form}>
            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={fullName}
              placeholder="John Smith"
              placeholderTextColor={C.textMuted}
              onChangeText={(t) => {
                setFullName(t);
                clearError('fullName');
              }}
              onFocus={() => clearError('fullName')}
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              placeholder="john@example.com"
              placeholderTextColor={C.textMuted}
              onChangeText={(t) => {
                setEmail(t);
                clearError('email');
              }}
              onFocus={() => clearError('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            {/* Phone */}
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={phone}
              placeholder="01012345678"
              placeholderTextColor={C.textMuted}
              onChangeText={(t) => {
                setPhone(t);
                clearError('phone');
              }}
              onFocus={() => clearError('phone')}
              keyboardType="phone-pad"
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              value={password}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              onChangeText={(t) => {
                setPassword(t);
                clearError('password');
              }}
              onFocus={() => clearError('password')}
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                errors.confirmPassword && styles.inputError,
              ]}
              value={confirmPassword}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              onChangeText={(t) => {
                setConfirmPassword(t);
                clearError('confirmPassword');
              }}
              onFocus={() => clearError('confirmPassword')}
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Submit */}
          <Pressable
            style={styles.continueButton}
            onPress={handleContinueToVehicleSetup}
            disabled={isSubmitting}>
            <Text style={styles.continueText}>
              {isSubmitting ? 'Creating Account...' : 'Continue'}
            </Text>
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
            </Text>

            <Link href="/sign-in" asChild>
              <Pressable>
                <Text style={styles.signInLink}>Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}