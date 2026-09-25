import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fontFamilies, spacing } from '@/theme/tokens';
import type { LensMoment } from '@/types';

import { densityColumns, momentDensity } from './lens-charts';
import { densitySentence } from './lens-copy';

export interface MomentDensityProps {
  strengths: readonly LensMoment[];
  improvements: readonly LensMoment[];
  durationMs?: number;
  /** How many equal stretches the recording is cut into. */
  buckets?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 240;
const BUCKETS = 6;
const COLUMN_GAP = 4;
const BASELINE_Y = 32;
const MAX_COLUMN = 26;
/** An empty stretch still draws a sliver, so the axis reads as continuous. */
const EMPTY_COLUMN = 3;
const SEGMENT_GAP = 1.5;
const TICK_BASELINE = 46;
const TICK_FONT_SIZE = 11;
const SVG_HEIGHT = 50;

/**
 * Where the evidence sits in the recording: the same span as the timeline
 * above, cut into equal stretches, each stacked ink over grey. It answers
 * "which half are the problems in" without reading a single timestamp.
 *
 * Renders nothing when the moments carry no timestamps, since an even spread
 * would be a distribution the report never claimed.
 */
export function MomentDensity({
  strengths,
  improvements,
  durationMs,
  buckets = BUCKETS,
  style,
}: MomentDensityProps) {
  const t = useT();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const density = momentDensity(strengths, improvements, durationMs, buckets);
  if (!density) return null;

  const columns = densityColumns(density.buckets.length, width, COLUMN_GAP);
  const unit = density.peak > 0 ? MAX_COLUMN / density.peak : 0;
  const sentence = densitySentence(density, t.locale);
  const filled = density.buckets.filter(
    (bucket) => bucket.strengths + bucket.improvements > 0,
  );
  const reading = filled
    .map(
      (bucket) =>
        t('{time}부터 잘한 점 {strengths}개, 더 좋아질 점 {improvements}개', {
          time: formatDuration(bucket.startMs / 1_000),
          strengths: bucket.strengths,
          improvements: bucket.improvements,
        }),
    )
    .join(', ');
  const label = [
    t('구간별 근거 분포, {n}구간.', { n: density.buckets.length }),
    `${reading}.`,
    sentence,
  ]
    .filter((part) => part.length > 1)
    .join(' ');

  return (
    <View
      accessibilityLabel={label}
      accessible
      style={[styles.wrap, style]}
    >
      <AppText tone="muted" variant="badge">
        {t('구간별 근거 분포')}
      </AppText>
      <View
        {...decorative}
        onLayout={(event: LayoutChangeEvent) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0 && next !== width) setWidth(next);
        }}
      >
        <Svg height={SVG_HEIGHT} width={width}>
          {density.buckets.map((bucket, index) => {
            const column = columns[index];
            if (!column || bucket.strengths + bucket.improvements > 0) return null;
            return (
              <Rect
                fill={colors.backgroundMuted}
                height={EMPTY_COLUMN}
                key={`empty-${bucket.index}`}
                width={column.width}
                x={column.x}
                y={BASELINE_Y - EMPTY_COLUMN}
              />
            );
          })}
          {density.buckets.map((bucket, index) => {
            const column = columns[index];
            if (!column || bucket.strengths === 0) return null;
            const height = bucket.strengths * unit;
            return (
              <Rect
                fill={colors.text}
                height={height}
                key={`strength-${bucket.index}`}
                width={column.width}
                x={column.x}
                y={BASELINE_Y - height}
              />
            );
          })}
          {density.buckets.map((bucket, index) => {
            const column = columns[index];
            if (!column || bucket.improvements === 0) return null;
            const height = bucket.improvements * unit;
            const below = bucket.strengths * unit;
            const gap = below > 0 ? SEGMENT_GAP : 0;
            return (
              <Rect
                fill={colors.textFaint}
                height={height}
                key={`improvement-${bucket.index}`}
                width={column.width}
                x={column.x}
                y={BASELINE_Y - below - gap - height}
              />
            );
          })}
          <Line
            stroke={colors.border}
            strokeWidth={1}
            x1={0}
            x2={width}
            y1={BASELINE_Y + 0.5}
            y2={BASELINE_Y + 0.5}
          />
          <SvgText
            fill={colors.textFaint}
            fontFamily={fontFamilies.medium}
            fontSize={TICK_FONT_SIZE}
            textAnchor="start"
            x={0}
            y={TICK_BASELINE}
          >
            0
          </SvgText>
          <SvgText
            fill={colors.textFaint}
            fontFamily={fontFamilies.medium}
            fontSize={TICK_FONT_SIZE}
            textAnchor="end"
            x={width}
            y={TICK_BASELINE}
          >
            {formatDuration(density.spanMs / 1_000)}
          </SvgText>
        </Svg>
      </View>
      {sentence ? (
        <AppText tone="muted" variant="meta">
          {sentence}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.sm },
});
