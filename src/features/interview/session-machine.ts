/**
 * The interview session state machine, as pure functions.
 *
 * Ported from apps/interview/lib/interview/store.ts. On the web each of these
 * ran inside one IndexedDB readwrite transaction ("read the latest session,
 * change one thing, put it back"). Here the transaction is split in two: the
 * transform below decides, and `interview-storage.ts` runs it under a
 * per-session lock against the latest stored copy. Keeping the decision pure is
 * what lets the charge-free rules (never re-evaluate a corrected transcript
 * without the learner asking; a late answer from a superseded request cannot
 * overwrite the current state) be tested without a device.
 *
 * Every function returns `null` (or `changed: false`) when it must not write,
 * exactly where the web version finished its transaction without a `put`.
 */
import {
  getEffectiveTranscript,
  isInterviewTranscriptReadyForFeedback,
  isProcessingExpired,
} from './analysis';
import {
  canAutomaticallyRetry,
  isFreshAnswerEvaluation,
  needsAnswerEvaluation,
  RESULT_WAIT_LIMIT_MS,
  retryNotBefore,
} from './result-policy';
import { resultPreparationAttempts } from './result-preparation';
import { resolveSessionSource } from './session-source';
import type {
  InterviewAnalysisError,
  InterviewAnalysisUsage,
  InterviewAttempt,
  InterviewAttemptAnalysis,
  InterviewEvaluationResult,
  InterviewEvaluationState,
  InterviewFeedbackBasis,
  InterviewFeedbackSummary,
  InterviewSession,
  InterviewSessionFeedbackState,
  InterviewSessionStatus,
  InterviewTranscript,
  InterviewTranscriptionState,
} from './types';

export const ANALYSIS_PROCESSING_LEASE_MS = 5 * 60 * 1000;
export const PENDING_AUDIO_TTL_MS = 24 * 60 * 60 * 1000;
export const TRANSCRIPT_CORRECTION_MAX_LENGTH = 20_000;
export const REVIEW_NOTE_MAX_LENGTH = 500;

export class InterviewSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterviewSessionError';
  }
}

export function createSessionRecord(
  id: string,
  source: Pick<InterviewSession, 'companyId'> &
    Partial<Pick<InterviewSession, 'customSet' | 'capture' | 'feedbackMode'>>,
  now = new Date().toISOString(),
): InterviewSession {
  return {
    id,
    billingVersion: 1,
    companyId: source.companyId,
    ...(source.customSet ? { customSet: source.customSet } : {}),
    ...(source.capture ? { capture: source.capture } : {}),
    ...(source.feedbackMode ? { feedbackMode: source.feedbackMode } : {}),
    status: 'active',
    createdAt: now,
    currentQuestionIndex: 0,
    attempts: [],
  };
}

// ── answers ────────────────────────────────────────────────────

export function applySaveAttempt(
  current: InterviewSession,
  params: {
    attempt: InterviewAttempt;
    nextQuestionIndex: number;
    status: InterviewSessionStatus;
    preserveRetry?: boolean;
  },
  now = new Date().toISOString(),
): InterviewSession {
  const { attempt, nextQuestionIndex, status, preserveRetry = false } = params;
  const otherAttempts = current.attempts.filter((item) => item.id !== attempt.id);
  const latestAttemptNo = otherAttempts.reduce(
    (latest, item) =>
      item.questionId === attempt.questionId ? Math.max(latest, item.attemptNo) : latest,
    0,
  );
  const normalizedAttempt: InterviewAttempt = {
    ...attempt,
    // 여러 창에서 같은 세션을 열어도 저장 시점에 본 최신 회차 뒤에 붙인다.
    attemptNo: Math.max(attempt.attemptNo, latestAttemptNo + 1),
  };
  const normalizedStatus =
    current.status === 'completed' && status === 'active' ? 'completed' : status;
  const next: InterviewSession = {
    ...current,
    resultPreparation: undefined,
    attempts: [...otherAttempts, normalizedAttempt],
    currentQuestionIndex: Math.max(current.currentQuestionIndex, nextQuestionIndex),
    status: normalizedStatus,
    ...(normalizedStatus === 'completed' &&
    current.status !== 'completed' &&
    !current.completedAt &&
    !current.retryQuestionId
      ? { completedAt: now }
      : {}),
  };
  if (!preserveRetry && current.retryQuestionId === attempt.questionId) {
    delete next.retryQuestionId;
  }
  if (next.resultPreparation === undefined) delete next.resultPreparation;
  return next;
}

