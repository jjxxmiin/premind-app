import type { LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { Tappable } from '@/components/app';
import { AppText, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme/tokens';

export interface SpeakTab<T extends string> {
  value: T;
  label: string;
  accessibilityLabel?: string;
  icon?: LucideIcon;
}

/**
 * 말하기 탭의 발표/면접 고르기. 2026-09-26 밑줄 탭(웹 같다) → 앱식 둥근 알약 세그먼트(iOS, 토스):
 * 옅은 회색 홈 안에서 고른 쪽만 흰 알약이 떠 있다. 누르면 가라앉고 폰은 가볍게 떨린다.
 * (공용으로 올릴 만하다: ui/SegmentedControl 의 알약판)
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
    <View accessibilityRole="tablist" style={styles.track} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Tappable
            aria-selected={selected}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            pressScale={0.96}
            style={({ hovered, focused }: PressState) => [
              styles.pill,
              selected ? styles.pillOn : hovered ? styles.pillHover : null,
              focused && Platform.OS === 'web' ? styles.focus : null,
            ]}
          >
            {Icon ? (
              <Icon
                {...decorative}
                color={selected ? colors.brand : colors.textMuted}
                size={iconSizes.inline}
                strokeWidth={2.2}
              />
            ) : null}
            <AppText numberOfLines={1} tone={selected ? 'default' : 'muted'} variant="label">
              {option.label}
            </AppText>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 420,
    padding: spacing.xs,
  },
  pill: {
    alignItems: 'center',
    borderRadius: radii.full,
    cursor: 'pointer',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  pillOn: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
    shadowOpacity: 0.08,
  },
  pillHover: {
    backgroundColor: colors.hoverStrong,
  },
  focus: {
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
    outlineWidth: 2,
  } as object,
});
