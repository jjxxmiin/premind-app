import { type LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import {
  colors,
  iconSizes,
  motion,
  radii,
  sizes,
} from '@/theme/tokens';

export type IconButtonVariant =
  | 'neutral'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'inverse';
export type IconButtonSize = 'small' | 'medium' | 'large';

export interface IconButtonProps
  extends Omit<PressableProps, 'children' | 'style'> {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  iconSize?: number;
  /** Tint the glyph with the accent. For a "live" state only. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface IconButtonVisuals {
  container: ViewStyle;
  color: string;
}

const variantStyles: Record<IconButtonVariant, IconButtonVisuals> = {
  neutral: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    color: colors.text,
  },
  soft: {
    container: {
      backgroundColor: colors.backgroundMuted,
      borderColor: colors.backgroundMuted,
    },
    color: colors.text,
  },
  ghost: {
    container: {
      backgroundColor: colors.transparent,
      borderColor: colors.transparent,
    },
    color: colors.text,
  },
  danger: {
    container: {
      backgroundColor: colors.negativeSoft,
      borderColor: colors.negativeSoft,
    },
    color: colors.negativeStrong,
  },
  inverse: {
    container: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderColor: 'rgba(255,255,255,0.14)',
    },
    color: colors.stageText,
  },
};

const visualSizes: Record<IconButtonSize, number> = {
  small: sizes.iconButton,
  medium: sizes.button,
  large: sizes.buttonLarge,
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'small',
  iconSize = iconSizes.section,
  active = false,
  disabled = false,
  style,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled === true;
  const visuals = variantStyles[variant];
  const visualSize = visualSizes[size];

  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={4}
      style={[
        styles.touchTarget,
        { minHeight: Math.max(visualSize, sizes.minimumTouchTarget) },
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.visual,
            visuals.container,
            { height: visualSize, width: visualSize },
            pressed && !isDisabled ? styles.pressed : null,
          ]}
        >
          <Icon
            {...decorative}
            color={active ? colors.brand : visuals.color}
            size={iconSize}
            strokeWidth={2}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: sizes.minimumTouchTarget,
  },
  visual: {
    alignItems: 'center',
    borderRadius: radii.iconButton,
    borderWidth: 1,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: colors.backgroundMuted,
    opacity: 0.85,
    transform: [{ scale: motion.press.buttonScale }],
  },
});
