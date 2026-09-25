import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { AppText, ProgressBar } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, fontFamilies, spacing } from '@/theme/tokens';
import type { LensRubricScore } from '@/types';

import {
  SCORE_MAX,
  pointsAttr,
  radarGrid,
  radarLabel,
  radarPolygon,
} from './lens-charts';
import { rubricLabel } from './lens-copy';

export interface RubricRadarProps {
  rubric: readonly LensRubricScore[];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 280;
/** Room on each side for a four-character label plus its gap. */
const LABEL_ROOM = 64;
const LABEL_GAP = 12;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE = 18;
const MIN_RADIUS = 56;
const MAX_RADIUS = 96;
const GRID_RINGS = 4;
const VERTEX_RADIUS = 3;
/** Fewer than three dimensions do not make a polygon; the bars carry it alone. */
const MIN_DIMENSIONS = 3;
const SCORE_COLUMN = 36;
const LABEL_COLUMN = 64;
/** English rubric names ("Structure") run wider than the Korean ones. */
const LABEL_COLUMN_EN = 72;

/**
 * The rubric as a spider chart on a light grid, with a compact bar per
 * dimension underneath so the exact numbers are never hidden in the shape.
 */
export function RubricRadar({ rubric, style }: RubricRadarProps) {
  const t = useT();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const values = rubric.map((metric) => metric.score);
  const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, width / 2 - LABEL_ROOM));
  const height = (radius + LABEL_GAP + LABEL_LINE) * 2;
  const cx = width / 2;
  const cy = height / 2;
  const count = rubric.length;
  const showRadar = count >= MIN_DIMENSIONS;
  const grid = showRadar ? radarGrid(count, cx, cy, radius, GRID_RINGS) : [];
  const outer = grid[grid.length - 1] ?? [];
  const polygon = showRadar ? radarPolygon(values, cx, cy, radius) : [];
  const summary = rubric
    .map(
      (metric) =>
        `${rubricLabel(metric, t.locale)} ${t('{score}점', { score: metric.score.toFixed(1) })}`,
    )
    .join(', ');

  return (
    <View
      accessibilityLabel={t('항목별 점수, {max}점 만점. {summary}', { max: SCORE_MAX, summary })}
      accessible
      onLayout={(event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      style={[styles.wrap, style]}
    >
      {showRadar ? (
        <View {...decorative} style={styles.chart}>
          <Svg height={height} width={width}>
            {grid.map((ring, ringIndex) => (
              <Polygon
                fill="none"
                key={`ring-${ringIndex}`}
                points={pointsAttr(ring)}
                stroke={ringIndex === grid.length - 1 ? colors.borderStrong : colors.border}
                strokeWidth={1}
              />
            ))}
            {outer.map((vertex, index) => (
              <Line
                key={`spoke-${index}`}
                stroke={colors.border}
                strokeWidth={1}
                x1={cx}
                x2={vertex.x}
                y1={cy}
                y2={vertex.y}
              />
            ))}
            <Polygon
              fill={colors.text}
              fillOpacity={0.12}
              points={pointsAttr(polygon)}
              stroke={colors.text}
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
            {polygon.map((vertex, index) => (
              <Circle
                cx={vertex.x}
                cy={vertex.y}
                fill={colors.text}
                key={`vertex-${index}`}
                r={VERTEX_RADIUS}
                stroke={colors.surface}
                strokeWidth={1.5}
              />
            ))}
            {rubric.map((metric, index) => {
              const label = radarLabel(cx, cy, radius, index, count, LABEL_GAP, LABEL_FONT_SIZE);
              return (
                <SvgText
                  fill={colors.textMuted}
                  fontFamily={fontFamilies.bold}
                  fontSize={LABEL_FONT_SIZE}
                  key={metric.key}
                  textAnchor={label.textAnchor}
                  x={label.x}
                  y={label.y}
                >
                  {rubricLabel(metric, t.locale)}
                </SvgText>
              );
            })}
          </Svg>
        </View>
      ) : null}
      <View style={styles.bars}>
        {rubric.map((metric) => (
          <View key={metric.key} style={styles.barRow}>
            <AppText numberOfLines={1} style={t.locale === 'en' ? styles.barLabelEn : styles.barLabel} tone="muted" variant="meta">
              {rubricLabel(metric, t.locale)}
            </AppText>
            <View style={styles.barTrack}>
              <ProgressBar height={4} tone="ink" value={(metric.score / SCORE_MAX) * 100} />
            </View>
            <AppText align="right" style={styles.barScore} tabular variant="label">
              {metric.score.toFixed(1)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.md },
  chart: { alignItems: 'center' },
  bars: { gap: spacing.sm },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  barLabel: { width: LABEL_COLUMN },
  barLabelEn: { width: LABEL_COLUMN_EN },
  barTrack: { flex: 1, minWidth: 0 },
  barScore: { width: SCORE_COLUMN },
});
