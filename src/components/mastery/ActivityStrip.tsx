import { StyleSheet, View } from 'react-native';

import { AppText, barHeights } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { weekCaption, type WeekdayActivity } from '@/lib/mastery';
import { colors, radii, spacing } from '@/theme/tokens';

export interface ActivityStripProps {
  /** Seven local days, oldest first, today last. */
  days: readonly WeekdayActivity[];
}

const BAR_WIDTH = 14;
const BAR_MAX = 34;
const BAR_MIN = 6;

/**
 * The week as a small bar chart: one column per day, its height the share of
 * that day's answers against the busiest day, with one caption summing it up.
 *
 * It used to be seven identical circles, on or off. That said whether the
 * learner showed up but not whether they did one question or forty, which is
 * the difference the week is actually made of. A day with nothing keeps a
 * short grey stub so the baseline stays readable and the row never looks
 * broken. The chart is announced as a whole; the columns carry no text.
 */
export function ActivityStrip({ days }: ActivityStripProps) {
  const t = useT();
  const caption = weekCaption(days, t.locale);
  const heights = barHeights(
    days.map((day) => day.attemptCount),
    BAR_MAX,
    BAR_MIN,
  );
  const spoken = days
    .map((day) =>
      day.attemptCount > 0
        ? t('{day} 문제 {n}개', { day: day.label, n: day.attemptCount })
        : t('{day} 없음', { day: day.label }),
    )
    .join(', ');

  return (
    <View
      accessibilityLabel={t('최근 7일 활동. {spoken}. {caption}', { spoken, caption })}
      accessible
      style={styles.wrap}
    >
      <View {...decorative} style={styles.row}>
        {days.map((day, index) => {
          const active = day.attemptCount > 0;
          return (
            <View key={day.day} style={styles.day}>
              <View style={styles.plot}>
                <View
                  style={[
                    styles.bar,
                    { height: heights[index] ?? BAR_MIN },
                    active ? styles.barActive : null,
                    day.today && !active ? styles.barToday : null,
                  ]}
                />
              </View>
              <AppText tone={day.today ? 'default' : 'faint'} variant="badge">
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText tone="muted" variant="meta">
        {caption}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: spacing.xs,
    width: BAR_WIDTH * 2,
  },
  /** A fixed plot height keeps every day's label on the same baseline. */
  plot: {
    height: BAR_MAX,
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    width: BAR_WIDTH,
  },
  barActive: {
    backgroundColor: colors.text,
  },
  barToday: {
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
  },
});
