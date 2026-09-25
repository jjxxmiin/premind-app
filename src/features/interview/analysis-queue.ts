/**
 * The AI feedback queue for one practice: transcribe each answer, then
 * evaluate the whole practice once. Ported from
 * apps/interview/lib/interview/analysis-queue.ts.
 *
 * Semantics kept from the web:
 * - Each answer is transcribed on its own as soon as it is saved, so the next
 *   question never waits for the network.
 * - The evaluation is one request for every ready answer, sent only after no
 *   transcription is queued or running.
 * - A recoverable failure is retried once automatically (after at least 3s,
 *   or the server's Retry-After); the result wait is capped at 2 minutes.
 * - A corrected transcript marks its feedback stale; nothing is re-sent until
 *   the learner asks for new feedback.
 * - Every server call carries `x-premind-operation: practice:<sessionId>` so the
 *   server charges it to this practice's reservation.
 *
 * On the web the queue also coordinated browser tabs; the app is one process,
 * so an in-memory "running" flag per session plays that part.
 */
import {
  classifyInterviewTranscript,
  getEffectiveTranscript,
  isInterviewTranscriptReadyForFeedback,
  meetsMinimumFeedbackRecordingDuration,
  shouldDiscardPendingAudioAfterTranscriptionFailure,
} from './analysis';
import {
  normalizeEvaluationRequest,
  validatePartialEvaluationOutput,
  type EvaluationRequest,
} from './evaluation';
import {
  ANALYSIS_REQUEST_TIMEOUT_MS,
  appendAudio,
  interviewRequest,
  InterviewApiError,
} from './interview-api';
import { interviewMedia } from './interview-media';
import { getSession, mutateSession, newId, subscribeInterviewSessions } from './interview-storage';
import { needsAnswerEvaluation } from './result-policy';
import { resultPreparationAttempts } from './result-preparation';
import {
  ANALYSIS_PROCESSING_LEASE_MS,
  advanceResultPreparation,
  claimEvaluation,
  claimNextTranscription,
  commitEvaluationFailure,
  commitEvaluationSuccess,
  commitTranscriptionClaim,
  expirePendingAudio,
  queueEvaluation,
  queueTranscriptions,
  recoverExpiredJobs,
} from './session-machine';
import { resolveSessionSource } from './session-source';
import { TRANSCRIPTION_LIMITS } from './transcription-limits';
import type {
  InterviewAnalysisError,
  InterviewAnalysisErrorCode,
  InterviewAnalysisUsage,
  InterviewAttempt,
  InterviewFeedbackBasis,
  InterviewSession,
  InterviewTranscriptionState,
} from './types';

class AnalysisRequestError extends Error {
  constructor(
    readonly code: InterviewAnalysisErrorCode,
    message: string,
    readonly retryable: boolean,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AnalysisRequestError';
  }
}

/** Maps the server's `{error}` code to the stored, user-safe error contract. */
export function analysisErrorFromApi(error: InterviewApiError): AnalysisRequestError {
  const code = error.errorCode;
  const status = error.status ?? 0;
  const message = error.message && error.message.length <= 200 ? error.message : 'AI 피드백을 준비하지 못했어요.';
  const make = (value: InterviewAnalysisErrorCode, retryable: boolean) =>
    new AnalysisRequestError(value, message, retryable, error.retryAfterMs);
  if (code === 'daily_limit') return make('daily_limit', false);
  if (code === 'duration_limit') return make('duration_limit', false);
  if (code === 'answer_too_short') return make('answer_too_short', false);
  if (code === 'capacity_limited') return make('capacity_limited', true);
  if (code === 'upstream_rate_limited') return make('upstream_rate_limited', true);
  if (status === 429 || code === 'rate_limited') return make('rate_limited', true);
  if (code === 'service_unavailable') return make('service_unavailable', false);
  if (code === 'upstream_auth') return make('upstream_auth', false);
  if (code === 'upstream_rejected') return make('upstream_rejected', false);
  if (status === 413 || code === 'payload_too_large') return make('payload_too_large', false);
  if (status === 415 || code === 'unsupported_format' || code === 'unsupported_media_type') return make('unsupported_format', false);
  if (status === 408 || status === 504 || code === 'timeout') return make('timeout', true);
  if (code === 'invalid_response' || code === 'invalid_model_output') return make('invalid_response', true);
  if (code === 'network') return make('network', true);
  if (status === 402) return make('service_unavailable', false);
  if (status >= 500) return make('upstream', true);
  return make('invalid_response', false);
}

