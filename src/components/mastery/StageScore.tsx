import { Check, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { masteryVerdict, type WeekdayActivity } from '@/lib/mastery';
import { colors, fontFamilies, radii, spacing } from '@/theme/tokens';

/**
 * The 복습 tab's dark top (direction D, 2026-10-04): the one number that
 * matters, Toss-size, and the last seven days as check-ins — a filled orange
 * dot for every day with an answered question.
 */
export function StageScore({
  score,
  days,
  streak,
}: {
  score: number | null;
  days: readonly WeekdayActivity[];
  streak: number;
}) {
  const t = useT();
  const weekCount = days.reduce((sum, day) => sum + day.attemptCount, 0);
  const week =
    streak > 1
      ? t('이번 주 {n}문제, 연속 {days}일', { n: weekCount, days: streak })
      : t('이번 주 {n}문제', { n: weekCount });
  const spoken =
    score === null
      ? t('이해도 시작 전')
      : t('전체 이해도 {score}%, {verdict}', { score, verdict: masteryVerdict(score, t.locale) });
  return (
    <View accessibilityLabel={`${spoken}. ${week}`} accessible style={styles.root}>
      <View style={styles.scoreRow}>
        <AppText style={styles.big} tabular>
          {score === null ? '-' : String(score)}
          {score === null ? null : <AppText style={styles.unit}>%</AppText>}
        </AppText>
        <AppText style={styles.caption} variant="label">
          {t('현재 이해도')}
        </AppText>
      </View>
      <View style={styles.week}>
        {days.map((day) => {
          const done = day.attemptCount > 0;
          return (
            <View key={day.day} style={styles.day}>
              <View
                {...decorative}
                style={[styles.dot, done ? styles.dotDone : null, day.today && !done ? styles.dotToday : null]}
              >
                {done ? <Check color={colors.textInverse} size={14} strokeWidth={3} /> : null}
              </View>
              <AppText style={[styles.dayLabel, day.today ? styles.dayLabelToday : null]} variant="badge">
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText style={styles.caption} tabular variant="meta">
        {week}
      </AppText>
    </View>
  );
}

/**
 * The day's one next step, said like a tutor would (direction D): the line the
 * mastery model already writes, in a bubble, with the one button under it.
 */
export function CoachCard({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.coach}>
      <View {...decorative} style={styles.avatar}>
        <Sparkles color={colors.brand} size={20} strokeWidth={2} />
      </View>
      <View style={styles.bubble}>
        <AppText variant="body">{message}</AppText>
        <Button onPress={onAction} size="medium" style={styles.coachAction} variant="primary">
          {actionLabel}
        </Button>
      </View>
    </View>
  );
}

const DOT = 30;

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  scoreRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.md },
  big: {
    color: colors.textInverse,
    fontFamily: fontFamilies.extraBold,
    fontSize: 60,
    letterSpacing: -2,
    lineHeight: 64,
  },
  unit: {
    color: colors.textInverse,
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
  },
  caption: { color: colors.stageMuted, paddingBottom: spacing.sm },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: spacing.xs + 2 },
  dot: {
    alignItems: 'center',
    backgroundColor: colors.stageRaised,
    borderRadius: DOT / 2,
    height: DOT,
    justifyContent: 'center',
    width: DOT,
  },
  dotDone: { backgroundColor: colors.brand },
  dotToday: { borderColor: colors.brand, borderWidth: 1.5 },
  dayLabel: { color: colors.stageMuted },
  dayLabelToday: { color: colors.textInverse },
  coach: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  bubble: {
    backgroundColor: colors.backgroundSoft,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 20,
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  coachAction: { alignSelf: 'flex-start' },
});
