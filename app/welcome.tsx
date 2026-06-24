import { useRouter } from 'expo-router';
import {
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.inner}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.glowBehind} />

          <View style={styles.logoCard}>
            <Image
              source={require('../assets/images/autocare-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.glowLine} />

          <View style={styles.textSection}>
            <Text style={styles.title}>
              Auto<Text style={styles.titleBlue}>Care</Text>
            </Text>
            <Text style={styles.subtitle}>Your intelligent driving companion</Text>

            <View style={styles.pillsRow}>
              <View style={styles.pill}><View style={styles.pillDot} /><Text style={styles.pillText}>Car Health</Text></View>
              <View style={styles.pill}><View style={styles.pillDot} /><Text style={styles.pillText}>AI Insights</Text></View>
              <View style={styles.pill}><View style={styles.pillDot} /><Text style={styles.pillText}>Fuel Tracking</Text></View>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/create-account')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/sign-in')} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const CARD_SIZE = width * 0.58;

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#080A0F' },
  inner:          { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },

  heroSection:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  glowBehind:     { position: 'absolute', width: CARD_SIZE * 1.2, height: CARD_SIZE * 0.7, borderRadius: 999, backgroundColor: 'rgba(37,99,235,0.08)' },

  logoCard:       { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 32, backgroundColor: 'rgba(10,20,45,0.7)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center', shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  logo:           { width: CARD_SIZE * 0.78, height: CARD_SIZE * 0.78 },

  glowLine:       { width: 80, height: 2, borderRadius: 2, backgroundColor: 'rgba(96,165,250,0.35)' },

  textSection:    { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  title:          { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  titleBlue:      { color: '#60A5FA' },
  subtitle:       { fontSize: 14, color: 'rgba(186,214,255,0.75)', textAlign: 'center' },

  pillsRow:       { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: 'rgba(37,99,235,0.08)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)', borderRadius: 20 },
  pillDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: '#60A5FA', opacity: 0.8 },
  pillText:       { fontSize: 11, color: 'rgba(186,214,255,0.8)', fontWeight: '500' },

  bottomSection:  { width: '100%', gap: 12 },
  primaryBtn:     { width: '100%', height: 54, backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn:   { width: '100%', height: 54, backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});