export function startQuestionRetry(current: InterviewSession, questionId: string): InterviewSession {
  if (!current.attempts.some((attempt) => attempt.questionId === questionId)) {
    throw new InterviewSessionError('다시 답변할 질문을 찾지 못했어요.');
  }
  const next: InterviewSession = { ...current, retryQuestionId: questionId };
  delete next.resultPreparation;
  return next;
}

export function cancelQuestionRetry(current: InterviewSession): InterviewSession {
  const next = { ...current };
  delete next.retryQuestionId;
  return next;
}

export function switchToBasicPractice(current: InterviewSession): InterviewSession {
  return { ...current, capture: 'off', feedbackMode: 'basic' };
}

export function saveTranscriptCorrection(
  current: InterviewSession,
  attemptId: string,
  corrected: string | null,
  now = new Date().toISOString(),
): InterviewSession {
  const attemptIndex = current.attempts.findIndex((attempt) => attempt.id === attemptId);
  const attempt = current.attempts[attemptIndex];
  const transcript = attempt?.analysis?.transcription.transcript;
  if (!attempt?.analysis || !transcript) {
    throw new InterviewSessionError('수정할 전사문을 찾지 못했어요.');
  }
  const normalized = corrected?.replace(/\r\n?/g, '\n') ?? null;
  if (normalized !== null && normalized.length > TRANSCRIPT_CORRECTION_MAX_LENGTH) {
    throw new InterviewSessionError('전사문은 20,000자까지 수정할 수 있어요.');
  }
  const nextCorrected =
    normalized === null || normalized === transcript.original ? undefined : normalized;
  if (nextCorrected === transcript.corrected) return current;

  const nextTranscript: InterviewTranscript = {
    ...transcript,
    revision: transcript.revision + 1,
    ...(nextCorrected === undefined ? {} : { corrected: nextCorrected }),
    correctedAt: now,
  };
  if (nextCorrected === undefined) delete nextTranscript.corrected;
  const attempts = [...current.attempts];
  attempts[attemptIndex] = {
    ...attempt,
    analysis: {
      ...attempt.analysis,
      transcription: { ...attempt.analysis.transcription, transcript: nextTranscript, updatedAt: now },
    },
  };
  return { ...current, attempts };
}

export function saveReviewNote(
  current: InterviewSession,
  questionId: string,
  note: string,
): InterviewSession {
  const normalizedNote = note.replace(/\r\n?/g, '\n');
  if (normalizedNote.length > REVIEW_NOTE_MAX_LENGTH) {
    throw new InterviewSessionError('복기 메모는 질문마다 500자까지 저장할 수 있어요.');
  }
  const reviewNotes = { ...current.reviewNotes };
  if (normalizedNote.trim().length === 0) delete reviewNotes[questionId];
  else reviewNotes[questionId] = normalizedNote;
  const next: InterviewSession = { ...current, reviewNotes };
  if (Object.keys(reviewNotes).length === 0) delete next.reviewNotes;
  return next;
}

// ── analysis queue ─────────────────────────────────────────────

/** 현재 세션에서 실제로 사용하는 질문에 해당하는 최신 답변만 반환한다. */
export function latestSourceAttemptsForAnalysis(session: InterviewSession): InterviewAttempt[] {
  const source = resolveSessionSource(session);
  if (!source) return [];
  const questionIds = new Set(source.questions.map((question) => question.id));
  return resultPreparationAttempts(session).filter((attempt) => questionIds.has(attempt.questionId));
}

