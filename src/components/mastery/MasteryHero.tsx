import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ScoreRing } from '@/components/lens';
import { AppText, Button, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
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
 * say where the learner stands, and the week's activity.
 *
 * On a phone the week sits under the ring in the same card. From a tablet up
 * it moves into a card of its own beside the ring: stretched across the full
 * width the seven bars drift a hundred points apart and stop reading as one
 * week.
 */
export function MasteryHero({ copy, days, onStart, score }: MasteryHeroProps) {
  const t = useT();
  const spokenScore =
    score === null
      ? t('이해도 시작 전')
      : t('전체 이해도 {score}%, {verdict}', {
          score,
          verdict: masteryVerdict(score, t.locale),
        });
  const { isTablet } = useLayout();

  const overview = (
    <View
      accessibilityLabel={`${spokenScore}. ${copy.title}${copy.detail ? `. ${copy.detail}` : ''}`}
      accessible
      style={styles.top}
    >
      {score === null ? (
        <EmptyRing />
      ) : (
        <ScoreRing
          label={t('이해도')}
          max={100}
          precision={0}
          score={score}
          unit="%"
          verdict={masteryVerdict(score, t.locale)}
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
            accessibilityHint={t('가장 최근 자료의 문제를 열어요')}
            onPress={onStart}
            size="small"
            style={styles.start}
            variant="primary"
          >
            {t('문제 풀러 가기')}
          </Button>
        ) : null}
      </View>
    </View>
  );

  if (isTablet) {
    return (
      <View style={styles.pair}>
        <Card style={[styles.card, styles.overviewCard]}>{overview}</Card>
        <Card style={[styles.card, styles.weekCard]}>
          <AppText tone="muted" variant="label">
            {t('최근 7일')}
          </AppText>
          <ActivityStrip days={days} />
        </Card>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      {overview}
      <View style={styles.rule} />
      <ActivityStrip days={days} />
    </Card>
  );
}

/** The large ring before there is a number: grey track, "시작 전" inside. */
function EmptyRing() {
  const t = useT();
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
          {t('시작 전')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.gutter,
  },
  /** Ring and week side by side, the ring's card the wider of the two. */
  pair: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.md,
  },
  overviewCard: {
    flex: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  weekCard: {
    flex: 2,
    gap: spacing.md,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  rule: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
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
