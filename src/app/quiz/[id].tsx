import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  Check,
  Headphones,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { BOTTOM_ACTION_SPACE, BottomAction } from '@/components/app';
import { PressFace, SurfaceButton } from '@/components/mastery';
import {
  AnimatedReveal,
  AppText,
  AuthField,
  BottomSheetModal,
  Button,
  Card,
  ErrorState,
  IconButton,
  Screen,
  SegmentedProgress,
  StatusBadge,
  Toast,
  useToast,
  type ProgressSegment,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { goBackOrReplace, quizReturnHref } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { colors, fontFamilies, iconSizes, radii, spacing } from '@/theme/tokens';

const REPORT_REASONS = [
  { id: 'not-in-material', label: '자료에 없는 내용이에요' },
  { id: 'wrong-answer', label: '정답이 틀린 것 같아요' },
  { id: 'unclear', label: '문제가 이해되지 않아요' },
] as const;

type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

interface QuestionReport {
  materialId: string;
  questionId: string;
  reason: ReportReasonId;
  note: string;
  reportedAt: string;
}

const REPORT_STORAGE_KEY = 'premind.rn.question-reports.v1';
/** Enough to look back over, small enough that the read stays cheap. */
const REPORT_LIMIT = 50;

/**
 * Keeps a report on the device.
 *
 * There is no reporting endpoint yet, and inventing a call to one would be a
 * lie the learner cannot check. So the report is written here and the question
 * is dropped from the session immediately, which is the part that matters to
 * the person who just hit a bad question. The next step is sending these to
 * the server and reading them back on open, so a reported question stays gone
 * across sessions rather than only for this one.
 */
async function rememberReport(entry: QuestionReport): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REPORT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const kept = Array.isArray(parsed) ? parsed : [];
    await AsyncStorage.setItem(
      REPORT_STORAGE_KEY,
      JSON.stringify([...kept, entry].slice(-REPORT_LIMIT)),
    );
  } catch {
    // A report that cannot be written is not worth interrupting the session
    // for; the question is already hidden either way.
  }
}