export function readyFeedbackBasis(session: InterviewSession): InterviewFeedbackBasis[] {
  return latestSourceAttemptsForAnalysis(session)
    .filter(
      (attempt) =>
        attempt.analysis?.transcription.status === 'ready' &&
        attempt.analysis.transcription.transcript &&
        isInterviewTranscriptReadyForFeedback(attempt.analysis.transcription.transcript),
    )
    .map((attempt) => ({
      attemptId: attempt.id,
      transcriptRevision: attempt.analysis?.transcription.transcript?.revision ?? 0,
    }));
}

export function sameFeedbackBasis(
  left: InterviewFeedbackBasis[] | undefined,
  right: InterviewFeedbackBasis[],
): boolean {
  return Boolean(
    left &&
      left.length === right.length &&
      left.every(
        (item, index) =>
          item.attemptId === right[index]?.attemptId &&
          item.transcriptRevision === right[index]?.transcriptRevision,
      ),
  );
}

function deadline(queuedAt: string): string {
  return new Date(Date.parse(queuedAt) + RESULT_WAIT_LIMIT_MS).toISOString();
}

/** 준비 화면에서 사용자가 다시 시도한 전사들을 한 번에 대기 상태로 되돌린다. */
export function queueTranscriptions(
  current: InterviewSession,
  attemptIds: string[],
  queuedAt: string,
): { session: InterviewSession; queued: number } {
  const requested = new Set(attemptIds);
  let queued = 0;
  const attempts = current.attempts.map((attempt) => {
    const analysis = attempt.analysis;
    if (!requested.has(attempt.id) || !analysis?.audioKey || analysis.transcription.status !== 'failed') {
      return attempt;
    }
    queued += 1;
    const transcription: InterviewTranscriptionState = {
      ...analysis.transcription,
      status: 'queued',
      queuedAt,
      updatedAt: queuedAt,
    };
    delete transcription.processingStartedAt;
    delete transcription.error;
    delete transcription.retryNotBefore;
    delete transcription.claimId;
    return { ...attempt, analysis: { ...analysis, transcription } };
  });
  if (queued === 0) return { session: current, queued };
  return {
    queued,
    session: {
      ...current,
      attempts,
      resultPreparation: { startedAt: queuedAt, deadlineAt: deadline(queuedAt), attemptIds },
    },
  };
}

