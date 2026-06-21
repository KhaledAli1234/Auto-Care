import { PressableScale } from '@/components/pressable-scale';
import { AppColors, useThemeColors } from '@/context/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

const ICON_SIZE = 22;

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
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.1 }],
  }));

  const color = active ? COLORS.text : COLORS.mutedDark;

  return (
    <PressableScale
      style={styles.item}
      scaleTo={0.92}
      onPress={() => {
        if (tab.route) router.push(tab.route);
      }}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={tab.icon} size={ICON_SIZE} color={color} />
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
    transform: [{ scale: 1 + progress.value * 0.06 }],
    shadowOpacity: 0.4 + progress.value * 0.4,
  }));

  return (
    <PressableScale
      style={styles.trackButton}
      scaleTo={0.95}
      onPress={() => router.push('/track')}
    >
      <Animated.View
        style={[
          styles.trackInner,
          active && styles.trackInnerActive,
          animatedStyle,
        ]}
      >
        <Ionicons name="radio-outline" size={26} color="#fff" />
      </Animated.View>

      <Text style={[styles.label, active && styles.labelActive]}>
        Track
      </Text>
    </PressableScale>
  );
}

export function BottomNavbar({ activeTab }: { activeTab: TabKey }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <View style={styles.wrap}>
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

const createStyles = (COLORS: AppColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      overflow: 'visible',
    },

    wrap: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 20,
      overflow: 'visible',
    },

    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 5,
    },

    trackButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
    },

    trackInner: {
      width: 62,
      height: 62,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -50,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },

    trackInnerActive: {
      backgroundColor: COLORS.primary,
    },

    label: {
      color: COLORS.mutedDark,
      fontSize: 12,
      fontWeight: '500',
    },

    labelActive: {
      color: COLORS.text,
      fontWeight: '600',
    },
  });