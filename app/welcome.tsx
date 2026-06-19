import { useRouter } from 'expo-router';
import {
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Hero Section ── */}
      <View style={styles.heroSection}>

        {/* ── Glow behind card ── */}
        <View style={styles.glowBehind} />

        {/* ── Logo Card ── */}
        <View style={styles.logoCard}>
          <Image
            source={require('../assets/images/autocare-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* ── Divider glow line ── */}
        <View style={styles.glowLine} />

        {/* ── TEXT ── */}
        <View style={styles.textSection}>
          <Text style={styles.title}>
            Auto<Text style={styles.titleBlue}>Care</Text>
          </Text>
          <Text style={styles.subtitle}>Your intelligent driving companion</Text>

          {/* ── Feature Pills ── */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>Car Health</Text>
            </View>
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>AI Insights</Text>
            </View>
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>Fuel Tracking</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── BUTTONS ── */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/create-account')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/sign-in')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const CARD_SIZE = width * 0.58;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1621',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },

  // ── Hero ──
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },

  // ── Glow behind the card ──
  glowBehind: {
    position: 'absolute',
    width: CARD_SIZE * 1.2,
    height: CARD_SIZE * 0.7,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 144, 255, 0.08)',
    // React Native doesn't support filter blur natively,
    // but this gives a subtle color glow effect
  },

  // ── Logo Card ──
  logoCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 32,
    backgroundColor: '#111E2E',
    borderWidth: 1,
    borderColor: 'rgba(30, 144, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle inner top highlight
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  logo: {
    width: CARD_SIZE * 0.78,
    height: CARD_SIZE * 0.78,
  },

  // ── Glow divider line ──
  glowLine: {
    width: 80,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(30, 144, 255, 0.35)',
  },

  // ── Text ──
  textSection: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  titleBlue: {
    color: '#1E90FF',
  },

  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(150, 185, 220, 0.85)',
    textAlign: 'center',
  },

  // ── Pills ──
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30, 144, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(30, 144, 255, 0.18)',
    borderRadius: 20,
  },

  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1E90FF',
    opacity: 0.8,
  },

  pillText: {
    fontSize: 11,
    color: 'rgba(120, 170, 220, 0.9)',
    fontWeight: '500',
  },

  // ── Buttons ──
  bottomSection: {
    width: '100%',
    gap: 12,
  },

  primaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#1E90FF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  secondaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});