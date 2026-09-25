import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { countCheckedPoints, toggleCheckedPoint } from '@/lib/study-notebook';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export interface KeyPointChecklistProps {
  /** The summary's 꼭 기억할 내용, in order. */
  keyPoints: readonly string[];
  /** `studyNotes[materialId].checkedPoints`. */
  checkedPoints: readonly string[];
  /** Receives the next `checkedPoints` after a row is tapped. */
  onChange: (checkedPoints: string[]) => void;
}

const BOX_SIZE = 22;

/**
 * The key points of a summary as check rows. Sits inside the padded 요약
 * card, so rows carry no horizontal padding of their own and a press dims
 * the row instead of tinting it.
 */
export function KeyPointChecklist({
  keyPoints,
  checkedPoints,
  onChange,
}: KeyPointChecklistProps) {
  const t = useT();
  const checkedCount = countCheckedPoints(keyPoints, checkedPoints);
  const allChecked = keyPoints.length > 0 && checkedCount === keyPoints.length;

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <AppText accessibilityRole="header" style={styles.title} variant="heading">
          {t('꼭 기억할 내용')}
        </AppText>
        <AppText
          accessibilityLiveRegion="polite"
          testID="key-point-progress"
          tone={allChecked ? 'positive' : 'muted'}
          variant="meta"
        >
          {t('{total}개 중 {n}개 확인', { total: keyPoints.length, n: checkedCount })}
        </AppText>
      </View>
      <View>
        {keyPoints.map((point, index) => {
          const checked = checkedPoints.includes(point);
          return (
            <Pressable
              aria-checked={checked}
              accessibilityHint={t('이해했으면 체크해요.')}
              accessibilityLabel={point}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              key={point}
              onPress={() => onChange(toggleCheckedPoint(checkedPoints, point))}
              style={({ pressed }) => [
                styles.row,
                index < keyPoints.length - 1 ? styles.rowDivider : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View
                {...decorative}
                style={[styles.box, checked ? styles.boxChecked : null]}
              >
                {checked ? (
                  <Check color={colors.textInverse} size={14} strokeWidth={3} />
                ) : null}
              </View>
              <AppText
                style={styles.label}
                tone={checked ? 'muted' : 'default'}
                variant="body"
              >
                {point}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Section title → its rows: 12, minus the first row's own top padding. */
  block: { gap: spacing.xs },
  head: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  title: { flexShrink: 1 },
  row: {
    // A key point is a whole sentence now, so it wraps to two or three lines.
    // Centring the box against that makes it look attached to the middle line;
    // it belongs beside the first, with a nudge down to sit on the text.
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.minimumTouchTarget,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.badge,
    borderWidth: 1.5,
    flexShrink: 0,
    height: BOX_SIZE,
    justifyContent: 'center',
    width: BOX_SIZE,
    // Sits on the first line's cap height, not above it.
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  label: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
});
