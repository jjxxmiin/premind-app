import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ScoreRing } from '@/components/lens';
import { AppText, Button, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { masteryVerdict, type OverviewCopy, type WeekdayActivity } from '@/lib/mastery';
import { colors, spacing } from '@/theme/tokens';

import { ActivityStrip } from './ActivityStrip';

export interface MasteryHeroProps {
  /** Mean 이해도 over scored materials; null before anything is scored. */
  score: number | null;
  copy: OverviewCopy;
  days: readonly WeekdayActivity[];
  /** Shown only before anything is scored: the one way in. */
  onStart?: () => void;
}

/** Same geometry as the large ScoreRing, so the two states line up. */
const RING = { diameter: 148, stroke: 10 } as const;

/**
 * The top of the 이해도 tab: one ring for everything studied, two lines that
 * say where the learner stands, and the week's activity under them.
 */
export function MasteryHero({ copy, days, onStart, score }: MasteryHeroProps) {
  const spokenScore = score === null ? '이해도 시작 전' : `전체 이해도 ${score}%, ${masteryVerdict(score)}`;
  return (
    <Card style={styles.card} variant="soft">
      <View
        accessibilityLabel={`${spokenScore}. ${copy.title}${copy.detail ? `. ${copy.detail}` : ''}`}
        accessible
        style={styles.top}
      >
        {score === null ? (
          <EmptyRing />
        ) : (
          <ScoreRing
            label="이해도"
            max={100}
            precision={0}
            score={score}
            unit="%"
            verdict={masteryVerdict(score)}
          />
        )}
        <View style={styles.copy}>
          <AppText variant="itemTitle">{copy.title}</AppText>
          {copy.detail ? (
            <AppText tone="muted" variant="meta">
              {copy.detail}
            </AppText>
          ) : null}
          {score === null && onStart ? (
            <Button
              accessibilityHint="가장 최근 자료의 문제를 열어요"
              onPress={onStart}
              size="small"
              style={styles.start}
              variant="primary"
            >
              문제 풀러 가기
            </Button>
          ) : null}
        </View>
      </View>
      <ActivityStrip days={days} />
    </Card>
  );
}

/** The large ring before there is a number: grey track, "시작 전" inside. */
function EmptyRing() {
  const { diameter, stroke } = RING;
  const centre = diameter / 2;
  return (
    <View {...decorative} style={[styles.ring, { height: diameter, width: diameter }]}>
      <Svg height={diameter} width={diameter}>
        <Circle
          cx={centre}
          cy={centre}
          fill="none"
          r={(diameter - stroke) / 2}
          stroke={colors.backgroundMuted}
          strokeWidth={stroke}
        />
      </Svg>
      <View style={styles.ringCentre}>
        <AppText tone="faint" variant="label">
          시작 전
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.gutter,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  start: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  ring: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  ringCentre: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
