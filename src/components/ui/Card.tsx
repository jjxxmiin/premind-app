import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, motion, radii, spacing } from '@/theme/tokens';

/**
 * `default` — white with a hairline border; the list/detail container.
 * `soft` — a light grey fill with no border; feature tiles and quiet panels.
 * `outlined` — transparent with a stronger border; selectable options.
 * `stage` — dark; the recording stage and media players.
 */
export type CardVariant = 'default' | 'soft' | 'outlined' | 'stage';

export interface CardProps extends Omit<ViewProps, 'style'> {
  variant?: CardVariant;
  padding?: boolean | number;
  selected?: boolean;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  soft: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.backgroundSoft,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  stage: {
    backgroundColor: colors.stageRaised,
    borderColor: colors.stageBorder,
  },
};

export function Card({
  children,
  variant = 'default',
  padding = true,
  selected,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
  ...props
}: PropsWithChildren<CardProps>) {
  const isSelected = selected === true;
  const paddingValue =
    typeof padding === 'number' ? padding : padding ? spacing.gutter : 0;
  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    variantStyles[variant],
    { padding: paddingValue },
    isSelected ? styles.selected : null,
    disabled ? styles.disabled : null,
    style,
  ];

  if (!onPress) {
    return (
      <View {...props} style={baseStyle}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      {...props}
      aria-pressed={selected === undefined ? undefined : isSelected}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected: isSelected }),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [baseStyle, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.text,
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: motion.press.cardScale }],
  },
});
