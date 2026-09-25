import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, Mic, Square, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CameraPreview } from '@/components/interview/CameraPreview';
import { AppText, Button, Card, Dialog, IconButton, ProgressBar, Screen } from '@/components/ui';
import { createQueuedAttemptAnalysis } from '@/features/interview/analysis';
import { startInterviewAnalysis } from '@/features/interview/analysis-queue';
import { interviewServerAvailable, isPlanLimit } from '@/features/interview/interview-api';
import { interviewMedia } from '@/features/interview/interview-media';
import { getSession, mutateSession, newId } from '@/features/interview/interview-storage';
import { startPaidPractice } from '@/features/interview/practice-charge';
import {
  applySaveAttempt,
  cancelQuestionRetry,
  PENDING_AUDIO_TTL_MS,
  switchToBasicPractice,
} from '@/features/interview/session-machine';
import { resolveSessionSource, type SessionSource } from '@/features/interview/session-source';
import type { InterviewAttempt, InterviewQuestion, InterviewSession } from '@/features/interview/types';
import { refreshInterviewAccount } from '@/features/interview/use-interview-account';
import { useAnswerRecorder } from '@/features/interview/use-answer-recorder';
import { formatClock } from '@/features/interview/view-model';
import type { RecordedAnswer } from '@/features/interview/answer-recorder.types';
import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import { INTERVIEW_HOME } from '@/features/interview/routes';

type Stage = 'loading' | 'missing' | 'blocked' | 'greeting' | 'connecting' | 'running' | 'device_error' | 'complete' | 'load_error';
type Phase = 'question' | 'thinking' | 'answering' | 'saving' | 'next';

const QUESTION_HOLD_MS = 700;
const NEXT_HOLD_MS = 700;
const DEFAULT_PREP_MS = 10_000;
const MAX_ANSWER_DURATION_MS = 5 * 60 * 1000;

const GREETING_FIRST = '답변은 직접 완료할 수 있어요.';
const GREETING_RESUME = '저장된 질문부터 이어서 연습할 수 있어요.';
const GREETING_RETRY = '이전 답변은 그대로 두고 선택한 질문만 다시 연습해요.';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 면접실: 질문 확인 → 생각 시간 → 답변(녹음) → 저장 → 다음 질문.
 * 생각 시간과 권장 답변 시간은 안내일 뿐이고, 답변은 최대 5분까지 이어갈 수 있다.
 * 요금은 첫 실제 답변을 시작할 때만 예약하고 확정한다(practice-charge).
 */