/** 대기 시간과 자동 재시도를 한 번에 기록한다. 새로고침과 다른 창도 이 예산을 함께 쓴다. */
export function advanceResultPreparation(
  current: InterviewSession,
  nowMs = Date.now(),
  offline = false,
): { session: InterviewSession; changed: boolean } {
  if (current.resultPreparation?.timedOut || current.feedbackMode !== 'ai') {
    return { session: current, changed: false };
  }
  const latest = latestSourceAttemptsForAnalysis(current);
  const ids = new Set(latest.map((attempt) => attempt.id));
  const pending = latest.some((attempt) => {
    const analysis = attempt.analysis;
    return Boolean(
      analysis &&
        (['queued', 'processing'].includes(analysis.transcription.status) ||
          (analysis.audioKey && canAutomaticallyRetry(analysis.transcription)) ||
          (analysis.transcription.status === 'ready' &&
            analysis.transcription.transcript &&
            isInterviewTranscriptReadyForFeedback(analysis.transcription.transcript) &&
            (['idle', 'queued', 'processing'].includes(analysis.evaluation.status) ||
              canAutomaticallyRetry(analysis.evaluation)))),
    );
  });
  let preparation = current.resultPreparation;
  let changed = false;
  const now = new Date(nowMs).toISOString();
  if (!preparation && pending && current.status === 'completed' && !current.retryQuestionId) {
    preparation = { startedAt: now, deadlineAt: new Date(nowMs + RESULT_WAIT_LIMIT_MS).toISOString() };
    changed = true;
  }
  const expired = Boolean(pending && preparation && Date.parse(preparation.deadlineAt) <= nowMs);
  const timeoutError: InterviewAnalysisError = {
    code: offline ? 'network' : 'timeout',
    message: offline ? '연결이 원활하지 않아 피드백을 준비하지 못했어요.' : '서비스 응답이 늦어지고 있어요.',
    retryable: true,
    occurredAt: now,
  };
  const attempts = current.attempts.map((attempt) => {
    if (!ids.has(attempt.id) || !attempt.analysis) return attempt;
    const analysis = attempt.analysis;
    let transcription = analysis.transcription;
    let evaluation = analysis.evaluation;
    if (expired) {
      if (
        ['queued', 'processing'].includes(transcription.status) ||
        (analysis.audioKey && canAutomaticallyRetry(transcription))
      ) {
        transcription = stripped({ ...transcription, status: 'failed', error: timeoutError, automaticRetryCount: 1, updatedAt: now }, ['claimId', 'processingStartedAt']);
      }
      if (
        transcription.status === 'ready' &&
        (['idle', 'queued', 'processing'].includes(evaluation.status) || canAutomaticallyRetry(evaluation))
      ) {
        evaluation = stripped({ ...evaluation, status: 'failed', error: timeoutError, automaticRetryCount: 1, updatedAt: now }, ['generationId', 'processingStartedAt']);
      }
    } else {
      if (analysis.audioKey && canAutomaticallyRetry(transcription)) {
        transcription = stripped(
          { ...transcription, status: 'queued', automaticRetryCount: 1, queuedAt: now, updatedAt: now, retryNotBefore: retryNotBefore(transcription.error, nowMs) },
          ['error', 'claimId', 'processingStartedAt'],
        );
      }
      if (transcription.status === 'ready' && canAutomaticallyRetry(evaluation)) {
        evaluation = stripped(
          { ...evaluation, status: 'queued', automaticRetryCount: 1, queuedAt: now, updatedAt: now, retryNotBefore: retryNotBefore(evaluation.error, nowMs) },
          ['error', 'generationId', 'processingStartedAt'],
        );
      }
    }
    if (transcription === analysis.transcription && evaluation === analysis.evaluation) return attempt;
    changed = true;
    return { ...attempt, analysis: { ...analysis, transcription, evaluation } };
  });
  let feedbackSummary = current.feedbackSummary;
  if (expired && preparation) {
    preparation = { ...preparation, timedOut: true };
    if (feedbackSummary && ['queued', 'processing'].includes(feedbackSummary.status)) {
      feedbackSummary = stripped(
        { ...feedbackSummary, status: 'failed' as const, error: timeoutError, updatedAt: now },
        ['generationId', 'processingStartedAt'],
      );
    }
    changed = true;
  }
  if (!changed) return { session: current, changed };
  const session: InterviewSession = { ...current, attempts, resultPreparation: preparation };
  if (feedbackSummary) session.feedbackSummary = feedbackSummary;
  return { session, changed };
}

function stripped<T extends object>(value: T, keys: string[]): T {
  const next = { ...value } as Record<string, unknown>;
  for (const key of keys) delete next[key];
  return next as T;
}

/** 다음 대기 중 전사를 선점한다. 같은 음성을 두 번 보내지 않는 유일한 문이다. */
export function claimNextTranscription(
  current: InterviewSession,
  claimId: string,
  startedAt: string,
): { session: InterviewSession; attempt: InterviewAttempt } | null {
  const source = resolveSessionSource(current);
  const questionIds = new Set(source?.questions.map((question) => question.id) ?? []);
  const latestIds = new Set(latestSourceAttemptsForAnalysis(current).map((attempt) => attempt.id));
  const startedMs = Date.parse(startedAt);
  const attemptIndex = current.attempts.findIndex(
    (attempt) =>
      !current.resultPreparation?.timedOut &&
      (!current.resultPreparation || Date.parse(current.resultPreparation.deadlineAt) > startedMs) &&
      questionIds.has(attempt.questionId) &&
      latestIds.has(attempt.id) &&
      attempt.analysis?.transcription.status === 'queued' &&
      (!attempt.analysis.transcription.retryNotBefore ||
        Date.parse(attempt.analysis.transcription.retryNotBefore) <= startedMs),
  );
  const attempt = current.attempts[attemptIndex];
  if (attemptIndex < 0 || !attempt?.analysis) return null;
  const nextAttempt: InterviewAttempt = {
    ...attempt,
    analysis: {
      ...attempt.analysis,
      transcription: stripped(
        {
          ...attempt.analysis.transcription,
          status: 'processing',
          attemptCount: attempt.analysis.transcription.attemptCount + 1,
          updatedAt: startedAt,
          processingStartedAt: startedAt,
          claimId,
        },
        ['error'],
      ),
    },
  };
  const attempts = [...current.attempts];
  attempts[attemptIndex] = nextAttempt;
  return { session: { ...current, attempts }, attempt: nextAttempt };
}

