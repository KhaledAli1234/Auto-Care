import { PressableScale } from '@/components/pressable-scale';
import { AppColors, useThemeColors } from '@/context/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type TabKey = 'home' | 'trips' | 'track' | 'community' | 'ai';

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: '/profile' | '/trips' | '/track' | '/community' | '/ai-assistant';
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: '/profile' },
  { key: 'trips', label: 'Trips', icon: 'location-outline', route: '/trips' },
  { key: 'track', label: 'Track', icon: 'radio-outline', route: '/track' },
  { key: 'community', label: 'Community', icon: 'people-outline', route: '/community' },
  { key: 'ai', label: 'AI', icon: 'chatbox-ellipses-outline', route: '/ai-assistant' },
];

const ICON_SIZE = 20;

function TabItem({
  tab,
  active,
  styles,
  COLORS,
}: {
  tab: typeof TABS[number];
  active: boolean;
  styles: ReturnType<typeof createStyles>;
  COLORS: AppColors;
}) {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');
  const activeColor = isDark ? '#60A5FA' : COLORS.primary;
  const inactiveColor = isDark ? '#334155' : COLORS.mutedDark;

  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const iconBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(96,165,250,${progress.value * 0.12})`,
  }));

  return (
    <PressableScale
      style={styles.item}
      scaleTo={0.92}
      onPress={() => {
        if (tab.route) router.push(tab.route);
      }}
    >
      <Animated.View style={[styles.iconWrap, iconBgStyle]}>
        <Ionicons
          name={tab.icon}
          size={ICON_SIZE}
          color={active ? activeColor : inactiveColor}
        />
      </Animated.View>

      <Text style={[styles.label, active && styles.labelActive]}>
        {tab.label}
      </Text>
    </PressableScale>
  );
}

function TrackTabItem({
  active,
  styles,
  COLORS,
}: {
  active: boolean;
  styles: ReturnType<typeof createStyles>;
  COLORS: AppColors;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.04 }],
    shadowOpacity: 0.28 + progress.value * 0.15,
  }));

  return (
    <PressableScale
      style={styles.item}
      scaleTo={0.95}
      onPress={() => router.push('/track')}
    >
      <Animated.View style={[styles.trackInner, animatedStyle]}>
        <Ionicons name="navigate-outline" size={22} color="#fff" />
      </Animated.View>

      <Text style={[styles.label, active && styles.labelActive]}>
        Track
      </Text>
    </PressableScale>
  );
}

export function BottomNavbar({ activeTab }: { activeTab: TabKey }) {
  const COLORS = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
        {TABS.map((tab) =>
          tab.key === 'track' ? (
            <TrackTabItem
              key={tab.key}
              active={activeTab === 'track'}
              styles={styles}
              COLORS={COLORS}
            />
          ) : (
            <TabItem
              key={tab.key}
              tab={tab}
              active={tab.key === activeTab}
              styles={styles}
              COLORS={COLORS}
            />
          )
        )}
      </View>
    </View>
  );
}

const createStyles = (COLORS: AppColors) => {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  const navbarBg = isDark ? '#07111F' : COLORS.surface;
  const borderColor = isDark ? 'rgba(96,165,250,0.15)' : COLORS.border;
  const activeColor = isDark ? '#60A5FA' : COLORS.primary;

  return StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      overflow: 'visible',
    },

    wrap: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingHorizontal: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: borderColor,
      backgroundColor: navbarBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'visible',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: isDark ? 0.25 : 0.07,
      shadowRadius: 16,
      elevation: 16,
    },

    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 8,
      gap: 5,
    },

    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    label: {
      fontSize: 10,
      fontWeight: '600',
      color: isDark ? '#334155' : COLORS.mutedDark,
      letterSpacing: 0.3,
      textAlign: 'center',
    },

    labelActive: {
      color: activeColor,
      fontWeight: '700',
    },

    trackInner: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -22,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(147,197,253,0.25)' : 'rgba(255,255,255,0.55)',
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 8,
    },
  });
};