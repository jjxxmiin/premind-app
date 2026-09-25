import { router } from 'expo-router';
import { BarChart3, Bell, Check, Link2, Mic, Play } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  LatestReportCard,
  LensEvaluatingRow,
  LensIntroCard,
  LensReportRow,
  LensTipsCard,
  ScoreTrend,
  lensFailure,
  lensHome,
  type LensFailure,
} from '@/components/lens';
import { MediaArtwork } from '@/components/MediaArtwork';
import {
  AnimatedReveal,
  AppText,
  BottomSheetModal,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatMaterialLength, formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/** 말하기 탭의 발표 쪽. `switcher` 는 발표, 면접을 고르는 줄(머리 바로 아래). */
export function PresentationHome({ switcher }: { switcher?: ReactNode }) {
  const t = useT();
  const { evaluatingMaterialIds, materials, projects, requestLens } = useAppStore();
  const { gutter } = useLayout();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<LensFailure | null>(null);

  const projectTitle = (material: StudyMaterial) =>
    projects.find((project) => project.id === material.projectId)?.title ??
    t('폴더 없음');

  const isEvaluating = (id: string) => evaluatingMaterialIds.includes(id);
  const { candidates, history, latest, rows, showRows, showTips } = lensHome(
    materials,
    evaluatingMaterialIds,
  );

  const openPicker = () => {
    setSelectedId(null);
    setPickerOpen(true);
  };
  const openRecorder = () => router.push('/record');
  const openReport = (material: StudyMaterial) =>
    router.push({ pathname: '/report/[id]', params: { id: material.id } });

  const startEvaluation = () => {
    if (!selectedId) return;
    const materialId = selectedId;
    setPickerOpen(false);
    setSelectedId(null);
    void requestLens(materialId)
      .then((material) => openReport(material))
      .catch((error: unknown) => setFailure(lensFailure(error)));
  };

  return (
    <Screen
      padded={false}
      safeAreaEdges={['top', 'left', 'right']}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      <AppHeader
        brand
        right={
          <IconButton
            icon={Bell}
            label={t('알림')}
            onPress={() => router.push('/notifications')}
          />
        }
      />

      <View style={[styles.content, { paddingHorizontal: gutter }]}>
        {switcher}
        <AnimatedReveal>
          <View style={styles.heading}>
            <AppText variant="pageTitle">{t('발표 평가')}</AppText>
            {latest ? (
              <AppText tone="muted" variant="body">
                {t('발표나 스피치를 대본으로 채점해요. 녹음, 올린 영상, 유튜브 링크 다 돼요.')}
              </AppText>
            ) : null}
          </View>
        </AnimatedReveal>

        <AnimatedReveal delay={80}>
          {latest?.lensReport ? (
            <View style={styles.section}>
              <LatestReportCard
                onPress={() => openReport(latest)}
                projectTitle={projectTitle(latest)}
                report={latest.lensReport}
                title={latest.title}
                updatedAt={latest.updatedAt}
              />
              <View style={styles.actions}>
                <Button
                  fullWidth
                  leftIcon={
                    <BarChart3 color={colors.textInverse} size={iconSizes.inline} />
                  }
                  onPress={openPicker}
                  size="large"
                  variant="primary"
                >
                  {t('새 평가 시작')}
                </Button>
                <Button
                  fullWidth
                  leftIcon={<Mic color={colors.text} size={iconSizes.inline} />}
                  onPress={openRecorder}
                  variant="outline"
                >
                  {t('발표 녹음하기')}
                </Button>
              </View>
            </View>
          ) : (
            <LensIntroCard onPick={openPicker} onRecord={openRecorder} />
          )}
        </AnimatedReveal>

        {history.length >= 2 ? (
          <AnimatedReveal delay={140}>
            <ScoreTrend entries={history} />
          </AnimatedReveal>
        ) : null}

        {showRows ? (
          <AnimatedReveal delay={200}>
            <View style={styles.section}>
              <SectionHeader title={t('지난 평가')} />
              <Card padding={false}>
                {rows.map((material, index) =>
                  isEvaluating(material.id) ? (
                    <LensEvaluatingRow
                      key={material.id}
                      last={index === rows.length - 1}
                      material={material}
                      projectTitle={projectTitle(material)}
                    />
                  ) : (
                    <LensReportRow
                      featured={material.id === latest?.id}
                      key={material.id}
                      last={index === rows.length - 1}
                      material={material}
                      onPress={() => openReport(material)}
                      projectTitle={projectTitle(material)}
                    />
                  ),
                )}
              </Card>
            </View>
          </AnimatedReveal>
        ) : null}

        {showTips ? (
          <AnimatedReveal delay={260}>
            <View style={styles.section}>
              <SectionHeader
                description={t('점수가 제대로 나오는 녹음이에요.')}
                title={t('이렇게 써요')}
              />
              <LensTipsCard />
            </View>
          </AnimatedReveal>
        ) : null}
      </View>

      <BottomSheetModal
        description={t(
          '평가할 자료를 골라 주세요. 녹음, 올린 영상이나 음성, 유튜브 링크 다 돼요. 말소리가 없는 PDF와 PPTX는 평가하지 않아요.',
        )}
        footer={
          <View style={styles.sheetFooter}>
            <Card style={styles.sheetNote} variant="soft">
              <Link2
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.inline}
                strokeWidth={2}
              />
              <AppText style={styles.flex} tone="muted" variant="meta">
                {t(
                  '여기서 평가 시작을 눌러야 채점해요. 자료를 올려도 알아서 평가하지 않아요. 말이 담긴 자료면 무엇이든 골라도 돼요.',
                )}
              </AppText>
            </Card>
            <Button
              disabled={!selectedId}
              fullWidth
              leftIcon={<Play color={colors.textInverse} size={iconSizes.inline} />}
              onPress={startEvaluation}
              size="large"
              variant="primary"
            >
              {t('평가 시작')}
            </Button>
          </View>
        }
        onClose={() => setPickerOpen(false)}
        title={t('새 평가 시작')}
        visible={pickerOpen}
      >
        {candidates.length > 0 ? (
          <Card padding={false}>
            {candidates.map((material, index) => (
              <CandidateRow
                key={material.id}
                last={index === candidates.length - 1}
                material={material}
                onPress={() => setSelectedId(material.id)}
                projectTitle={projectTitle(material)}
                selected={selectedId === material.id}
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            actionLabel={t('녹음 시작')}
            compact
            description={t(
              '발표를 녹음하거나, 영상이나 음성 파일 또는 유튜브 링크를 올려 주세요. PDF와 PPTX는 말소리가 없어서 평가할 수 없어요.',
            )}
            icon={Mic}
            onAction={() => {
              setPickerOpen(false);
              openRecorder();
            }}
            title={t('평가할 자료가 없어요')}
          />
        )}
      </BottomSheetModal>

      <Dialog
        confirm={{ label: t('확인'), onPress: () => setFailure(null) }}
        description={failure ? t(failure.message) : undefined}
        onRequestClose={() => setFailure(null)}
        title={t(failure?.title ?? '평가를 시작하지 못했어요')}
        visible={failure !== null}
      />
    </Screen>
  );
}

/**
 * What the row is made of. The picker takes any ready 자료, so the row says
 * so out loud — otherwise a list of recordings reads as a rule that only
 * recordings can be scored.
 */
function sourceLabel(material: StudyMaterial): string {
  if (material.source.origin === 'link') return '유튜브 링크';
  if (material.source.kind === 'video') return '영상';
  if (material.source.kind === 'document') return '문서';
  return material.source.origin === 'recording' ? '녹음' : '음성';
}

function CandidateRow({
  last,
  material,
  onPress,
  projectTitle,
  selected,
}: {
  last: boolean;
  material: StudyMaterial;
  onPress: () => void;
  projectTitle: string;
  selected: boolean;
}) {
  const t = useT();
  const kind = t(sourceLabel(material));
  return (
    <Pressable
      accessibilityLabel={`${material.title}. ${projectTitle}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last ? styles.rowDivider : null,
        selected ? styles.rowSelected : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <MediaArtwork compact kind={material.source.kind} status={material.status} />
      <View style={styles.flex}>
        <AppText numberOfLines={2} variant="itemTitle">
          {material.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {kind}
          {` / ${formatMaterialLength(material.source.kind, material.source.durationMs, material.transcript.length)}`}
          {' / '}
          {formatRelativeDate(material.updatedAt)}
          {material.lensReport ? ` / ${t('평가 있음')}` : ''}
        </AppText>
      </View>
      <View
        {...decorative}
        style={[styles.checkCircle, selected ? styles.checkCircleOn : null]}
      >
        {selected ? (
          <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  heading: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
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
  rowSelected: {
    backgroundColor: colors.brandSubtle,
  },
  checkCircle: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    borderWidth: 1.5,
    height: spacing.xl,
    justifyContent: 'center',
    width: spacing.xl,
  },
  checkCircleOn: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  sheetFooter: {
    gap: spacing.md,
  },
  sheetNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