function toStoredError(reason: unknown): InterviewAnalysisError {
  const error =
    reason instanceof AnalysisRequestError
      ? reason
      : reason instanceof InterviewApiError
        ? analysisErrorFromApi(reason)
        : null;
  if (error) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
      occurredAt: new Date().toISOString(),
    };
  }
  return { code: 'unknown', message: 'AI 피드백을 준비하지 못했어요.', retryable: true, occurredAt: new Date().toISOString() };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readUsage(value: unknown): InterviewAnalysisUsage | null {
  const record = asRecord(value);
  if (!record || typeof record.model !== 'string' || typeof record.recordedAt !== 'string') return null;
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens', 'thinkingTokens', 'audioDurationMs']) {
    const count = record[key];
    if (count !== undefined && (!Number.isSafeInteger(count) || (count as number) < 0)) return null;
  }
  return record as InterviewAnalysisUsage;
}

/** `{transcript, model, usage}`; the model name is recorded, not pinned. */
export function parseTranscriptionResponse(value: unknown): { transcript: string; usage: InterviewAnalysisUsage | null } {
  const record = asRecord(value);
  if (!record || typeof record.transcript !== 'string' || record.transcript.length > 40_000) {
    throw new AnalysisRequestError('invalid_response', '전사 결과를 확인하지 못했어요.', true);
  }
  return { transcript: record.transcript, usage: readUsage(record.usage) };
}

export function parseEvaluationResponse(value: unknown, request: EvaluationRequest) {
  const record = asRecord(value);
  if (!record) throw new AnalysisRequestError('invalid_response', '피드백 결과를 확인하지 못했어요.', true);
  try {
    // The same strict validator the web runs: ids 1:1, quotes present in the
    // transcript, and no score, pass/fail, personality or delivery judgement.
    const validated = validatePartialEvaluationOutput({ answers: record.answers, overall: record.overall }, request);
    const usage = readUsage(record.usage) ?? {
      provider: 'google' as const,
      model: typeof record.model === 'string' ? record.model : 'unknown',
      recordedAt: new Date().toISOString(),
    };
    return { ...validated, model: typeof record.model === 'string' ? record.model : usage.model, usage };
  } catch {
    throw new AnalysisRequestError('invalid_response', '피드백 결과를 확인하지 못했어요.', true);
  }
}

// ── network seams (tests replace these) ─────────────────────────

export interface AnalysisTransport {
  transcribe(sessionId: string, form: FormData): Promise<unknown>;
  evaluate(sessionId: string, request: EvaluationRequest): Promise<unknown>;
  online(): boolean;
}

const defaultTransport: AnalysisTransport = {
  transcribe: (sessionId, form) =>
    interviewRequest('/transcribe', { form, operation: `practice:${sessionId}`, timeoutMs: ANALYSIS_REQUEST_TIMEOUT_MS }),
  evaluate: (sessionId, request) =>
    interviewRequest('/evaluate', { json: request, operation: `practice:${sessionId}`, timeoutMs: ANALYSIS_REQUEST_TIMEOUT_MS }),
  online: () => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine !== false : true),
};

let transport: AnalysisTransport = defaultTransport;

export function setAnalysisTransport(next: AnalysisTransport | null): void {
  transport = next ?? defaultTransport;
}

// ── queue ──────────────────────────────────────────────────────

function buildVocabulary(session: InterviewSession): string[] {
  const guided = session.customSet?.guided;
  const terms = [guided?.company, guided?.jobRole]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
  return [...new Set(terms)].slice(0, 20);
}

async function commitClaim(
  sessionId: string,
  attemptId: string,
  claimId: string,
  patch: Partial<InterviewTranscriptionState>,
  removePendingAudio: boolean,
): Promise<void> {
  const outcome = await mutateSession<string | null>(sessionId, (current) => {
    const committed = commitTranscriptionClaim(current, { attemptId, claimId, patch, removePendingAudio });
    return committed ? { session: committed.session, result: committed.removedAudioKey } : null;
  });
  if (outcome.result) await interviewMedia.deletePendingAudio(outcome.result).catch(() => undefined);
}

function failure(code: InterviewAnalysisErrorCode, message: string, attemptCount: number, now: string, completed = false): Partial<InterviewTranscriptionState> {
  return {
    status: 'failed',
    attemptCount,
    updatedAt: now,
    ...(completed ? { completedAt: now } : {}),
    processingStartedAt: undefined,
    error: { code, message, retryable: false, occurredAt: now },
  };
}

