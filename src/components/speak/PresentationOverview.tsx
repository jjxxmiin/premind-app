import { BookOpen, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  LatestReportCard,
  LensEvaluatingRow,
  ScoreTrend,
  lensEvaluatedAt,
  type LensHome,
} from '@/components/lens';
import {
  AppText,
  BottomSheetModal,
  Button,
  Card,
  ListRow,
  SegmentedControl,
} from '@/components/ui';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

type ReportView = 'recent' | 'trend';

export function PresentationOverview({
  home,
  evaluatingIds,
  projectTitle,
  onOpen,
}: {
  readonly home: LensHome;
  readonly evaluatingIds: readonly string[];
  readonly projectTitle: (material: StudyMaterial) => string;
  readonly onOpen: (material: StudyMaterial) => void;
}) {
  const t = useT();
  const [view, setView] = useState<ReportView>('recent');
  const [historyOpen, setHistoryOpen] = useState(false);
  const { latest, history, rows } = home;
  const running = rows.find((material) => evaluatingIds.includes(material.id));

  if (rows.length === 0) {
    return (
      <Card padding={false}>
        <ListRow
          leadingIcon={BookOpen}
          subtitle={t('녹음한 자료가 준비되면 위의 자료로 평가에서 골라 주세요.')}
          title={t('녹음 다음은 평가')}
        />
        <ListRow
          divider={false}
          leadingIcon={MessageSquare}
          subtitle={t('발표의 구성과 말하기 습관을 보고, 고칠 부분을 확인해요.')}
          title={t('다음 연습의 힌트')}
        />
      </Card>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="heading">
          {t('내 평가')}
        </AppText>
        <Button onPress={() => setHistoryOpen(true)} size="small" variant="ghost">
          {t('전체 {n}개', { n: rows.length })}
        </Button>
      </View>
      {history.length >= 2 ? (
        <SegmentedControl
          onChange={setView}
          options={[
            { value: 'recent', label: t('최근 평가') },
            { value: 'trend', label: t('변화 추이') },
          ]}
          value={view}
        />
      ) : null}
      {running ? (
        <Card padding={false}>
          <LensEvaluatingRow last material={running} projectTitle={projectTitle(running)} />
        </Card>
      ) : null}
      {view === 'trend' && history.length >= 2 ? (
        <ScoreTrend entries={history} />
      ) : latest?.lensReport ? (
        <LatestReportCard
          onPress={() => onOpen(latest)}
          projectTitle={projectTitle(latest)}
          report={latest.lensReport}
          title={latest.title}
          updatedAt={lensEvaluatedAt(latest)}
        />
      ) : null}
      <BottomSheetModal
        onClose={() => setHistoryOpen(false)}
        title={t('평가 기록')}
        visible={historyOpen}
      >
        <Card padding={false}>
          {rows.map((material, index) =>
            evaluatingIds.includes(material.id) ? (
              <LensEvaluatingRow
                key={material.id}
                last={index === rows.length - 1}
                material={material}
                projectTitle={projectTitle(material)}
              />
            ) : (
              <ListRow
                divider={index < rows.length - 1}
                key={material.id}
                onPress={() => {
                  setHistoryOpen(false);
                  onOpen(material);
                }}
                subtitle={`${projectTitle(material)} / ${formatRelativeDate(lensEvaluatedAt(material))}`}
                title={material.title}
              />
            ),
          )}
        </Card>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
