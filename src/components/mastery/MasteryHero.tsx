import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { masteryVerdict, type WeekdayActivity } from '@/lib/mastery';
import { colors, fontFamilies, radii, shadows, spacing } from '@/theme/tokens';

import { ProgressRing } from './ProgressRing';

export interface MasteryHeroProps {
  /** Mean 이해도 over scored materials; null before anything is scored. */
  score: number | null;
  /** What to do next, in one line ("분류와 회귀를 다시 볼 차례예요"). */
  next: string;
  days: readonly WeekdayActivity[];
  /** Days in a row with at least one answer. */
  streak: number;
  /** The one button: 오늘 복습 시작, or 첫 문제 풀기 before anything is scored. */
  actionLabel: string;
  onAction: () => void;
}

/**
 * The head of the 이해도 tab (2026-09-26 declutter, after Santa's 분석): one
 * white card on the grey page with one ring, and in the ring the label and
 * the one number ("현재 이해도 35%"). Under it the week in one small line,
 * the next step in one line, and the single full-width button.
 *
 * The seven weekday dots and the streak chip that sat here are now that one
 * line; the number is never written twice.
 */
export function MasteryHero({ actionLabel, days, next, onAction, score, streak }: MasteryHeroProps) {
  const t = useT();
  const weekCount = days.reduce((sum, day) => sum + day.attemptCount, 0);
  const week =
    streak > 1
      ? t('이번 주 {n}문제, 연속 {days}일', { n: weekCount, days: streak })
      : t('이번 주 {n}문제', { n: weekCount });
  const spokenScore =
    score === null
      ? t('이해도 시작 전')
      : t('전체 이해도 {score}%, {verdict}', {
          score,
          verdict: masteryVerdict(score, t.locale),
        });

  return (
    <View style={styles.hero}>
      <View accessibilityLabel={`${spokenScore}. ${week}`} accessible style={styles.top}>
        <ProgressRing diameter={RING} stroke={RING_STROKE} value={score}>
          <AppText tone="soft" variant="label">
            {t('현재 이해도')}
          </AppText>
          <AppText
            numberOfLines={1}
            style={[styles.big, score === null ? styles.bigEmpty : null]}
            tabular
          >
            {score === null ? '-' : `${score}%`}
          </AppText>
        </ProgressRing>
        <AppText tabular tone="muted" variant="meta">
          {week}
        </AppText>
      </View>
      <View style={styles.action}>
        <AppText align="center" variant="bodyStrong">
          {next}
        </AppText>
        <Button fullWidth onPress={onAction} size="large" variant="primary">
          {actionLabel}
        </Button>
      </View>
    </View>
  );
}

const RING = 168;
const RING_STROKE = 14;

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii.hero,
    gap: spacing.xl,
    padding: spacing.xl,
    ...shadows.subtle,
  },
  top: { alignItems: 'center', gap: spacing.md },
  /** The one number on the screen that matters, Toss-size. */
  big: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 40,
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  bigEmpty: { color: colors.textFaint },
  action: { gap: spacing.md },
});
