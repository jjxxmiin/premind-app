import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import {
  colors,
  motion,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';

import { AppText } from './AppText';

/**
 * `primary` is the filled ink CTA — the default "go" of a screen.
 * `brand` is the accent-filled CTA, reserved for the one action the product
 * is about (start recording, generate). Use at most one filled button per view.
 */
export type ButtonVariant =
  | 'primary'
  | 'brand'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Overrides the label colour for buttons wearing an external brand's palette. */
  textStyle?: StyleProp<TextStyle>;
}

interface ButtonVisuals {
  container: ViewStyle;
  text: TextStyle;
  activity: string;
}

const variantStyles: Record<ButtonVariant, ButtonVisuals> = {
  primary: {
    container: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    text: { color: colors.textInverse },
    activity: colors.textInverse,
  },
  brand: {
    container: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    text: { color: colors.textInverse },
    activity: colors.textInverse,
  },
  secondary: {
    container: {
      backgroundColor: colors.backgroundMuted,
      borderColor: colors.backgroundMuted,
    },
    text: { color: colors.text },
    activity: colors.text,
  },
  outline: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    text: { color: colors.text },
    activity: colors.text,
  },
  ghost: {
    container: {
      backgroundColor: colors.transparent,
      borderColor: colors.transparent,
    },
    text: { color: colors.textSoft },
    activity: colors.textSoft,
  },
  danger: {
    container: {
      backgroundColor: colors.negativeSoft,
      borderColor: colors.negativeSoft,
    },
    text: { color: colors.negativeStrong },
    activity: colors.negativeStrong,
  },
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  small: {
    minHeight: sizes.buttonSmall,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  medium: {
    minHeight: sizes.button,
    borderRadius: radii.button,
    paddingHorizontal: spacing.gutter,
  },
  large: {
    minHeight: sizes.buttonLarge,
    borderRadius: radii.largeButton,
    paddingHorizontal: spacing.lg,
  },
};

const sizeTypography: Record<ButtonSize, TextStyle> = {
  small: typography.buttonSmall,
  medium: typography.button,
  large: typography.buttonLarge,
};

const pressedStyles: Partial<Record<ButtonVariant, ViewStyle>> = {
  primary: {
    backgroundColor: colors.actionPressed,
    borderColor: colors.actionPressed,
  },
  brand: {
    backgroundColor: colors.brandPressed,
    borderColor: colors.brandPressed,
  },
  secondary: {
    backgroundColor: colors.borderStrong,
    borderColor: colors.borderStrong,
  },
  outline: {
    backgroundColor: colors.backgroundSoft,
  },
  ghost: {
    backgroundColor: colors.backgroundSoft,
  },
};

export function Button({
  children,
  variant = 'secondary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const visuals = variantStyles[variant];
  const isDisabled = disabled || loading;
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined);
  const content = (
    <View
      {...(loading ? decorative : {})}
      style={[styles.content, loading ? styles.loadingContent : null]}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      {typeof children === 'string' || typeof children === 'number' ? (
        <AppText
          align="center"
          style={[styles.label, sizeTypography[size], visuals.text, textStyle]}
        >
          {children}
        </AppText>
      ) : (
        children
      )}
      {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
    </View>
  );

  return (
    <Pressable
      {...props}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        visuals.container,
        fullWidth ? styles.fullWidth : null,
        style,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        pressed && !isDisabled ? pressedStyles[variant] : null,
      ]}
    >
      {content}
      {loading ? (
        <View {...decorative} pointerEvents="none" style={styles.loadingIndicator}>
          <ActivityIndicator color={visuals.activity} size="small" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    flexShrink: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
  loadingContent: {
    opacity: 0,
  },
  loadingIndicator: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    transform: [{ scale: motion.press.buttonScale }],
  },
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