async function transcribeAttempt(session: InterviewSession, attempt: InterviewAttempt, claimId: string): Promise<void> {
  const analysis = attempt.analysis;
  if (!analysis || analysis.transcription.status !== 'processing' || analysis.transcription.claimId !== claimId) return;
  const attemptCount = analysis.transcription.attemptCount;
  const now = () => new Date().toISOString();

  if (!meetsMinimumFeedbackRecordingDuration(attempt.durationMs)) {
    await commitClaim(session.id, attempt.id, claimId, failure('answer_too_short', '답변 시간이 너무 짧아 내용을 확인하기 어려워요. 다음에는 핵심 경험과 결과를 조금 더 말해 보세요.', attemptCount, now(), true), true);
    return;
  }
  if (!analysis.audioKey) {
    await commitClaim(session.id, attempt.id, claimId, failure('no_audio', '전사할 답변 음성을 찾지 못했어요.', attemptCount, now()), true);
    return;
  }
  const pending = await interviewMedia.getPendingAudio(analysis.audioKey).catch(() => null);
  if (!pending) {
    await commitClaim(session.id, attempt.id, claimId, failure('no_audio', '임시 답변 음성을 찾지 못했어요. 이 질문을 다시 답해 주세요.', attemptCount, now()), true);
    return;
  }
  if (!Number.isFinite(attempt.durationMs) || attempt.durationMs > TRANSCRIPTION_LIMITS.durationMs) {
    await commitClaim(session.id, attempt.id, claimId, failure('duration_limit', '5분을 넘은 답변은 전사할 수 없어요. 이 질문을 다시 답변해 주세요.', attemptCount, now()), true);
    return;
  }
  if (pending.size > TRANSCRIPTION_LIMITS.audioBytes) {
    await commitClaim(session.id, attempt.id, claimId, failure('payload_too_large', '답변 음성의 크기가 너무 커서 전사할 수 없어요. 이 질문을 다시 답변해 주세요.', attemptCount, now()), true);
    return;
  }

  try {
    const form = new FormData();
    appendAudio(form, pending.part);
    form.append('durationMs', String(Math.max(250, attempt.durationMs)));
    const vocabulary = buildVocabulary(session);
    if (vocabulary.length > 0) form.append('customVocabulary', JSON.stringify(vocabulary));
    const result = parseTranscriptionResponse(await transport.transcribe(session.id, form));
    const completedAt = now();
    const readiness = classifyInterviewTranscript(result.transcript);
    const transcript = { original: result.transcript, revision: 0, language: 'ko-KR', createdAt: completedAt };
    if (readiness !== 'ready') {
      await commitClaim(session.id, attempt.id, claimId, {
        ...failure(
          readiness,
          readiness === 'no_speech'
            ? '말한 내용이 들리지 않았어요. 다음에는 마이크를 가까이 두고 또렷하게 답해 보세요.'
            : '답변이 너무 짧아 내용을 확인하기 어려워요. 다음에는 핵심 경험과 결과를 조금 더 말해 보세요.',
          attemptCount,
          completedAt,
          true,
        ),
        transcript,
        ...(result.usage ? { usage: result.usage } : {}),
      }, true);
      return;
    }
    await commitClaim(session.id, attempt.id, claimId, {
      status: 'ready',
      attemptCount,
      updatedAt: completedAt,
      completedAt,
      processingStartedAt: undefined,
      error: undefined,
      transcript,
      ...(result.usage ? { usage: result.usage } : {}),
    }, true);
  } catch (reason) {
    const error = toStoredError(reason);
    await commitClaim(session.id, attempt.id, claimId, {
      status: 'failed',
      attemptCount,
      updatedAt: now(),
      processingStartedAt: undefined,
      error,
    }, shouldDiscardPendingAudioAfterTranscriptionFailure(error.code));
  }
}

