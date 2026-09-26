import { type LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import {
  colors,
  iconSizes,
  radii,
  shadows,
  sizes,
  spacing,
} from '@/theme/tokens';

import { AppText } from './AppText';
import type { PressState } from './interaction';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  accessibilityLabel?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  fullWidth = true,
  style,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, fullWidth ? styles.fullWidth : null, style]}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <Pressable
            aria-selected={selected}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="tab"
            accessibilityState={{ disabled: option.disabled, selected }}
            disabled={option.disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed, hovered }: PressState) => [
              styles.segment,
              fullWidth ? styles.flexSegment : null,
              selected ? styles.selectedSegment : null,
              hovered && !selected && !pressed && !option.disabled ? styles.hoverSegment : null,
              option.disabled ? styles.disabled : null,
              pressed && !option.disabled ? styles.pressed : null,
            ]}
          >
            {Icon ? (
              <Icon
                {...decorative}
                color={selected ? colors.text : colors.textMuted}
                size={iconSizes.dense}
                strokeWidth={2}
              />
            ) : null}
            <AppText
              numberOfLines={1}
              tone={selected ? 'default' : 'muted'}
              variant="label"
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.input,
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: sizes.segmentedControl,
    padding: 3,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.input - 2,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: sizes.segmentedControl - 6,
    paddingHorizontal: spacing.md,
  },
  // Equal-width segments centre their label, so the side padding is only a
  // floor against the neighbour. Kept small: four English labels
  // ("Summary", "Transcript", ...) have to fit a 390pt phone, where 12 on
  // each side left "Transc..." (2026-09-26). Korean looks the same either way.
  flexSegment: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  selectedSegment: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  // Unselected segments sit on the grey track; hover lifts them halfway to
  // the white of the selected one.
  hoverSegment: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
