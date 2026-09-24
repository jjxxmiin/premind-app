import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Skeleton, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { ScoreRing } from './ScoreRing';
import { scoreWord } from './lens-copy';
import { lensEvaluatedAt, lensRowMeta, verdictTone } from './lens-home';

export interface LensReportRowProps {
  material: StudyMaterial;
  projectTitle: string;
  /** No hairline under the last row of a card. */
  last?: boolean;
  /** The report the card above features; the row says so instead of hiding. */
  featured?: boolean;
  onPress: () => void;
}

/** "8월 22일" with a no-break space, so a narrow meta line wraps at the slash, not inside the date. */
function atomicDate(isoDate: string): string {
  return formatRelativeDate(isoDate).replace(/ /g, ' ');
}

/** A finished report in the 지난 평가 list: ring, title, meta, verdict, chevron. */
export function LensReportRow({
  featured = false,
  last = false,
  material,
  onPress,
  projectTitle,
}: LensReportRowProps) {
  const overall = material.lensReport?.overall ?? 0;
  const verdict = scoreWord(overall);
  const evaluatedAt = lensEvaluatedAt(material);
  const meta = lensRowMeta(projectTitle, atomicDate(evaluatedAt), material.lensCount);
  const spokenMeta = lensRowMeta(
    projectTitle,
    formatRelativeDate(evaluatedAt),
    material.lensCount,
  );
  return (
    <Pressable
      accessibilityHint="발표 평가 결과를 열어요"
      accessibilityLabel={`${material.title}${featured ? ', 최근' : ''}. ${overall.toFixed(1)}점, ${verdict}. ${spokenMeta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last ? styles.rowDivider : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <ScoreRing score={overall} size="small" />
      <View style={styles.copy}>
        <View style={styles.titleLine}>
          <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
            {material.title}
          </AppText>
          {featured ? <StatusBadge label="최근" tone="neutral" /> : null}
        </View>
        <AppText tone="muted" variant="meta">
          {meta}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <StatusBadge label={verdict} tone={verdictTone(overall)} />
        <ChevronRight
          {...decorative}
          color={colors.textFaint}
          size={iconSizes.section}
          strokeWidth={1.8}
        />
      </View>
    </Pressable>
  );
}

export interface LensEvaluatingRowProps {
  material: StudyMaterial;
  projectTitle: string;
  last?: boolean;
}

/** A report still being written: the same row with a skeleton where the score goes. */
export function LensEvaluatingRow({ last = false, material, projectTitle }: LensEvaluatingRowProps) {
  return (
    <View
      accessibilityLabel={`${material.title}. 평가 중`}
      accessibilityLiveRegion="polite"
      style={[styles.row, !last ? styles.rowDivider : null]}
    >
      <Skeleton height={40} radius={radii.full} width={40} />
      <View style={styles.copy}>
        <AppText numberOfLines={2} variant="itemTitle">
          {material.title}
        </AppText>
        <View style={styles.skeletonLine}>
          <Skeleton height={10} width="58%" />
        </View>
        <AppText tone="faint" variant="badge">
          {projectTitle}
        </AppText>
      </View>
      <StatusBadge label="평가 중" showDot tone="brand" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  titleLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xs,
  },
  skeletonLine: {
    paddingVertical: spacing.xs,
  },
});
