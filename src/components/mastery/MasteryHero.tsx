import { ArrowRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { masteryVerdict, type OverviewCopy, type WeekdayActivity } from '@/lib/mastery';
import { colors, fontFamilies, iconSizes, radii, spacing } from '@/theme/tokens';

import { ProgressRing } from './ProgressRing';
import { WeekDots } from './WeekDots';

export interface MasteryHeroProps {
  /** Mean 이해도 over scored materials; null before anything is scored. */
  score: number | null;
  copy: OverviewCopy;
  days: readonly WeekdayActivity[];
  /** Days in a row with at least one answer. */
  streak: number;
  /** The one button: 오늘 복습 시작, or 첫 문제 풀기 before anything is scored. */
  actionLabel: string;
  /** Where the button goes, said in a line above it ("5주차부터 시작해요"). */
  actionDetail?: string;
  onAction: () => void;
}

/**
 * The head of the 이해도 tab, one card with one job (Toss): an activity ring
 * with the overall number beside it in large type, how many questions this
 * week, the week as seven dots with the run of days, and the single way in.
 *
 * It sits on the brand's soft face with no border, so it reads as the screen's
 * subject rather than one more box in a list. The button lives inside the
 * card, not docked to the bottom: this is a tab, and the tab bar owns the
 * bottom edge. From a tablet up the week moves into a card of its own beside
 * it, as it did before.
 */
export function MasteryHero({
  actionDetail,
  actionLabel,
  copy,
  days,
  onAction,
  score,
  streak,
}: MasteryHeroProps) {
  const t = useT();
  const { isTablet } = useLayout();
  const weekCount = days.reduce((sum, day) => sum + day.attemptCount, 0);
  const spokenScore =
    score === null
      ? t('이해도 시작 전')
      : t('전체 이해도 {score}%, {verdict}', {
          score,
          verdict: masteryVerdict(score, t.locale),
        });
  const next = copy.detail || copy.title;

  const overview = (
    <View
      accessibilityLabel={`${spokenScore}. ${t('이번 주 {n}문제', { n: weekCount })}`}
      accessible
      style={styles.top}
    >
      <ProgressRing diameter={RING} stroke={RING_STROKE} value={score} />
      <View style={styles.numbers}>
        <AppText tone="soft" variant="label">
          {t('전체 이해도')}
        </AppText>
        <AppText
          numberOfLines={1}
          style={[styles.big, score === null ? styles.bigEmpty : null]}
          tabular
        >
          {`${score ?? 0}%`}
        </AppText>
        <AppText tabular tone="soft" variant="meta">
          {t('이번 주 {n}문제', { n: weekCount })}
        </AppText>
      </View>
    </View>
  );

  const action = (
    <View style={styles.action}>
      <View style={styles.nextCopy}>
        <AppText variant="bodyStrong">{next}</AppText>
        {actionDetail ? (
          <AppText numberOfLines={1} tone="soft" variant="meta">
            {actionDetail}
          </AppText>
        ) : null}
      </View>
      <Button
        fullWidth
        onPress={onAction}
        rightIcon={<ArrowRight color={colors.textInverse} size={iconSizes.inline} />}
        size="large"
        variant="primary"
      >
        {actionLabel}
      </Button>
    </View>
  );

  if (isTablet) {
    return (
      <View style={styles.pair}>
        <View style={[styles.hero, styles.heroMain]}>
          {overview}
          {action}
        </View>
        <View style={[styles.hero, styles.heroWeek]}>
          <WeekDots days={days} streak={streak} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      {overview}
      <WeekDots days={days} streak={streak} />
      {action}
    </View>
  );
}

const RING = 112;
const RING_STROKE = 14;

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.hero,
    gap: spacing.xl,
    padding: spacing.xl,
  },
  pair: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.md },
  heroMain: { flex: 3, minWidth: 0 },
  heroWeek: { flex: 2, justifyContent: 'center', minWidth: 0 },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl },
  numbers: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  /** The one number on the screen that matters, Toss-size. */
  big: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 48,
    letterSpacing: -1.4,
    lineHeight: 56,
  },
  bigEmpty: { color: colors.textFaint },
  action: { gap: spacing.md },
  nextCopy: { gap: spacing.xxs },
});
