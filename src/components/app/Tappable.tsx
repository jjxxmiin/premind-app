import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion } from '@/components/ui/Motion';
import type { PressState } from '@/components/ui/interaction';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TappableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode | ((state: PressState) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  /** How far it sinks when pressed (1 = not at all). Cards 0.98, buttons 0.96. */
  pressScale?: number;
  /** A light tap on native. Off for rows that scroll past the thumb. */
  haptic?: boolean;
}

/**
 * 앱다운 누름(2026-09-26 "너무 웹 같다"): 누르면 살짝 가라앉고(스프링) 폰에서는 가볍게 떨린다.
 * 웹에서는 hover 가 그대로 PressState 로 온다. 움직임 줄이기 설정이면 가라앉지 않는다.
 */
export function Tappable({ children, style, pressScale = 0.98, haptic = true, onPressIn, onPressOut, onPress, ...rest }: TappableProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        if (!reduced) scale.set(withSpring(pressScale, { damping: 20, stiffness: 400 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 18, stiffness: 300 }));
        onPressOut?.(event);
      }}
      style={(state: PressState) => [typeof style === 'function' ? style(state) : style, animated]}
    >
      {children as PressableProps['children']}
    </AnimatedPressable>
  );
}
