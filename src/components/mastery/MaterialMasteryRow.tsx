import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { masteryLine, masteryVerdict, type MasterySummary } from '@/lib/mastery';
import { colors, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { PressFace } from './PressFace';

export interface MaterialMasteryRowProps {
  material: StudyMaterial;
  summary: MasterySummary;
  onPress: (material: StudyMaterial, summary: MasterySummary) => void;
  /** Kept for callers; rows now sit apart on a filled face with no rules. */
  divider?: boolean;
}

const BAR = 8;

/**
 * One material in the list under the carousel: the title with its number on
 * the right, a thick progress bar, and the one-line meaning. The row is its
 * own filled face (no border, no rule between rows), and the whole of it opens
 * what comes next.
 */
export function MaterialMasteryRow({ material, onPress, summary }: MaterialMasteryRowProps) {
  const t = useT();
  const line = masteryLine(summary, t.locale);
  const scored = summary.score !== null;
  const hint = scored
    ? t('이해도와 취약 개념을 열어요')
    : material.quiz.length > 0
      ? t('문제를 풀어요')
      : t('요약에서 핵심 내용을 확인해요');
  return (
    <PressFace
      accessibilityHint={hint}
      accessibilityLabel={
        scored
          ? t('{title}. 이해도 {score}%, {verdict}. {line}', {
              title: material.title,
              score: summary.score,
              verdict: masteryVerdict(summary.score ?? 0, t.locale),
              line,
            })
          : `${material.title}. ${line}`
      }
      accessibilityRole="button"
      haptic={false}
      onPress={() => onPress(material, summary)}
      style={styles.row}
    >
      <View style={styles.head}>
        <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
          {material.title}
        </AppText>
        <AppText tabular tone={scored ? 'default' : 'faint'} variant="label">
          {scored ? `${summary.score}%` : '-'}
        </AppText>
      </View>
      <View {...decorative} style={styles.track}>
        {scored && (summary.score ?? 0) > 0 ? (
          <View style={[styles.fill, { width: `${summary.score ?? 0}%` }]} />
        ) : null}
      </View>
      <AppText numberOfLines={1} tone="muted" variant="meta">
        {line}
      </AppText>
    </PressFace>
  );
}

/** The tablet and desktop form: the same row, sized for a grid cell. */
export function MaterialMasteryTile(props: Omit<MaterialMasteryRowProps, 'divider'>) {
  return <MaterialMasteryRow {...props} />;
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.card,
    flex: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  head: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  title: { flex: 1, minWidth: 0 },
  track: {
    backgroundColor: colors.borderStrong,
    borderRadius: radii.full,
    height: BAR,
    overflow: 'hidden',
  },
  fill: { backgroundColor: colors.brand, borderRadius: radii.full, height: BAR },
});
