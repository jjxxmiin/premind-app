import { StyleSheet, View } from 'react-native';

import { SpeakCard } from '@/components/speak/SpeakCard';
import { Surface } from '@/components/speak/SpeakKit';
import { AppText, Skeleton, StatusBadge } from '@/components/ui';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { ScoreRing } from './ScoreRing';
import { scoreWord } from './lens-copy';
import { lensEvaluatedAt, lensRowMeta, verdictTone } from './lens-home';

/** 지난 평가 한 장(옆으로 넘기는 줄 안): 링, 판정 한 마디, 제목, 날짜. 카드 전체가 리포트를 연다. */
export function LensReportTile({
  material,
  projectTitle,
  onPress,
}: {
  material: StudyMaterial;
  projectTitle: string;
  onPress: () => void;
}) {
  const t = useT();
  const overall = material.lensReport?.overall ?? 0;
  const verdict = scoreWord(overall, t.locale);
  const meta = lensRowMeta(projectTitle, formatRelativeDate(lensEvaluatedAt(material)), material.lensCount, t.locale);
  return (
    <SpeakCard
      accessibilityHint={t('발표 평가 결과를 열어요')}
      accessibilityLabel={`${material.title}. ${t('{score}점', { score: overall.toFixed(1) })}, ${verdict}. ${meta}`}
      onPress={onPress}
      style={styles.card}
      tone="soft"
    >
      <View style={styles.head}>
        <ScoreRing score={overall} size="small" />
        <StatusBadge label={verdict} tone={verdictTone(overall)} />
      </View>
      <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
        {material.title}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="meta">
        {meta}
      </AppText>
    </SpeakCard>
  );
}

/** 아직 쓰는 중인 평가: 같은 자리에 점수 대신 뼈대. */
export function LensEvaluatingTile({ material, projectTitle }: { material: StudyMaterial; projectTitle: string }) {
  const t = useT();
  return (
    <Surface
      accessibilityLabel={`${material.title}. ${t('평가 중')}`}
      accessible
      style={styles.card}
      tone="soft"
    >
      <View style={styles.head}>
        <Skeleton height={40} radius={radii.full} width={40} />
        <StatusBadge label={t('평가 중')} showDot tone="brand" />
      </View>
      <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
        {material.title}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="meta">
        {projectTitle}
      </AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.sm, minHeight: 148 },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  title: { flexGrow: 1 },
});
