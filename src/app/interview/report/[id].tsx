import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CircleAlert, History, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { RecordedVideo } from '@/components/interview/RecordedVideo';
import { ShareWithOrg } from '@/components/interview/ShareWithOrg';
import {
  AppText,
  Button,
  Card,
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
  totalSpeakingMs,
} from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 연습 결과. 질문별로 내가 한 말(전사문), 질문에 맞게 답했는지, 말한 것과
 * 빠진 것, 잘한 점, 다음에 해볼 것을 보여 준다. 점수와 합격 가능성, 성격은
 * 말하지 않는다. 다른 기기의 기록은 읽기만 한다(녹음이 이 기기에 없다).
 */
export default function InterviewReportScreen() {
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
        <AppHeader onBack={() => router.back()} title="연습 결과" />
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
        <AppHeader onBack={() => router.back()} title="연습 결과" />
        <EmptyState
          actionLabel="연습 기록으로"
          description="기록이 지워졌거나 이 기기에 없는 연습이에요."
          icon={History}
          onAction={() => router.replace('/interview/history')}
          title="연습 기록을 불러오지 못했어요."
        />
      </Screen>
    );
  }

  const questions = source.questions;
  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId) ?? questions.find((question) => byQuestion.has(question.id)) ?? questions[0];
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
      toast.show(reason instanceof Error ? reason.message : '다시 답변을 시작하지 못했어요.');
    }
  };

  const questionList = (
    <Card padding={false}>
      {questions.map((question, index) => {
        const latest = latestAttempt(byQuestion.get(question.id));
        const status = reportQuestionStatus(latest);
        const on = question.id === selectedQuestion?.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            key={question.id}
            onPress={() => {
              setSelectedQuestionId(question.id);
              setSelectedAttemptId(null);
            }}
            style={({ pressed }) => [styles.qRow, index < questions.length - 1 ? styles.divider : null, on ? styles.qRowOn : null, pressed ? styles.pressed : null]}
          >
            <AppText style={styles.qNumber} tabular tone={on ? 'brand' : 'muted'} variant="bodyStrong">
              {index + 1}
            </AppText>
            <View style={styles.flex}>
              <AppText numberOfLines={2} variant="body">
                {question.text}
              </AppText>
              <AppText tone="muted" variant="meta">
                {!latest ? '아직 답하지 않았어요' : status ? status.label : latest.analysis?.evaluation.status === 'ready' ? '피드백 있음' : formatAnswerDuration(latest.durationMs)}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );

  const header = (
    <Card style={styles.summary}>
      <View style={styles.badges}>
        <StatusBadge label={source.kindLabel} tone="neutral" />
        <StatusBadge label={modeLabel(session)} tone={session.feedbackMode === 'ai' ? 'brand' : 'neutral'} />
        {remote ? <StatusBadge label="다른 기기의 기록" tone="info" /> : null}
      </View>
      <AppText variant="pageTitle">{source.title}</AppText>
      <AppText tone="muted" variant="meta">
        {[formatDate(session.completedAt ?? session.createdAt), `답변한 질문 ${answeredCount} / ${questions.length}개`, `총 말한 시간 ${formatAnswerDuration(totalSpeakingMs(session))}`].filter(Boolean).join(' / ')}
      </AppText>
      {grounded ? (
        <View style={styles.reflect}>
          <AppText tone="brand" variant="badge">
            이번 연습 돌아보기
          </AppText>
          <AppText variant="bodyStrong">{clean(grounded.summary)}</AppText>
        </View>
      ) : null}
      <AppText tone="faint" variant="badge">
        {ai
          ? 'AI가 만든 전사문과 피드백이에요. 사실과 다를 수 있으니 참고로만 봐 주세요. 합격 가능성이나 성격은 판단하지 않아요.'
          : '이 화면은 답변 시간과 메모를 정리하며, 답변 내용이나 합격 가능성을 평가하지 않아요.'}
      </AppText>
    </Card>
  );

  const detail = selectedQuestion ? (
    <QuestionDetail
      attempts={attempts}
      editable={!remote}
      key={`${selectedQuestion.id}:${selectedAttempt?.id ?? 'none'}`}
      note={session.reviewNotes?.[selectedQuestion.id] ?? ''}
      onMessage={toast.show}
      onRetryEvaluation={async (attemptId) => {
        const queued = await retryInterviewEvaluation(session.id, attemptId);
        if (!queued) toast.show('지금은 다시 받을 피드백이 없어요.');
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
    />
  ) : null;

  return (
    <Screen padded={false}>
      <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/interview'))} title="연습 결과" />
      <ScrollView style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
        {header}
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.listColumn}>
              <SectionHeader title="질문별로 돌아보기" />
              {questionList}
            </View>
            <View style={styles.detailColumn}>{detail}</View>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader description="질문을 누르면 내가 한 답변을 볼 수 있어요." title="질문별로 돌아보기" />
              {questionList}
            </View>
            {detail}
          </>
        )}

        <View style={[styles.actions, breakpoint !== 'compact' ? styles.actionsRow : null]}>
          {!remote ? (
            <Button
              leftIcon={<RotateCcw color={colors.textInverse} size={iconSizes.inline} />}
              onPress={() => router.push({ pathname: '/interview/prepare', params: { again: session.id } })}
              style={styles.action}
            >
              전체 다시 연습
            </Button>
          ) : null}
          {canShare && user ? <ShareWithOrg onMessage={toast.show} orgName={user.orgName ?? '기관'} session={session} source={source} /> : null}
          <Button onPress={() => router.push('/interview/history')} style={styles.action} variant="outline">
            연습 기록으로
          </Button>
        </View>
        {!remote ? (
          <Button leftIcon={<Trash2 color={colors.negative} size={iconSizes.inline} />} onPress={() => setDeleteOpen(true)} textStyle={styles.danger} variant="ghost">
            이 연습 기록 지우기
          </Button>
        ) : null}
        </View>
      </ScrollView>
      <Toast message={toast.message} />
      <Dialog
        cancel={{ label: '취소', onPress: () => setDeleteOpen(false) }}
        confirm={{
          label: '지우기',
          onPress: () => {
            setDeleteOpen(false);
            void Promise.all([deleteSession(session.id), forgetBackup(session.id)]).then(() => router.replace('/interview/history'));
          },
        }}
        description="이 기기의 기록과 녹음, 계정에 남긴 글 사본을 모두 지워요. 되돌릴 수 없어요."
        onRequestClose={() => setDeleteOpen(false)}
        title="이 연습 기록을 지울까요?"
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
}: QuestionDetailProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftNote, setDraftNote] = useState(note);
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
      <Card style={styles.detailCard}>
        <View style={styles.badges}>
          <AppText tone="muted" variant="badge">
            {question.kind === 'follow_up' ? '꼬리질문' : `${questionNumber}번 질문`}
          </AppText>
          {question.traitIds.length > 0 ? <StatusBadge label="연결된 인재상" tone="neutral" /> : null}
        </View>
        <AppText variant="heading">{question.text}</AppText>
        {question.sourceQuote ? (
          <AppText tone="muted" variant="meta">{`질문과 연결된 내 자소서: ${question.sourceQuote}`}</AppText>
        ) : null}

        {attempts.length > 1 ? (
          <View accessibilityLabel="답변 회차 선택" style={styles.chips}>
            {attempts.map((attempt) => (
              <Chip
                key={attempt.id}
                label={`${attempt.attemptNo}회차${attempt.status === 'failed' ? ' 중단' : ''}`}
                onPress={() => onSelectAttempt(attempt.id)}
                selected={attempt.id === selected?.id}
              />
            ))}
          </View>
        ) : null}

        {!selected ? (
          <AppText tone="muted" variant="body">
            아직 답변 기록이 없는 질문이에요. 아래에서 전체 연습을 다시 시작할 수 있어요.
          </AppText>
        ) : (
          <>
            <AppText tone="muted" variant="meta">
              {`${formatAnswerDuration(selected.durationMs)} 동안 답변 / 권장 시간 ${formatAnswerDuration(question.maxDurationMs)}`}
            </AppText>
            {selected.mediaKey ? <RecordedVideo mediaKey={selected.mediaKey} /> : null}

            {analysis ? (
              <View style={styles.block}>
                <View style={styles.rowBetween}>
                  <AppText variant="itemTitle">내가 한 말</AppText>
                  {editable && transcript && editing === null && !working ? (
                    <Button leftIcon={<Pencil color={colors.text} size={iconSizes.dense} />} onPress={() => setEditing(text)} size="small" variant="ghost">
                      내용 고치기
                    </Button>
                  ) : null}
                </View>
                {editing !== null ? (
                  <View style={styles.block}>
                    <TextArea label="내가 한 말 고치기" maxLength={20_000} minHeight={140} onChangeText={setEditing} value={editing} />
                    <AppText tone="muted" variant="meta">
                      {classifyInterviewTranscript(editing) === 'ready'
                        ? '고친 내용으로 피드백을 받으려면 ‘저장하고 피드백 새로 받기’를 눌러주세요.'
                        : '말한 내용이 너무 짧아요. 빠진 말이 있다면 적어주세요.'}
                    </AppText>
                    <View style={styles.inlineActions}>
                      <Button
                        disabled={saving || classifyInterviewTranscript(editing) !== 'ready'}
                        leftIcon={<RefreshCw color={colors.textInverse} size={iconSizes.dense} />}
                        loading={saving}
                        onPress={() => void saveTranscript(true)}
                        size="small"
                      >
                        저장하고 피드백 새로 받기
                      </Button>
                      <Button disabled={saving} onPress={() => void saveTranscript(false)} size="small" variant="secondary">
                        저장하기
                      </Button>
                      {transcript?.corrected !== undefined ? (
                        <Button disabled={saving} onPress={() => setEditing(transcript.original)} size="small" variant="ghost">
                          처음 내용으로 되돌리기
                        </Button>
                      ) : null}
                      <Button disabled={saving} onPress={() => setEditing(null)} size="small" variant="ghost">
                        취소
                      </Button>
                    </View>
                  </View>
                ) : analysis.transcription.status === 'queued' || analysis.transcription.status === 'processing' ? (
                  <AppText tone="muted" variant="body">
                    말한 내용을 글로 옮기고 있어요.
                  </AppText>
                ) : analysis.transcription.status === 'failed' && !transcript ? (
                  <Notice
                    action={
                      editable && canRetryReportTask(analysis.transcription.error) && analysis.audioKey ? (
                        <Button onPress={() => onRetryTranscription(selected.id)} size="small" variant="secondary">
                          다시 시도하기
                        </Button>
                      ) : null
                    }
                    text={reportAnalysisMessage('answer', analysis.transcription.error?.code)}
                  />
                ) : text.length === 0 ? (
                  <AppText tone="muted" variant="body">
                    글로 옮긴 내용이 없어요. ‘내용 고치기’에서 내가 한 말을 직접 적을 수 있어요.
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
                이 답변에는 녹음이 없어요.
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
                            고친 내용으로 피드백 받기
                          </Button>
                        ) : null
                      }
                      text="고친 내용은 아직 피드백에 반영되지 않았어요."
                    />
                  ) : null}
                  <StatusBadge label={FIT_COPY[result.fit]} tone={result.fit === 'direct' ? 'positive' : result.fit === 'partial' ? 'warning' : 'neutral'} />
                  <AppText tone="brand" variant="badge">
                    다음엔 이렇게 해보세요
                  </AppText>
                  <AppText variant="bodyStrong">{clean(conciseReportText(result.nextFocus))}</AppText>
                  {result.coverage.length > 0 ? (
                    <View style={styles.block}>
                      <AppText variant="itemTitle">질문이 바란 내용</AppText>
                      {result.coverage.map((item) => (
                        <View key={item.point} style={styles.coverageRow}>
                          <StatusBadge label={COVERAGE_COPY[item.status]} tone={item.status === 'met' ? 'positive' : item.status === 'partial' ? 'warning' : 'neutral'} />
                          <AppText style={styles.flex} variant="body">
                            {clean(item.point)}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {result.strengths.length > 0 ? (
                    <View style={styles.block}>
                      <AppText tone="positive" variant="itemTitle">
                        잘한 점
                      </AppText>
                      {result.strengths.map((item) => (
                        <AppText key={item.point} variant="body">
                          {`${clean(item.point)} `}
                          <AppText tone="muted" variant="body">{`“${item.evidenceQuote}”`}</AppText>
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                  {result.missingPoints.length > 0 ? (
                    <View style={styles.block}>
                      <AppText tone="warning" variant="itemTitle">
                        빠진 내용
                      </AppText>
                      {result.missingPoints.map((point) => (
                        <AppText key={point} variant="body">{`• ${clean(point)}`}</AppText>
                      ))}
                    </View>
                  ) : null}
                  {result.suggestedStructure.length > 0 ? (
                    <View style={styles.block}>
                      <AppText tone="brand" variant="itemTitle">
                        이렇게 구성해 보세요
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
                        다시 시도하기
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
                        다시 시도하기
                      </Button>
                    ) : null
                  }
                  text={reportAnalysisMessage('feedback', evaluation.error?.code)}
                />
              ) : evaluation?.status === 'queued' || evaluation?.status === 'processing' ? (
                <AppText tone="muted" variant="body">
                  피드백 받는 중
                </AppText>
              ) : evaluation?.status === 'unavailable' ? (
                <AppText tone="muted" variant="body">
                  이 답변에는 피드백이 없어요. 위에 남겨둔 ‘내가 한 말’로 답변을 돌아보세요.
                </AppText>
              ) : analysis.transcription.status === 'ready' && readiness && readiness !== 'ready' ? (
                <AppText tone="muted" variant="body">
                  {reportAnalysisMessage('answer', readiness)}
                </AppText>
              ) : null
            ) : null}
          </>
        )}
      </Card>

      {compare ? (
        <Card style={styles.detailCard}>
          <View style={styles.rowBetween}>
            <AppText variant="itemTitle">처음 답변과 비교</AppText>
            {compare.missingDelta !== null && compare.missingDelta > 0 ? (
              <StatusBadge label={`빠진 내용 ${compare.missingDelta}개 줄었어요`} tone="positive" />
            ) : null}
          </View>
          <View style={styles.compare}>
            {[compare.first, compare.last].map((side, index) => (
              <Pressable
                accessibilityLabel={`${side.attempt.attemptNo}회차 답변 보기`}
                accessibilityRole="button"
                key={side.attempt.id}
                onPress={() => onSelectAttempt(side.attempt.id)}
                style={({ pressed }) => [styles.compareSide, pressed ? styles.pressed : null]}
              >
                <View style={styles.rowBetween}>
                  <AppText tone="muted" variant="badge">{`${index === 0 ? '처음' : '최근'} ${side.attempt.attemptNo}회차`}</AppText>
                  <AppText tabular tone="muted" variant="badge">
                    {formatAnswerDuration(side.attempt.durationMs)}
                  </AppText>
                </View>
                {side.missing !== null ? <AppText variant="meta">{`빠진 내용 ${side.missing}개`}</AppText> : null}
                <AppText numberOfLines={3} variant="meta">
                  {side.transcript || '전사문이 아직 없어요.'}
                </AppText>
              </Pressable>
            ))}
          </View>
          {compare.last.nextFocus ? <AppText tone="muted" variant="meta">{`다음 연습: ${clean(compare.last.nextFocus)}`}</AppText> : null}
        </Card>
      ) : null}

      {editable ? (
        <Card style={styles.detailCard}>
          <TextArea
            hint="다음에 해보고 싶은 것을 적어보세요. 비워둬도 괜찮아요."
            label="다음 연습 메모"
            maxLength={500}
            minHeight={80}
            onBlur={() => {
              if (draftNote !== note) void onSaveNote(draftNote).then(() => onMessage('메모를 저장했어요.')).catch(() => onMessage('메모를 저장하지 못했어요.'));
            }}
            onChangeText={setDraftNote}
            placeholder="예: 지원한 이유부터 말하고, 내 경험 하나 덧붙이기"
            value={draftNote}
          />
          {selected ? (
            <Button leftIcon={<ArrowRight color={colors.text} size={iconSizes.inline} />} onPress={onRetryQuestion} variant="secondary">
              이 질문 다시 연습하기
            </Button>
          ) : null}
        </Card>
      ) : note ? (
        <Card style={styles.detailCard} variant="soft">
          <AppText tone="muted" variant="badge">
            다음 연습 메모
          </AppText>
          <AppText variant="body">{note}</AppText>
        </Card>
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
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  summary: { gap: spacing.sm },
  badges: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reflect: { backgroundColor: colors.brandSubtle, borderRadius: radii.tile, gap: spacing.xs, marginTop: spacing.xs, padding: spacing.md },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xl },
  listColumn: { flex: 2, gap: spacing.md, minWidth: 0 },
  detailColumn: { flex: 3, minWidth: 0 },
  qRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md },
  qRowOn: { backgroundColor: colors.brandSubtle },
  qNumber: { minWidth: 20 },
  divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  detailCard: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.sm },
  rowBetween: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mark: { backgroundColor: colors.brandSoft },
  coverageRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  compare: { gap: spacing.md },
  compareSide: { backgroundColor: colors.backgroundSoft, borderRadius: radii.tile, gap: spacing.xs, padding: spacing.md },
  notice: { alignItems: 'flex-start', backgroundColor: colors.warningSoft, borderRadius: radii.tile, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  actions: { gap: spacing.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexGrow: 1 },
  danger: { color: colors.negative },
});