/** The evaluation request for every answer that is ready and still owed feedback. */
export function evaluationRequestForSession(
  session: InterviewSession,
  nowMs = Date.now(),
): { request: EvaluationRequest; basis: InterviewFeedbackBasis[]; attempts: InterviewAttempt[] } | null {
  const source = resolveSessionSource(session);
  if (!source) return null;
  const questionById = new Map(source.questions.map((question) => [question.id, question]));
  const attempts = resultPreparationAttempts(session).filter((attempt) => {
    const transcription = attempt.analysis?.transcription;
    const retryAt = attempt.analysis?.evaluation.retryNotBefore;
    return Boolean(
      questionById.has(attempt.questionId) &&
        needsAnswerEvaluation(attempt) &&
        (!retryAt || Date.parse(retryAt) <= nowMs) &&
        transcription?.status === 'ready' &&
        transcription.transcript &&
        isInterviewTranscriptReadyForFeedback(transcription.transcript),
    );
  });
  if (attempts.length === 0) return null;
  const guided = session.customSet?.guided;
  const request = normalizeEvaluationRequest({
    company: guided?.company ?? (source.kind === 'company' ? source.title : ''),
    jobRole: guided?.jobRole ?? '',
    items: attempts.map((attempt) => {
      const question = questionById.get(attempt.questionId)!;
      return {
        attemptId: attempt.id,
        questionId: attempt.questionId,
        question: question.text,
        transcript: getEffectiveTranscript(attempt.analysis!.transcription.transcript!),
        durationMs: Math.min(300_000, Math.max(0, Math.round(attempt.durationMs))),
        kind: question.kind ?? null,
        parentQuestionId: question.parentQuestionId ?? null,
        sourceQuote: question.sourceQuote ?? null,
      };
    }),
  });
  const basis = attempts.map((attempt) => ({
    attemptId: attempt.id,
    transcriptRevision: attempt.analysis?.transcription.transcript?.revision ?? 0,
  }));
  return { request, basis, attempts };
}

async function evaluateSession(session: InterviewSession): Promise<boolean> {
  if (session.status !== 'completed') return false;
  const source = resolveSessionSource(session);
  if (!source) return false;
  const questionIds = new Set(source.questions.map((question) => question.id));
  const latest = resultPreparationAttempts(session).filter((attempt) => questionIds.has(attempt.questionId));
  if (latest.some((attempt) => ['queued', 'processing'].includes(attempt.analysis?.transcription.status ?? ''))) return false;

  let input: ReturnType<typeof evaluationRequestForSession>;
  try {
    input = evaluationRequestForSession(session);
  } catch {
    return false;
  }
  if (!input) return false;
  const { request, attempts, basis } = input;
  const needsInitial = attempts.some((attempt) => attempt.analysis?.evaluation.status === 'idle');
  const explicitlyQueued =
    session.feedbackSummary?.status === 'queued' ||
    attempts.some((attempt) => attempt.analysis?.evaluation.status === 'queued');
  // 전사 수정은 사용자가 다시 받기를 고를 때까지 자동으로 다시 보내지 않는다.
  if (!needsInitial && !explicitlyQueued) return false;

  const generationId = newId();
  const claimed = await mutateSession(session.id, (current) => {
    const next = claimEvaluation(current, { generationId, expectedBasis: basis, startedAt: new Date().toISOString() });
    return next ? { session: next } : null;
  });
  if (!claimed.changed) return false;

  try {
    const result = parseEvaluationResponse(await transport.evaluate(session.id, request), request);
    const completedAt = new Date().toISOString();
    await mutateSession(session.id, (current) => {
      const next = commitEvaluationSuccess(current, {
        generationId,
        basis,
        answers: result.answers,
        summary: result.overall,
        model: result.model,
        usage: result.usage,
        completedAt,
      });
      return next ? { session: next } : null;
    });
  } catch (reason) {
    const error = toStoredError(reason);
    await mutateSession(session.id, (current) => {
      const next = commitEvaluationFailure(current, { generationId, basis, error, failedAt: new Date().toISOString() });
      return next ? { session: next } : null;
    });
  }
  return true;
}

/** 준비 화면과 큐가 함께 부른다. 통신 중에도 마감 시간을 적용한다. */
export async function refreshResultPreparation(sessionId: string): Promise<InterviewSession | null> {
  const outcome = await mutateSession(sessionId, (current) => {
    const advanced = advanceResultPreparation(current, Date.now(), !transport.online());
    return advanced.changed ? { session: advanced.session } : null;
  });
  return outcome.session;
}

async function cleanup(sessionId: string): Promise<void> {
  const expired = new Set(await interviewMedia.expiredPendingAudio(Date.now()).catch(() => [] as string[]));
  await mutateSession(sessionId, (current) => {
    let next = recoverExpiredJobs(current).session;
    if (expired.size) next = expirePendingAudio(next, expired).session;
    return next === current ? null : { session: next };
  });
  for (const key of expired) await interviewMedia.deletePendingAudio(key).catch(() => undefined);
}

