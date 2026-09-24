import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type ProgressTone = 'brand' | 'positive' | 'warning' | 'negative' | 'ink';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: ProgressTone;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const fillColors: Record<ProgressTone, string> = {
  brand: colors.brand,
  positive: colors.positive,
  warning: colors.warning,
  negative: colors.negative,
  ink: colors.text,
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'brand',
  height = 6,
  style,
  testID,
}: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), safeMax)
    : 0;
  const percentage = Math.round((safeValue / safeMax) * 100);
  const width = `${percentage}%` as `${number}%`;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label || showValue ? (
        <View style={styles.labelRow}>
          {label ? (
            <AppText numberOfLines={1} style={styles.label} tone="muted" variant="meta">
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {showValue ? (
            <AppText tabular variant="meta">
              {percentage}%
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        aria-valuetext={`${percentage}%`}
        accessibilityLabel={label}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: safeMax,
          now: safeValue,
          text: `${percentage}%`,
        }}
        style={[styles.track, { height }]}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: fillColors[tone], height, width },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  label: {
    flexShrink: 1,
  },
  track: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radii.full,
  },
});
