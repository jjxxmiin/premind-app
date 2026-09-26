import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion, type PressState } from '@/components/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode | ((state: PressState) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  /** How far it sinks when pressed (1 = not at all). Cards 0.98, buttons 0.96. */
  pressScale?: number;
  haptic?: boolean;
}

/**
 * `app/Tappable` 과 같은 누름(가라앉음 + 폰 진동)인데, 스타일을 함수로 넘기지 않는다.
 * 2026-09-26 실측: reanimated 로 감싼 Pressable 에 style 함수를 주면 웹에서 스타일이 통째로 빠진다
 * (Tappable 을 쓴 알약, 카드의 배경과 여백이 사라졌다). 그래서 눌림, hover, 포커스를 상태로 들고
 * 매번 평범한 스타일 배열을 넘긴다. Tappable 이 고쳐지면 이 파일은 지우고 그쪽을 쓴다.
 */
export function Press({ children, style, pressScale = 0.98, haptic = true, onPressIn, onPressOut, onPress, onHoverIn, onHoverOut, onFocus, onBlur, ...rest }: PressProps) {
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
