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
import { stickyColumn } from '@/components/mastery';
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
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
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
  const t = useT();
  const locale = t.locale;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, projects, quizAttempts, studyNotes } = useAppStore();
  const { breakpoint, gutter } = useLayout();
  /** Desktop: the score and the one button pinned left, the detail on the right. */
  const wide = breakpoint === 'expanded';
  const material = materials.find((item) => item.id === id);
  const summary = useMemo(
    () =>
      material
        ? summarizeMastery(material, quizAttempts, studyNotes[material.id], locale)
        : null,
    [locale, material, quizAttempts, studyNotes],
  );

  const back = () => goBackOrReplace('/(tabs)/mastery');

  if (!material || !summary) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={back} title={t('이해도')} />
        <ErrorState
          description={t('이 자료를 찾을 수 없어요. 평가에서 다시 골라 주세요.')}
          onRetry={back}
          retryLabel={t('돌아가기')}
        />
      </Screen>
    );
  }

  const projectTitle =
    projects.find((project) => project.id === material.projectId)?.title ?? t('폴더 없음');
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
    ? t('요약 보기')
    : summary.answeredCount > 0
      ? t('문제 다시 풀기')
      : t('문제 풀기');
  const onPrimary = hasQuiz ? openQuiz : openSummary;

  if (summary.score === null) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={back} title={t('이해도')} />
        <View style={styles.unavailableContent}>
          <EmptyState
            actionLabel={primaryLabel}
            description={
              hasQuiz
                ? t('문제 {n}개를 풀면 이해도와 취약 개념이 생겨요.', {
                    n: summary.questionCount,
                  })
                : t('요약에서 핵심 내용을 확인하면 이해도가 생겨요.')
            }
            icon={BookOpenCheck}
            onAction={onPrimary}
            title={t('아직 이해도를 볼 게 없어요')}
          />
        </View>
      </Screen>
    );
  }

  const trendValues = summary.trend.map((point) => toPercent(point.accuracy));
  const first = summary.trend[0];
  const latest = summary.trend[summary.trend.length - 1];

  const heading = (
    <View style={styles.heading}>
      <AppText variant="pageTitle">{masteryHeadline(summary, locale)}</AppText>
      <AppText numberOfLines={2} tone="muted" variant="body">
        {`${material.title} / ${projectTitle}`}
      </AppText>
    </View>
  );
  const scoreCard = (
    <Card
      style={[
        styles.scoreCard,
        breakpoint === 'medium' ? styles.scoreCardRow : null,
      ]}
    >
      <ScoreRing
        label={t('이해도')}
        max={100}
        precision={0}
        score={summary.score}
        unit="%"
        verdict={masteryVerdict(summary.score, locale)}
      />
      <View style={styles.scoreParts}>
        <ScorePart
          label={t('문제 정답률 {weight}%', { weight: Math.round(QUIZ_WEIGHT * 100) })}
          value={
            summary.accuracy === null
              ? t('아직 안 풀었어요')
              : t('{total}개 중 {correct}개 맞힘, {percent}%', {
                  total: summary.answeredCount,
                  correct: summary.correctCount,
                  percent: toPercent(summary.accuracy),
                })
          }
        />
        <ScorePart
          label={t('핵심 내용 확인 {weight}%', {
            weight: Math.round(CHECKLIST_WEIGHT * 100),
          })}
          value={
            summary.checklistRatio === null
              ? t('핵심 내용이 없어요')
              : t('{total}개 중 {checked}개 확인, {percent}%', {
                  total: summary.keyPointCount,
                  checked: summary.checkedCount,
                  percent: toPercent(summary.checklistRatio),
                })
          }
        />
      </View>
    </Card>
  );
  const primaryButton = (
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
  );

  const details = (
    <>
      <View style={styles.section}>
        <SectionHeader
          description={t('마지막 답이 틀린 개념이에요. 시간을 누르면 그 부분부터 들어요.')}
          title={t('헷갈린 개념')}
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
            <StatusBadge label={t('없어요')} tone="positive" />
            <AppText tone="muted" variant="body">
              {summary.answeredCount > 0
                ? t('푼 문제는 모두 맞혔어요.')
                : t('문제를 풀면 헷갈린 개념이 보여요.')}
            </AppText>
          </Card>
        )}
      </View>
      {keyPoints.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            actionLabel={t('요약 보기')}
            description={t('{total}개 중 {checked}개를 확인했어요.', {
              total: keyPoints.length,
              checked: summary.checkedCount,
            })}
            onAction={openSummary}
            title={t('핵심 내용')}
          />
          <Card padding={false}>
            {keyPoints.map((point, index) => {
              const done = checked.has(point);
              return (
                <View
                  accessibilityLabel={`${done ? t('확인함') : t('아직 확인 안 함')}. ${point}`}
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
          description={t('날짜별로 맞힌 비율이에요.')}
          title={t('정답률 추이')}
        />
        <Card style={styles.trendCard}>
          {summary.trend.length >= 2 && first && latest ? (
            <View
              accessibilityLabel={t('정답률 추이, {n}일. {values}', {
                n: summary.trend.length,
                values: trendValues.map((value) => `${value}%`).join(', '),
              })}
              accessible
              style={styles.trendBody}
            >
              <View style={styles.trendMetric}>
                <AppText tabular variant="metric">
                  {`${trendValues[trendValues.length - 1]}%`}
                </AppText>
                <AppText tone="muted" variant="badge">
                  {t('{when}, 문제 {n}개', {
                    when: formatRelativeDate(latest.lastAttemptAt),
                    n: latest.attemptCount,
                  })}
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
                ? t('다른 날 한 번 더 풀면 추이가 보여요.')
                : t('문제를 풀면 추이가 보여요.')}
            </AppText>
          )}
        </Card>
      </View>
      {/* No "다음에 할 일" list: 헷갈린 개념 already offers the re-listen,
          핵심 내용 the checklist, and the bottom bar the questions. A
          section that restates all three is one more thing to read. */}
      {summary.nextSteps.length === 0 ? (
        <Card style={styles.quietCard} variant="soft">
          <StatusBadge label={t('다 했어요')} tone="positive" />
          <AppText tone="muted" variant="body">
            {t('문제도 다 맞히고 핵심 내용도 다 확인했어요.')}
          </AppText>
        </Card>
      ) : null}
    </>
  );

  if (wide) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={back} title={t('이해도')} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          style={styles.fill}
        >
          <View style={[styles.content, styles.wideContent, { paddingHorizontal: gutter }]}>
            <View style={[styles.aside, stickyColumn()]}>
              {heading}
              {scoreCard}
              {primaryButton}
            </View>
            <View style={styles.main}>
              {details}
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader onBack={back} title={t('이해도')} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.fill}
      >
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {heading}
          {scoreCard}
          {details}
        </View>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingHorizontal: gutter }]}>{primaryButton}</View>
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
  const t = useT();
  const time = formatSourcePosition(concept.sourceStartMs, page);
  return (
    <Card style={styles.conceptCard}>
      <View style={styles.conceptHead}>
        <AppText style={styles.flex} variant="itemTitle">
          {/* '기타' is the name the app gives a question with no concept. */}
          {concept.concept === '기타' ? t('기타') : concept.concept}
        </AppText>
        <StatusBadge
          label={t('{total}개 중 {correct}개', {
            total: concept.questionCount,
            correct: concept.correctCount,
          })}
          tone="warning"
        />
      </View>
      {concept.missedQuestion ? (
        <View style={styles.conceptQuestion}>
          <AppText tone="muted" variant="badge">
            {t('물어본 것')}
          </AppText>
          <AppText variant="body">{concept.missedQuestion.prompt}</AppText>
        </View>
      ) : null}
      <Button
        accessibilityHint={t('그 시점부터 대본과 함께 재생해요.')}
        leftIcon={<PlayCircle color={colors.textSoft} size={iconSizes.inline} />}
        onPress={onListen}
        style={styles.listenButton}
        variant="outline"
      >
        {t('{at}부터 다시 듣기', { at: time })}
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
  wideContent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xxl,
    paddingTop: spacing.lg,
  },
  /** The pinned column: wide enough for the large ring and a two-line title. */
  aside: { gap: spacing.lg, width: 320 },
  main: { flex: 1, gap: spacing.xl, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md },
  cardList: { gap: spacing.md },
  scoreCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  /** Tablet: ring left, the two parts beside it. */
  scoreCardRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  scoreParts: {
    alignSelf: 'stretch',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  scorePart: {
    backgroundColor: colors.backgroundSoft,
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
