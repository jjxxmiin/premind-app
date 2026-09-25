import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';

import { balanceSegments } from './lens-charts';

export interface BalanceStripProps {
  strengthCount: number;
  improvementCount: number;
  style?: StyleProp<ViewStyle>;
}

const BAR_HEIGHT = 10;
const DEFAULT_WIDTH = 280;

/** One stacked bar: how much of the feedback was 강점 (ink) versus 보완 (grey). */
export function BalanceStrip({ strengthCount, improvementCount, style }: BalanceStripProps) {
  const t = useT();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const segments = balanceSegments(strengthCount, improvementCount, width);
  const total = strengthCount + improvementCount;

  return (
    <View
      accessibilityLabel={t('강점 {strengths}개, 보완 {improvements}개, 모두 {total}개', {
        strengths: strengthCount,
        improvements: improvementCount,
        total,
      })}
      accessible
      onLayout={(event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      style={[styles.wrap, style]}
    >
      <View {...decorative}>
        <Svg height={BAR_HEIGHT} width={width}>
          <Rect
            fill={colors.backgroundMuted}
            height={BAR_HEIGHT}
            rx={BAR_HEIGHT / 2}
            width={width}
            x={0}
            y={0}
          />
          {segments.strength.width > 0 ? (
            <Rect
              fill={colors.text}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              width={segments.strength.width}
              x={segments.strength.x}
              y={0}
            />
          ) : null}
          {segments.improvement.width > 0 ? (
            <Rect
              fill={colors.borderStrong}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              width={segments.improvement.width}
              x={segments.improvement.x}
              y={0}
            />
          ) : null}
        </Svg>
      </View>
      <View style={styles.legend}>
        <LegendItem color={colors.text} label={t('강점 {n}개', { n: strengthCount })} />
        <LegendItem color={colors.borderStrong} label={t('보완 {n}개', { n: improvementCount })} />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View {...decorative} style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText tabular tone="muted" variant="badge">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.sm },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  legendDot: { borderRadius: radii.full, height: 8, width: 8 },
});
