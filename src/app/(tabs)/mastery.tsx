import { router } from 'expo-router';
import { Bell, Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { MasteryHero, MaterialMasteryRow } from '@/components/mastery';
import {
  AnimatedReveal,
  AppText,
  Button,
  Card,
  EmptyMasteryArtwork,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { confusionSpots, type ConfusionSpot } from '@/lib/confusion-spots';
import { formatSourcePosition } from '@/lib/format';
import { useLayout } from '@/lib/layout';
import type { QuizOrigin } from '@/lib/navigation';
import {
  overallMastery,
  overviewCopy,
  summarizeMastery,
  weekdayActivity,
  type MasterySummary,
} from '@/lib/mastery';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/** A material the learner can be scored on: ready, with questions or key points. */
function isStudyable(material: StudyMaterial): boolean {
  return (
    material.status === 'ready' &&
    (material.quiz.length > 0 || (material.note?.keyPoints.length ?? 0) > 0)
  );
}

/** Rows shown before "더 보기". */
const VISIBLE_ROWS = 6;
/** Marked passages shown at once: a reminder, not a backlog. */
const VISIBLE_SPOTS = 4;

/**
 * The 이해도 tab: one ring for everything studied, the week's activity, what
 * to do next across every material, and a row per material. Everything is
 * computed on the device from the learner's own answers and ticks.
 */
export default function MasteryScreen() {
  const {
    confusionFeedback,
    materials,
    quizAttempts,
    resolveConfusion,
    studyNotes,
  } = useAppStore();
  const { gutter } = useLayout();
  const [expanded, setExpanded] = useState(false);

  /** 이해도 per studyable material, scored ones first, newest activity on top. */
  const mastery = useMemo(() => {
    const rows = materials.filter(isStudyable).map((material) => ({
      material,
      summary: summarizeMastery(material, quizAttempts, studyNotes[material.id]),
    }));
    return rows.sort((left, right) => {
      const leftDone = left.summary.score !== null ? 1 : 0;
      const rightDone = right.summary.score !== null ? 1 : 0;
      if (leftDone !== rightDone) return rightDone - leftDone;
      const leftAt = left.summary.lastAttemptAt ?? left.material.updatedAt;
      const rightAt = right.summary.lastAttemptAt ?? right.material.updatedAt;
      return rightAt.localeCompare(leftAt);
    });
  }, [materials, quizAttempts, studyNotes]);

  /**
   * The passages the learner said they were stuck on. Marking one asks the AI
   * about it there and then; this is where they add up, so a week later the
   * shortest list of what to go back to is the one they wrote themselves.
   */
  const spots = useMemo(
    () => confusionSpots(confusionFeedback, materials),
    [confusionFeedback, materials],
  );
  const visibleSpots = spots.slice(0, VISIBLE_SPOTS);

  const days = useMemo(() => weekdayActivity(quizAttempts), [quizAttempts]);
  const score = overallMastery(mastery.map((row) => row.summary));
  const studiedCount = mastery.filter((row) => row.summary.score !== null).length;
  const unansweredCount = mastery.reduce(
    (sum, row) => sum + (row.summary.questionCount - row.summary.answeredCount),
    0,
  );
  const copy = overviewCopy({
    materialCount: mastery.length,
    studiedCount,
    // The first concept the learner actually got wrong, across materials.
    weakConcept:
      mastery.flatMap((row) => row.summary.weakConcepts)[0]?.concept ?? null,
    unansweredCount,
  });

  /** `from` names this tab so 문제 comes back here, not to the material. */
  const openQuiz = (materialId: string) =>
    router.push({
      pathname: '/quiz/[id]',
      params: { id: materialId, from: 'mastery' satisfies QuizOrigin },
    });

  /** The hero's one button: the newest material with questions, or the recorder. */
  const startFirstQuiz = () => {
    const newest = [...mastery]
      .filter((row) => row.material.quiz.length > 0)
      .sort((left, right) => right.material.updatedAt.localeCompare(left.material.updatedAt))[0];
    if (newest) openQuiz(newest.material.id);
    else router.push('/record');
  };

  const openMastery = (material: StudyMaterial, summary: MasterySummary) => {
    if (summary.score !== null) {
      router.push({ pathname: '/mastery/[id]', params: { id: material.id } });
    } else if (material.quiz.length > 0) {
      openQuiz(material.id);
    } else {
      router.push({
        pathname: '/material/[id]',
        params: { id: material.id, tab: 'summary' },
      });
    }
  };

  const visibleRows = expanded ? mastery : mastery.slice(0, VISIBLE_ROWS);
  const hiddenCount = mastery.length - visibleRows.length;

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
            label="알림"
            onPress={() => router.push('/notifications')}
          />
        }
      />

      <View style={[styles.content, { paddingHorizontal: gutter }]}>
        <AnimatedReveal>
          <View style={styles.heading}>
            <AppText variant="pageTitle">이해도</AppText>
            <AppText tone="muted" variant="body">
              푼 문제와 확인한 내용으로 자료마다 계산해요
            </AppText>
          </View>
        </AnimatedReveal>

        {mastery.length === 0 ? (
          <AnimatedReveal delay={40}>
            <Card padding={false}>
              <EmptyState
                actionLabel="마인드팩 만들기"
                // A ring at zero over an unticked 확인 목록: the two things
                // that fill it, drawn before either has happened.
                artwork={<EmptyMasteryArtwork />}
                compact
                description="문제를 풀고 꼭 기억할 내용을 확인하면 여기에 자료별 이해도가 채워져요"
                onAction={() => router.push('/record')}
                title="아직 평가할 자료가 없어요"
              />
            </Card>
          </AnimatedReveal>
        ) : (
          <>
            <AnimatedReveal delay={40}>
              <MasteryHero copy={copy} days={days} onStart={startFirstQuiz} score={score} />
            </AnimatedReveal>

            {spots.length ? (
              <AnimatedReveal delay={50}>
                <View style={styles.section}>
                  <SectionHeader
                    description="누르면 그 대목으로 가요. 알게 됐으면 지워 주세요."
                    title="헷갈린다고 표시한 곳"
                  />
                  <Card padding={false}>
                    {visibleSpots.map((spot, index) => (
                      <ConfusionSpotRow
                        divider={index < visibleSpots.length - 1}
                        key={spot.id}
                        onOpen={() =>
                          router.push({
                            pathname: '/material/[id]',
                            params: {
                              at: String(spot.positionMs),
                              id: spot.materialId,
                              tab: 'transcript',
                            },
                          })
                        }
                        onResolve={() => resolveConfusion(spot.id)}
                        spot={spot}
                      />
                    ))}
                  </Card>
                  {spots.length > visibleSpots.length ? (
                    <AppText tone="muted" variant="meta">
                      표시한 곳 {spots.length}개 중 최근 {visibleSpots.length}개예요
                    </AppText>
                  ) : null}
                </View>
              </AnimatedReveal>
            ) : null}

            {/* No "다음에 할 일" list here: it repeated what each material's
                own screen already says, and the study actions (문제, 카드,
                다시 듣기) now live on the material itself. */}
            <AnimatedReveal delay={60}>
              <View style={styles.section}>
                <SectionHeader
                  description="자료를 누르면 취약 개념과 무엇부터 볼지 알려 줘요."
                  title="자료별 이해도"
                />
                <Card padding={false}>
                  {visibleRows.map(({ material, summary }, index) => (
                    <MaterialMasteryRow
                      divider={index < visibleRows.length - 1 || hiddenCount > 0}
                      key={material.id}
                      material={material}
                      onPress={openMastery}
                      summary={summary}
                    />
                  ))}
                  {hiddenCount > 0 ? (
                    <Button
                      accessibilityLabel={`자료 ${hiddenCount}개 더 보기`}
                      fullWidth
                      onPress={() => setExpanded(true)}
                      style={styles.more}
                      variant="ghost"
                    >
                      {`더 보기 ${hiddenCount}개`}
                    </Button>
                  ) : null}
                </Card>
              </View>
            </AnimatedReveal>
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * One marked passage: tap the body to go there, tap the check to clear it.
 *
 * Written out rather than built from `ListRow` because the row needs two
 * independent targets. A button nested inside a button is invalid on the web
 * and ambiguous to a screen reader on the phone, so they are siblings.
 */
function ConfusionSpotRow({
  divider,
  onOpen,
  onResolve,
  spot,
}: {
  divider: boolean;
  onOpen: () => void;
  onResolve: () => void;
  spot: ConfusionSpot;
}) {
  const where = `${spot.materialTitle} / ${formatSourcePosition(spot.positionMs, spot.isDocument)} / ${spot.reasonLabel}`;
  return (
    <View style={[styles.spotRow, divider ? styles.spotDivider : null]}>
      <Pressable
        accessibilityHint="표시한 대목을 대본에서 열어요."
        accessibilityLabel={`${spot.passage}, ${where}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.spotBody, pressed ? styles.spotPressed : null]}
      >
        <AppText numberOfLines={2} variant="itemTitle">
          {spot.passage}
        </AppText>
        <AppText numberOfLines={2} tone="muted" variant="meta">
          {where}
        </AppText>
      </Pressable>
      <IconButton
        icon={Check}
        label={`${spot.reasonLabel} 표시 지우기`}
        onPress={onResolve}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  spotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  spotDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  spotBody: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  spotPressed: { opacity: 0.7 },
  /** Header → first block 8; between blocks 24; last block → end 32. */
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
  more: {
    borderRadius: 0,
    minHeight: 54,
  },
});
