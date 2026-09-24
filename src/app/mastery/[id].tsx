import { router, useLocalSearchParams } from 'expo-router';
import {
  BookOpenCheck,
  Check,
  ListChecks,
  PlayCircle,
  RotateCcw,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ScoreRing, TrendSparkline } from '@/components/lens';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate, formatSourcePosition } from '@/lib/format';
import {
  CHECKLIST_WEIGHT,
  QUIZ_WEIGHT,
  masteryHeadline,
  masteryVerdict,
  summarizeMastery,
  toPercent,
  type ConceptResult,
} from '@/lib/mastery';
import { goBackOrReplace, type QuizOrigin } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

/**
 * 이해도 for one material, plain language first: a sentence, the concepts
 * that went wrong with a way back into the recording, the checklist, the
 * daily accuracy line, and what to do next. Everything is computed on the
 * device from the learner's own answers and ticks.
 */
export default function MasteryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, projects, quizAttempts, studyNotes } = useAppStore();
  const material = materials.find((item) => item.id === id);
  const summary = useMemo(
    () => (material ? summarizeMastery(material, quizAttempts, studyNotes[material.id]) : null),
    [material, quizAttempts, studyNotes],
  );

  const back = () => goBackOrReplace('/(tabs)/mastery');

  if (!material || !summary) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={back} title="이해도" />
        <ErrorState
          description="이 자료를 찾을 수 없어요. 평가에서 다시 골라 주세요."
          onRetry={back}
          retryLabel="돌아가기"
        />
      </Screen>
    );
  }

  const projectTitle =
    projects.find((project) => project.id === material.projectId)?.title ?? '폴더 없음';
  const keyPoints = material.note?.keyPoints ?? [];
  const checked = new Set(studyNotes[material.id]?.checkedPoints ?? []);
  const hasQuiz = material.quiz.length > 0;

  const listenAt = (sourceStartMs: number) =>
    router.push({
      pathname: '/material/[id]',
      params: { id: material.id, tab: 'transcript', at: String(sourceStartMs) },
    });
  const openSummary = () =>
    router.push({
      pathname: '/material/[id]',
      params: { id: material.id, tab: 'summary' },
    });
  /** `from` names this screen so 문제 comes back here, not to the material. */
  const openQuiz = () =>
    router.push({
      pathname: '/quiz/[id]',
      params: { id: material.id, from: 'mastery-detail' satisfies QuizOrigin },
    });

  const primaryLabel = !hasQuiz
    ? '요약 보기'
    : summary.answeredCount > 0
      ? '문제 다시 풀기'
      : '문제 풀기';
  const onPrimary = hasQuiz ? openQuiz : openSummary;

  if (summary.score === null) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={back} title="이해도" />
        <View style={styles.unavailableContent}>
          <EmptyState
            actionLabel={primaryLabel}
            description={
              hasQuiz
                ? `문제 ${summary.questionCount}개를 풀면 이해도와 취약 개념이 생겨요.`
                : '요약에서 핵심 내용을 확인하면 이해도가 생겨요.'
            }
            icon={BookOpenCheck}
            onAction={onPrimary}
            title="아직 평가할 게 없어요"
          />
        </View>
      </Screen>
    );
  }

  const trendValues = summary.trend.map((point) => toPercent(point.accuracy));
  const first = summary.trend[0];
  const latest = summary.trend[summary.trend.length - 1];

  return (
    <Screen padded={false}>
      <AppHeader onBack={back} title="이해도" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.fill}
      >
        <View style={styles.content}>
          <View style={styles.heading}>
            <AppText variant="pageTitle">{masteryHeadline(summary)}</AppText>
            <AppText numberOfLines={2} tone="muted" variant="body">
              {`${material.title} / ${projectTitle}`}
            </AppText>
          </View>

          <Card style={styles.scoreCard} variant="soft">
            <ScoreRing
              label="이해도"
              max={100}
              precision={0}
              score={summary.score}
              unit="%"
              verdict={masteryVerdict(summary.score)}
            />
            <View style={styles.scoreParts}>
              <ScorePart
                label={`문제 정답률 ${Math.round(QUIZ_WEIGHT * 100)}%`}
                value={
                  summary.accuracy === null
                    ? '아직 안 풀었어요'
                    : `${summary.answeredCount}개 중 ${summary.correctCount}개 맞힘, ${toPercent(summary.accuracy)}%`
                }
              />
              <ScorePart
                label={`핵심 내용 확인 ${Math.round(CHECKLIST_WEIGHT * 100)}%`}
                value={
                  summary.checklistRatio === null
                    ? '핵심 내용이 없어요'
                    : `${summary.keyPointCount}개 중 ${summary.checkedCount}개 확인, ${toPercent(summary.checklistRatio)}%`
                }
              />
            </View>
          </Card>

          <View style={styles.section}>
            <SectionHeader
              description="마지막 답이 틀린 개념이에요. 시간을 누르면 그 부분부터 들어요."
              title="헷갈린 개념"
            />
            {summary.weakConcepts.length > 0 ? (
              <View style={styles.cardList}>
                {summary.weakConcepts.map((concept) => (
                  <ConceptCard
                    concept={concept}
                    key={concept.concept}
                    onListen={() => listenAt(concept.sourceStartMs)}
                    page={material.source.kind === 'document'}
                  />
                ))}
              </View>
            ) : (
              <Card style={styles.quietCard} variant="soft">
                <StatusBadge label="없어요" tone="positive" />
                <AppText tone="muted" variant="body">
                  {summary.answeredCount > 0
                    ? '푼 문제는 모두 맞혔어요.'
                    : '문제를 풀면 헷갈린 개념이 보여요.'}
                </AppText>
              </Card>
            )}
          </View>

          {keyPoints.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                actionLabel="요약 보기"
                description={`${keyPoints.length}개 중 ${summary.checkedCount}개를 확인했어요.`}
                onAction={openSummary}
                title="핵심 내용"
              />
              <Card padding={false}>
                {keyPoints.map((point, index) => {
                  const done = checked.has(point);
                  return (
                    <View
                      accessibilityLabel={`${done ? '확인함' : '아직 확인 안 함'}. ${point}`}
                      accessible
                      key={`${index}-${point}`}
                      style={[
                        styles.pointRow,
                        index < keyPoints.length - 1 ? styles.rowDivider : null,
                      ]}
                    >
                      <View
                        {...decorative}
                        style={[styles.pointMark, done ? styles.pointMarkOn : null]}
                      >
                        {done ? (
                          <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} />
                        ) : null}
                      </View>
                      <AppText
                        style={styles.flex}
                        tone={done ? 'default' : 'muted'}
                        variant="body"
                      >
                        {point}
                      </AppText>
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              description="날짜별로 맞힌 비율이에요."
              title="정답률 추이"
            />
            <Card style={styles.trendCard} variant="soft">
              {summary.trend.length >= 2 && first && latest ? (
                <View
                  accessibilityLabel={`정답률 추이, ${summary.trend.length}일. ${trendValues
                    .map((value) => `${value}%`)
                    .join(', ')}`}
                  accessible
                  style={styles.trendBody}
                >
                  <View style={styles.trendMetric}>
                    <AppText tabular variant="metric">
                      {`${trendValues[trendValues.length - 1]}%`}
                    </AppText>
                    <AppText tone="muted" variant="badge">
                      {`${formatRelativeDate(latest.lastAttemptAt)}, 문제 ${latest.attemptCount}개`}
                    </AppText>
                  </View>
                  <TrendSparkline
                    endLabel={formatRelativeDate(latest.lastAttemptAt)}
                    startLabel={formatRelativeDate(first.lastAttemptAt)}
                    style={styles.flex}
                    values={trendValues}
                  />
                </View>
              ) : (
                <AppText tone="muted" variant="body">
                  {summary.trend.length === 1
                    ? '다른 날 한 번 더 풀면 추이가 보여요.'
                    : '문제를 풀면 추이가 보여요.'}
                </AppText>
              )}
            </Card>
          </View>

          {/* No "다음에 할 일" list: 헷갈린 개념 already offers the re-listen,
              핵심 내용 the checklist, and the bottom bar the questions. A
              section that restates all three is one more thing to read. */}
          {summary.nextSteps.length === 0 ? (
            <Card style={styles.quietCard} variant="soft">
              <StatusBadge label="다 했어요" tone="positive" />
              <AppText tone="muted" variant="body">
                문제도 다 맞히고 핵심 내용도 다 확인했어요.
              </AppText>
            </Card>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Button
          fullWidth
          leftIcon={
            hasQuiz ? (
              <RotateCcw color={colors.textInverse} size={iconSizes.inline} />
            ) : (
              <ListChecks color={colors.textInverse} size={iconSizes.inline} />
            )
          }
          onPress={onPrimary}
          size="large"
          variant="primary"
        >
          {primaryLabel}
        </Button>
      </View>
    </Screen>
  );
}

function ScorePart({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scorePart}>
      <AppText tone="muted" variant="badge">
        {label}
      </AppText>
      <AppText variant="meta">{value}</AppText>
    </View>
  );
}

/** One weak concept: the term, what the missed question asked, and a way back in. */
function ConceptCard({
  concept,
  onListen,
  page,
}: {
  concept: ConceptResult;
  onListen: () => void;
  /** True for an uploaded document: positions are pages, and nothing plays. */
  page: boolean;
}) {
  const time = formatSourcePosition(concept.sourceStartMs, page);
  return (
    <Card style={styles.conceptCard}>
      <View style={styles.conceptHead}>
        <AppText style={styles.flex} variant="itemTitle">
          {concept.concept}
        </AppText>
        <StatusBadge
          label={`${concept.questionCount}개 중 ${concept.correctCount}개`}
          tone="warning"
        />
      </View>
      {concept.missedQuestion ? (
        <View style={styles.conceptQuestion}>
          <AppText tone="muted" variant="badge">
            물어본 것
          </AppText>
          <AppText variant="body">{concept.missedQuestion.prompt}</AppText>
        </View>
      ) : null}
      <Button
        accessibilityHint="그 시점부터 대본과 함께 재생해요."
        leftIcon={<PlayCircle color={colors.textSoft} size={iconSizes.inline} />}
        onPress={onListen}
        style={styles.listenButton}
        variant="outline"
      >
        {`${time}부터 다시 듣기`}
      </Button>
    </Card>
  );
}

/** List rows: 68 default, per the layout rules. */
const ROW_HEIGHT = 68;
const POINT_MARK_SIZE = 22;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  /** Header → first block 8; between blocks 24; last block → end 32. */
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  unavailableContent: {
    flex: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
  },
  heading: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md },
  cardList: { gap: spacing.md },
  scoreCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreParts: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  scorePart: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    gap: spacing.xxs,
    padding: spacing.md,
  },
  quietCard: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  conceptCard: { gap: spacing.md },
  conceptHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conceptQuestion: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    gap: spacing.xs,
    padding: spacing.md,
  },
  listenButton: { alignSelf: 'flex-start' },
  pointRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  pointMark: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.badge,
    borderWidth: 1.5,
    height: POINT_MARK_SIZE,
    justifyContent: 'center',
    width: POINT_MARK_SIZE,
  },
  pointMarkOn: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { backgroundColor: colors.backgroundSoft },
  trendCard: { gap: spacing.sm },
  trendBody: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  trendMetric: { gap: spacing.xxs, minWidth: 0 },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  /** A row's trailing control: a fixed 44pt column so text never runs under it. */
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginRight: -spacing.md,
    width: sizes.minimumTouchTarget,
  },
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
});
