import { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  opacityTo?: number;
}

const TIMING = { duration: 120, easing: Easing.out(Easing.quad) };

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  opacityTo = 0.85,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback((e: any) => {
    scale.value = withTiming(scaleTo, TIMING);
    opacity.value = withTiming(opacityTo, TIMING);
    onPressIn?.(e);
  }, [scaleTo, opacityTo, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
    scale.value = withTiming(1, TIMING);
    opacity.value = withTiming(1, TIMING);
    onPressOut?.(e);
  }, [onPressOut]);

  return (
    <Pressable
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}