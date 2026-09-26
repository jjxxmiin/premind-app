import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronUp, CircleAlert, History, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { BOTTOM_ACTION_SPACE, BottomAction, Carousel } from '@/components/app';
import { RecordedVideo } from '@/components/interview/RecordedVideo';
import { ShareWithOrg } from '@/components/interview/ShareWithOrg';
import { SpeakFrame } from '@/components/speak/SpeakColumns';
import { Surface } from '@/components/speak/SpeakKit';
import {
  AppText,
  Button,
  Chip,
  Dialog,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
  StatusBadge,
  TextArea,
  Toast,
  useToast,
} from '@/components/ui';
import {
  classifyInterviewTranscript,
  getEffectiveTranscript,
  isEvaluationStale,
  isInterviewTranscriptReadyForFeedback,
} from '@/features/interview/analysis';
import {
  retryInterviewEvaluation,
  retryInterviewTranscriptions,
  startInterviewAnalysis,
} from '@/features/interview/analysis-queue';
import { forgetBackup, openRemoteSession } from '@/features/interview/backup-sync';
import { deleteSession, mutateSession } from '@/features/interview/interview-storage';
import { canRetryReportTask, conciseReportText, hasSharedReportFailure, reportAnalysisMessage, reportQuestionStatus } from '@/features/interview/report-copy';
import { saveReviewNote, saveTranscriptCorrection, startQuestionRetry } from '@/features/interview/session-machine';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewAttempt, InterviewQuestion, InterviewSession } from '@/features/interview/types';
import { useInterviewAccount } from '@/features/interview/use-interview-account';
import { useInterviewSession } from '@/features/interview/use-interview-sessions';
import {
  attemptsByQuestion,
  clean,
  comparison,
  COVERAGE_COPY,
  FIT_COPY,
  formatAnswerDuration,
  highlightTranscript,
  latestAttempt,
  modeLabel,
} from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import { INTERVIEW_HOME } from '@/features/interview/routes';
import { enShortDate, useLocale, useT, type AppLocale } from '@/lib/i18n';

