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
import { BOTTOM_ACTION_SPACE, BottomAction } from '@/components/app';
import { TrendSparkline } from '@/components/lens';
import { PressFace, ProgressRing, stickyColumn } from '@/components/mastery';
import {
  AppText,
  Button,
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
import { colors, fontFamilies, iconSizes, radii, shadows, sizes, spacing } from '@/theme/tokens';

/**
 * 이해도 for one material, laid out as an app screen (2026-09-26): the title
 * large, a brand hero with the ring, the verdict word and the concepts that
 * went wrong as chips, two metric tiles for what the ring is made of, then
 * 다시 볼 곳 with a way back into the recording, the checklist and the daily
 * accuracy line. On a phone the one button is docked under the thumb. Everything is computed on the
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
  const verdict = masteryVerdict(summary.score, locale);
  const chips = summary.weakConcepts.map((concept) =>
    concept.concept === '기타' ? t('기타') : concept.concept,
  );

  const heading = (
    <View style={styles.heading}>
      <AppText accessibilityRole="header" numberOfLines={3} variant="display">
        {material.title}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="body">
        {projectTitle}
      </AppText>
    </View>
  );

  /**
   * The head card (Apple Fitness, Toss): the ring with the number in it, the
   * verdict word large beside it, the plain sentence, and the concepts that
   * went wrong as chips. Brand face, no border.
   */
  const hero = (
    <View style={styles.hero}>
      <View
        accessibilityLabel={t('이해도 {score}%, {verdict}', { score: summary.score, verdict })}
        accessible
        style={styles.heroTop}
      >
        <ProgressRing diameter={RING} stroke={RING_STROKE} value={summary.score}>
          <AppText style={styles.ringNumber} tabular>
            {`${summary.score}%`}
          </AppText>
        </ProgressRing>
        <View style={styles.heroCopy}>
          <AppText tone="soft" variant="label">
            {t('이해도')}
          </AppText>
          <AppText variant="heroTitle">{t(verdict)}</AppText>
        </View>
      </View>
      <AppText variant="body">{masteryHeadline(summary, locale)}</AppText>
      {chips.length > 0 ? (
        <View
          accessibilityLabel={t('헷갈린 개념: {terms}', { terms: chips.join(', ') })}
          accessible
          style={styles.chips}
        >
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <AppText numberOfLines={1} style={styles.chipText} variant="badge">
                {chip}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  /** What the ring is made of, as two tiles (Yoodli): a big number, what it is, the count. */
  const tiles = (
    <View style={styles.tilesWrap}>
      <View style={styles.tiles}>
        <MetricTile
          detail={
            summary.accuracy === null
              ? t('아직 안 풀었어요')
              : t('{total}개 중 {correct}개 맞힘', {
                  total: summary.answeredCount,
                  correct: summary.correctCount,
                })
          }
          label={t('문제 정답률')}
          value={summary.accuracy === null ? '-' : `${toPercent(summary.accuracy)}%`}
        />
        <MetricTile
          detail={
            summary.checklistRatio === null
              ? t('핵심 내용이 없어요')
              : t('{total}개 중 {checked}개 확인', {
                  total: summary.keyPointCount,
                  checked: summary.checkedCount,
                })
          }
          label={t('핵심 내용 확인')}
          value={summary.checklistRatio === null ? '-' : `${toPercent(summary.checklistRatio)}%`}
        />
      </View>
      <AppText tone="faint" variant="meta">
        {t('이해도는 정답률 {quiz}%, 핵심 내용 확인 {check}%로 계산해요', {
          quiz: Math.round(QUIZ_WEIGHT * 100),
          check: Math.round(CHECKLIST_WEIGHT * 100),
        })}
      </AppText>
    </View>
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
          description={t('마지막 답이 틀린 개념이에요. 누르면 그 부분부터 들어요.')}
          title={t('다시 볼 곳')}
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
          <View style={[styles.softCard, styles.quietCard]}>
            <StatusBadge label={t('없어요')} tone="positive" />
            <AppText tone="muted" variant="body">
              {summary.answeredCount > 0
                ? t('푼 문제는 모두 맞혔어요.')
                : t('문제를 풀면 헷갈린 개념이 보여요.')}
            </AppText>
          </View>
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
          <View style={[styles.softCard, styles.points]}>
            {keyPoints.map((point, index) => {
              const done = checked.has(point);
              return (
                <View
                  accessibilityLabel={`${done ? t('확인함') : t('아직 확인 안 함')}. ${point}`}
                  accessible
                  key={`${index}-${point}`}
                  style={styles.pointRow}
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
          </View>
        </View>
      ) : null}
      <View style={styles.section}>
        <SectionHeader
          description={t('날짜별로 맞힌 비율이에요.')}
          title={t('정답률 추이')}
        />
        <View style={[styles.softCard, styles.trendCard]}>
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
        </View>
      </View>
      {summary.nextSteps.length === 0 ? (
        <View style={[styles.softCard, styles.quietCard]}>
          <StatusBadge label={t('다 했어요')} tone="positive" />
          <AppText tone="muted" variant="body">
            {t('문제도 다 맞히고 핵심 내용도 다 확인했어요.')}
          </AppText>
        </View>
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
              {hero}
              {primaryButton}
            </View>
            <View style={styles.main}>
              {tiles}
              {details}
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const compact = breakpoint === 'compact';
  return (
    <Screen padded={false}>
      <AppHeader onBack={back} title={t('이해도')} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.fill}
      >
        <View
          style={[
            styles.content,
            { paddingHorizontal: gutter },
            compact ? { paddingBottom: BOTTOM_ACTION_SPACE + spacing.lg } : null,
          ]}
        >
          {heading}
          {hero}
          {/* A tablet keeps the button in the flow, under the hero. */}
          {compact ? null : <BottomAction>{primaryButton}</BottomAction>}
          {tiles}
          {details}
        </View>
      </ScrollView>
      {compact ? <BottomAction>{primaryButton}</BottomAction> : null}
    </Screen>
  );
}

function MetricTile({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label} ${value}. ${detail}`} accessible style={styles.tile}>
      <AppText tone="muted" variant="label">
        {label}
      </AppText>
      <AppText style={styles.tileValue} tabular>
        {value}
      </AppText>
      <AppText tone="muted" variant="meta">
        {detail}
      </AppText>
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
    <View style={[styles.softCard, styles.conceptCard]}>
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
      <PressFace
        accessibilityHint={t('그 시점부터 대본과 함께 재생해요.')}
        accessibilityRole="button"
        onPress={onListen}
        pressScale={0.96}
        style={styles.listen}
      >
        <PlayCircle {...decorative} color={colors.brand} size={iconSizes.section} />
        <AppText variant="label">{t('{at}부터 다시 듣기', { at: time })}</AppText>
      </PressFace>
    </View>
  );
}

const RING = 128;
const RING_STROKE = 14;
const POINT_MARK_SIZE = 22;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  /** Header → title 8; between blocks 28; last block → end 32. */
  content: {
    gap: spacing.xl + spacing.xs,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  unavailableContent: {
    flex: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
  },
  heading: { gap: spacing.xs },
  wideContent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xxl,
    paddingTop: spacing.lg,
  },
  /** The pinned column: wide enough for the ring and the verdict beside it. */
  aside: { gap: spacing.lg, width: 360 },
  main: { flex: 1, gap: spacing.xl + spacing.xs, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md },
  cardList: { gap: spacing.sm },
  hero: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.hero,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl },
  heroCopy: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  ringNumber: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 38,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  chipText: { color: colors.warningStrong },
  tilesWrap: { gap: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.card,
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
    padding: spacing.lg,
  },
  tileValue: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  softCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.card,
    padding: spacing.lg,
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
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    gap: spacing.xs,
    padding: spacing.md,
  },
  listen: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.minimumTouchTarget,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    ...shadows.subtle,
  },
  points: { gap: spacing.md },
  pointRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  pointMark: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    borderWidth: 1.5,
    height: POINT_MARK_SIZE,
    justifyContent: 'center',
    marginTop: 1,
    width: POINT_MARK_SIZE,
  },
  pointMarkOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  trendCard: { gap: spacing.sm },
  trendBody: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  trendMetric: { gap: spacing.xxs, minWidth: 0 },
});
