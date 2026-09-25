import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import type { AppTextTone } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { speechScale, type SpeechMetric, type SpeechMetrics } from '@/lib/speech-metrics';
import { colors, fontFamilies, spacing } from '@/theme/tokens';

import { gaugeLayout } from './lens-charts';

export interface SpeechHabitsProps {
  metrics: SpeechMetrics;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 240;
const SVG_HEIGHT = 40;
const NEEDLE_HALF = 5;
const NEEDLE_HEIGHT = 10;
const TRACK_Y = 12;
const TRACK_HEIGHT = 8;
const TICK_BASELINE = 36;
const TICK_FONT_SIZE = 11;
/** Keeps the needle's own width inside the drawing at both ends of the scale. */
const INSET = NEEDLE_HALF + 1;

/** The middle band is the good one; the ends earn a warning tone. */
function bandTone(metric: SpeechMetric): AppTextTone {
  if (metric.key === 'pauses') return metric.level === 'high' ? 'warning' : 'positive';
  if (metric.key === 'fillers') return metric.level === 'high' ? 'warning' : 'positive';
  return metric.level === 'mid' ? 'positive' : 'warning';
}

/**
 * 말하기 습관: three gauges, one per number the transcript can measure. Each
 * draws the whole scale it is judged on, shades the stretch that needs no
 * fixing, and puts the needle where the recording landed, so a number is read
 * as a position rather than taken on faith.
 */
export function SpeechHabits({ metrics, style }: SpeechHabitsProps) {
  const gauges = [metrics.pace, metrics.fillers, metrics.pauses];
  return (
    <Card padding={false} style={style}>
      {gauges.map((metric, index) => (
        <SpeechGauge
          key={metric.key}
          last={index === gauges.length - 1}
          metric={metric}
        />
      ))}
    </Card>
  );
}

function SpeechGauge({ metric, last }: { metric: SpeechMetric; last: boolean }) {
  const t = useT();
  // speech-metrics.ts keeps its Korean words (its tests read them); the words go
  // through the dictionary here, where they are drawn.
  const title = t.ctx('speech', metric.title);
  const unit = t.ctx('speech', metric.unit);
  const band = t.ctx('speech', metric.band);
  const advice = t.ctx('speech', metric.advice);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const scale = speechScale(metric.key);
  const gauge = gaugeLayout(metric.value, scale, width, INSET);
  const usable = Math.max(0, width - INSET * 2);
  const label = [
    `${title} ${metric.valueText} ${unit}, ${band}.`,
    t('눈금은 {range}, 알맞은 구간은 {min}에서 {max}예요.', {
      range: t.ctx('speech', scale.rangeText),
      min: scale.healthyMin,
      max: scale.healthyMax,
    }),
    gauge.clamped ? t('눈금 밖이라 끝에 표시했어요.') : '',
    `${advice}.`,
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return (
    <View
      accessibilityLabel={label}
      accessible
      style={[styles.gauge, last ? null : styles.divider]}
    >
      <View style={styles.head}>
        <AppText variant="itemTitle">{title}</AppText>
        <View style={styles.valueLine}>
          <AppText tabular variant="metric">
            {metric.valueText}
          </AppText>
          <AppText tone="faint" variant="badge">
            {gauge.clamped ? t('{unit}, 눈금 밖', { unit }) : unit}
          </AppText>
        </View>
      </View>
      <View
        {...decorative}
        onLayout={(event: LayoutChangeEvent) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0 && next !== width) setWidth(next);
        }}
      >
        <Svg height={SVG_HEIGHT} width={width}>
          <Rect
            fill={colors.backgroundMuted}
            height={TRACK_HEIGHT}
            rx={TRACK_HEIGHT / 2}
            width={usable}
            x={INSET}
            y={TRACK_Y}
          />
          {gauge.healthy.width > 0 ? (
            <Rect
              fill={colors.textFaint}
              fillOpacity={0.45}
              height={TRACK_HEIGHT}
              rx={TRACK_HEIGHT / 2}
              width={gauge.healthy.width}
              x={gauge.healthy.x}
              y={TRACK_Y}
            />
          ) : null}
          <Polygon
            fill={colors.text}
            points={`${gauge.needleX - NEEDLE_HALF},0 ${gauge.needleX + NEEDLE_HALF},0 ${gauge.needleX},${NEEDLE_HEIGHT}`}
          />
          <Line
            stroke={colors.text}
            strokeLinecap="round"
            strokeWidth={2}
            x1={gauge.needleX}
            x2={gauge.needleX}
            y1={NEEDLE_HEIGHT - 2}
            y2={TRACK_Y + TRACK_HEIGHT + 2}
          />
          {gauge.ticks.map((tick) => (
            <SvgText
              fill={colors.textFaint}
              fontFamily={fontFamilies.medium}
              fontSize={TICK_FONT_SIZE}
              key={`tick-${tick.value}`}
              textAnchor={tick.textAnchor}
              x={tick.x}
              y={TICK_BASELINE}
            >
              {String(tick.value)}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={styles.foot}>
        <AppText style={styles.band} tone={bandTone(metric)} variant="label">
          {band}
        </AppText>
        <AppText style={styles.advice} tone="muted" variant="badge">
          {advice}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: {
    gap: spacing.xs,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  valueLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xs,
  },
  foot: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  band: { flexShrink: 0 },
  advice: { flex: 1, minWidth: 0 },
});