/**
 * 선점이 아직 유효할 때만 전사 결과를 저장한다. `removedAudioKey` 는 호출자가
 * 기기에서 지울 임시 음성이다(세션 기록과 함께 지워야 새지 않는다).
 */
export function commitTranscriptionClaim(
  current: InterviewSession,
  params: {
    attemptId: string;
    claimId: string;
    patch: Partial<InterviewTranscriptionState>;
    removePendingAudio?: boolean;
  },
): { session: InterviewSession; removedAudioKey: string | null } | null {
  const attemptIndex = current.attempts.findIndex((attempt) => attempt.id === params.attemptId);
  const attempt = current.attempts[attemptIndex];
  if (
    attemptIndex < 0 ||
    !attempt?.analysis ||
    attempt.analysis.transcription.status !== 'processing' ||
    attempt.analysis.transcription.claimId !== params.claimId
  ) {
    return null;
  }
  const previousAudioKey = attempt.analysis.audioKey;
  const transcription: InterviewTranscriptionState = { ...attempt.analysis.transcription, ...params.patch };
  delete transcription.claimId;
  for (const key of Object.keys(transcription) as (keyof InterviewTranscriptionState)[]) {
    if (transcription[key] === undefined) delete transcription[key];
  }
  const analysis: InterviewAttemptAnalysis = { ...attempt.analysis, transcription };
  if (params.removePendingAudio) analysis.audioKey = null;
  const attempts = [...current.attempts];
  attempts[attemptIndex] = { ...attempt, analysis };
  return {
    session: { ...current, attempts },
    removedAudioKey: params.removePendingAudio ? previousAudioKey : null,
  };
}

/**
 * 전체 평가를 선점하고 답변별 상태와 총평 상태를 같은 generation 으로 묶는다.
 * 호출 전에 읽은 전사 revision 이 달라졌다면 선점하지 않는다.
 */
export function claimEvaluation(
  current: InterviewSession,
  params: { generationId: string; expectedBasis: InterviewFeedbackBasis[]; startedAt: string },
): InterviewSession | null {
  const startedMs = Date.parse(params.startedAt);
  if (
    current.status !== 'completed' ||
    current.resultPreparation?.timedOut ||
    (current.resultPreparation && Date.parse(current.resultPreparation.deadlineAt) <= startedMs)
  ) {
    return null;
  }
  const latest = latestSourceAttemptsForAnalysis(current);
  if (
    latest.some((attempt) => {
      const status = attempt.analysis?.transcription.status;
      return status === 'queued' || status === 'processing';
    })
  ) {
    return null;
  }
  const basis = readyFeedbackBasis(current).filter((item) => {
    const attempt = latest.find((entry) => entry.id === item.attemptId);
    const state = attempt?.analysis?.evaluation;
    return Boolean(
      attempt && state && needsAnswerEvaluation(attempt) &&
        (!state.retryNotBefore || Date.parse(state.retryNotBefore) <= startedMs),
    );
  });
  if (basis.length === 0 || !sameFeedbackBasis(basis, params.expectedBasis)) return null;
  if (current.attempts.some((attempt) => attempt.analysis?.evaluation.status === 'processing')) return null;

  const basisIds = new Set(basis.map((item) => item.attemptId));
  const needsInitialEvaluation = latest.some(
    (attempt) => basisIds.has(attempt.id) && attempt.analysis?.evaluation.status === 'idle',
  );
  const explicitlyQueued =
    current.feedbackSummary?.status === 'queued' ||
    latest.some((attempt) => basisIds.has(attempt.id) && attempt.analysis?.evaluation.status === 'queued');
  // 전사 수정만으로는 다시 평가하지 않는다. 사용자가 다시 받기를 눌렀을 때만 queued 다.
  if (!needsInitialEvaluation && !explicitlyQueued) return null;

  const attempts = current.attempts.map((attempt) => {
    if (!basisIds.has(attempt.id) || !attempt.analysis) return attempt;
    const basisItem = basis.find((item) => item.attemptId === attempt.id);
    return {
      ...attempt,
      analysis: {
        ...attempt.analysis,
        evaluation: stripped(
          {
            ...attempt.analysis.evaluation,
            status: 'processing' as const,
            attemptCount: attempt.analysis.evaluation.attemptCount + 1,
            updatedAt: params.startedAt,
            processingStartedAt: params.startedAt,
            generationId: params.generationId,
            transcriptRevision: basisItem?.transcriptRevision,
          },
          ['error'],
        ),
      },
    };
  });
  const feedbackSummary: InterviewSessionFeedbackState = stripped(
    {
      schemaVersion: 1 as const,
      ...current.feedbackSummary,
      status: 'processing' as const,
      attemptCount: (current.feedbackSummary?.attemptCount ?? 0) + 1,
      updatedAt: params.startedAt,
      processingStartedAt: params.startedAt,
      generationId: params.generationId,
      basis,
    },
    ['error'],
  );
  return { ...current, attempts, feedbackSummary };
}

