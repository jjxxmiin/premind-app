import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Card, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration, formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import type { LensReport } from '@/types';

import { RubricSummary } from './RubricSummary';
import { ScoreRing } from './ScoreRing';
import { reportConclusion, scoreWord } from './lens-copy';
import { verdictTone } from './lens-home';

export interface LatestReportCardProps {
  title: string;
  /** "인공지능 개론", or "폴더 없음". */
  projectTitle: string;
  updatedAt: string;
  report: LensReport;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The newest report, big enough to read without opening it: the ring, the
 * 총평 sentence, and the one thing to fix first. The whole card opens the
 * report.
 */
export function LatestReportCard({
  onPress,
  projectTitle,
  report,
  style,
  title,
  updatedAt,
}: LatestReportCardProps) {
  const t = useT();
  const conclusion = reportConclusion(report, t.locale);
  const verdict = scoreWord(report.overall, t.locale);
  const fixTime = conclusion.fix ? formatDuration(conclusion.fix.sourceStartMs / 1_000) : null;
  const meta = `${projectTitle} / ${formatRelativeDate(updatedAt)}`;
  const spoken = [
    t('최근 평가, {title}. {meta}.', { title, meta }),
    conclusion.sentence,
    conclusion.fix
      ? t('먼저 고칠 것, {time}. {text}', { time: fixTime, text: conclusion.fix.text })
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card
      accessibilityHint={t('발표 평가 결과를 열어요')}
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.head}>
        <AppText tone="muted" variant="badge">
          {t('최근 평가')}
        </AppText>
        <StatusBadge label={verdict} tone={verdictTone(report.overall)} />
      </View>
      <View style={styles.main}>
        <ScoreRing label={t('전체 평가')} score={report.overall} size="medium" />
        <View style={styles.copy}>
          <AppText variant="itemTitle">{title}</AppText>
          <AppText tone="faint" variant="badge">
            {meta}
          </AppText>
          <AppText style={styles.sentence} tone="soft" variant="meta">
            {conclusion.sentence}
          </AppText>
        </View>
      </View>
      <RubricSummary rubric={report.rubric} />
      {conclusion.fix && fixTime ? (
        <View style={styles.fix}>
          <View style={styles.fixHead}>
            <AppText tone="muted" variant="badge">
              {t('먼저 고칠 것')}
            </AppText>
            <View style={styles.timeChip}>
              <AppText tabular tone="soft" variant="badge">
                {fixTime}
              </AppText>
            </View>
          </View>
          <AppText variant="body">{conclusion.fix.text}</AppText>
        </View>
      ) : null}
      <View {...decorative} style={styles.link}>
        <AppText tone="soft" variant="label">
          {t('자세히 보기')}
        </AppText>
        <ChevronRight color={colors.textFaint} size={iconSizes.inline} strokeWidth={2} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  main: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  sentence: {
    marginTop: spacing.xs,
  },
  fix: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.tile,
    gap: spacing.xs,
    padding: spacing.md,
  },
  fixHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.badge,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: spacing.xxs,
  },
  link: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xxs,
  },
});
