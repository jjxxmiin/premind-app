import { StyleSheet, View } from 'react-native';

import { ScoreRing } from '@/components/lens';
import { AppText, ListRow } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { masteryLine, masteryVerdict, type MasterySummary } from '@/lib/mastery';
import { colors, radii, sizes } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

export interface MaterialMasteryRowProps {
  material: StudyMaterial;
  summary: MasterySummary;
  onPress: (material: StudyMaterial, summary: MasterySummary) => void;
  divider?: boolean;
}

/** The small ScoreRing's stroke, so the placeholder matches it. */
const RING_STROKE = 3;

/**
 * One material in the 자료별 이해도 list: a 40pt ring (or a grey "-" ring
 * before the first answer), the title on up to two lines, the one-line
 * meaning, and a chevron. No buttons in the row: the whole row opens what
 * comes next.
 */
export function MaterialMasteryRow({
  divider = true,
  material,
  onPress,
  summary,
}: MaterialMasteryRowProps) {
  const line = masteryLine(summary);
  const scored = summary.score !== null;
  const hint = scored
    ? '이해도와 취약 개념을 열어요'
    : material.quiz.length > 0
      ? '문제를 풀어요'
      : '요약에서 핵심 내용을 확인해요';
  return (
    <ListRow
      accessibilityHint={hint}
      accessibilityLabel={
        scored
          ? `${material.title}. 이해도 ${summary.score}%, ${masteryVerdict(summary.score ?? 0)}. ${line}`
          : `${material.title}. ${line}`
      }
      divider={divider}
      leading={
        scored ? (
          <ScoreRing max={100} precision={0} score={summary.score ?? 0} size="small" />
        ) : (
          <View {...decorative} style={styles.placeholder}>
            <AppText tone="faint" variant="badge">
              -
            </AppText>
          </View>
        )
      }
      onPress={() => onPress(material, summary)}
      subtitle={line}
      title={material.title}
    />
  );
}

const styles = StyleSheet.create({
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
