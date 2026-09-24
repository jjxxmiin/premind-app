import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, spacing } from '@/theme/tokens';

import { pointsAttr, sparklinePoints } from './lens-charts';

export interface TrendSparklineProps {
  /** Oldest first, on any scale; the line is fitted to the series' own range. */
  values: readonly number[];
  /** Captions under the left and right ends of the line. */
  startLabel?: string;
  endLabel?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 48;
const INSET = 6;
const DOT_RADIUS = 3;
const LATEST_RADIUS = 4.5;

/**
 * A bare sparkline: a line through every value with the latest point filled.
 * Decorative on its own, so the parent must say what the numbers are.
 */
export function TrendSparkline({
  endLabel,
  height = DEFAULT_HEIGHT,
  startLabel,
  style,
  values,
}: TrendSparklineProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const points = sparklinePoints(values, width, height, INSET);
  const lastIndex = points.length - 1;

  return (
    <View
      {...decorative}
      onLayout={(event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      style={[styles.chart, style]}
    >
      <Svg height={height} width={width}>
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
            key={index}
            r={index === lastIndex ? LATEST_RADIUS : DOT_RADIUS}
            stroke={colors.text}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
      {startLabel || endLabel ? (
        <View style={styles.axis}>
          <AppText tone="faint" variant="badge">
            {startLabel ?? ''}
          </AppText>
          <AppText tone="faint" variant="badge">
            {endLabel ?? ''}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { alignSelf: 'stretch', gap: spacing.xxs, minWidth: 0 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
