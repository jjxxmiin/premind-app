import type {
  InterviewAnalysisErrorCode,
  InterviewAttemptAnalysis,
  InterviewEvaluationState,
  InterviewFeedbackBasis,
  InterviewSessionFeedbackState,
  InterviewTranscript,
  InterviewTranscriptionState,
} from "./types";

/**
 * 이보다 짧은 녹음은 음성 API를 호출해도 면접 답변으로 판단할 정보가 거의 없다.
 * 3초 자체는 답변의 품질 기준이 아니라 불필요한 API 호출을 막는 최소 안전선이다.
 */
export const MINIMUM_FEEDBACK_RECORDING_MS = 3_000;

/**
 * 공백과 문장부호를 제외한 글자 수 기준이다. 한국어는 조사와 어미가 붙으므로
 * 단어 수를 함께 강제하지 않아 짧지만 유효한 문장을 가능한 한 살린다.
 */
export const MINIMUM_FEEDBACK_TRANSCRIPT_CHARACTERS = 10;

export type InterviewTranscriptReadiness =
  | "ready"
  | "no_speech"
  | "speech_too_short";

export function isInterviewRecordingTooShort(durationMs: number): boolean {
  return (
    Number.isSafeInteger(durationMs) &&
    durationMs >= 0 &&
    durationMs < MINIMUM_FEEDBACK_RECORDING_MS
  );
}

/** 손상된 시간값까지 포함해 외부 전사 요청의 최소 길이 조건을 확인한다. */
export function meetsMinimumFeedbackRecordingDuration(
  durationMs: number,
): boolean {
  return (
    Number.isSafeInteger(durationMs) &&
    durationMs >= MINIMUM_FEEDBACK_RECORDING_MS
  );
}

/**
 * 클라이언트 큐와 서버 라우트가 같은 최소 길이 경계를 실제 외부 호출에 적용하도록
 * 하는 작은 실행 게이트다. 반환값으로 호출 여부도 명시해 테스트할 수 있다.
 */
export async function runInterviewTranscriptionRequest<T>(
  durationMs: number,
  request: () => Promise<T>,
): Promise<{ requested: false } | { requested: true; value: T }> {
  if (!meetsMinimumFeedbackRecordingDuration(durationMs)) {
    return { requested: false };
  }
  return { requested: true, value: await request() };
}

/** 같은 음성으로 재시도해도 달라질 수 없는 전사 실패인지 판별한다. */
export function shouldDiscardPendingAudioAfterTranscriptionFailure(
  code: InterviewAnalysisErrorCode,
): boolean {
  return code === "duration_limit" || code === "answer_too_short";
}

/** API가 돌려준 문장을 평가 API에 다시 보내도 될지 판별하는 순수 함수. */
export function classifyInterviewTranscript(
  transcript: string,
): InterviewTranscriptReadiness {
  const normalized = transcript.normalize("NFKC").replace(/\r\n?/g, "\n");
  const meaningfulCharacterCount =
    normalized.match(/[\p{L}\p{N}]/gu)?.length ?? 0;

  if (meaningfulCharacterCount === 0) return "no_speech";
  return meaningfulCharacterCount < MINIMUM_FEEDBACK_TRANSCRIPT_CHARACTERS
    ? "speech_too_short"
    : "ready";
}

/** 오디오 답변을 저장하는 시점에 사용하는 분석 초기값. */
export function createQueuedAttemptAnalysis(
  audioKey: string,
  now = new Date().toISOString(),
): InterviewAttemptAnalysis {
  return {
    schemaVersion: 1,
    audioKey,
    transcription: {
      status: "queued",
      automaticRetryCount: 0,
      attemptCount: 0,
      queuedAt: now,
      updatedAt: now,
    },
    evaluation: {
      status: "idle",
      automaticRetryCount: 0,
      attemptCount: 0,
      updatedAt: now,
    },
  };
}

export function createQueuedSessionFeedback(
  basis: InterviewFeedbackBasis[],
  now = new Date().toISOString(),
): InterviewSessionFeedbackState {
  return {
    schemaVersion: 1,
    status: "queued",
    attemptCount: 0,
    updatedAt: now,
    queuedAt: now,
    basis,
  };
}

/** 화면과 평가 요청은 사용자가 고친 문장이 있을 때 그것을 우선한다. */
export function getEffectiveTranscript(
  transcript: InterviewTranscript,
): string {
  return transcript.corrected ?? transcript.original;
}

/** 사용자 수정본까지 포함해 평가 API에 보낼 수 있는 전사문인지 확인한다. */
export function isInterviewTranscriptReadyForFeedback(
  transcript: InterviewTranscript,
): boolean {
  return (
    classifyInterviewTranscript(getEffectiveTranscript(transcript)) === "ready"
  );
}

/** 전사 수정 뒤 화면에 "수정 전 전사 기준" 안내를 띄우는 기준. */
export function isEvaluationStale(
  analysis: InterviewAttemptAnalysis,
): boolean {
  const revision = analysis.transcription.transcript?.revision;
  return (
    revision !== undefined &&
    analysis.evaluation.status === "ready" &&
    analysis.evaluation.transcriptRevision !== revision
  );
}

export function isProcessingExpired(
  state:
    | InterviewTranscriptionState
    | InterviewEvaluationState
    | InterviewSessionFeedbackState,
  nowMs: number,
  staleAfterMs: number,
): boolean {
  if (state.status !== "processing") return false;
  const startedAt = state.processingStartedAt
    ? new Date(state.processingStartedAt).getTime()
    : Number.NaN;
  return !Number.isFinite(startedAt) || startedAt <= nowMs - staleAfterMs;
}
