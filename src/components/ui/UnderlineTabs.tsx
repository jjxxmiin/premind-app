import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { PressState } from './interaction';

export interface UnderlineTabOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Text tabs with an ink underline under the chosen one (direction D,
 * 2026-10-04): the 마인드팩 sheet's 요약, 대본, 마인드맵, 카드. Lighter than a
 * segmented control, so the sheet's first line reads as its title row rather
 * than as another box.
 */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly UnderlineTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.row} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            key={option.value}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={({ pressed }: PressState) => [
              styles.tab,
              selected ? styles.tabOn : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppText tone={selected ? 'default' : 'muted'} variant={selected ? 'heading' : 'bodyStrong'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xl,
  },
  tab: {
    borderBottomColor: colors.transparent,
    borderBottomWidth: 2.5,
    marginBottom: -StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabOn: { borderBottomColor: colors.text },
  pressed: { opacity: 0.6 },
});