async function processSessionQueue(sessionId: string): Promise<void> {
  await cleanup(sessionId).catch(() => undefined);
  for (let guard = 0; guard < 100; guard += 1) {
    const session = await refreshResultPreparation(sessionId);
    if (!session || session.resultPreparation?.timedOut || !transport.online()) return;
    // 기본 연습으로 바꿔도 이미 남긴 답변의 전사와 피드백은 끝까지 처리한다.
    if (session.feedbackMode !== 'ai' && !session.attempts.some((attempt) => attempt.analysis)) return;
    const claimId = newId();
    const claimed = await mutateSession<InterviewAttempt>(sessionId, (current) => {
      const next = claimNextTranscription(current, claimId, new Date().toISOString());
      return next ? { session: next.session, result: next.attempt } : null;
    });
    if (claimed.changed && claimed.session && claimed.result) {
      await transcribeAttempt(claimed.session, claimed.result, claimId);
      continue;
    }
    if (await evaluateSession(session)) continue;
    return;
  }
}

const running = new Map<string, Promise<void>>();
const rerun = new Set<string>();
const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function nextWake(session: InterviewSession): number | null {
  const times: number[] = [];
  const add = (state: { status: string; processingStartedAt?: string; retryNotBefore?: string }) => {
    if (state.status === 'queued' && state.retryNotBefore) times.push(Date.parse(state.retryNotBefore));
    if (state.status !== 'processing') return;
    const started = state.processingStartedAt ? Date.parse(state.processingStartedAt) : Number.NaN;
    times.push(Number.isFinite(started) ? started + ANALYSIS_PROCESSING_LEASE_MS : Date.now());
  };
  for (const attempt of session.attempts) {
    if (!attempt.analysis) continue;
    add(attempt.analysis.transcription);
    add(attempt.analysis.evaluation);
  }
  if (session.feedbackSummary) add(session.feedbackSummary);
  return times.length ? Math.min(...times) : null;
}

async function scheduleWake(sessionId: string): Promise<void> {
  const previous = wakeTimers.get(sessionId);
  if (previous) clearTimeout(previous);
  wakeTimers.delete(sessionId);
  const session = await getSession(sessionId).catch(() => null);
  if (!session || session.resultPreparation?.timedOut || !transport.online()) return;
  const at = nextWake(session);
  if (at === null) return;
  const timer = setTimeout(() => {
    wakeTimers.delete(sessionId);
    void startInterviewAnalysis(sessionId);
  }, Math.max(1_000, at - Date.now() + 100));
  wakeTimers.set(sessionId, timer);
}

/** 답변 저장 직후와 결과 화면 진입 때 부르는, 기다리지 않아도 되는 입구. */
export function startInterviewAnalysis(sessionId: string): Promise<void> {
  const timer = wakeTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    wakeTimers.delete(sessionId);
  }
  const current = running.get(sessionId);
  if (current) {
    rerun.add(sessionId);
    return current;
  }
  const next = (async () => {
    do {
      rerun.delete(sessionId);
      await processSessionQueue(sessionId);
    } while (rerun.has(sessionId));
  })()
    .catch(() => undefined)
    .finally(() => {
      running.delete(sessionId);
      if (rerun.delete(sessionId)) {
        void startInterviewAnalysis(sessionId);
        return;
      }
      void scheduleWake(sessionId);
    });
  running.set(sessionId, next);
  return next;
}

/** 여러 답변의 전사 재시도를 한 번에 등록한 뒤 큐를 한 번만 깨운다. */
export async function retryInterviewTranscriptions(sessionId: string, attemptIds: string[]): Promise<void> {
  const queuedAt = new Date().toISOString();
  const outcome = await mutateSession(sessionId, (current) => {
    const next = queueTranscriptions(current, attemptIds, queuedAt);
    return next.queued ? { session: next.session } : null;
  });
  if (outcome.changed) void startInterviewAnalysis(sessionId);
}

/** 전사 수정이나 평가 실패 뒤 사용자가 고르는 다시 받기. */
export async function retryInterviewEvaluation(sessionId: string, attemptId?: string): Promise<boolean> {
  const queuedAt = new Date().toISOString();
  const outcome = await mutateSession(sessionId, (current) => {
    const next = queueEvaluation(current, { generationId: newId(), queuedAt, attemptId });
    return next ? { session: next } : null;
  });
  if (outcome.changed) void startInterviewAnalysis(sessionId);
  return outcome.changed;
}

/** Drops pending wake-ups (sign-out, tests). Running work finishes on its own. */
export function resetAnalysisQueue(): void {
  for (const timer of wakeTimers.values()) clearTimeout(timer);
  wakeTimers.clear();
  rerun.clear();
}

export { subscribeInterviewSessions };
