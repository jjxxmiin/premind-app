import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { ProgressBar } from './ProgressBar';
import { shouldSegment } from './artwork-geometry';

export type ProgressSegment = 'correct' | 'wrong' | 'current' | 'upcoming';

export interface SegmentedProgressProps {
  /** One entry per item, in order. */
  segments: readonly ProgressSegment[];
  /** What the whole strip announces. It carries no per-segment labels. */
  accessibilityLabel: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const GAP = 3;
const DEFAULT_HEIGHT = 5;

const segmentColors: Record<ProgressSegment, string> = {
  correct: colors.text,
  wrong: colors.negative,
  current: colors.borderStrong,
  upcoming: colors.backgroundMuted,
};

/**
 * Progress through a set of items, one tick per item.
 *
 * A single bar says how far along the reader is; a bar per question also says
 * how it went — three solid, one red, the rest waiting — which is the thing
 * worth knowing halfway through a set and the thing worth seeing at the end.
 * Past twenty items the ticks are thinner than the gaps between them at
 * 320dp, so the strip becomes a plain bar rather than a row of hairlines.
 */
export function SegmentedProgress({
  accessibilityLabel,
  height = DEFAULT_HEIGHT,
  segments,
  style,
  testID,
}: SegmentedProgressProps) {
  const answered = segments.filter(
    (segment) => segment === 'correct' || segment === 'wrong',
  ).length;

  if (!shouldSegment(segments.length)) {
    return (
      <View accessibilityLabel={accessibilityLabel} accessible style={style}>
        <ProgressBar
          height={height}
          testID={testID}
          tone="ink"
          value={segments.length ? (answered / segments.length) * 100 : 0}
        />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: segments.length, now: answered }}
      aria-valuemax={segments.length}
      aria-valuemin={0}
      aria-valuenow={answered}
      style={[styles.row, style]}
      testID={testID}
    >
      {segments.map((segment, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            { backgroundColor: segmentColors[segment], height },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: GAP,
  },
  segment: {
    borderRadius: radii.full,
    flex: 1,
    minWidth: 0,
  },
});
