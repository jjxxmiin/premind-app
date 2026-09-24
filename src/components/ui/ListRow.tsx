import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import {
  colors,
  iconSizes,
  radii,
  sizes,
  spacing,
} from '@/theme/tokens';

import { AppText } from './AppText';

export interface ListRowProps extends Omit<ViewProps, 'style'> {
  title: string;
  subtitle?: string;
  metadata?: string;
  leadingIcon?: LucideIcon;
  leading?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  selected?: boolean;
  disabled?: boolean;
  divider?: boolean;
  /** Tighter row for settings groups and menus. */
  compact?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The row of a list. Rows are flat and separated by hairlines; the container
 * (a Card or a SettingsGroup) supplies the outer border.
 */
export function ListRow({
  title,
  subtitle,
  metadata,
  leadingIcon: LeadingIcon,
  leading,
  trailing,
  showChevron,
  selected = false,
  disabled = false,
  divider = true,
  compact = false,
  onPress,
  style,
  accessibilityLabel,
  ...props
}: ListRowProps) {
  const shouldShowChevron = showChevron ?? Boolean(onPress);
  const content = (
    <>
      {leading ? (
        <View style={styles.leading}>{leading}</View>
      ) : LeadingIcon ? (
        <View style={[styles.iconBox, selected ? styles.selectedIconBox : null]}>
          <LeadingIcon
            {...decorative}
            color={selected ? colors.brandText : colors.text}
            size={iconSizes.section}
            strokeWidth={1.9}
          />
        </View>
      ) : null}
      <View style={styles.copy}>
        <AppText numberOfLines={2} variant={compact ? 'body' : 'itemTitle'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText numberOfLines={2} tone="muted" variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {metadata ? (
        <AppText numberOfLines={1} tabular tone="muted" variant="meta">
          {metadata}
        </AppText>
      ) : null}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {shouldShowChevron ? (
        <ChevronRight
          {...decorative}
          color={colors.textFaint}
          size={iconSizes.section}
          strokeWidth={1.8}
        />
      ) : null}
    </>
  );
  const sharedStyle: StyleProp<ViewStyle> = [
    styles.row,
    compact ? styles.compactRow : null,
    divider ? styles.divider : null,
    selected ? styles.selected : null,
    disabled ? styles.disabled : null,
    style,
  ];

  if (!onPress) {
    return (
      <View {...props} accessibilityLabel={accessibilityLabel} style={sharedStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        sharedStyle,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  compactRow: {
    minHeight: 54,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selected: {
    backgroundColor: colors.brandSubtle,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  selectedIconBox: {
    backgroundColor: colors.brandSoft,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