export default function QuizScreen() {
  const t = useT();
  const { from, id } = useLocalSearchParams<{ from?: string; id: string }>();
  const { materials, submitQuizAnswer } = useAppStore();
  const material = materials.find((item) => item.id === id);
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missedQuestionIds, setMissedQuestionIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonId | null>(null);
  const [reportNote, setReportNote] = useState('');
  const toast = useToast();
  const { isTablet } = useLayout();

  /**
   * The questions still in play. A reported one leaves the session at once —
   * being told "이 문제는 다시 보지 않을게요" and then meeting it again in the
   * same run is worse than never having offered the report.
   */
  const questions = useMemo(
    () => (material?.quiz ?? []).filter((item) => !reportedIds.includes(item.id)),
    [material?.quiz, reportedIds],
  );

  if (!material || material.quiz.length === 0) {
    const leaveEmpty = () => goBackOrReplace(quizReturnHref(from, material?.id));
    return (
      <Screen maxWidth={640} padded={false}>
        <AppHeader onBack={leaveEmpty} title={t.ctx('quiz', '문제')} />
        <ErrorState
          description={t('아직 풀 수 있는 문제가 없어요. 마인드팩이 준비되면 다시 열어 주세요.')}
          onRetry={leaveEmpty}
          retryLabel={t('돌아가기')}
        />
      </Screen>
    );
  }

  /**
   * Back to whichever screen sent the reader here: 이해도, the 이해도 상세
   * 화면, or the material. The history knows that already whenever there is
   * any, so it wins; `from` is what answers when there is none.
   */
  /** A document's positions are page numbers, not times, and have no sound. */
  const isDocument = material.source.kind === 'document';

  const leaveQuiz = () => goBackOrReplace(quizReturnHref(from, material.id));

  const percentage = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0;

  /**
   * One tick per question, in order: ink for a question already answered
   * right, red for one answered wrong, and grey ahead of the reader. It is
   * the same strip during the run and on the result, so the shape a reader
   * watched fill up is the shape they are handed at the end.
   */
  const segments = questions.map<ProgressSegment>((question, questionIndex) => {
    const answered =
      questionIndex < index || (questionIndex === index && selectedIndex !== null);
    if (!answered) return questionIndex === index ? 'current' : 'upcoming';
    return missedQuestionIds.includes(question.id) ? 'wrong' : 'correct';
  });

  const selectAnswer = (choiceIndex: number) => {
    const asked = questions[index];
    if (!asked || selectedIndex !== null) return;
    const result = submitQuizAnswer(material.id, asked.id, choiceIndex);
    setSelectedIndex(choiceIndex);
    if (result.isCorrect) {
      setCorrectCount((count) => count + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setMissedQuestionIds((current) =>
        current.includes(asked.id) ? current : [...current, asked.id],
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const next = () => {
    if (index >= questions.length - 1) {
      // The end of a run is a small moment of its own (Duolingo): one
      // success tap on the phone as the result comes up.
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelectedIndex(null);
  };

  const restart = () => {
    setIndex(0);
    setSelectedIndex(null);
    setCorrectCount(0);
    setMissedQuestionIds([]);
    setFinished(false);
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportReason(null);
    setReportNote('');
  };

  /**
   * Takes the question out of the session and forgets what it scored: a
   * question the learner does not trust must not move their 이해도 in either
   * direction. Removing it shifts the list, so `index` already points at the
   * next question — unless it was the last one, which ends the run.
   */
  const submitReport = () => {
    const asked = questions[index];
    if (!asked || !reportReason) return;
    void rememberReport({
      materialId: material.id,
      questionId: asked.id,
      reason: reportReason,
      note: reportNote.trim(),
      reportedAt: new Date().toISOString(),
    });
    if (selectedIndex === asked.correctChoiceIndex) {
      setCorrectCount((count) => Math.max(0, count - 1));
    }
    setMissedQuestionIds((current) => current.filter((entry) => entry !== asked.id));
    setReportedIds((current) => [...current, asked.id]);
    setSelectedIndex(null);
    if (index >= questions.length - 1) setFinished(true);
    closeReport();
    toast.show(t('알려 줘서 고마워요. 이 문제는 다시 보지 않을게요.'));
  };

  if (questions.length === 0) {
    return (
      <Screen maxWidth={640} padded={false}>
        <AppHeader onBack={leaveQuiz} title={t.ctx('quiz', '문제')} />
        <ErrorState
          description={t('알려 준 문제를 빼니 남은 문제가 없어요. 새 문제가 만들어지면 다시 열어 주세요.')}
          onRetry={leaveQuiz}
          retryLabel={t('돌아가기')}
          title={t('풀 문제가 없어요')}
        />
        <Toast bottom={spacing.xxxl} message={toast.message} />
      </Screen>
    );
  }

  if (finished) {
    const missed = questions.filter((item) => missedQuestionIds.includes(item.id));
    const wrongCount = questions.length - correctCount;
    /** Encouragement, never a verdict: what to do with the number, not what it says about them. */
    const cheer =
      wrongCount === 0
        ? t('모든 문제를 맞혔어요 🎉')
        : percentage >= 60
          ? t('잘했어요! 틀린 {n}문제만 다시 보면 돼요', { n: wrongCount })
          : t('괜찮아요, 틀린 곳을 다시 들으면 금방 늘어요');

    return (
      <Screen background="soft" maxWidth={640} padded={false}>
        <AppHeader
          onBack={leaveQuiz}
          right={<IconButton icon={RefreshCw} label={t('다시 풀기')} onPress={restart} />}
          title={t.ctx('quiz', '결과')}
        />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            isTablet ? null : { paddingBottom: BOTTOM_ACTION_SPACE + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {/* The score large on a white card (Toss), with one line of
              encouragement and the run's shape kept from the question screen.
              The strip is the count of right and wrong; no tiles repeat it. */}
          <AnimatedReveal distance={16}>
            <View
              accessibilityLabel={`${t('점수')} ${percentage}${t.ctx('score-unit', '점')}. ${cheer}`}
              accessible
              style={styles.resultHero}
            >
              <View style={styles.scoreLine}>
                <AppText style={styles.bigScore} tabular>
                  {String(percentage)}
                </AppText>
                <AppText style={styles.scoreUnit}>{t.ctx('score-unit', '점')}</AppText>
              </View>
              <AppText align="center" variant="bodyStrong">
                {cheer}
              </AppText>
              <SegmentedProgress
                accessibilityLabel={t('{total}문제 중 {correct}개 정답', {
                  total: questions.length,
                  correct: correctCount,
                })}
                segments={segments}
                style={styles.resultStrip}
              />
            </View>
          </AnimatedReveal>

          {missed.length ? (
            <View style={styles.section}>
              <AppText accessibilityRole="header" variant="heading">
                {t('다시 볼 문제')}
              </AppText>
              <View style={styles.missedList}>
                {missed.map((item) => (
                  <PressFace
                    accessibilityHint={t('설명이 나온 시점부터 재생해요.')}
                    accessibilityLabel={`${item.prompt}, ${item.concept}, ${formatSourcePosition(item.sourceStartMs, isDocument)}`}
                    accessibilityRole="button"
                    haptic={false}
                    key={item.id}
                    onPress={() =>
                      router.push({
                        pathname: '/material/[id]',
                        params: { id: material.id, tab: 'transcript', at: String(item.sourceStartMs) },
                      })
                    }
                    style={styles.missed}
                  >
                    <AppText numberOfLines={1} variant="itemTitle">
                      {item.prompt}
                    </AppText>
                    <AppText numberOfLines={1} tone="muted" variant="meta">
                      {item.concept}
                    </AppText>
                    <View style={styles.missedAt}>
                      <Headphones {...decorative} color={colors.brand} size={iconSizes.dense} />
                      <AppText style={styles.missedAtText} tabular variant="badge">
                        {formatSourcePosition(item.sourceStartMs, isDocument)}
                      </AppText>
                    </View>
                  </PressFace>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
        {/* Under the thumb (Toss): one full-width 돌아가기. 다시 풀기 is the
            header's icon. */}
        <BottomAction>
          <Button fullWidth onPress={leaveQuiz} size="large" variant="primary">
            {t('돌아가기')}
          </Button>
        </BottomAction>
        <Toast bottom={TOAST_ABOVE_RESULT_BAR} message={toast.message} />
      </Screen>
    );
  }

  const question = questions[index];
  if (!question) return null;
  const isCorrect = selectedIndex === question.correctChoiceIndex;
  const isLast = index === questions.length - 1;

  return (
    <Screen maxWidth={640} padded={false}>
      <AppHeader
        onBack={leaveQuiz}
        right={
          <AppText
            accessibilityLabel={t('{total}문제 중 {n}번째', {
              total: questions.length,
              n: index + 1,
            })}
            style={styles.headerMeta}
            tabular
            tone="muted"
            variant="meta"
          >
            {index + 1}/{questions.length}
          </AppText>
        }
        title={t.ctx('quiz', '문제')}
      />
      <View style={styles.progressStrip}>
        <SegmentedProgress
          accessibilityLabel={t('{total}문제 중 {n}번째, 맞힌 문제 {correct}개', {
            total: questions.length,
            n: index + 1,
            correct: correctCount,
          })}
          segments={segments}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.questionCopy}>
          <StatusBadge label={question.concept} tone="neutral" />
          <AppText accessibilityRole="header" variant="heading">
            {question.prompt}
          </AppText>
        </View>

        <View style={styles.choices}>
          {question.choices.map((choice, choiceIndex) => {
            const selected = selectedIndex === choiceIndex;
            const correct = selectedIndex !== null && choiceIndex === question.correctChoiceIndex;
            const wrong = selected && !correct;
            return (
              <SurfaceButton
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedIndex !== null, selected }}
                aria-pressed={selected}
                disabled={selectedIndex !== null}
                key={choice}
                onPress={() => selectAnswer(choiceIndex)}
                selected={selected}
                selectedStyle={styles.choiceSelected}
                style={[
                  styles.choice,
                  selectedIndex !== null ? styles.choiceLocked : null,
                  correct ? styles.choiceCorrect : null,
                  wrong ? styles.choiceWrong : null,
                ]}
              >
                <View
                  style={[
                    styles.choiceIndex,
                    correct ? styles.choiceIndexCorrect : null,
                    wrong ? styles.choiceIndexWrong : null,
                  ]}
                >
                  {correct ? (
                    <Check
                      {...decorative}
                      color={colors.textInverse}
                      size={iconSizes.inline}
                      strokeWidth={2.6}
                    />
                  ) : wrong ? (
                    <X
                      {...decorative}
                      color={colors.textInverse}
                      size={iconSizes.inline}
                      strokeWidth={2.6}
                    />
                  ) : (
                    <AppText variant="label">{String.fromCharCode(65 + choiceIndex)}</AppText>
                  )}
                </View>
                <AppText style={styles.flex} variant={selected || correct ? 'bodyStrong' : 'body'}>
                  {choice}
                </AppText>
              </SurfaceButton>
            );
          })}
        </View>

        {selectedIndex !== null ? (
          <Card style={styles.explanation} variant="soft">
            <View style={styles.explanationTitle}>
              {/* A filled mark, not a bare glyph: the verdict has to be
                  readable from the far side of the screen. */}
              <View
                style={[
                  styles.verdictMark,
                  isCorrect ? styles.verdictMarkCorrect : styles.verdictMarkWrong,
                ]}
              >
                {isCorrect ? (
                  <Check
                    {...decorative}
                    color={colors.textInverse}
                    size={iconSizes.inline}
                    strokeWidth={3}
                  />
                ) : (
                  <X
                    {...decorative}
                    color={colors.textInverse}
                    size={iconSizes.inline}
                    strokeWidth={3}
                  />
                )}
              </View>
              <AppText tone={isCorrect ? 'positive' : 'negative'} variant="itemTitle">
                {isCorrect ? t('정답이에요') : t('아쉬워요')}
              </AppText>
            </View>
            <AppText variant="body">{question.explanation}</AppText>
            <Button
              fullWidth
              leftIcon={<Headphones color={colors.textSoft} size={iconSizes.inline} />}
              onPress={() => router.push({ pathname: '/material/[id]', params: { id: material.id, tab: 'transcript', at: String(question.sourceStartMs) } })}
              variant="outline"
            >
              {isDocument
                ? t('{at} 근거 보기', {
                    at: formatSourcePosition(question.sourceStartMs, isDocument),
                  })
                : t('{at} 근거 듣기', {
                    at: formatSourcePosition(question.sourceStartMs, isDocument),
                  })}
            </Button>
            <Button
              accessibilityHint={t('틀린 문제나 이해되지 않는 문제를 알려요')}
              onPress={() => setReportOpen(true)}
              size="small"
              style={styles.reportButton}
              variant="ghost"
            >
              {t('이 문제가 이상해요')}
            </Button>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          disabled={selectedIndex === null}
          fullWidth
          onPress={next}
          rightIcon={
            <ArrowRight
              color={selectedIndex === null ? colors.textFaint : colors.textInverse}
              size={iconSizes.inline}
            />
          }
          size="large"
          variant="primary"
        >
          {isLast ? t('결과 보기') : t('다음 문제')}
        </Button>
      </View>

      <BottomSheetModal
        description={t('어떤 점이 이상했는지 알려 주면 문제를 다시 만들 때 반영해요.')}
        footer={
          <Button
            disabled={reportReason === null}
            fullWidth
            onPress={submitReport}
            size="large"
            variant="primary"
          >
            {t('보내기')}
          </Button>
        }
        onClose={closeReport}
        title={t('이 문제가 이상해요')}
        visible={reportOpen}
      >
        <View style={styles.reportSheet}>
          <View style={styles.reportReasons}>
            {REPORT_REASONS.map((reason) => (
              <Card
                key={reason.id}
                onPress={() => setReportReason(reason.id)}
                padding={spacing.md}
                selected={reportReason === reason.id}
                style={styles.reportReason}
                variant="outlined"
              >
                <AppText
                  style={styles.flex}
                  variant={reportReason === reason.id ? 'bodyStrong' : 'body'}
                >
                  {t(reason.label)}
                </AppText>
                {reportReason === reason.id ? (
                  <Check
                    {...decorative}
                    color={colors.text}
                    size={iconSizes.inline}
                    strokeWidth={2.4}
                  />
                ) : null}
              </Card>
            ))}
          </View>
          <AuthField
            label={t('한 줄 설명 (선택)')}
            maxLength={80}
            onChangeText={setReportNote}
            placeholder={t('어떤 점이 이상했나요?')}
            returnKeyType="done"
            value={reportNote}
          />
        </View>
      </BottomSheetModal>

      <Toast bottom={TOAST_ABOVE_BAR} message={toast.message} />
    </Screen>
  );
}

/** The arrow cursor over a choice that can no longer be picked. */
function webDefaultCursor(): ViewStyle {
  return Platform.OS === 'web' ? ({ cursor: 'default' } as unknown as ViewStyle) : {};
}

/** Compact row height, per the layout rules. */
const COMPACT_ROW_HEIGHT = 54;
/** Toast clearances: high enough that the bottom bar cannot cover the notice. */
const TOAST_ABOVE_BAR = 96;
const TOAST_ABOVE_RESULT_BAR = 148;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  /** Header → first block 8; between blocks 24; last block clears the bar by 32. */
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  headerMeta: { paddingRight: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  questionCopy: { alignItems: 'flex-start', gap: spacing.md },
  choices: { gap: spacing.sm },
  choice: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: COMPACT_ROW_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  /** Answered: no pointer, and the tinted correct / wrong styles carry the meaning. */
  choiceLocked: webDefaultCursor(),
  choiceSelected: {
    borderColor: colors.text,
    borderWidth: 1.5,
  },
  choiceCorrect: {
    backgroundColor: colors.positiveSoft,
    borderColor: colors.positive,
  },
  choiceWrong: {
    backgroundColor: colors.negativeSoft,
    borderColor: colors.negative,
  },
  choiceIndex: {
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    height: iconSizes.state,
    justifyContent: 'center',
    width: iconSizes.state,
  },
  choiceIndexCorrect: { backgroundColor: colors.positive },
  choiceIndexWrong: { backgroundColor: colors.negative },
  explanation: { gap: spacing.md },
  explanationTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  verdictMark: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: iconSizes.state,
    justifyContent: 'center',
    width: iconSizes.state,
  },
  verdictMarkCorrect: { backgroundColor: colors.positive },
  verdictMarkWrong: { backgroundColor: colors.negative },
  /** Quiet and self-aligned: a way out of a bad question, not a call to act. */
  reportButton: { alignSelf: 'center' },
  reportSheet: { gap: spacing.xl },
  reportReasons: { gap: spacing.sm },
  reportReason: {
    alignItems: 'center',
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: COMPACT_ROW_HEIGHT,
  },
  /** Hairline + 12pt vertical padding; the Screen owns the bottom inset. */
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
  /** The run's shape, kept from the question screen. */
  resultStrip: { alignSelf: 'stretch', marginTop: spacing.xs },
  /** Under the 56pt header, above the question: the run at a glance. */
  progressStrip: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  section: { gap: spacing.md },
  resultHero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.hero,
    gap: spacing.sm,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  scoreLine: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs },
  /** The one number on the screen, Toss-size. */
  bigScore: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 64,
    letterSpacing: -2,
    lineHeight: 72,
  },
  scoreUnit: {
    color: colors.textSoft,
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 30,
  },


  missedList: { gap: spacing.sm },
  /** A review card (Santa 복습): the question, its concept, and where to listen. */
  missed: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  missedAt: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  missedAtText: { color: colors.brandStrong },


});
