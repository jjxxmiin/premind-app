import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { masteryLine, masteryVerdict } from '@/lib/mastery';
import { colors, radii, spacing } from '@/theme/tokens';

import type { MaterialMasteryRowProps } from './MaterialMasteryRow';
import { PressFace } from './PressFace';
import { ProgressRing } from './ProgressRing';

/** Weak concepts shown on a card: enough to say what, not a list. */
const CHIPS = 2;

/**
 * One card in 지금 복습할 자료 (the carousel): a small ring with the number in
 * it, the title, and the one or two concepts that went wrong as chips. A
 * material not yet tried shows its waiting questions instead. The whole card
 * opens what comes next, as the row did.
 */
export function ReviewCard({ material, onPress, summary }: Omit<MaterialMasteryRowProps, 'divider'>) {
  const t = useT();
  const line = masteryLine(summary, t.locale);
  const scored = summary.score !== null;
  const chips = summary.weakConcepts
    .slice(0, CHIPS)
    .map((concept) => (concept.concept === '기타' ? t('기타') : concept.concept));
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
      onPress={() => onPress(material, summary)}
      style={styles.card}
    >
      <View style={styles.top}>
        <ProgressRing
          color={colors.brand}
          diameter={52}
          stroke={6}
          trackColor={colors.borderStrong}
          value={summary.score}
        >
          <AppText tabular tone={scored ? 'default' : 'faint'} variant="label">
            {scored ? String(summary.score) : '-'}
          </AppText>
        </ProgressRing>
        <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
          {material.title}
        </AppText>
      </View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <AppText numberOfLines={1} style={styles.chipText} variant="badge">
                {chip}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <AppText numberOfLines={2} style={styles.line} tone="muted" variant="meta">
        {line}
      </AppText>
    </PressFace>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.hero,
    flex: 1,
    gap: spacing.md,
    minHeight: 164,
    padding: spacing.lg,
  },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.chip,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.warningStrong },
  /** Pinned to the card's foot so cards of different content line up. */
  line: { marginTop: 'auto' },
});
