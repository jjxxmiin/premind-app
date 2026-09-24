import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, motion, radii, spacing } from '@/theme/tokens';

function webReducedMotionPreference(): boolean | undefined {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return undefined;
}

let cachedReducedMotion = webReducedMotionPreference();

/** Mirrors the OS accessibility preference and updates while the app is open. */
export function useReducedMotion() {
  // Unknown is treated as reduced so motion never starts before the native
  // accessibility preference has been read.
  const [reduced, setReduced] = useState(() => cachedReducedMotion ?? true);

  useEffect(() => {
    let mounted = true;
    const updatePreference = (value: boolean) => {
      cachedReducedMotion = value;
      if (mounted) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(updatePreference)
      .catch(() => {
        cachedReducedMotion = true;
        if (mounted) setReduced(true);
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updatePreference,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export function AnimatedReveal({
  children,
  delay = 0,
  distance = 12,
  duration = motion.duration.deliberate,
  style,
}: PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduced = useReducedMotion();
  const [initiallyReduced] = useState(reduced);
  const [progress] = useState(
    () => new Animated.Value(reduced ? 1 : 0),
  );

  useEffect(() => {
    progress.stopAnimation();
    if (reduced || initiallyReduced) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      delay,
      duration,
      easing: motion.easing.enter,
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, initiallyReduced, progress, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const WAVEFORM_HEIGHTS = [14, 24, 34, 20, 30, 18, 26] as const;
const WAVEFORM_PHASES = [0, 2, 4, 1, 3, 5, 2] as const;

/** A low-cost, decorative signal used only when capture or processing is active. */
export function ActivityWaveform({
  active = true,
  color = colors.brand,
  compact = false,
  style,
}: {
  active?: boolean;
  color?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [phase] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    phase.stopAnimation();
    if (!active || reduced) {
      phase.setValue(0.5);
      return;
    }

    phase.setValue(0);
    const animation = Animated.loop(
      Animated.timing(phase, {
        duration: 1200,
        easing: motion.easing.standard,
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [active, phase, reduced]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.waveform, compact ? styles.waveformCompact : null, style]}
    >
      {WAVEFORM_HEIGHTS.map((height, index) => {
        const offset = (WAVEFORM_PHASES[index] ?? 0) * 0.08;
        return (
          <Animated.View
            key={`${height}-${index}`}
            style={[
              styles.waveformBar,
              {
                backgroundColor: color,
                height: compact ? Math.max(8, height * 0.65) : height,
                opacity: phase.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.45 + offset, 1 - offset / 2, 0.45 + offset],
                }),
                transform: [
                  {
                    scaleY: phase.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.58 + offset, 1, 0.58 + offset],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Restrained ambient emphasis for the single object representing live work. */
export function BreathingView({
  active = true,
  children,
  style,
}: PropsWithChildren<{
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const [value] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    value.stopAnimation();
    if (!active || reduced) {
      value.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          duration: 1400,
          easing: motion.easing.standard,
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(value, {
          duration: 1400,
          easing: motion.easing.standard,
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, reduced, value]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.96],
          }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.025],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    height: 36,
    justifyContent: 'center',
  },
  waveformCompact: {
    gap: 3,
    height: 24,
  },
  waveformBar: {
    borderRadius: radii.full,
    width: 4,
  },
});
