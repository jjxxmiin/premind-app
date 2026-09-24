import { Check } from 'lucide-react-native';
import { Fragment, useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, motion, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { railFill, stageRatio } from './artwork-geometry';
import { useReducedMotion } from './Motion';

export interface PipelineStepsProps {
  /** Two or more short stage names, in the order the work happens. */
  steps: readonly string[];
  /** Which stage the work is inside of. Past the last one, everything is done. */
  stageIndex: number;
  /** Overall progress, 0–1. Only ever moves the current stage's rail. */
  progress: number;
  /** False once the work has finished or stopped: the pulse stops with it. */
  active?: boolean;
  /** What the whole strip announces, before the per-step states. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const NODE = 24;
const DOT = 8;
const RAIL_HEIGHT = 3;
const PULSE_DURATION = 1600;

/**
 * A pipeline as a line, not as a list.
 *
 * The wait for a 마인드팩 is the longest one in the product, and a column of
 * bulleted labels gives no sense of how far along it is. A rail with a node
 * per stage says three things at a glance: what the machine does, which part
 * it is doing, and how much of that part is left. The rail between the
 * finished stages is solid; only the current segment moves, because the two
 * pipelines disagree about what a percentage means but agree about the stage.
 *
 * The current node breathes so a slow stage never reads as a hang. The pulse
 * follows the OS reduce-motion preference and stops the moment work does.
 */
export function PipelineSteps({
  active = true,
  label = '진행 단계',
  progress,
  stageIndex,
  steps,
  style,
}: PipelineStepsProps) {
  const count = steps.length;
  const ratio = stageRatio(progress, stageIndex, count);
  const spoken = steps
    .map((step, index) => `${step} ${stateWord(index, stageIndex)}`)
    .join(', ');

  return (
    <View
      accessibilityLabel={`${label}. ${count}단계 중 ${Math.min(stageIndex + 1, count)}단계. ${spoken}`}
      accessible
      style={[styles.wrap, style]}
    >
      <View {...decorative} style={styles.track}>
        {steps.map((step, index) => (
          <Fragment key={step}>
            <StepNode
              active={active}
              state={index < stageIndex ? 'complete' : index === stageIndex ? 'current' : 'upcoming'}
            />
            {index < count - 1 ? (
              <View style={styles.rail}>
                <View
                  style={[
                    styles.railFill,
                    { width: `${railFill(index, stageIndex, ratio) * 100}%` as const },
                  ]}
                />
              </View>
            ) : null}
          </Fragment>
        ))}
      </View>
      <View {...decorative} style={styles.labels}>
        {steps.map((step, index) => (
          <AppText
            align={index === 0 ? 'left' : index === count - 1 ? 'right' : 'center'}
            key={step}
            style={styles.label}
            tone={index > stageIndex ? 'faint' : 'default'}
            variant={index === stageIndex ? 'bodyStrong' : 'meta'}
          >
            {step}
          </AppText>
        ))}
      </View>
    </View>
  );
}

type StepState = 'complete' | 'current' | 'upcoming';

function stateWord(index: number, stageIndex: number): string {
  if (index < stageIndex) return '완료';
  if (index === stageIndex) return '진행 중';
  return '대기';
}

function StepNode({ active, state }: { active: boolean; state: StepState }) {
  if (state === 'complete') {
    return (
      <View style={[styles.node, styles.nodeComplete]}>
        <Check
          {...decorative}
          color={colors.textInverse}
          size={iconSizes.dense}
          strokeWidth={3}
        />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={styles.nodeSlot}>
        <PulseRing active={active} />
        <View style={[styles.node, styles.nodeCurrent]}>
          <View style={styles.nodeDot} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.node, styles.nodeUpcoming]}>
      <View style={[styles.nodeDot, styles.nodeDotUpcoming]} />
    </View>
  );
}

/** A ring that grows out of the current node and fades. Ink, never accent. */
function PulseRing({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    value.stopAnimation();
    if (!active || reduced) {
      value.setValue(0);
      return;
    }
    value.setValue(0);
    const animation = Animated.loop(
      Animated.timing(value, {
        duration: PULSE_DURATION,
        easing: motion.easing.enter,
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [active, reduced, value]);

  if (!active || reduced) return null;

  return (
    <Animated.View
      {...decorative}
      style={[
        styles.pulse,
        {
          opacity: value.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 0],
          }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.75],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  track: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rail: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    flex: 1,
    height: RAIL_HEIGHT,
    marginHorizontal: spacing.sm,
    minWidth: spacing.md,
    overflow: 'hidden',
  },
  railFill: {
    backgroundColor: colors.text,
    borderRadius: radii.full,
    height: RAIL_HEIGHT,
  },
  nodeSlot: {
    alignItems: 'center',
    height: NODE,
    justifyContent: 'center',
    width: NODE,
  },
  node: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: NODE,
    justifyContent: 'center',
    width: NODE,
  },
  nodeComplete: {
    backgroundColor: colors.action,
  },
  nodeCurrent: {
    backgroundColor: colors.surface,
    borderColor: colors.text,
    borderWidth: 2,
  },
  nodeUpcoming: {
    backgroundColor: colors.backgroundMuted,
  },
  nodeDot: {
    backgroundColor: colors.text,
    borderRadius: radii.full,
    height: DOT,
    width: DOT,
  },
  nodeDotUpcoming: {
    backgroundColor: colors.borderStrong,
  },
  pulse: {
    borderColor: colors.text,
    borderRadius: radii.full,
    borderWidth: 2,
    height: NODE,
    position: 'absolute',
    width: NODE,
  },
  labels: {
    flexDirection: 'row',
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
});
