import { router } from 'expo-router';
import { Bell, Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Carousel } from '@/components/app';
import {
  MasteryHero,
  MaterialMasteryRow,
  MaterialMasteryTile,
  PressFace,
  ReviewCard,
  TileGrid,
  studyStreak,
} from '@/components/mastery';
import {
  AnimatedReveal,
  AppText,
  Button,
  EmptyMasteryArtwork,
  EmptyState,
  IconButton,
  Screen,
} from '@/components/ui';
import { confusionSpots, type ConfusionSpot } from '@/lib/confusion-spots';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
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
import { colors, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/** A material the learner can be scored on: ready, with questions or key points. */
function isStudyable(material: StudyMaterial): boolean {
  return (
    material.status === 'ready' &&
    (material.quiz.length > 0 || (material.note?.keyPoints.length ?? 0) > 0)
  );
}

/** Rows shown before "더 보기": two full rows of the widest grid. */
const VISIBLE_ROWS = 6;
/** Marked passages shown at once: a reminder, not a backlog. */
const VISIBLE_SPOTS = 4;
/** Cards in 지금 복습할 자료: a handful to swipe through; the rest are listed below. */
const REVIEW_CARDS = 5;

/**
 * The 이해도 tab, laid out as an app rather than a dashboard (2026-09-26,
 * decluttered the same day): grey page, white cards. A large title; one hero
 * with one ring holding "현재 이해도 35%", the week in a line and a single
 * full-width "오늘 복습 시작"; the materials to review as a carousel; the
 * passages marked 헷갈려요 as review cards; and the rest as progress rows.
 * Everything is computed on the device from the learner's own answers and ticks.
 */
export default function MasteryScreen() {
  const t = useT();
  const locale = t.locale;
  const {
    confusionFeedback,
    materials,
    quizAttempts,
    resolveConfusion,
    studyNotes,
  } = useAppStore();
  const { breakpoint, columns, gutter, isTablet } = useLayout();
  /** Desktop: the sidebar carries the wordmark, so the bell sits beside the title. */
  const wide = breakpoint === 'expanded';
  const [expanded, setExpanded] = useState(false);

  /** 이해도 per studyable material, scored ones first, newest activity on top. */
  const mastery = useMemo(() => {
    const rows = materials.filter(isStudyable).map((material) => ({
      material,
      summary: summarizeMastery(material, quizAttempts, studyNotes[material.id], locale),
    }));
    return rows.sort((left, right) => {
      const leftDone = left.summary.score !== null ? 1 : 0;
      const rightDone = right.summary.score !== null ? 1 : 0;
      if (leftDone !== rightDone) return rightDone - leftDone;
      const leftAt = left.summary.lastAttemptAt ?? left.material.updatedAt;
      const rightAt = right.summary.lastAttemptAt ?? right.material.updatedAt;
      return rightAt.localeCompare(leftAt);
    });
  }, [locale, materials, quizAttempts, studyNotes]);

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

  const days = useMemo(
    () => weekdayActivity(quizAttempts, undefined, locale),
    [locale, quizAttempts],
  );
  const streak = useMemo(() => studyStreak(quizAttempts), [quizAttempts]);
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
  }, locale);

  /** `from` names this tab so 문제 comes back here, not to the material. */
  const openQuiz = (materialId: string) =>
    router.push({
      pathname: '/quiz/[id]',
      params: { id: materialId, from: 'mastery' satisfies QuizOrigin },
    });

  /** The newest material with questions, or the recorder when there is none. */
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

  const openSpot = (spot: ConfusionSpot) =>
    router.push({
      pathname: '/material/[id]',
      params: { at: String(spot.positionMs), id: spot.materialId, tab: 'transcript' },
    });

  /**
   * 지금 복습할 자료, the carousel: scored materials not yet at 100, weakest
   * first, then materials with questions nobody has tried yet, newest first.
   * Before anything is scored the same row holds the untried ones, so the
   * carousel is also the "where do I start".
   */
  const review = useMemo(() => {
    const weak = mastery
      .filter((row) => row.summary.score !== null && (row.summary.score < 100 || row.summary.weakConcepts.length > 0))
      .sort((left, right) => (left.summary.score ?? 0) - (right.summary.score ?? 0));
    const untried = mastery.filter(
      (row) => row.summary.score === null && row.material.quiz.length > 0,
    );
    return [...weak, ...untried].slice(0, REVIEW_CARDS);
  }, [mastery]);
  const rest = mastery.filter((row) => !review.includes(row));

  /**
   * The hero's one button, the day's single path (Duolingo): the weakest
   * material's questions, else the first spot marked 헷갈려요, else the first
   * quiz. Every target is a route the tab already used.
   */
  const target = review.find((row) => row.material.quiz.length > 0);
  const anyScored = studiedCount > 0;
  const actionLabel = anyScored ? t('오늘 복습 시작') : t('첫 문제 풀기');
  const startToday = () => {
    if (target) openQuiz(target.material.id);
    else if (spots[0]) openSpot(spots[0]);
    else startFirstQuiz();
  };

  const visibleRows = expanded ? rest : rest.slice(0, VISIBLE_ROWS);
  const hiddenCount = rest.length - visibleRows.length;

  return (
    <Screen
      background="soft"
      padded={false}
      safeAreaEdges={['top', 'left', 'right']}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      {wide ? null : (
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
      )}

      <View style={[styles.content, { paddingHorizontal: gutter }, wide ? styles.contentWide : null]}>
        <AnimatedReveal>
          <View style={styles.titleRow}>
            <AppText accessibilityRole="header" style={styles.title} variant="display">
              {t('복습')}
            </AppText>
            {wide ? (
              <IconButton
                icon={Bell}
                label={t('알림')}
                onPress={() => router.push('/notifications')}
              />
            ) : null}
          </View>
        </AnimatedReveal>

        {mastery.length === 0 ? (
          <AnimatedReveal delay={40}>
            <View style={styles.emptyFace}>
              <EmptyState
                actionLabel={t('마인드팩 만들기')}
                // A ring at zero over an unticked 확인 목록: the two things
                // that fill it, drawn before either has happened.
                artwork={<EmptyMasteryArtwork />}
                compact
                description={t(
                  '문제를 풀고 꼭 기억할 내용을 확인하면 여기에 자료별 이해도가 채워져요',
                )}
                onAction={() => router.push('/record')}
                title={t('아직 이해도를 볼 자료가 없어요')}
              />
            </View>
          </AnimatedReveal>
        ) : (
          <>
            <AnimatedReveal delay={40}>
              <MasteryHero
                actionLabel={actionLabel}
                days={days}
                next={copy.detail || copy.title}
                onAction={startToday}
                score={score}
                streak={streak}
              />
            </AnimatedReveal>

            {review.length ? (
              <AnimatedReveal delay={60}>
                {/* 구역 제목 없이 카드로만 나눈다(2026-09-26 CEO "섹션별로 제목 굳이 없어도"). 이름은 화면 읽기용으로. */}
                <View style={styles.section}>
                  <Carousel
                    accessibilityLabel={anyScored ? t('지금 복습할 자료') : t('시작할 자료')}
                    itemWidth={isTablet ? 280 : undefined}
                  >
                    {review.map(({ material, summary }) => (
                      <ReviewCard
                        key={material.id}
                        material={material}
                        onPress={openMastery}
                        summary={summary}
                      />
                    ))}
                  </Carousel>
                </View>
              </AnimatedReveal>
            ) : null}

            {spots.length ? (
              <AnimatedReveal delay={70}>
                <View accessibilityLabel={t('헷갈린 곳')} style={styles.section}>
                  {isTablet ? (
                    <TileGrid columns={2}>
                      {visibleSpots.map((spot) => (
                        <ConfusionSpotCard
                          key={spot.id}
                          onOpen={() => openSpot(spot)}
                          onResolve={() => resolveConfusion(spot.id)}
                          spot={spot}
                        />
                      ))}
                    </TileGrid>
                  ) : (
                    <View style={styles.stack}>
                      {visibleSpots.map((spot) => (
                        <ConfusionSpotCard
                          key={spot.id}
                          onOpen={() => openSpot(spot)}
                          onResolve={() => resolveConfusion(spot.id)}
                          spot={spot}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </AnimatedReveal>
            ) : null}

            {rest.length ? (
              <AnimatedReveal delay={80}>
                <View
                  accessibilityLabel={review.length ? t('나머지 자료') : t('자료별 이해도')}
                  style={styles.section}
                >
                  {isTablet ? (
                    <TileGrid columns={Math.max(2, columns)} gap={spacing.sm}>
                      {visibleRows.map(({ material, summary }) => (
                        <MaterialMasteryTile
                          key={material.id}
                          material={material}
                          onPress={openMastery}
                          summary={summary}
                        />
                      ))}
                    </TileGrid>
                  ) : (
                    <View style={styles.stack}>
                      {visibleRows.map(({ material, summary }) => (
                        <MaterialMasteryRow
                          key={material.id}
                          material={material}
                          onPress={openMastery}
                          summary={summary}
                        />
                      ))}
                    </View>
                  )}
                  {hiddenCount > 0 ? (
                    <Button
                      accessibilityLabel={t('자료 {n}개 더 보기', { n: hiddenCount })}
                      onPress={() => setExpanded(true)}
                      style={styles.more}
                      variant="secondary"
                    >
                      {t('더 보기 {n}개', { n: hiddenCount })}
                    </Button>
                  ) : null}
                </View>
              </AnimatedReveal>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * One marked passage as a review card (Santa 복습): the passage in one line,
 * where it is in one line, and at the foot the reason on the left with the
 * check that clears it on the right. Nothing else.
 *
 * The check is a sibling laid over the card's corner, not a child: a button
 * inside a button is invalid on the web and ambiguous to a screen reader.
 */
function ConfusionSpotCard({
  onOpen,
  onResolve,
  spot,
}: {
  onOpen: () => void;
  onResolve: () => void;
  spot: ConfusionSpot;
}) {
  const t = useT();
  const reason = t(spot.reasonLabel);
  const where = `${spot.materialTitle} / ${formatSourcePosition(spot.positionMs, spot.isDocument)}`;
  return (
    <View style={styles.spot}>
      <PressFace
        accessibilityHint={t('표시한 대목을 대본에서 열어요.')}
        accessibilityLabel={`${spot.passage}, ${where}, ${reason}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.spotBody}
      >
        <AppText numberOfLines={1} variant="itemTitle">
          {spot.passage}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {where}
        </AppText>
        <AppText numberOfLines={1} style={styles.reasonText} variant="badge">
          {reason}
        </AppText>
      </PressFace>
      <View style={styles.spotResolve}>
        <IconButton
          icon={Check}
          label={t('{reason} 표시 지우기', { reason })}
          onPress={onResolve}
          size="small"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Header → title 8; between blocks 32; last block → end 40. */
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  /** No header bar on a desktop: the title starts where the home's greeting does. */
  contentWide: { paddingTop: spacing.xl },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md },
  stack: { gap: spacing.sm },
  emptyFace: {
    backgroundColor: colors.surface,
    borderRadius: radii.hero,
    paddingVertical: spacing.lg,
  },
  more: { alignSelf: 'center', borderRadius: radii.chip },
  spot: { flex: 1 },
  /** Right padding leaves the foot's right end to the check laid over it. */
  spotBody: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    paddingRight: spacing.huge,
  },
  spotResolve: { bottom: spacing.sm, position: 'absolute', right: spacing.sm },
  reasonText: { color: colors.warningStrong, marginTop: spacing.xs },
});