function formatDate(value: string | undefined, locale: AppLocale): string {
  if (!value) return '';
  if (locale === 'en') return enShortDate(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 연습 결과. 질문별로 내가 한 말(전사문), 질문에 맞게 답했는지, 말한 것과
 * 빠진 것, 잘한 점, 다음에 해볼 것을 보여 준다. 점수와 합격 가능성, 성격은
 * 말하지 않는다. 다른 기기의 기록은 읽기만 한다(녹음이 이 기기에 없다).
 */
export default function InterviewReportScreen() {
  const t = useT();
  const locale = useLocale();
  const params = useLocalSearchParams<{ id: string; remote?: string }>();
  const remote = params.remote === '1';
  const local = useInterviewSession(remote ? undefined : params.id);
  const [remoteSession, setRemoteSession] = useState<InterviewSession | null | undefined>(undefined);
  const session = remote ? remoteSession : local.session;
  const { breakpoint, gutter } = useLayout();
  const account = useInterviewAccount();
  const toast = useToast();
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!remote || !params.id) return;
    let alive = true;
    void openRemoteSession(params.id).then((value) => alive && setRemoteSession(value));
    return () => {
      alive = false;
    };
  }, [params.id, remote]);

  // Opening a report also wakes any AI work still owed to it (web: report entry).
  useEffect(() => {
    if (!remote && params.id && local.session?.feedbackMode === 'ai') void startInterviewAnalysis(params.id);
  }, [local.session?.feedbackMode, params.id, remote]);

  const source = useMemo(() => resolveSessionSource(session), [session]);
  const byQuestion = useMemo(() => (session ? attemptsByQuestion(session) : new Map<string, InterviewAttempt[]>()), [session]);

  if (session === undefined) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => router.back()} title={t('연습 결과')} />
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          <Skeleton height={120} />
          <Skeleton height={240} />
        </View>
      </Screen>
    );
  }

  if (!session || !source) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => router.back()} title={t('연습 결과')} />
        <EmptyState
          actionLabel={t('연습 기록으로')}
          description={t('기록이 지워졌거나 이 기기에 없는 연습이에요.')}
          icon={History}
          onAction={() => router.replace('/interview/history')}
          title={t('연습 기록을 불러오지 못했어요.')}
        />
      </Screen>
    );
  }

  const questions = source.questions;
  // Open on the first answer that has feedback; otherwise the first one answered.
  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ??
    questions.find((question) => latestAttempt(byQuestion.get(question.id))?.analysis?.evaluation.status === 'ready') ??
    questions.find((question) => byQuestion.has(question.id)) ??
    questions[0];
  const attempts = selectedQuestion ? byQuestion.get(selectedQuestion.id) ?? [] : [];
  const selectedAttempt = attempts.find((attempt) => attempt.id === selectedAttemptId) ?? latestAttempt(attempts);
  const ai = session.feedbackMode === 'ai' || session.attempts.some((attempt) => attempt.analysis);
  const summary = session.feedbackSummary;
  const summaryStale = session.attempts.some((attempt) => (attempt.analysis ? isEvaluationStale(attempt.analysis) : false));
  const grounded = summary?.status === 'ready' && !summaryStale ? summary.result : undefined;
  const answeredCount = questions.filter((question) => byQuestion.get(question.id)?.some((attempt) => attempt.status !== 'failed')).length;
  const user = account.status === 'ready' ? account.user : null;
  const canShare = !remote && ai && user?.role === 'student' && Boolean(user.orgId) && account.status === 'ready' && !account.demo;
  const wide = breakpoint === 'expanded';

  const mutate = async (transform: (current: InterviewSession) => InterviewSession) => {
    await mutateSession(session.id, (current) => ({ session: transform(current) }));
  };

  const retryQuestion = async (question: InterviewQuestion) => {
    try {
      await mutate((current) => startQuestionRetry(current, question.id));
      router.push({ pathname: '/interview/room/[id]', params: { id: session.id } });
    } catch (reason) {
      toast.show(t(reason instanceof Error ? reason.message : '다시 답변을 시작하지 못했어요.'));
    }
  };

  const questionItems = questions.map((question, index) => {
    const latest = latestAttempt(byQuestion.get(question.id));
    const status = reportQuestionStatus(latest);
    const on = question.id === selectedQuestion?.id;
    const statusText = !latest ? t('아직 답하지 않았어요') : status ? t(status.label) : latest.analysis?.evaluation.status === 'ready' ? t('피드백 있음') : formatAnswerDuration(latest.durationMs, locale);
    return { question, index, on, statusText };
  });
  const selectQuestion = (id: string) => {
    setSelectedQuestionId(id);
    setSelectedAttemptId(null);
  };

  // 폰: 질문을 옆으로 넘기는 카드 줄(고른 카드는 주황 면). 넓은 화면: 왼쪽 목록.
  const questionList = wide ? (
    <Surface padding={0} style={styles.clip} tone="raised">
      {questionItems.map(({ question, index, on, statusText }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          key={question.id}
          onPress={() => selectQuestion(question.id)}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.qRow, index < questions.length - 1 ? styles.divider : null, hovered && !on ? styles.qRowHover : null, on ? styles.qRowOn : null, pressed ? styles.pressed : null]}
        >
          <AppText style={styles.qNumber} tabular tone={on ? 'brand' : 'muted'} variant="bodyStrong">
            {index + 1}
          </AppText>
          <View style={styles.flex}>
            <AppText numberOfLines={2} variant="body">
              {t(question.text)}
            </AppText>
            <AppText tone="muted" variant="meta">
              {statusText}
            </AppText>
          </View>
        </Pressable>
      ))}
    </Surface>
  ) : (
    <Carousel accessibilityLabel={t('질문별로 돌아보기')} itemWidth={236}>
      {questionItems.map(({ question, index, on, statusText }) => (
        <Pressable
          accessibilityLabel={`${index + 1}. ${t(question.text)}. ${statusText}`}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          key={question.id}
          onPress={() => selectQuestion(question.id)}
          style={({ pressed }) => [styles.qCard, on ? styles.qCardOn : null, pressed ? styles.qCardPressed : null]}
        >
          <View style={[styles.qBadge, on ? styles.qBadgeOn : null]}>
            <AppText tabular tone={on ? 'inverse' : 'soft'} variant="label">
              {index + 1}
            </AppText>
          </View>
          <AppText numberOfLines={3} style={styles.grow} variant="bodyStrong">
            {t(question.text)}
          </AppText>
          <AppText numberOfLines={1} tone={on ? 'brand' : 'muted'} variant="meta">
            {statusText}
          </AppText>
        </Pressable>
      ))}
    </Carousel>
  );

  // 2026-09-26 덜어내기: 흰 카드에 제목, 메타 한 줄(방식, 날짜), 사실 한 줄(답변 수, 말한 시간), 돌아보기 한 문장.
  // 판정은 하지 않는다는 안내는 맨 아래 작은 글씨로.
  const metaLine = [
    t(modeLabel(session)),
    formatDate(session.completedAt ?? session.createdAt, locale),
    t('답변 {done} / {total}개', { done: answeredCount, total: questions.length }),
    remote ? t('다른 기기의 기록') : null,
  ]
    .filter(Boolean)
    .join(' / ');
  const header = (
    <Surface padding={spacing.xl} style={styles.summary} tone="raised">
      <View style={styles.titleBlock}>
        <AppText variant="pageTitle">{t(source.title)}</AppText>
        <AppText tone="muted" variant="meta">
          {metaLine}
        </AppText>
      </View>
      {grounded ? (
        <View accessibilityLabel={`${t('이번 연습 돌아보기')}. ${clean(grounded.summary)}`} accessible style={styles.reflect}>
          <AppText variant="bodyStrong">{clean(grounded.summary)}</AppText>
        </View>
      ) : null}
    </Surface>
  );
  const disclaimer = (
    <AppText tone="faint" variant="badge">
      {t(
        ai
          ? 'AI가 만든 전사문과 피드백이에요. 사실과 다를 수 있으니 참고로만 봐 주세요. 합격 가능성이나 성격은 판단하지 않아요.'
          : '이 화면은 답변 시간과 메모를 정리하며, 답변 내용이나 합격 가능성을 평가하지 않아요.',
      )}
    </AppText>
  );

  const detail = selectedQuestion ? (
    <QuestionDetail
      attempts={attempts}
      editable={!remote}
      key={`${selectedQuestion.id}:${selectedAttempt?.id ?? 'none'}`}
      note={session.reviewNotes?.[selectedQuestion.id] ?? ''}
      onMessage={(message) => toast.show(t(message))}
      onRetryEvaluation={async (attemptId) => {
        const queued = await retryInterviewEvaluation(session.id, attemptId);
        if (!queued) toast.show(t('지금은 다시 받을 피드백이 없어요.'));
      }}
      onRetryQuestion={() => void retryQuestion(selectedQuestion)}
      onRetryTranscription={(attemptId) => void retryInterviewTranscriptions(session.id, [attemptId])}
      onSaveNote={(note) => mutate((current) => saveReviewNote(current, selectedQuestion.id, note))}
      onSaveTranscript={(attemptId, text) => mutate((current) => saveTranscriptCorrection(current, attemptId, text))}
      onSelectAttempt={setSelectedAttemptId}
      question={selectedQuestion}
      questionNumber={questions.indexOf(selectedQuestion) + 1}
      selected={selectedAttempt}
      session={session}
      showQuestion={wide}
    />
  ) : null;

  const againButton = (
    <Button
      fullWidth={breakpoint === 'compact'}
      leftIcon={<RotateCcw color={colors.textInverse} size={iconSizes.inline} />}
      onPress={() => router.push({ pathname: '/interview/prepare', params: { again: session.id } })}
      size={breakpoint === 'compact' ? 'large' : 'medium'}
      style={breakpoint === 'compact' ? null : styles.action}
      variant="primary"
    >
      {t('전체 다시 연습')}
    </Button>
  );
  const docked = !remote && breakpoint === 'compact';

  return (
    <Screen background="soft" fullBleed padded={false}>
      <SpeakFrame>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace(INTERVIEW_HOME))} title={t('연습 결과')} />
      </SpeakFrame>
      <ScrollView style={styles.scroll}>
        <SpeakFrame>
        <View style={[styles.content, { paddingHorizontal: gutter }, docked ? styles.dockSpace : null]}>
        {header}
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.listColumn}>
              <SectionHeader title={t('질문별로 돌아보기')} />
              {questionList}
            </View>
            <View style={styles.detailColumn}>{detail}</View>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader title={t('질문별로 돌아보기')} />
              {questionList}
            </View>
            {detail}
          </>
        )}

        <View style={[styles.actions, breakpoint !== 'compact' ? styles.actionsRow : null]}>
          {!remote && breakpoint !== 'compact' ? againButton : null}
          {canShare && user ? <ShareWithOrg onMessage={toast.show} orgName={user.orgName ?? t('기관')} session={session} source={source} /> : null}
        </View>
        {!remote ? (
          <Button leftIcon={<Trash2 color={colors.negative} size={iconSizes.inline} />} onPress={() => setDeleteOpen(true)} textStyle={styles.danger} variant="ghost">
            {t('이 연습 기록 지우기')}
          </Button>
        ) : null}
        {disclaimer}
        </View>
        </SpeakFrame>
      </ScrollView>
      {docked ? <BottomAction>{againButton}</BottomAction> : null}
      <Toast message={toast.message} />
      <Dialog
        cancel={{ label: t('취소'), onPress: () => setDeleteOpen(false) }}
        confirm={{
          label: t('지우기'),
          onPress: () => {
            setDeleteOpen(false);
            void Promise.all([deleteSession(session.id), forgetBackup(session.id)]).then(() => router.replace('/interview/history'));
          },
        }}
        description={t('이 기기의 기록과 녹음, 계정에 남긴 글 사본을 모두 지워요. 되돌릴 수 없어요.')}
        onRequestClose={() => setDeleteOpen(false)}
        title={t('이 연습 기록을 지울까요?')}
        visible={deleteOpen}
      />
    </Screen>
  );
}

