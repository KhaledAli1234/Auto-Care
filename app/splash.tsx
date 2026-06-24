import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet,
    View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.88)).current;
  const barWidth       = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const versionOpacity = useRef(new Animated.Value(0)).current;
  const dotOpacity     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(barWidth, { toValue: 1, duration: 1400, useNativeDriver: false }).start(() => {
        Animated.parallel([
          Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(versionOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
      });
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const animatedBarWidth = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080A0F" />

      <LinearGradient
        colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Subtle rings */}
      <View style={styles.ring1} />
      <View style={styles.ring2} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require('../assets/images/autocare-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Loading bar */}
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: animatedBarWidth }]}>
            <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Initializing vehicle diagnostics...
        </Animated.Text>
      </View>

      {/* Version */}
      <Animated.Text style={[styles.version, { opacity: versionOpacity }]}>
        v1.0.0
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#080A0F', alignItems: 'center', justifyContent: 'center' },
  ring1:       { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(96,165,250,0.06)' },
  ring2:       { position: 'absolute', width: 480, height: 480, borderRadius: 240, borderWidth: 1, borderColor: 'rgba(96,165,250,0.03)' },
  logoWrapper: {
    marginBottom: 60,
    ...Platform.select({
      ios: { shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 30 },
    }),
  },
  logo:         { width: width * 0.6, height: width * 0.6 * 0.55 },
  barContainer: { alignItems: 'center', gap: 14 },
  barTrack:     { width: 180, height: 2, backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 999, overflow: 'hidden' },
  barFill:      { height: '100%', backgroundColor: '#2563EB', borderRadius: 999 },
  dot:          { position: 'absolute', right: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#60A5FA' },
  tagline:      { color: 'rgba(186,214,255,0.5)', fontSize: 11, fontWeight: '300', letterSpacing: 2.5, textTransform: 'uppercase' },
  version:      { position: 'absolute', bottom: 36, color: 'rgba(96,130,165,0.5)', fontSize: 10, letterSpacing: 1.5 },
});