function isCurrentEvaluationGeneration(
  session: InterviewSession,
  generationId: string,
  basis: InterviewFeedbackBasis[],
): boolean {
  if (
    session.feedbackSummary?.status !== 'processing' ||
    session.feedbackSummary.generationId !== generationId ||
    !sameFeedbackBasis(session.feedbackSummary.basis, basis)
  ) {
    return false;
  }
  return basis.every((basisItem) => {
    const attempt = session.attempts.find((item) => item.id === basisItem.attemptId);
    return (
      attempt?.analysis?.evaluation.status === 'processing' &&
      attempt.analysis.evaluation.generationId === generationId &&
      attempt.analysis.transcription.transcript?.revision === basisItem.transcriptRevision
    );
  });
}

/** 최신 generation 일 때만 답변별 피드백과 총평을 함께 저장한다. */
export function commitEvaluationSuccess(
  current: InterviewSession,
  params: {
    generationId: string;
    basis: InterviewFeedbackBasis[];
    answers: InterviewEvaluationResult[];
    summary: InterviewFeedbackSummary | null;
    model: string;
    usage: InterviewAnalysisUsage;
    completedAt: string;
  },
): InterviewSession | null {
  if (!isCurrentEvaluationGeneration(current, params.generationId, params.basis)) return null;
  if (params.answers.some((item) => !params.basis.some((basis) => basis.attemptId === item.attemptId))) return null;
  const answerByAttempt = new Map(params.answers.map((answer) => [answer.attemptId, answer]));
  const basisByAttempt = new Map(params.basis.map((item) => [item.attemptId, item]));
  const attempts = current.attempts.map((attempt) => {
    const basisItem = basisByAttempt.get(attempt.id);
    const result = answerByAttempt.get(attempt.id);
    if (!basisItem || !attempt.analysis) return attempt;
    const evaluation: InterviewEvaluationState = stripped(
      {
        ...attempt.analysis.evaluation,
        status: result ? ('ready' as const) : ('failed' as const),
        updatedAt: params.completedAt,
        completedAt: params.completedAt,
        transcriptRevision: basisItem.transcriptRevision,
        ...(result ? { result } : {}),
        ...(result
          ? {}
          : {
              error: {
                code: 'invalid_response' as const,
                message: '서비스에 잠시 문제가 생겼어요.',
                retryable: true,
                occurredAt: params.completedAt,
              },
            }),
      },
      ['processingStartedAt', 'generationId', ...(result ? ['error'] : ['result'])],
    );
    return { ...attempt, analysis: { ...attempt.analysis, evaluation } };
  });
  const feedbackSummary: InterviewSessionFeedbackState = stripped(
    {
      ...current.feedbackSummary!,
      status:
        params.summary && sameFeedbackBasis(readyFeedbackBasis(current), params.basis)
          ? ('ready' as const)
          : ('unavailable' as const),
      updatedAt: params.completedAt,
      completedAt: params.completedAt,
      basis: params.basis,
      model: params.model,
      ...(params.summary ? { result: params.summary } : {}),
      usage: params.usage,
    },
    ['processingStartedAt', 'generationId', 'error', ...(params.summary ? [] : ['result'])],
  );
  return { ...current, attempts, feedbackSummary };
}

