import { Check, Grid2X2, List } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  BottomSheetModal,
  Button,
  SegmentedControl,
  type SegmentOption,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  activeFilterCount,
  type LibraryFilters,
  type StatusFilter,
} from './library';

const VIEW_OPTIONS = [
  { value: 'card', label: '카드', icon: Grid2X2 },
  { value: 'list', label: '목록', icon: List },
] as const;

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  statusOptions: readonly SegmentOption<StatusFilter>[];
  savedCount: number;
}

/**
 * Everything that reorders or narrows the list, in one sheet: sort, status,
 * the saved-only switch and the card/list toggle. Opened from the toolbar's
 * sort control, so sort comes first. Changes apply as they are made; the
 * only footer action is a quiet reset, and the sheet's own close puts it away.
 */
export function FilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  statusOptions,
  savedCount,
}: FilterSheetProps) {
  const activeCount = activeFilterCount(filters);
  const update = (patch: Partial<LibraryFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <BottomSheetModal
      footer={
        // Only when there is something to undo: a permanently greyed-out
        // button at the foot of the sheet reads as a control that is broken.
        activeCount > 0 ? (
          <Button
            accessibilityHint="정렬과 필터를 처음 상태로 되돌려요"
            fullWidth
            onPress={() => onChange({ ...DEFAULT_FILTERS, view: filters.view })}
            variant="ghost"
          >
            초기화
          </Button>
        ) : undefined
      }
      onClose={onClose}
      scrollable={false}
      title="정렬과 필터"
      visible={visible}
    >
      <View style={styles.sections}>
        <View style={styles.section}>
          <AppText tone="soft" variant="meta">
            정렬
          </AppText>
          <View accessibilityRole="radiogroup" style={styles.radioGroup}>
            {SORT_OPTIONS.map((option, index) => {
              const checked = option.value === filters.sort;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  aria-checked={checked}
                  key={option.value}
                  onPress={() => update({ sort: option.value })}
                  style={({ pressed }) => [
                    styles.radioRow,
                    index < SORT_OPTIONS.length - 1 ? styles.rowDivider : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <AppText
                    style={styles.rowLabel}
                    variant={checked ? 'bodyStrong' : 'body'}
                  >
                    {option.label}
                  </AppText>
                  {checked ? (
                    <Check
                      {...decorative}
                      color={colors.text}
                      size={iconSizes.section}
                      strokeWidth={2.4}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <AppText tone="soft" variant="meta">
            상태
          </AppText>
          <View accessibilityLabel="자료 상태 필터">
            <SegmentedControl
              onChange={(status) => update({ status })}
              options={statusOptions}
              value={filters.status}
            />
          </View>
        </View>

        <Pressable
          accessibilityLabel={`저장한 자료만 보기, ${savedCount}개`}
          accessibilityRole="switch"
          accessibilityState={{ checked: filters.savedOnly }}
          aria-checked={filters.savedOnly}
          onPress={() => update({ savedOnly: !filters.savedOnly })}
          style={({ pressed }) => [styles.switchRow, pressed ? styles.pressed : null]}
        >
          <View style={styles.switchCopy}>
            <AppText variant="body">저장한 자료만</AppText>
            <AppText tone="muted" variant="meta">
              저장한 자료 {savedCount}개
            </AppText>
          </View>
          <View
            {...decorative}
            style={[styles.track, filters.savedOnly ? styles.trackOn : null]}
          >
            <View
              style={[styles.knob, filters.savedOnly ? styles.knobOn : null]}
            />
          </View>
        </Pressable>

        <View style={styles.section}>
          <AppText tone="soft" variant="meta">
            보기
          </AppText>
          <SegmentedControl
            onChange={(view) => update({ view })}
            options={VIEW_OPTIONS}
            value={filters.view}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const KNOB = 20;

const styles = StyleSheet.create({
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  radioGroup: {
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  radioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  switchRow: {
    alignItems: 'center',
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
  },
  switchCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  track: {
    backgroundColor: colors.borderStrong,
    borderRadius: radii.full,
    flexShrink: 0,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: TRACK_WIDTH,
  },
  trackOn: {
    backgroundColor: colors.action,
  },
  knob: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: KNOB,
    width: KNOB,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});
