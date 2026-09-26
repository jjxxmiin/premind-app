import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SpeakCard } from '@/components/speak/SpeakCard';
import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';
import type { LensReport } from '@/types';

import { ScoreRing } from './ScoreRing';
import { reportConclusion, scoreWord } from './lens-copy';

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
 * The newest report: the ring, the title and its meta line (2026-09-26
 * declutter: the verdict badge, the 총평 sentence and the thing to fix first
 * live in the report; a screen reader still hears them). The whole card opens it.
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
  const meta = `${projectTitle} / ${formatRelativeDate(updatedAt)}`;
  const spoken = [
    t('최근 평가, {title}. {meta}.', { title, meta }),
    t('{score}점, {verdict}.', { score: report.overall.toFixed(1), verdict }),
    conclusion.fix ? t('먼저 고칠 것, {text}', { text: conclusion.fix.text }) : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SpeakCard
      tone="raised"
      accessibilityHint={t('발표 평가 결과를 열어요')}
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.main}>
        <ScoreRing label={t('전체 평가')} score={report.overall} size="medium" />
        <View style={styles.copy}>
          <AppText numberOfLines={2} variant="heading">
            {title}
          </AppText>
          <AppText numberOfLines={1} tone="faint" variant="meta">
            {meta}
          </AppText>
        </View>
        <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} strokeWidth={2} />
      </View>
    </SpeakCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
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
});