/** 최신 generation 일 때만 평가 실패를 기록한다. */
export function commitEvaluationFailure(
  current: InterviewSession,
  params: { generationId: string; basis: InterviewFeedbackBasis[]; error: InterviewAnalysisError; failedAt: string },
): InterviewSession | null {
  if (!isCurrentEvaluationGeneration(current, params.generationId, params.basis)) return null;
  const basisIds = new Set(params.basis.map((item) => item.attemptId));
  const attempts = current.attempts.map((attempt) => {
    if (!basisIds.has(attempt.id) || !attempt.analysis) return attempt;
    const evaluation: InterviewEvaluationState = stripped(
      { ...attempt.analysis.evaluation, status: 'failed' as const, updatedAt: params.failedAt, error: params.error },
      ['processingStartedAt', 'generationId'],
    );
    return { ...attempt, analysis: { ...attempt.analysis, evaluation } };
  });
  const feedbackSummary: InterviewSessionFeedbackState = stripped(
    { ...current.feedbackSummary!, status: 'failed' as const, updatedAt: params.failedAt, error: params.error },
    ['processingStartedAt', 'generationId'],
  );
  return { ...current, attempts, feedbackSummary };
}

/** 사용자가 누른 다시 받기를 새 generation 으로 등록한다. 진행 중이면 덮지 않는다. */
export function queueEvaluation(
  current: InterviewSession,
  params: { generationId: string; queuedAt: string; attemptId?: string },
): InterviewSession | null {
  if (
    resultPreparationAttempts(current).some((attempt) => {
      const status = attempt.analysis?.evaluation.status;
      return status === 'queued' || status === 'processing';
    })
  ) {
    return null;
  }
  const requestedSession: InterviewSession = params.attemptId
    ? {
        ...current,
        resultPreparation: { startedAt: params.queuedAt, deadlineAt: deadline(params.queuedAt), attemptIds: [params.attemptId] },
      }
    : current;
  const basis = readyFeedbackBasis(requestedSession).filter((item) => {
    const attempt = current.attempts.find((entry) => entry.id === item.attemptId);
    return Boolean(attempt) && (!params.attemptId || item.attemptId === params.attemptId) && !isFreshAnswerEvaluation(attempt!);
  });
  if (basis.length === 0) return null;
  const basisIds = new Set(basis.map((item) => item.attemptId));
  const attempts = current.attempts.map((attempt) => {
    if (!basisIds.has(attempt.id) || !attempt.analysis) return attempt;
    const evaluation: InterviewEvaluationState = stripped(
      {
        ...attempt.analysis.evaluation,
        status: 'queued' as const,
        queuedAt: params.queuedAt,
        updatedAt: params.queuedAt,
        generationId: params.generationId,
      },
      ['processingStartedAt', 'error', 'retryNotBefore'],
    );
    return { ...attempt, analysis: { ...attempt.analysis, evaluation } };
  });
  const feedbackSummary: InterviewSessionFeedbackState = stripped(
    {
      schemaVersion: 1 as const,
      ...current.feedbackSummary,
      status: 'queued' as const,
      attemptCount: current.feedbackSummary?.attemptCount ?? 0,
      updatedAt: params.queuedAt,
      queuedAt: params.queuedAt,
      generationId: params.generationId,
      basis,
    },
    ['error'],
  );
  return {
    ...current,
    attempts,
    feedbackSummary,
    resultPreparation: {
      startedAt: params.queuedAt,
      deadlineAt: deadline(params.queuedAt),
      attemptIds: basis.map((item) => item.attemptId),
    },
  };
}

