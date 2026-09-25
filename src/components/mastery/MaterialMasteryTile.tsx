import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ScoreRing } from '@/components/lens';
import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { masteryLine, masteryVerdict } from '@/lib/mastery';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

import type { MaterialMasteryRowProps } from './MaterialMasteryRow';
import { SurfaceButton } from './surface';

/** The small ScoreRing's stroke, so the placeholder matches it. */
const RING_STROKE = 3;

/**
 * The tablet and desktop form of `MaterialMasteryRow`: the same ring, title
 * and one-line meaning, laid out as a card for the 자료별 이해도 grid. The
 * whole card opens what comes next, exactly as the row does.
 */
export function MaterialMasteryTile({
  material,
  onPress,
  summary,
}: Omit<MaterialMasteryRowProps, 'divider'>) {
  const t = useT();
  const line = masteryLine(summary, t.locale);
  const scored = summary.score !== null;
  const hint = scored
    ? t('이해도와 취약 개념을 열어요')
    : material.quiz.length > 0
      ? t('문제를 풀어요')
      : t('요약에서 핵심 내용을 확인해요');
  return (
    <SurfaceButton
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
      style={styles.tile}
    >
      <View style={styles.top}>
        {scored ? (
          <ScoreRing max={100} precision={0} score={summary.score ?? 0} size="small" />
        ) : (
          <View {...decorative} style={styles.placeholder}>
            <AppText tone="faint" variant="badge">
              -
            </AppText>
          </View>
        )}
        <ChevronRight
          {...decorative}
          color={colors.textFaint}
          size={iconSizes.section}
          strokeWidth={1.8}
        />
      </View>
      <View style={styles.copy}>
        <AppText numberOfLines={2} variant="itemTitle">
          {material.title}
        </AppText>
        <AppText numberOfLines={2} tone="muted" variant="meta">
          {line}
        </AppText>
      </View>
    </SurfaceButton>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.md,
    minHeight: 148,
    padding: spacing.lg,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    gap: spacing.xs,
    minWidth: 0,
  },
  placeholder: {
    alignItems: 'center',
    borderColor: colors.backgroundMuted,
    borderRadius: radii.full,
    borderWidth: RING_STROKE,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
});
