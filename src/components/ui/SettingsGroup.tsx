import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface SettingsGroupProps {
  /** A small grey caption above the group. */
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A block of settings rows. Groups are separated by the canvas showing
 * through, not by cards, so a long settings screen reads as one calm list.
 */
export function SettingsGroup({
  title,
  style,
  children,
}: PropsWithChildren<SettingsGroupProps>) {
  return (
    <View style={[styles.group, style]}>
      {title ? (
        <AppText style={styles.groupTitle} tone="muted" variant="meta">
          {title}
        </AppText>
      ) : null}
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

export interface SettingsRowProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Right-aligned quiet text, e.g. the current value or a version number. */
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Renders a switch on the right. Overrides `trailing`. */
  toggled?: boolean;
  onToggle?: (value: boolean) => void;
  tone?: 'default' | 'negative';
  /** Defaults to showing a chevron on pressable rows. Actions (로그아웃) hide it. */
  showChevron?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * React Native Web paints the checked thumb from `activeThumbColor`, a prop
 * that does not exist in RN's types; without it the thumb turns teal on web.
 */
const webSwitchProps = Platform.OS === 'web'
  ? ({ activeThumbColor: colors.surface } as Record<string, string>)
  : {};

export function SettingsRow({
  title,
  description,
  icon: Icon,
  value,
  trailing,
  onPress,
  toggled,
  onToggle,
  tone = 'default',
  showChevron,
  disabled = false,
  testID,
}: SettingsRowProps) {
  const isSwitch = typeof toggled === 'boolean' && onToggle;
  const interactive = Boolean(onPress) && !isSwitch;
  const content = (
    <>
      {Icon ? (
        <Icon
          {...decorative}
          color={tone === 'negative' ? colors.negative : colors.text}
          size={iconSizes.section}
          strokeWidth={1.9}
        />
      ) : null}
      <View style={styles.copy}>
        <AppText
          numberOfLines={2}
          tone={tone === 'negative' ? 'negative' : 'default'}
          variant="body"
        >
          {title}
        </AppText>
        {description ? (
          <AppText numberOfLines={2} tone="muted" variant="meta">
            {description}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText numberOfLines={1} tone="muted" variant="body">
          {value}
        </AppText>
      ) : null}
      {isSwitch ? (
        <Switch
          {...webSwitchProps}
          accessibilityLabel={title}
          disabled={disabled}
          ios_backgroundColor={colors.borderStrong}
          onValueChange={onToggle}
          thumbColor={colors.surface}
          trackColor={{ false: colors.borderStrong, true: colors.brand }}
          value={toggled}
        />
      ) : trailing ? (
        trailing
      ) : interactive && (showChevron ?? tone !== 'negative') ? (
        <ChevronRight
          {...decorative}
          color={colors.textFaint}
          size={iconSizes.section}
          strokeWidth={1.8}
        />
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <View
        style={[styles.row, disabled ? styles.disabled : null]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    paddingBottom: spacing.xs,
  },
  rows: {
    backgroundColor: colors.surface,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
