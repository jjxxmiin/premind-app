import type { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface SpeakTab<T extends string> {
  value: T;
  label: string;
  accessibilityLabel?: string;
  icon?: LucideIcon;
}

type PressState = { hovered?: boolean; pressed: boolean; focused?: boolean };

/**
 * 말하기 탭의 발표/면접 고르기. 버튼 두 개가 아니라 탭으로 읽히게, 밑줄 탭이다.
 * 선택된 쪽은 진한 글자와 주황 밑줄, 나머지는 옅은 글자(웹은 hover 에 배경이 살짝).
 * (공용으로 올릴 만하다: ui/Tabs)
 */
export function SpeakTabs<T extends string>({
  value,
  options,
  onChange,
  testID,
}: {
  value: T;
  options: readonly SpeakTab<T>[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.bar} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            aria-selected={selected}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ hovered, pressed, focused }: PressState) => [
              styles.tab,
              hovered && !selected ? styles.tabHover : null,
              pressed ? styles.tabPressed : null,
              focused && Platform.OS === 'web' ? styles.tabFocus : null,
            ]}
          >
            <View style={styles.inner}>
              {Icon ? (
                <Icon
                  {...decorative}
                  color={selected ? colors.text : colors.textMuted}
                  size={iconSizes.inline}
                  strokeWidth={2}
                />
              ) : null}
              <AppText numberOfLines={1} tone={selected ? 'default' : 'muted'} variant="label">
                {option.label}
              </AppText>
            </View>
            <View {...decorative} style={[styles.underline, selected ? styles.underlineOn : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tab: {
    borderTopLeftRadius: radii.badge,
    borderTopRightRadius: radii.badge,
    cursor: 'pointer',
    marginBottom: -1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  tabHover: {
    backgroundColor: colors.backgroundSoft,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabFocus: {
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
    outlineWidth: 2,
  } as object,
  inner: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  underline: {
    backgroundColor: colors.transparent,
    borderRadius: 1,
    height: 2,
  },
  underlineOn: {
    backgroundColor: colors.brand,
  },
});