function requeueExpiredState<
  T extends InterviewTranscriptionState | InterviewEvaluationState | InterviewSessionFeedbackState,
>(state: T, now: string): T {
  return stripped(
    {
      ...state,
      status: 'failed' as const,
      error: { code: 'timeout' as const, message: '서비스 응답이 늦어지고 있어요.', retryable: true, occurredAt: now },
      queuedAt: now,
      updatedAt: now,
    },
    ['processingStartedAt', 'claimId', 'generationId'],
  );
}

/** 앱 종료 등으로 processing 에 멈춘 작업을 실패로 바꿔 자동 재시도 규칙에 맡긴다. */
export function recoverExpiredJobs(
  session: InterviewSession,
  nowMs = Date.now(),
  staleAfterMs = ANALYSIS_PROCESSING_LEASE_MS,
): { session: InterviewSession; recovered: number } {
  if (session.resultPreparation?.timedOut) return { session, recovered: 0 };
  const now = new Date(nowMs).toISOString();
  let recovered = 0;
  const attempts = session.attempts.map((attempt) => {
    const analysis = attempt.analysis;
    if (!analysis) return attempt;
    let transcription = analysis.transcription;
    let evaluation = analysis.evaluation;
    if (isProcessingExpired(transcription, nowMs, staleAfterMs)) {
      transcription = requeueExpiredState(transcription, now);
      recovered += 1;
    }
    if (isProcessingExpired(evaluation, nowMs, staleAfterMs)) {
      evaluation = requeueExpiredState(evaluation, now);
      recovered += 1;
    }
    return transcription === analysis.transcription && evaluation === analysis.evaluation
      ? attempt
      : { ...attempt, analysis: { ...analysis, transcription, evaluation } };
  });
  let feedbackSummary = session.feedbackSummary;
  if (feedbackSummary && isProcessingExpired(feedbackSummary, nowMs, staleAfterMs)) {
    feedbackSummary = requeueExpiredState(feedbackSummary, now);
    recovered += 1;
  }
  if (recovered === 0) return { session, recovered };
  const next: InterviewSession = { ...session, attempts };
  if (feedbackSummary) next.feedbackSummary = feedbackSummary;
  return { session: next, recovered };
}

/** 보관 시간이 지난 임시 음성을 가리키는 답변을 실패로 닫는다. */
export function expirePendingAudio(
  session: InterviewSession,
  expiredKeys: ReadonlySet<string>,
  now = new Date().toISOString(),
): { session: InterviewSession; changed: boolean } {
  let changed = false;
  const attempts = session.attempts.map((attempt) => {
    const analysis = attempt.analysis;
    if (!analysis?.audioKey || !expiredKeys.has(analysis.audioKey)) return attempt;
    changed = true;
    if (analysis.transcription.status === 'ready') {
      return { ...attempt, analysis: { ...analysis, audioKey: null } };
    }
    const transcription: InterviewTranscriptionState = stripped(
      {
        ...analysis.transcription,
        status: 'failed' as const,
        updatedAt: now,
        error: {
          code: 'expired' as const,
          message: '임시 음성의 보관 시간이 지나 전사할 수 없어요.',
          retryable: false,
          occurredAt: now,
        },
      },
      ['processingStartedAt'],
    );
    return { ...attempt, analysis: { ...analysis, audioKey: null, transcription } };
  });
  return changed ? { session: { ...session, attempts }, changed } : { session, changed };
}

/** 서버 백업으로 보낼 글만 남긴 사본. 영상과 임시 음성 키는 비운다(서버가 거절한다). */
export function textOnly(session: InterviewSession): InterviewSession {
  return {
    ...session,
    attempts: session.attempts.map((attempt) => ({
      ...attempt,
      mediaKey: null,
      analysis: attempt.analysis ? { ...attempt.analysis, audioKey: null } : attempt.analysis,
    })),
  };
}

/** 리포트의 인용 하이라이트에 쓰는 전사문. */
export function effectiveTranscriptOf(attempt: InterviewAttempt | undefined): string {
  const transcript = attempt?.analysis?.transcription.transcript;
  return transcript ? getEffectiveTranscript(transcript) : '';
}
