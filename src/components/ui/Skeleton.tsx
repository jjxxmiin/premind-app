import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';

import { useReducedMotion } from './Motion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** One grey placeholder block. Pulses gently unless motion is reduced. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = radii.badge,
  style,
}: SkeletonProps) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    pulse.stopAnimation();
    if (reduced) {
      pulse.setValue(0.5);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          duration: 900,
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);

  return (
    <Animated.View
      {...decorative}
      style={[
        styles.block,
        {
          borderRadius: radius,
          height,
          width,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1],
          }),
        },
        style,
      ]}
    />
  );
}

/** A stack of text-like lines, the last one shorter, like a paragraph. */
export function SkeletonLines({
  lines = 4,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  return (
    <View accessibilityLabel={t('불러오는 중')} style={[styles.lines, style]}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          height={12}
          key={index}
          width={index === lines - 1 ? '62%' : index % 3 === 1 ? '92%' : '100%'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.backgroundMuted,
  },
  lines: {
    gap: spacing.md,
  },
});
