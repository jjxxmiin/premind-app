import type { InterviewAttempt, InterviewSession } from "./types";
import { canAutomaticallyRetry } from "./result-policy";

export type ResultPreparationState =
  | { kind: "loading" }
  | { kind: "open-report" }
  | { kind: "unfinished" }
  | { kind: "working"; phase: "transcription" | "feedback" }
  | { kind: "problem" }
  | { kind: "complete" };

/** 질문별로 저장에 성공한 가장 최근 답변을 고른다. */
export function latestCompletedAttempts(session: InterviewSession): InterviewAttempt[] {
  const byQuestion = new Map<string, InterviewAttempt>();
  for (const attempt of session.attempts) {
    if (attempt.status === "failed") continue;
    const previous = byQuestion.get(attempt.questionId);
    if (!previous || previous.attemptNo <= attempt.attemptNo) byQuestion.set(attempt.questionId, attempt);
  }
  return [...byQuestion.values()];
}

/** 명시적으로 다시 요청한 이전 회차는 최신 답변과 별개로 끝까지 처리한다. */
export function resultPreparationAttempts(session: InterviewSession): InterviewAttempt[] {
  const selected = latestCompletedAttempts(session);
  const ids = new Set(selected.map((attempt) => attempt.id));
  const requested = new Set(session.resultPreparation?.attemptIds ?? []);
  return [...selected, ...session.attempts.filter((attempt) =>
    requested.has(attempt.id) && !ids.has(attempt.id) && attempt.status !== "failed")];
}

/** 실패/짧은 답변도 완료다. 총평 유무나 낡은 피드백은 자동 재요청의 이유가 아니다. */
export function derivePreparationState(
  session: InterviewSession,
  sourceQuestionIds: readonly string[] | null | undefined,
): ResultPreparationState {
  if (session.feedbackMode !== "ai") return { kind: "open-report" };
  if (!sourceQuestionIds?.length) return { kind: "problem" };
  const ids = new Set(sourceQuestionIds);
  if ((session.retryQuestionId && ids.has(session.retryQuestionId)) ||
      (session.status !== "completed" && session.currentQuestionIndex < ids.size)) return { kind: "unfinished" };
  if (session.resultPreparation?.timedOut) return { kind: "complete" };
  let feedbackPending = false;
  for (const attempt of resultPreparationAttempts(session).filter((attempt) => ids.has(attempt.questionId))) {
    const analysis = attempt.analysis;
    if (!analysis) continue;
    const transcription = analysis.transcription;
    if (["queued", "processing"].includes(transcription.status) ||
        (analysis.audioKey && canAutomaticallyRetry(transcription))) return { kind: "working", phase: "transcription" };
    if (transcription.status !== "ready" || !transcription.transcript) continue;
    const transcript = transcription.transcript.corrected ?? transcription.transcript.original;
    if ((transcript.normalize("NFKC").match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 10) continue;
    if (["idle", "queued", "processing"].includes(analysis.evaluation.status) || canAutomaticallyRetry(analysis.evaluation)) feedbackPending = true;
  }
  return feedbackPending ? { kind: "working", phase: "feedback" } : { kind: "complete" };
}
