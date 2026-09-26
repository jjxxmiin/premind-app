import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import type { AppTextTone } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';

import { formatDelta, pointsAttr, scoreDelta, sparklinePoints } from './lens-charts';

export interface ScoreTrendEntry {
  id: string;
  overall: number;
  updatedAt: string;
}

export interface ScoreTrendProps {
  /** Oldest first. */
  entries: readonly ScoreTrendEntry[];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 180;
const SVG_HEIGHT = 56;
const INSET = 6;
const DOT_RADIUS = 3;
const LATEST_RADIUS = 4.5;

/**
 * A sparkline of every overall score, oldest to newest, with the latest
 * change spelled out. Only shown once there are two reports to compare.
 */
export function ScoreTrend({ entries, style }: ScoreTrendProps) {
  const t = useT();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const values = entries.map((entry) => entry.overall);
  const points = sparklinePoints(values, width, SVG_HEIGHT, INSET);
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const delta = scoreDelta(values);
  const deltaText =
    delta === null
      ? ''
      : delta === 0
        ? t('지난 평가와 같아요')
        : t('지난 평가보다 {delta}점', { delta: formatDelta(delta) });
  const deltaTone: AppTextTone =
    delta === null || delta === 0 ? 'muted' : delta > 0 ? 'positive' : 'negative';
  const lastIndex = points.length - 1;

  if (!latest || !first) return null;

  return (
    <Card
      accessibilityLabel={t('평가 추이, {n}번. 점수 {scores}. {delta}', {
        n: entries.length,
        scores: values.map((value) => value.toFixed(1)).join(', '),
        delta: deltaText,
      })}
      accessible
      style={[styles.card, style]}
      variant="soft"
    >
      <View style={styles.head}>
        <AppText tone="muted" variant="badge">
          {t('추이')}
        </AppText>
        <AppText tabular tone="faint" variant="badge">
          {t('{n}번 평가', { n: entries.length })}
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.metric}>
          <AppText tabular variant="metric">
            {latest.overall.toFixed(1)}
          </AppText>
          <AppText tone={deltaTone} variant="badge">
            {deltaText}
          </AppText>
        </View>
        <View
          {...decorative}
          onLayout={(event: LayoutChangeEvent) => {
            const next = Math.round(event.nativeEvent.layout.width);
            if (next > 0 && next !== width) setWidth(next);
          }}
          style={styles.chart}
        >
          <Svg height={SVG_HEIGHT} width={width}>
            {points.length > 1 ? (
              <Polyline
                fill="none"
                points={pointsAttr(points)}
                stroke={colors.text}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            ) : null}
            {points.map((point, index) => (
              <Circle
                cx={point.x}
                cy={point.y}
                fill={index === lastIndex ? colors.text : colors.surface}
                key={entries[index]?.id ?? index}
                r={index === lastIndex ? LATEST_RADIUS : DOT_RADIUS}
                stroke={colors.text}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
          <View style={styles.axis}>
            <AppText tone="faint" variant="badge">
              {formatRelativeDate(first.updatedAt)}
            </AppText>
            <AppText tone="faint" variant="badge">
              {formatRelativeDate(latest.updatedAt)}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.hero, gap: spacing.sm },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  metric: { gap: spacing.xxs, minWidth: 0 },
  chart: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
