import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, palette } from '@/theme/tokens';

export interface ProgressRingProps {
  /** 0 to 100. Null draws the track alone (nothing measured yet). */
  value: number | null;
  diameter: number;
  stroke: number;
  /** Arc colour. Default: the brand orange, as on the hero. */
  color?: string;
  /** Track colour. Default: a brand tint, for a ring sitting on a brand face. */
  trackColor?: string;
  /** What sits in the middle (a number, or nothing). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const FILL_MS = 900;

/**
 * An activity ring (Apple Fitness): a thick round-capped arc that fills from
 * the top when it first appears. Driven by a plain frame loop rather than
 * animated SVG props, so it fills the same way on a phone and on the web; the
 * OS "reduce motion" setting draws it full at once.
 *
 * Decorative: the caller names the number for screen readers.
 */
export function ProgressRing({
  children,
  color = colors.brand,
  diameter,
  stroke,
  style,
  trackColor = palette.accent200,
  value,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const target = value === null ? 0 : Math.max(0, Math.min(100, value));
  /** 0 to 1: how far the first fill has run. The ring follows later changes at once. */
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const linear = Math.min(1, (now - start) / FILL_MS);
      // Ease out: quick at first, settling onto the number.
      setProgress(1 - Math.pow(1 - linear, 3));
      if (linear < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  const shown = reduced ? target : target * progress;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = diameter / 2;
  const arc = (shown / 100) * circumference;

  return (
    <View style={[styles.ring, { height: diameter, width: diameter }, style]}>
      <Svg {...decorative} height={diameter} width={diameter}>
        <Circle
          cx={centre}
          cy={centre}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {arc > 0.5 ? (
          <Circle
            cx={centre}
            cy={centre}
            fill="none"
            r={radius}
            stroke={color}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.centre}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', flexShrink: 0, justifyContent: 'center' },
  centre: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
