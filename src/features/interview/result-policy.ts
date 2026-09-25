import type { InterviewAnalysisError, InterviewAttempt, InterviewEvaluationState, InterviewTranscriptionState } from "./types";

export const RESULT_WAIT_LIMIT_MS = 120_000;
export const AUTOMATIC_RETRY_DELAY_MS = 3_000;
const RETRYABLE_CODES = new Set(["network", "timeout", "upstream", "invalid_response", "capacity_limited", "rate_limited", "upstream_rate_limited"]);

export function canAutomaticallyRetry(state: InterviewEvaluationState | InterviewTranscriptionState): boolean {
  return state.status === "failed" && state.automaticRetryCount === 0 &&
    Boolean(state.error?.retryable && RETRYABLE_CODES.has(state.error.code));
}

export function retryNotBefore(error: InterviewAnalysisError | undefined, now: number): string {
  return new Date(now + Math.max(AUTOMATIC_RETRY_DELAY_MS, error?.retryAfterMs ?? 0)).toISOString();
}

export function needsAnswerEvaluation(attempt: InterviewAttempt): boolean {
  const analysis = attempt.analysis;
  return Boolean(analysis?.transcription.status === "ready" &&
    ["idle", "queued"].includes(analysis.evaluation.status));
}

export function isFreshAnswerEvaluation(attempt: InterviewAttempt): boolean {
  const analysis = attempt.analysis;
  return Boolean(analysis?.evaluation.status === "ready" && analysis.evaluation.result &&
    analysis.evaluation.transcriptRevision === analysis.transcription.transcript?.revision);
}
