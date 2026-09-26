import { Check, Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { weekCaption, type WeekdayActivity } from '@/lib/mastery';
import { colors, iconSizes, palette, radii, spacing } from '@/theme/tokens';

export interface WeekDotsProps {
  /** Seven local days, oldest first, today last. */
  days: readonly WeekdayActivity[];
  /** Days in a row with an answer; the flame pill shows from 1. */
  streak: number;
}

const DOT = 30;

/**
 * The week as seven dots (Duolingo): a filled orange dot with a tick for a day
 * with at least one answer, an outlined dot for today while it is still open,
 * and a quiet one for the rest. The run of days sits beside it as a flame.
 *
 * It replaced a bar chart: on a phone the question a learner asks of the week
 * is "did I show up", and seven ticks answer it at a glance. The counts stay
 * in the spoken label.
 */
export function WeekDots({ days, streak }: WeekDotsProps) {
  const t = useT();
  const caption = weekCaption(days, t.locale);
  const spoken = days
    .map((day) =>
      day.attemptCount > 0
        ? t('{day} 문제 {n}개', { day: day.label, n: day.attemptCount })
        : t('{day} 없음', { day: day.label }),
    )
    .join(', ');

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText tone="soft" variant="label">
          {t('이번 주')}
        </AppText>
        {streak > 0 ? (
          <View
            accessibilityLabel={t('연속 {n}일 공부했어요', { n: streak })}
            accessible
            style={styles.streak}
          >
            <Flame {...decorative} color={colors.brand} fill={colors.brand} size={iconSizes.dense} />
            <AppText tabular tone="brand" variant="badge">
              {t('연속 {n}일', { n: streak })}
            </AppText>
          </View>
        ) : null}
      </View>
      <View
        accessibilityLabel={t('최근 7일 활동. {spoken}. {caption}', { spoken, caption })}
        accessible
        style={styles.row}
      >
        {days.map((day) => {
          const done = day.attemptCount > 0;
          return (
            <View {...decorative} key={day.day} style={styles.day}>
              <View
                style={[
                  styles.dot,
                  done ? styles.dotDone : day.today ? styles.dotToday : null,
                ]}
              >
                {done ? (
                  <Check color={colors.textInverse} size={iconSizes.inline} strokeWidth={3} />
                ) : null}
              </View>
              <AppText tone={day.today ? 'default' : 'muted'} variant="badge">
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streak: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: { alignItems: 'center', gap: spacing.xs, width: DOT + 8 },
  dot: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: DOT,
    justifyContent: 'center',
    width: DOT,
  },
  dotDone: { backgroundColor: colors.brand },
  dotToday: {
    borderColor: palette.accent300,
    borderStyle: 'dashed',
    borderWidth: 2,
  },
});
