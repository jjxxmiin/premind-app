import { ChevronRight, Headphones, PenLine, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import type { PlanItem, PlanKind } from '@/lib/mastery';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

export interface PlanRowProps {
  item: PlanItem;
  onPress: (item: PlanItem) => void;
  divider?: boolean;
}

const ICONS: Record<PlanKind, LucideIcon> = {
  relisten: Headphones,
  retry: RotateCcw,
  start: PenLine,
};

const HINTS: Record<PlanKind, string> = {
  relisten: '그 시점부터 대본과 함께 재생해요',
  retry: '이 자료의 문제를 다시 풀어요',
  start: '이 자료의 문제를 풀어요',
};

const ROW_HEIGHT = 54;
const WELL_SIZE = 36;

/** One thing to do next: a 36pt icon well, the term or action, where it is. */
export function PlanRow({ divider = true, item, onPress }: PlanRowProps) {
  const Icon = ICONS[item.kind];
  return (
    <Pressable
      accessibilityHint={HINTS[item.kind]}
      accessibilityLabel={`${item.title}. ${item.detail}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        divider ? styles.divider : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.well}>
        <Icon {...decorative} color={colors.text} size={iconSizes.section} strokeWidth={1.9} />
      </View>
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="itemTitle">
          {item.title}
        </AppText>
        <AppText numberOfLines={2} tone="muted" variant="meta">
          {item.detail}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <ChevronRight
          {...decorative}
          color={colors.textFaint}
          size={iconSizes.section}
          strokeWidth={1.8}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  well: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    flexShrink: 0,
    height: WELL_SIZE,
    justifyContent: 'center',
    width: WELL_SIZE,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  /** The trailing column is a fixed 44pt so text never runs under the chevron. */
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginRight: -spacing.md,
    width: sizes.minimumTouchTarget,
  },
});
