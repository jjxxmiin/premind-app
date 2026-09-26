import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
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
 * 움직임 줄이기 설정이면 가라앉지 않는다.
 *
 * 누름/hover 상태는 여기서 직접 들고 style 을 **값으로** 넘긴다. reanimated 의 애니메이션 Pressable 은
 * 함수 style 을 받지 못해 웹에서 스타일이 통째로 빠졌다(2026-09-26 이해도 갈래가 찾음).
 */
export function Tappable({
  children,
  style,
  pressScale = 0.98,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  ...rest
}: TappableProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const state = { pressed, hovered, focused } as PressState;
  return (
    <AnimatedPressable
      {...rest}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        if (!reduced) scale.set(withSpring(pressScale, { damping: 20, stiffness: 400 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(withSpring(1, { damping: 18, stiffness: 300 }));
        onPressOut?.(event);
      }}
      style={[typeof style === 'function' ? style(state) : style, animated]}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