interface QuestionDetailProps {
  session: InterviewSession;
  question: InterviewQuestion;
  questionNumber: number;
  attempts: InterviewAttempt[];
  selected: InterviewAttempt | undefined;
  editable: boolean;
  note: string;
  onSelectAttempt: (id: string) => void;
  onSaveTranscript: (attemptId: string, text: string | null) => Promise<void>;
  onRetryEvaluation: (attemptId: string) => Promise<void>;
  onRetryTranscription: (attemptId: string) => void;
  onRetryQuestion: () => void;
  onSaveNote: (note: string) => Promise<void>;
  onMessage: (message: string) => void;
  /** The question text as a heading; off on a phone where the card row above shows it. */
  showQuestion: boolean;
}

function QuestionDetail({
  session,
  question,
  questionNumber,
  attempts,
  selected,
  editable,
  note,
  onSelectAttempt,
  onSaveTranscript,
  onRetryEvaluation,
  onRetryTranscription,
  onRetryQuestion,
  onSaveNote,
  onMessage,
  showQuestion,
}: QuestionDetailProps) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftNote, setDraftNote] = useState(note);
  /** 내가 한 말은 접어 둔다. 피드백이 없으면 그게 전부라 펼쳐 둔다. 고치는 중에는 늘 펼친다. */
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const analysis = selected?.analysis;
  const transcript = analysis?.transcription.transcript;
  const text = transcript ? getEffectiveTranscript(transcript) : '';
  const evaluation = analysis?.evaluation;
  const result = evaluation?.status === 'ready' ? evaluation.result : undefined;
  const stale = analysis ? isEvaluationStale(analysis) : false;
  const working = [analysis?.transcription.status, evaluation?.status].some((status) => status === 'queued' || status === 'processing');
  const readiness = transcript ? classifyInterviewTranscript(text) : null;
  const quotes = result ? [...result.coverage.map((item) => item.evidenceQuote), ...result.strengths.map((item) => item.evidenceQuote)] : [];
  const compare = comparison(attempts);
  const sharedFailure = hasSharedReportFailure(session.feedbackSummary, selected);
  const showTranscript = !result || transcriptOpen || editing !== null;
  /** 다음엔 이렇게 한 줄 아래의 말한 것, 잘한 점, 빠진 내용, 구성은 접어 둔다. */
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const hasMore = Boolean(
    result &&
      (result.coverage.length > 0 ||
        result.strengths.length > 0 ||
        result.missingPoints.length > 0 ||
        result.suggestedStructure.length > 0),
  );

  const saveTranscript = async (andEvaluate: boolean) => {
    if (!selected || editing === null) return;
    setSaving(true);
    try {
      await onSaveTranscript(selected.id, editing);
      setEditing(null);
      if (andEvaluate) await onRetryEvaluation(selected.id);
      else onMessage('저장했어요');
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : '수정한 답변을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Surface style={styles.detailCard} tone="raised">
        {showQuestion || question.kind === 'follow_up' ? (
          <AppText tone="muted" variant="badge">
            {question.kind === 'follow_up' ? t('꼬리질문') : t('{n}번 질문', { n: questionNumber })}
          </AppText>
        ) : null}
        {/* 폰에서는 바로 위 카드 줄에 같은 질문이 보여 여기서는 뺀다(넓은 화면은 왼쪽 목록이 줄여 보여서 둔다). */}
        {showQuestion ? <AppText variant="heading">{t(question.text)}</AppText> : null}
        {question.sourceQuote ? (
          <AppText tone="muted" variant="meta">{`“${question.sourceQuote}”`}</AppText>
        ) : null}

        {attempts.length > 1 ? (
          <View accessibilityLabel={t('답변 회차 선택')} style={styles.chips}>
            {attempts.map((attempt) => (
              <Chip
                key={attempt.id}
                label={t(attempt.status === 'failed' ? '{n}회차 중단' : '{n}회차', { n: attempt.attemptNo })}
                onPress={() => onSelectAttempt(attempt.id)}
                selected={attempt.id === selected?.id}
              />
            ))}
          </View>
        ) : null}

        {!selected ? (
          <AppText tone="muted" variant="body">
            {t('아직 답변 기록이 없는 질문이에요. 아래에서 전체 연습을 다시 시작할 수 있어요.')}
          </AppText>
        ) : (
          <>
            <AppText tone="muted" variant="meta">
              {t('{time} / 권장 {suggested}', {
                time: formatAnswerDuration(selected.durationMs, locale),
                suggested: formatAnswerDuration(question.maxDurationMs, locale),
              })}
            </AppText>
            {selected.mediaKey ? <RecordedVideo mediaKey={selected.mediaKey} /> : null}

            {analysis ? (
              <View style={styles.block}>
                <View style={styles.rowBetween}>
                  {result ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showTranscript }}
                      onPress={() => setTranscriptOpen((open) => !open)}
                      style={styles.disclosure}
                    >
                      <AppText variant="itemTitle">{t('내가 한 말')}</AppText>
                      {showTranscript ? (
                        <ChevronUp {...decorative} color={colors.textMuted} size={iconSizes.inline} />
                      ) : (
                        <ChevronDown {...decorative} color={colors.textMuted} size={iconSizes.inline} />
                      )}
                    </Pressable>
                  ) : (
                    <AppText variant="itemTitle">{t('내가 한 말')}</AppText>
                  )}
                  {showTranscript && editable && transcript && editing === null && !working ? (
                    <Button leftIcon={<Pencil color={colors.text} size={iconSizes.dense} />} onPress={() => setEditing(text)} size="small" variant="ghost">
                      {t('내용 고치기')}
                    </Button>
                  ) : null}
                </View>
                {!showTranscript ? null : editing !== null ? (
                  <View style={styles.block}>
                    <TextArea label={t('내가 한 말 고치기')} maxLength={20_000} minHeight={140} onChangeText={setEditing} value={editing} />
                    <AppText tone="muted" variant="meta">
                      {t(
                        classifyInterviewTranscript(editing) === 'ready'
                          ? '고친 내용으로 피드백을 받으려면 ‘저장하고 피드백 새로 받기’를 눌러주세요.'
                          : '말한 내용이 너무 짧아요. 빠진 말이 있다면 적어주세요.',
                      )}
                    </AppText>
                    <View style={styles.inlineActions}>
                      <Button variant="primary"
                        disabled={saving || classifyInterviewTranscript(editing) !== 'ready'}
                        leftIcon={<RefreshCw color={colors.textInverse} size={iconSizes.dense} />}
                        loading={saving}
                        onPress={() => void saveTranscript(true)}
                        size="small"
                      >
                        {t('저장하고 피드백 새로 받기')}
                      </Button>
                      <Button disabled={saving} onPress={() => void saveTranscript(false)} size="small" variant="secondary">
                        {t('저장하기')}
                      </Button>
                      {transcript?.corrected !== undefined ? (
                        <Button disabled={saving} onPress={() => setEditing(transcript.original)} size="small" variant="ghost">
                          {t('처음 내용으로 되돌리기')}
                        </Button>
                      ) : null}
                      <Button disabled={saving} onPress={() => setEditing(null)} size="small" variant="ghost">
                        {t('취소')}
                      </Button>
                    </View>
                  </View>
                ) : analysis.transcription.status === 'queued' || analysis.transcription.status === 'processing' ? (
                  <AppText tone="muted" variant="body">
                    {t('말한 내용을 글로 옮기고 있어요.')}
                  </AppText>
                ) : analysis.transcription.status === 'failed' && !transcript ? (
                  <Notice
                    action={
                      editable && canRetryReportTask(analysis.transcription.error) && analysis.audioKey ? (
                        <Button onPress={() => onRetryTranscription(selected.id)} size="small" variant="secondary">
                          {t('다시 시도하기')}
                        </Button>
                      ) : null
                    }
                    text={t(reportAnalysisMessage('answer', analysis.transcription.error?.code))}
                  />
                ) : text.length === 0 ? (
                  <AppText tone="muted" variant="body">
                    {t('글로 옮긴 내용이 없어요. ‘내용 고치기’에서 내가 한 말을 직접 적을 수 있어요.')}
                  </AppText>
                ) : (
                  <AppText variant="body">
                    {highlightTranscript(text, quotes).map((part, index) =>
                      part.mark ? (
                        <AppText key={index} style={styles.mark} variant="body">
                          {part.text}
                        </AppText>
                      ) : (
                        part.text
                      ),
                    )}
                  </AppText>
                )}
              </View>
            ) : session.feedbackMode === 'ai' ? (
              <AppText tone="muted" variant="body">
                {t('이 답변에는 녹음이 없어요.')}
              </AppText>
            ) : null}

            {analysis && editing === null ? (
              result ? (
                <View style={styles.block}>
                  {stale ? (
                    <Notice
                      action={
                        editable ? (
                          <Button disabled={working} onPress={() => void onRetryEvaluation(selected.id)} size="small" variant="secondary">
                            {t('고친 내용으로 피드백 받기')}
                          </Button>
                        ) : null
                      }
                      text={t('고친 내용은 아직 피드백에 반영되지 않았어요.')}
                    />
                  ) : null}
                  <StatusBadge label={t(FIT_COPY[result.fit])} tone={result.fit === 'direct' ? 'positive' : result.fit === 'partial' ? 'warning' : 'neutral'} />
                  <View style={styles.focus}>
                    <AppText tone="brand" variant="badge">
                      {t('다음엔 이렇게 해보세요')}
                    </AppText>
                    <AppText variant="bodyStrong">{clean(conciseReportText(result.nextFocus))}</AppText>
                  </View>
                  {hasMore ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: feedbackOpen }}
                      onPress={() => setFeedbackOpen((open) => !open)}
                      style={styles.disclosure}
                    >
                      <AppText tone="soft" variant="bodyStrong">
                        {feedbackOpen ? t.ctx('fold', '접기') : t('자세히 보기')}
                      </AppText>
                      {feedbackOpen ? (
                        <ChevronUp {...decorative} color={colors.textMuted} size={iconSizes.inline} />
                      ) : (
                        <ChevronDown {...decorative} color={colors.textMuted} size={iconSizes.inline} />
                      )}
                    </Pressable>
                  ) : null}
                  {feedbackOpen && result.coverage.length > 0 ? (
                    <View style={styles.block}>
                      <AppText variant="itemTitle">{t('질문이 바란 내용')}</AppText>
                      <View style={styles.coverageChips}>
                        {result.coverage.map((item) => (
                          <View
                            accessibilityLabel={`${clean(item.point)}, ${t(COVERAGE_COPY[item.status])}`}
                            accessible
                            key={item.point}
                            style={[styles.coverageChip, item.status === 'met' ? styles.coverageMet : item.status === 'partial' ? styles.coveragePartial : null]}
                          >
                            <AppText tone={item.status === 'met' ? 'positive' : item.status === 'partial' ? 'warning' : 'muted'} variant="badge">
                              {t(COVERAGE_COPY[item.status])}
                            </AppText>
                            <AppText style={styles.shrink} variant="label">
                              {clean(item.point)}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {feedbackOpen && result.strengths.length > 0 ? (
                    <View style={[styles.block, styles.panel, styles.panelPositive]}>
                      <AppText tone="positive" variant="itemTitle">
                        {t('잘한 점')}
                      </AppText>
                      {result.strengths.map((item) => (
                        <AppText key={item.point} variant="body">
                          {`${clean(item.point)} `}
                          <AppText tone="muted" variant="body">{`“${item.evidenceQuote}”`}</AppText>
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                  {feedbackOpen && result.missingPoints.length > 0 ? (
                    <View style={[styles.block, styles.panel, styles.panelSoft]}>
                      <AppText tone="warning" variant="itemTitle">
                        {t('빠진 내용')}
                      </AppText>
                      {result.missingPoints.map((point) => (
                        <AppText key={point} variant="body">{`• ${clean(point)}`}</AppText>
                      ))}
                    </View>
                  ) : null}
                  {feedbackOpen && result.suggestedStructure.length > 0 ? (
                    <View style={[styles.block, styles.panel, styles.panelBrand]}>
                      <AppText tone="brand" variant="itemTitle">
                        {t('이렇게 구성해 보세요')}
                      </AppText>
                      {result.suggestedStructure.map((step, index) => (
                        <AppText key={step} variant="body">{`${index + 1}. ${clean(step)}`}</AppText>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : evaluation?.status === 'failed' && !sharedFailure ? (
                <Notice
                  action={
                    editable && canRetryReportTask(evaluation.error) && transcript && isInterviewTranscriptReadyForFeedback(transcript) ? (
                      <Button disabled={working} onPress={() => void onRetryEvaluation(selected.id)} size="small" variant="secondary">
                        {t('다시 시도하기')}
                      </Button>
                    ) : null
                  }
                  text={reportAnalysisMessage('feedback', evaluation.error?.code)}
                />
              ) : evaluation?.status === 'failed' && sharedFailure ? (
                <Notice
                  action={
                    editable && canRetryReportTask(evaluation.error) ? (
                      <Button disabled={working} onPress={() => void onRetryEvaluation(selected.id)} size="small" variant="secondary">
                        {t('다시 시도하기')}
                      </Button>
                    ) : null
                  }
                  text={reportAnalysisMessage('feedback', evaluation.error?.code)}
                />
              ) : evaluation?.status === 'queued' || evaluation?.status === 'processing' ? (
                <AppText tone="muted" variant="body">
                  {t('피드백 받는 중')}
                </AppText>
              ) : evaluation?.status === 'unavailable' ? (
                <AppText tone="muted" variant="body">
                  {t('이 답변에는 피드백이 없어요. 위에 남겨둔 ‘내가 한 말’로 답변을 돌아보세요.')}
                </AppText>
              ) : analysis.transcription.status === 'ready' && readiness && readiness !== 'ready' ? (
                <AppText tone="muted" variant="body">
                  {t(reportAnalysisMessage('answer', readiness))}
                </AppText>
              ) : null
            ) : null}
          </>
        )}
      </Surface>

      {compare ? (
        <Surface style={styles.detailCard} tone="raised">
          <View style={styles.rowBetween}>
            <AppText variant="itemTitle">{t('처음 답변과 비교')}</AppText>
            {compare.missingDelta !== null && compare.missingDelta > 0 ? (
              <StatusBadge label={t('빠진 내용 {n}개 줄었어요', { n: compare.missingDelta })} tone="positive" />
            ) : null}
          </View>
          <View style={styles.compare}>
            {[compare.first, compare.last].map((side, index) => (
              <Pressable
                accessibilityLabel={t('{n}회차 답변 보기', { n: side.attempt.attemptNo })}
                accessibilityRole="button"
                key={side.attempt.id}
                onPress={() => onSelectAttempt(side.attempt.id)}
                style={({ pressed }) => [styles.compareSide, pressed ? styles.pressed : null]}
              >
                <View style={styles.rowBetween}>
                  <AppText tone="muted" variant="badge">{t(index === 0 ? '처음 {n}회차' : '최근 {n}회차', { n: side.attempt.attemptNo })}</AppText>
                  <AppText tabular tone="muted" variant="badge">
                    {formatAnswerDuration(side.attempt.durationMs, locale)}
                  </AppText>
                </View>
                {side.missing !== null ? <AppText variant="meta">{t('빠진 내용 {n}개', { n: side.missing })}</AppText> : null}
                <AppText numberOfLines={3} variant="meta">
                  {side.transcript || t('전사문이 아직 없어요.')}
                </AppText>
              </Pressable>
            ))}
          </View>
          {compare.last.nextFocus ? <AppText tone="muted" variant="meta">{t('다음 연습: {text}', { text: clean(compare.last.nextFocus) })}</AppText> : null}
        </Surface>
      ) : null}

      {editable ? (
        <Surface style={styles.detailCard} tone="raised">
          <TextArea
            hint={t('다음에 해보고 싶은 것을 적어보세요. 비워둬도 괜찮아요.')}
            label={t('다음 연습 메모')}
            maxLength={500}
            minHeight={80}
            onBlur={() => {
              if (draftNote !== note) void onSaveNote(draftNote).then(() => onMessage('메모를 저장했어요.')).catch(() => onMessage('메모를 저장하지 못했어요.'));
            }}
            onChangeText={setDraftNote}
            placeholder={t('예: 지원한 이유부터 말하고, 내 경험 하나 덧붙이기')}
            value={draftNote}
          />
          {selected ? (
            <Button leftIcon={<ArrowRight color={colors.text} size={iconSizes.inline} />} onPress={onRetryQuestion} variant="secondary">
              {t('이 질문 다시 연습하기')}
            </Button>
          ) : null}
        </Surface>
      ) : note ? (
        <Surface style={styles.detailCard} tone="raised">
          <AppText tone="muted" variant="badge">
            {t('다음 연습 메모')}
          </AppText>
          <AppText variant="body">{note}</AppText>
        </Surface>
      ) : null}
    </View>
  );
}

function Notice({ text, action }: { text: string; action: ReactNode }) {
  return (
    <View style={styles.notice}>
      <CircleAlert {...decorative} color={colors.warningStrong} size={iconSizes.inline} />
      <View style={[styles.flex, styles.block]}>
        <AppText variant="meta">{text}</AppText>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xxl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  summary: { borderRadius: 24, gap: spacing.md },
  titleBlock: { gap: spacing.xxs },
  clip: { overflow: 'hidden' },
  grow: { flexGrow: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
  dockSpace: { paddingBottom: BOTTOM_ACTION_SPACE + spacing.md },
  qCard: { backgroundColor: colors.surface, borderRadius: radii.hero, cursor: 'pointer', flex: 1, gap: spacing.sm, minHeight: 148, padding: spacing.lg },
  qCardOn: { backgroundColor: colors.brandSoft },
  qCardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  qBadge: { alignItems: 'center', backgroundColor: colors.backgroundSoft, borderRadius: radii.full, height: 28, justifyContent: 'center', width: 28 },
  qBadgeOn: { backgroundColor: colors.brand },
  focus: { backgroundColor: colors.brandSoft, borderRadius: radii.tile, gap: spacing.xs, padding: spacing.md },
  coverageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  coverageChip: { alignItems: 'center', backgroundColor: colors.backgroundSoft, borderRadius: radii.chip, flexDirection: 'row', gap: spacing.sm, maxWidth: '100%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  coverageMet: { backgroundColor: colors.positiveSoft },
  coveragePartial: { backgroundColor: colors.warningSoft },
  panel: { borderRadius: radii.tile, padding: spacing.md },
  panelPositive: { backgroundColor: colors.positiveSoft },
  panelSoft: { backgroundColor: colors.backgroundSoft },
  panelBrand: { backgroundColor: colors.brandSubtle },
  badges: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reflect: { gap: spacing.xs },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xl },
  listColumn: {
    flexShrink: 0,
    gap: spacing.md,
    position: Platform.OS === 'web' ? ('sticky' as 'relative') : 'relative',
    top: spacing.md,
    width: 360,
  },
  detailColumn: { flex: 1, minWidth: 0 },
  qRow: { alignItems: 'flex-start', cursor: 'pointer', flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md },
  qRowOn: { backgroundColor: colors.brandSubtle },
  qRowHover: { backgroundColor: colors.backgroundSoft },
  qNumber: { minWidth: 20 },
  divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  detailCard: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.sm },
  disclosure: { alignItems: 'center', cursor: 'pointer', flexDirection: 'row', gap: spacing.xs, minHeight: 44 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mark: { backgroundColor: colors.brandSoft },
  compare: { gap: spacing.md },
  compareSide: { backgroundColor: colors.backgroundSoft, borderRadius: radii.tile, gap: spacing.xs, padding: spacing.md },
  notice: { alignItems: 'flex-start', backgroundColor: colors.warningSoft, borderRadius: radii.tile, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  actions: { gap: spacing.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexGrow: 1 },
  danger: { color: colors.negative },
});
