import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';

import { SCORE_MAX, clampScore, ringDash, verdictWord } from './lens-charts';

export interface ScoreRingProps {
  score: number;
  /**
   * `large` is the report hero: the score, the scale and a one-word verdict
   * inside the ring. `medium` is the featured card on the 평가 tab: the score
   * and the scale, the verdict lives in the copy beside it. `small` sits in a
   * list row and is decorative there, so the row must describe the score
   * itself.
   */
  size?: 'large' | 'medium' | 'small';
  /**
   * The full ring. Lens scores run to 5 with one decimal; an 이해도 runs to
   * 100 as a whole number with a `%` unit.
   */
  max?: number;
  /** Decimals printed in the middle: 1 for Lens, 0 for 이해도. */
  precision?: 0 | 1;
  /** Unit after the number for a percentage ring; Lens rings print "/ 5.0". */
  unit?: string;
  /** Word under the number. Defaults to the Lens bands. */
  verdict?: string;
  /** What the large ring announces to a screen reader, before the value. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  large: { diameter: 148, stroke: 10 },
  medium: { diameter: 104, stroke: 8 },
  small: { diameter: 40, stroke: 3 },
} as const;

/** A ring gauge: grey track, ink arc from the top, the number in the middle. */
export function ScoreRing({
  label: labelKo = '전체 평가',
  max = SCORE_MAX,
  precision = 1,
  score,
  size = 'large',
  style,
  unit,
  verdict,
}: ScoreRingProps) {
  const t = useT();
  // A caller's Korean label or verdict is translated here too; an English one passes through.
  const label = t(labelKo);
  const { diameter, stroke } = SIZES[size];
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = clampScore(score, max);
  const word = verdict !== undefined ? t(verdict) : verdictWord(safe, t.locale);
  const centre = diameter / 2;
  const number = safe.toFixed(precision);
  /** A percentage ring prints "56%" over its label; a Lens ring prints "4.1" over "/ 5.0". */
  const bigText = unit ? `${number}${unit}` : number;
  const scaleText = unit ? label : `/ ${max.toFixed(precision)}`;
  const spokenUnit = unit ?? '점';

  const ring = (
    <View {...decorative} style={[styles.ring, { height: diameter, width: diameter }]}>
      <Svg height={diameter} width={diameter}>
        <Circle
          cx={centre}
          cy={centre}
          fill="none"
          r={radius}
          stroke={colors.backgroundMuted}
          strokeWidth={stroke}
        />
        {safe > 0 ? (
          <Circle
            cx={centre}
            cy={centre}
            fill="none"
            r={radius}
            stroke={colors.text}
            strokeDasharray={ringDash(safe, circumference, max)}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>
      <View style={styles.centre}>
        {size === 'large' ? (
          <>
            <AppText tabular variant="display">
              {bigText}
            </AppText>
            <AppText tone="muted" variant="badge">
              {scaleText}
            </AppText>
            <AppText align="center" style={styles.verdict} variant="label">
              {word}
            </AppText>
          </>
        ) : size === 'medium' ? (
          <>
            <AppText tabular variant="metric">
              {bigText}
            </AppText>
            <AppText tone="muted" variant="badge">
              {scaleText}
            </AppText>
          </>
        ) : (
          <AppText tabular variant="badge">
            {number}
          </AppText>
        )}
      </View>
    </View>
  );

  if (size === 'small') {
    return <View style={style}>{ring}</View>;
  }

  return (
    <View
      accessibilityLabel={
        t.locale === 'en'
          ? `${label} ${number}${unit ?? ' points'}, out of ${max}${unit ?? ''}, ${word}`
          : `${label} ${number}${spokenUnit}, ${max}${spokenUnit} 만점, ${word}`
      }
      accessible
      style={[styles.wrap, style]}
    >
      {ring}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  centre: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  verdict: { marginTop: spacing.xs, paddingHorizontal: spacing.md },
});
