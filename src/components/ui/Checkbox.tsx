import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface CheckboxProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  /** Renders smaller, for the items grouped under a "select all" row. */
  compact?: boolean;
  /** A trailing control, typically a link to the document being agreed to. */
  trailing?: ReactNode;
  disabled?: boolean;
}

/**
 * A labelled checkbox whose whole row is the target.
 *
 * The box itself is 22pt, far below a thumb's minimum, so the row carries the
 * touch area — tapping the label is the same gesture as tapping the box.
 */
export function Checkbox({
  checked,
  label,
  onChange,
  compact = false,
  trailing,
  disabled = false,
}: CheckboxProps) {
  return (
    <Pressable
      aria-checked={checked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        style={[styles.box, checked ? styles.boxChecked : null]}
        {...decorative}
      >
        {checked ? <Check color={colors.textInverse} size={14} strokeWidth={3} /> : null}
      </View>
      <AppText
        style={styles.label}
        tone={compact ? 'soft' : 'default'}
        variant={compact ? 'body' : 'bodyStrong'}
      >
        {label}
      </AppText>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.minimumTouchTarget,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.badge,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  boxChecked: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
