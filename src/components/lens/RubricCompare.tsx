import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import type { AppTextTone } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, radii, spacing } from '@/theme/tokens';
import type { LensReport } from '@/types';

import {
  SCORE_MAX,
  formatDelta,
  rubricComparison,
  scoreBarPercent,
  type RubricComparisonRow,
} from './lens-charts';
import { comparisonSentence } from './lens-copy';
import { formatEvaluatedDay } from './lens-history';

export interface RubricCompareProps {
  current: LensReport;
  previous: LensReport;
  /** ISO dates of the two evaluations, newest first. */
  currentAt: string;
  previousAt: string;
  style?: StyleProp<ViewStyle>;
}

const LABEL_COLUMN = 60;
const DELTA_COLUMN = 40;
const CURRENT_BAR = 8;
const PREVIOUS_BAR = 6;

function deltaTone(delta: number): AppTextTone {
  if (delta > 0) return 'positive';
  if (delta < 0) return 'negative';
  return 'faint';
}

/** "3.4에서 4.3으로 +0.9" — one row, read out loud. */
function rowReading(row: RubricComparisonRow): string {
  return `${row.label} ${row.previous.toFixed(1)}에서 ${row.current.toFixed(1)}, ${formatDelta(row.delta)}`;
}

/**
 * 이번 평가 next to 지난 평가: a paired bar per rubric item on one 0–5 scale,
 * the change beside it, and one line on what moved. Only ever drawn when there
 * really are two evaluations of the same recording.
 */
export function RubricCompare({
  current,
  previous,
  currentAt,
  previousAt,
  style,
}: RubricCompareProps) {
  const rows = rubricComparison(current.rubric, previous.rubric);
  const overallDelta = Math.round((current.overall - previous.overall) * 10) / 10;
  const sentence = comparisonSentence(rows);
  const label = [
    `지난 평가와 비교, ${SCORE_MAX}점 만점.`,
    `총점 ${previous.overall.toFixed(1)}에서 ${current.overall.toFixed(1)}, ${formatDelta(overallDelta)}.`,
    rows.map(rowReading).join('. '),
    sentence,
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return (
    <View accessible accessibilityLabel={label} style={[styles.wrap, style]}>
      <View style={styles.totalRow}>
        <AppText tone="muted" variant="meta">
          총점
        </AppText>
        <View style={styles.totalValues}>
          <AppText tabular tone="faint" variant="itemTitle">
            {previous.overall.toFixed(1)}
          </AppText>
          <AppText tone="faint" variant="meta">
            {'→'}
          </AppText>
          <AppText tabular variant="itemTitle">
            {current.overall.toFixed(1)}
          </AppText>
          <AppText
            align="right"
            style={styles.delta}
            tabular
            tone={deltaTone(overallDelta)}
            variant="badge"
          >
            {formatDelta(overallDelta)}
          </AppText>
        </View>
      </View>
      <View {...decorative} style={styles.divider} />
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <AppText numberOfLines={1} style={styles.label} tone="muted" variant="meta">
              {row.label}
            </AppText>
            <View style={styles.bars}>
              <View style={[styles.track, styles.previousTrack]}>
                <View
                  style={[styles.previousFill, { width: scoreBarPercent(row.previous) }]}
                />
              </View>
              <View style={[styles.track, styles.currentTrack]}>
                <View style={[styles.currentFill, { width: scoreBarPercent(row.current) }]} />
              </View>
            </View>
            <AppText
              align="right"
              style={styles.delta}
              tabular
              tone={deltaTone(row.delta)}
              variant="badge"
            >
              {formatDelta(row.delta)}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <LegendItem color={colors.text} label={`이번 ${formatEvaluatedDay(currentAt)}`} />
        <LegendItem color={colors.textFaint} label={`지난 ${formatEvaluatedDay(previousAt)}`} />
      </View>
      {sentence ? <AppText variant="body">{sentence}</AppText> : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View {...decorative} style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText numberOfLines={1} tone="muted" variant="badge">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.md },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  totalValues: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.sm,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  rows: { gap: spacing.md },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: { flexShrink: 0, width: LABEL_COLUMN },
  bars: { flex: 1, gap: spacing.xs, minWidth: 0 },
  track: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  previousTrack: { height: PREVIOUS_BAR },
  currentTrack: { height: CURRENT_BAR },
  previousFill: {
    backgroundColor: colors.textFaint,
    borderRadius: radii.full,
    height: PREVIOUS_BAR,
  },
  currentFill: {
    backgroundColor: colors.text,
    borderRadius: radii.full,
    height: CURRENT_BAR,
  },
  delta: { flexShrink: 0, width: DELTA_COLUMN },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minWidth: 0 },
  legendDot: { borderRadius: radii.full, height: 8, width: 8 },
});
