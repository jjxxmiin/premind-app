import { type LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { PressState } from './interaction';

export interface ChipProps
  extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}

export type StatusTone =
  | 'neutral'
  | 'brand'
  | 'positive'
  | 'warning'
  | 'negative'
  | 'info';

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ChipVisuals {
  container: ViewStyle;
  text: TextStyle;
  icon: string;
}

/** A pill filter: white when idle, ink when selected. */
const chipVisuals: Record<'default' | 'selected', ChipVisuals> = {
  default: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    text: { color: colors.textSoft },
    icon: colors.textMuted,
  },
  selected: {
    container: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    text: { color: colors.textInverse },
    icon: colors.textInverse,
  },
};

interface StatusVisuals {
  container: ViewStyle;
  text: TextStyle;
  dot: string;
}

const statusVisuals: Record<StatusTone, StatusVisuals> = {
  neutral: {
    container: { backgroundColor: colors.backgroundMuted },
    text: { color: colors.textSoft },
    dot: colors.textFaint,
  },
  brand: {
    container: { backgroundColor: colors.brandSoft },
    text: { color: colors.brandText },
    dot: colors.brand,
  },
  positive: {
    container: { backgroundColor: colors.positiveSoft },
    text: { color: colors.positiveStrong },
    dot: colors.positive,
  },
  warning: {
    container: { backgroundColor: colors.warningSoft },
    text: { color: colors.warningStrong },
    dot: colors.warning,
  },
  negative: {
    container: { backgroundColor: colors.negativeSoft },
    text: { color: colors.negativeStrong },
    dot: colors.negative,
  },
  info: {
    container: { backgroundColor: '#EBF2FA' },
    text: { color: '#2F5FA8' },
    dot: '#3D7BE8',
  },
};

export function Chip({
  label,
  selected,
  icon: Icon,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
  ...props
}: ChipProps) {
  const isDisabled = disabled === true;
  const isSelected = selected === true;
  const visuals = chipVisuals[isSelected ? 'selected' : 'default'];
  const content = (
    <>
      {Icon ? (
        <Icon
          {...decorative}
          color={visuals.icon}
          size={iconSizes.dense}
          strokeWidth={2}
        />
      ) : null}
      <AppText variant="label" style={[styles.label, visuals.text]}>
        {label}
      </AppText>
    </>
  );
  const sharedStyle: StyleProp<ViewStyle> = [
    styles.chip,
    visuals.container,
    isDisabled ? styles.disabled : null,
    style,
  ];

  if (!onPress) {
    return (
      <View {...props} accessibilityLabel={accessibilityLabel ?? label} style={sharedStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      {...props}
      aria-pressed={selected === undefined ? undefined : isSelected}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        ...(selected === undefined ? {} : { selected: isSelected }),
      }}
      disabled={isDisabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        sharedStyle,
        hovered && !pressed && !isDisabled
          ? isSelected
            ? styles.hoverSelected
            : styles.hover
          : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
  showDot = false,
  style,
  testID,
}: StatusBadgeProps) {
  const visuals = statusVisuals[tone];

  return (
    <View
      accessibilityLabel={label}
      style={[styles.badge, visuals.container, style]}
      testID={testID}
    >
      {showDot ? (
        <View
          {...decorative}
          style={[styles.dot, { backgroundColor: visuals.dot }]}
        />
      ) : null}
      <AppText variant="badge" style={[styles.label, visuals.text]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.chip,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    minHeight: sizes.chip,
    paddingHorizontal: 14,
    paddingVertical: spacing.xs,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.badge,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: '100%',
    minHeight: sizes.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  dot: {
    borderRadius: radii.full,
    flexShrink: 0,
    height: 6,
    width: 6,
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  hover: {
    backgroundColor: colors.hover,
    borderColor: colors.borderHover,
  },
  hoverSelected: {
    backgroundColor: colors.actionPressed,
    borderColor: colors.actionPressed,
  },
  pressed: {
    opacity: 0.7,
  },
});