export default function InterviewRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { breakpoint, gutter } = useLayout();
  const recorder = useAnswerRecorder();

  const [stage, setStage] = useState<Stage>('loading');
  const [phase, setPhase] = useState<Phase>('question');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [source, setSource] = useState<SessionSource | null>(null);
  const [firstEntry, setFirstEntry] = useState(true);
  const [clockMs, setClockMs] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [planBlocked, setPlanBlocked] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [preview, setPreview] = useState<MediaStream | null>(null);

  const deadlineRef = useRef(0);
  const startedAtRef = useRef(0);
  const answerLockRef = useRef(false);
  const closedRef = useRef(false);
  const mountedRef = useRef(true);
  const leavingRef = useRef(false);

  const ai = session?.feedbackMode === 'ai';
  const withVideo = ai && session?.capture === 'record' && Platform.OS === 'web';
  const retrying = Boolean(session?.retryQuestionId);
  const questions = source?.questions ?? [];
  const questionIndex = session
    ? session.retryQuestionId
      ? Math.max(0, questions.findIndex((item) => item.id === session.retryQuestionId))
      : Math.min(session.currentQuestionIndex, Math.max(0, questions.length - 1))
    : 0;
  const question: InterviewQuestion | undefined = questions[questionIndex];
  const finalAnswer = Boolean(session && (retrying || questionIndex >= questions.length - 1));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── load ───────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = id ? await getSession(id) : null;
        if (!alive) return;
        const foundSource = resolveSessionSource(found);
        if (!found || !foundSource) {
          setStage('missing');
          return;
        }
        const retryQuestion = found.retryQuestionId ? foundSource.questions.find((item) => item.id === found.retryQuestionId) : undefined;
        if (!retryQuestion && (found.status === 'completed' || found.currentQuestionIndex >= foundSource.questions.length)) {
          router.replace({ pathname: found.feedbackMode === 'ai' ? '/interview/preparing/[id]' : '/interview/report/[id]', params: { id: found.id } });
          return;
        }
        setSession(found);
        setSource(foundSource);
        setFirstEntry(found.attempts.length === 0);
        if (found.feedbackMode === 'ai') {
          const support = recorder.support({ video: found.capture === 'record' && Platform.OS === 'web' });
          if (!support.ok) {
            setMessage(support.reason);
            setStage('blocked');
            return;
          }
          setStage('greeting');
          return;
        }
        if (found.attempts.length === 0 && !found.retryQuestionId) {
          // 기본 연습은 준비 화면에서 이미 시작을 골랐으니 인사를 다시 묻지 않는다.
          setPhase('question');
          setStage('running');
        } else {
          setStage('greeting');
        }
      } catch (reason) {
        if (!alive) return;
        setMessage(reason instanceof Error ? reason.message : '면접 정보를 불러오지 못했어요.');
        setStage('load_error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, recorder]);

  // ── devices ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!session) return;
    setStage('connecting');
    setMessage(null);
    try {
      await recorder.prepare({ video: withVideo });
      if (!mountedRef.current) return;
      setPreview(recorder.previewStream());
      answerLockRef.current = false;
      setPhase('question');
      setStage('running');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '마이크를 켜지 못했어요.');
      setStage('device_error');
    }
  }, [recorder, session, withVideo]);

  const beginInterview = useCallback(() => {
    if (ai) {
      void connect();
      return;
    }
    answerLockRef.current = false;
    setPhase('question');
    setStage('running');
  }, [ai, connect]);

  // ── answers ────────────────────────────────────────────────────
  const finishAnswer = useCallback(
    async (recorded: RecordedAnswer | null, durationMs: number, answered: InterviewQuestion) => {
      if (!session || !source) return;
      const isRetry = session.retryQuestionId === answered.id;
      const nextIndex = isRetry ? session.currentQuestionIndex : session.currentQuestionIndex + 1;
      const last = isRetry || nextIndex >= source.questions.length;
      setPhase('saving');
      if (last) setStage('complete');

      const attemptId = newId();
      const attemptNo = session.attempts.filter((item) => item.questionId === answered.id).length + 1;
      const audio = ai ? recorded?.audio ?? null : null;
      const audioKey = audio ? `${session.id}:${attemptId}:audio` : null;
      const mediaKey = withVideo && recorded?.video ? `${session.id}:${attemptId}` : null;
      const attempt: InterviewAttempt = {
        id: attemptId,
        questionId: answered.id,
        attemptNo,
        recordedAt: new Date().toISOString(),
        durationMs: Math.round(Math.min(MAX_ANSWER_DURATION_MS, durationMs)),
        mediaKey,
        status: 'recorded',
        ...(audioKey ? { analysis: createQueuedAttemptAnalysis(audioKey) } : {}),
      };
      try {
        // Recordings first, then the record that points at them: a crash in
        // between leaves an orphan file (cleaned later), never a dangling key.
        if (audio && audioKey) {
          await interviewMedia.putPendingAudio({
            key: audioKey,
            sessionId: session.id,
            attemptId,
            audio,
            mimeType: recorded?.audioMimeType ?? 'audio/webm',
            expiresAt: new Date(Date.now() + PENDING_AUDIO_TTL_MS).toISOString(),
          });
        }
        if (mediaKey && recorded?.video) {
          await interviewMedia
            .putVideo({ key: mediaKey, sessionId: session.id, video: recorded.video, mimeType: recorded.videoMimeType })
            .catch(() => undefined);
        }
        const saved = await mutateSession(session.id, (current) => ({
          session: applySaveAttempt(current, {
            attempt: { ...attempt, mediaKey: mediaKey && recorded?.video ? mediaKey : null },
            nextQuestionIndex: nextIndex,
            status: last ? 'completed' : 'active',
          }),
        }));
        if (!saved.session) throw new Error('저장할 면접 연습을 찾지 못했어요.');
        if (audioKey) void startInterviewAnalysis(saved.session.id);
        if (leavingRef.current || !mountedRef.current) return;
        setSession(saved.session);
        setFirstEntry(false);
        if (last) {
          recorder.release();
          router.replace({
            pathname: saved.session.feedbackMode === 'ai' ? '/interview/preparing/[id]' : '/interview/report/[id]',
            params: { id: saved.session.id },
          });
          return;
        }
        answerLockRef.current = false;
        setPhase('next');
        await wait(NEXT_HOLD_MS);
        if (!mountedRef.current || leavingRef.current) return;
        setPhase('question');
      } catch (reason) {
        if (!mountedRef.current) return;
        setMessage(reason instanceof Error ? reason.message : '답변을 저장하지 못했어요. 다시 시도해 주세요.');
        setStage('device_error');
      }
    },
    [ai, recorder, session, source, withVideo],
  );

  const openAnswerWindow = useCallback(() => {
    if (!question) return;
    closedRef.current = false;
    startedAtRef.current = Date.now();
    deadlineRef.current = startedAtRef.current + question.maxDurationMs;
    setClockMs(question.maxDurationMs);
    setPhase('answering');
  }, [question]);

  const startAnswer = useCallback(() => {
    if (stage !== 'running' || (phase !== 'thinking' && phase !== 'question') || !question || !session || answerLockRef.current) return;
    answerLockRef.current = true;
    const start = async () => {
      if (ai) {
        const ok = await recorder.start();
        if (!ok) {
          setMessage('녹음을 시작하지 못했어요. 마이크를 확인한 뒤 다시 시도해 주세요.');
          setStage('device_error');
          answerLockRef.current = false;
          return false;
        }
      }
      openAnswerWindow();
      return true;
    };
    const run = interviewServerAvailable()
      ? startPaidPractice(session, start, () => !mountedRef.current || leavingRef.current)
      : start().then(() => undefined);
    run
      .then(() => {
        if (session.billingVersion === 1) void refreshInterviewAccount();
      })
      .catch((reason: unknown) => {
        answerLockRef.current = false;
        if (!mountedRef.current || leavingRef.current) return;
        setPlanBlocked(isPlanLimit(reason));
        setMessage(reason instanceof Error ? reason.message : '연습을 시작하지 못했어요. 다시 시도해 주세요.');
        setStage('load_error');
      });
  }, [ai, openAnswerWindow, phase, question, recorder, session, stage]);

  const endAnswer = useCallback(() => {
    if (!question || closedRef.current) return;
    closedRef.current = true;
    const durationMs = Math.min(MAX_ANSWER_DURATION_MS, Math.max(0, Date.now() - startedAtRef.current));
    if (!ai) {
      void finishAnswer(null, durationMs, question);
      return;
    }
    setPhase('saving');
    void recorder.stop().then((recorded) => finishAnswer(recorded, recorded?.durationMs ?? durationMs, question));
  }, [ai, finishAnswer, question, recorder]);

  // QUESTION: show the question first, then open the thinking time.
  useEffect(() => {
    if (stage !== 'running' || phase !== 'question' || !question) return;
    const timer = setTimeout(() => {
      const prepMs = Math.max(0, question.prepDurationMs ?? DEFAULT_PREP_MS);
      if (prepMs === 0) {
        startAnswer();
        return;
      }
      deadlineRef.current = Date.now() + prepMs;
      setClockMs(prepMs);
      setPhase('thinking');
    }, QUESTION_HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, question, stage, startAnswer]);

  // THINKING: open the answer once at zero; the learner can start earlier.
  useEffect(() => {
    if (stage !== 'running' || phase !== 'thinking') return;
    const tick = () => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setClockMs(left);
      if (left <= 0) startAnswer();
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [phase, stage, startAnswer]);

  // ANSWERING: past the recommended time the clock shows overtime; 5 minutes is the hard stop.
  useEffect(() => {
    if (stage !== 'running' || phase !== 'answering') return;
    const tick = () => {
      const now = Date.now();
      setClockMs(deadlineRef.current - now);
      if (now - startedAtRef.current >= MAX_ANSWER_DURATION_MS) endAnswer();
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [endAnswer, phase, stage]);

  // Web: warn before closing the tab mid-answer.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (phase !== 'answering' && phase !== 'saving') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const exitRoom = useCallback(async () => {
    leavingRef.current = true;
    recorder.discard();
    recorder.release();
    if (session?.retryQuestionId) {
      await mutateSession(session.id, (current) => ({ session: cancelQuestionRetry(current) })).catch(() => undefined);
      router.replace({ pathname: '/interview/report/[id]', params: { id: session.id } });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(INTERVIEW_HOME);
  }, [recorder, session]);

  const leave = () => {
    if (phase === 'answering' || phase === 'saving') {
      setLeaveOpen(true);
      return;
    }
    void exitRoom();
  };

  const continueBasic = useCallback(async () => {
    if (!session) return;
    const saved = await mutateSession(session.id, (current) => ({ session: switchToBasicPractice(current) }));
    if (!saved.session) return;
    recorder.release();
    setSession(saved.session);
    setMessage(null);
    answerLockRef.current = false;
    setPhase('question');
    setStage('running');
  }, [recorder, session]);

  // ── render ─────────────────────────────────────────────────────
  if (stage === 'missing') {
    return (
      <Screen background="stage" centered>
        <Notice
          actions={<Button onPress={() => router.replace(INTERVIEW_HOME)} variant="primary">면접 연습으로 돌아가기</Button>}
          description="기록이 지워졌거나 다른 기기에서 만든 연습이에요."
          title="연습을 찾지 못했어요."
        />
      </Screen>
    );
  }

  if (stage === 'loading') {
    return (
      <Screen background="stage" centered>
        <AppText tone="inverse" variant="meta">
          면접실 여는 중...
        </AppText>
      </Screen>
    );
  }

  if (stage === 'blocked' || stage === 'load_error' || stage === 'device_error') {
    return (
      <Screen background="stage" centered>
        <Notice
          actions={
            <>
              {planBlocked ? (
                <Button onPress={() => router.push('/subscription')} variant="brand">
                  요금제 보기
                </Button>
              ) : stage === 'device_error' ? (
                <Button onPress={() => void connect()} variant="brand">
                  다시 연결
                </Button>
              ) : null}
              {(stage === 'blocked' || stage === 'device_error' || planBlocked) && session?.feedbackMode === 'ai' ? (
                <Button onPress={() => void continueBasic()} variant="secondary">
                  기본 연습으로 계속
                </Button>
              ) : null}
              <Button onPress={() => void exitRoom()} variant="ghost" textStyle={styles.inverseLink}>
                {retrying ? '연습 기록으로 돌아가기' : '연습 준비로 돌아가기'}
              </Button>
            </>
          }
          description={message ?? undefined}
          title={
            stage === 'blocked'
              ? 'AI 피드백 연습을 시작할 수 없어요.'
              : stage === 'device_error'
                ? '녹음을 이어갈 수 없어요.'
                : planBlocked
                  ? 'AI 피드백 연습 횟수가 부족해요.'
                  : '면접실을 열지 못했어요.'
          }
        />
      </Screen>
    );
  }

  const thinking = stage === 'running' && phase === 'thinking';
  const answering = stage === 'running' && phase === 'answering';
  const overtime = answering && clockMs < 0;
  const progressLabel = retrying ? `질문 ${questionIndex + 1} 다시 답변` : `${questionIndex + 1} / ${questions.length}`;
  const wide = breakpoint !== 'compact';

  return (
    <Screen background="stage" padded={false}>
      <View style={[styles.top, { paddingHorizontal: gutter }]}>
        <View style={styles.flex}>
          <AppText numberOfLines={1} style={styles.inverseMuted} variant="meta">
            {source?.title}
          </AppText>
          <AppText tabular tone="inverse" variant="itemTitle">
            {progressLabel}
          </AppText>
        </View>
        <IconButton icon={X} label="면접실 나가기" onPress={leave} variant="inverse" />
      </View>
      {!retrying && questions.length > 0 ? (
        <View style={{ paddingHorizontal: gutter }}>
          <ProgressBar height={4} max={questions.length} tone="brand" value={Math.min(questions.length, questionIndex + 1)} />
        </View>
      ) : null}

      <View style={[styles.stage, { paddingHorizontal: gutter }]}>
        <View style={[styles.stageInner, wide && withVideo ? styles.stageRow : null]}>
          {withVideo && preview ? (
            <View style={wide ? styles.previewWide : styles.preview}>
              <CameraPreview stream={preview} />
            </View>
          ) : null}
          <View style={styles.questionColumn}>
            {stage === 'greeting' || stage === 'connecting' ? (
              <View style={styles.block}>
                <AppText tone="inverse" variant="heroTitle">
                  {retrying ? '이 질문을 다시 답해 볼게요.' : firstEntry ? '준비되면 시작해요.' : '이어서 연습해요.'}
                </AppText>
                <AppText style={styles.inverseMuted} variant="body">
                  {retrying ? GREETING_RETRY : firstEntry ? GREETING_FIRST : GREETING_RESUME}
                  {ai ? ' 답변은 녹음해서 글로 옮기고, 녹음은 바로 지워요.' : ''}
                </AppText>
                <Button
                  leftIcon={<Mic color={colors.textInverse} size={iconSizes.inline} />}
                  loading={stage === 'connecting'}
                  onPress={beginInterview}
                  size="large"
                  variant="brand"
                >
                  {retrying ? '다시 답변 시작' : firstEntry ? '연습 시작' : '이어서 시작'}
                </Button>
              </View>
            ) : stage === 'complete' ? (
              <View style={styles.block}>
                <CheckCircle2 {...decorative} color={colors.positive} size={40} />
                <AppText tone="inverse" variant="heroTitle">
                  연습을 마쳤어요.
                </AppText>
                <AppText style={styles.inverseMuted} variant="body">
                  답변을 정리하고 있어요. 저장이 끝나면 바로 다음 화면으로 넘어가요.
                </AppText>
              </View>
            ) : (
              <View style={styles.block}>
                <AppText style={styles.inverseMuted} variant="badge">
                  {question?.kind === 'follow_up' ? '꼬리질문' : `질문 ${questionIndex + 1}`}
                </AppText>
                <AppText accessibilityRole="header" tone="inverse" variant="heroTitle">
                  {question?.text}
                </AppText>
                {question?.sourceQuote ? (
                  <AppText numberOfLines={2} style={styles.inverseMuted} variant="meta">
                    {`자소서: ${question.sourceQuote}`}
                  </AppText>
                ) : null}

                <View style={styles.clockRow}>
                  {thinking || answering ? (
                    <View style={[styles.clock, answering ? styles.clockLive : null, overtime ? styles.clockOver : null]}>
                      <AppText accessibilityLabel={thinking ? `생각 시간 ${Math.ceil(clockMs / 1000)}초 남음` : overtime ? `권장 시간 ${Math.floor(-clockMs / 1000)}초 초과` : `답변 시간 ${Math.ceil(clockMs / 1000)}초 남음`} tabular tone="inverse" variant="display">
                        {formatClock(clockMs)}
                      </AppText>
                      <AppText style={styles.inverseMuted} variant="meta">
                        {thinking ? '생각 시간' : overtime ? '권장 시간이 지났어요. 더 말해도 괜찮아요.' : ai ? '녹음 중' : '답변 중'}
                      </AppText>
                    </View>
                  ) : (
                    <AppText style={styles.inverseMuted} variant="body">
                      {phase === 'saving'
                        ? ai
                          ? '답변을 저장하고 있어요.'
                          : '답변 시간을 기록하고 있어요.'
                        : phase === 'next'
                          ? '다음 질문으로 넘어갈게요.'
                          : '질문을 확인해 주세요. 잠시 후 생각 시간이 시작돼요.'}
                    </AppText>
                  )}
                </View>

                {thinking ? (
                  <Button leftIcon={<Mic color={colors.textInverse} size={iconSizes.inline} />} onPress={startAnswer} size="large" variant="brand">
                    바로 답하기
                  </Button>
                ) : answering ? (
                  <Button leftIcon={<Square color={colors.text} size={iconSizes.inline} />} onPress={endAnswer} size="large" variant="secondary">
                    {finalAnswer ? '답변 마치고 끝내기' : '답변 마치기'}
                  </Button>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </View>

      <Dialog
        cancel={{ label: '계속 답하기', onPress: () => setLeaveOpen(false) }}
        confirm={{
          label: '나가기',
          onPress: () => {
            setLeaveOpen(false);
            void exitRoom();
          },
        }}
        description="지금 답변은 저장하지 않아요. 앞에서 저장한 답변은 그대로 남아요."
        onRequestClose={() => setLeaveOpen(false)}
        title="면접실에서 나갈까요?"
        visible={leaveOpen}
      />
    </Screen>
  );
}

function Notice({ title, description, actions }: { title: string; description?: string; actions: ReactNode }) {
  return (
    <Card style={styles.notice}>
      <View {...decorative} style={styles.noticeIcon}>
        <AlertTriangle color={colors.warningStrong} size={iconSizes.section} />
      </View>
      <AppText align="center" variant="heading">
        {title}
      </AppText>
      {description ? (
        <AppText align="center" tone="muted" variant="body">
          {description}
        </AppText>
      ) : null}
      <View style={styles.noticeActions}>{actions}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingTop: spacing.sm },
  inverseMuted: { color: colors.stageMuted },
  inverseLink: { color: colors.stageText },
  stage: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  stageInner: { gap: spacing.xl, maxWidth: 960, width: '100%' },
  stageRow: { alignItems: 'center', flexDirection: 'row' },
  preview: { alignSelf: 'center', maxWidth: 360, width: '100%' },
  previewWide: { flex: 1, maxWidth: 420 },
  questionColumn: { alignSelf: 'center', flex: 1, maxWidth: 680, minWidth: 0, width: '100%' },
  block: { gap: spacing.lg },
  clockRow: { minHeight: 96, justifyContent: 'center' },
  clock: {
    alignSelf: 'flex-start',
    backgroundColor: colors.stageRaised,
    borderColor: colors.stageBorder,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xxs,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  clockLive: { borderColor: colors.brand },
  clockOver: { borderColor: colors.warning },
  notice: { alignItems: 'center', alignSelf: 'center', gap: spacing.md, maxWidth: 440, width: '100%' },
  noticeIcon: { alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radii.full, height: 48, justifyContent: 'center', width: 48 },
  noticeActions: { alignSelf: 'stretch', gap: spacing.sm },
});
