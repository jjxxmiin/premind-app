import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';
import type { LensReport } from '@/types';

import { SCORE_MAX } from './lens-charts';
import { rubricLabel } from './lens-copy';

export interface RubricSummaryProps {
  rubric: LensReport['rubric'];
  style?: StyleProp<ViewStyle>;
}

/**
 * The four scores as short bars, for a card that has to be readable without
 * opening the report. The full radar and the evidence live on the report
 * screen; this is the glance version.
 */
export function RubricSummary({ rubric, style }: RubricSummaryProps) {
  const t = useT();
  if (!rubric.length) return null;
  const spoken = rubric
    .map(
      (item) => `${rubricLabel(item, t.locale)} ${t('{score}점', { score: item.score.toFixed(1) })}`,
    )
    .join(', ');

  return (
    <View accessibilityLabel={t('항목별 점수. {spoken}', { spoken })} style={[styles.list, style]}>
      {rubric.map((item) => (
        <View key={item.key} style={styles.row}>
          <AppText
            numberOfLines={1}
            style={t.locale === 'en' ? styles.labelEn : styles.label}
            tone="muted"
            variant="badge"
          >
            {rubricLabel(item, t.locale)}
          </AppText>
          <View {...decorative} style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(100, Math.max(0, (item.score / SCORE_MAX) * 100))}%` },
              ]}
            />
          </View>
          <AppText style={styles.score} tabular variant="badge">
            {item.score.toFixed(1)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    width: 52,
  },
  /** English rubric names ("Structure") run wider than the Korean ones. */
  labelEn: {
    width: 64,
  },
  track: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    flex: 1,
    height: 6,
    minWidth: 0,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.text,
    borderRadius: radii.full,
    height: '100%',
  },
  score: {
    textAlign: 'right',
    width: 26,
  },
});
