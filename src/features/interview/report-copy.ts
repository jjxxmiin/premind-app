import type {
  InterviewAnalysisError,
  InterviewAnalysisErrorCode,
  InterviewAttempt,
  InterviewSessionFeedbackState,
} from "./types";

/** Describe what is known, without blaming the speaker or guessing the cause. */
export function reportAnalysisMessage(
  kind: "answer" | "feedback",
  code?: InterviewAnalysisErrorCode,
): string {
  switch (code) {
    case "answer_too_short":
    case "speech_too_short":
      return "답변이 짧아 자세히 살펴보기 어려웠어요. 다음에는 이유나 경험도 함께 말해보세요.";
    case "no_speech":
      return "녹음에서 말소리를 확인하기 어려웠어요.";
    case "no_audio":
    case "expired":
      return "말한 내용을 글로 옮기는 데 필요한 음성이 남아 있지 않아요.";
    case "permission_denied":
      return "마이크 사용이 허용되지 않아 말한 내용을 글로 옮기지 못했어요.";
    case "duration_limit":
      return "5분을 넘는 답변은 피드백을 받을 수 없어요. 다음 연습에서는 5분 안으로 답해 보세요.";
    case "payload_too_large":
      return "녹음 파일이 커서 답변을 확인하지 못했어요.";
    case "unsupported_format":
      return "이 녹음 파일은 글로 옮기기 어려운 형식이에요.";
    case "daily_limit":
      return "오늘 이용할 수 있는 AI 사용량을 모두 썼어요. 내일 다시 시도해 주세요.";
    case "rate_limited":
    case "capacity_limited":
    case "upstream_rate_limited":
      return "지금은 요청이 많아 피드백을 받기 어려워요. 잠시 후 다시 시도해 주세요.";
    case "network":
      return "연결이 원활하지 않아 피드백을 준비하지 못했어요.";
    case "timeout":
      return "서비스 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.";
    case "service_unavailable":
    case "upstream_auth":
      return "서비스에 잠시 문제가 생겼어요. 남겨둔 답변은 그대로 볼 수 있어요.";
    default:
      return kind === "answer"
        ? "서비스에 잠시 문제가 생겨 말한 내용을 글로 옮기지 못했어요."
        : "서비스에 잠시 문제가 생겼어요. 남겨둔 답변은 그대로 볼 수 있어요.";
  }
}

export function canRetryReportTask(error?: InterviewAnalysisError): boolean {
  return Boolean(error?.retryable);
}

/** 저장된 예전 결과도 문장 경계를 유지하며 핵심 두 문장만 보여준다. */
export function conciseReportText(text: string): string {
  return text.trim().split(/(?<=[.!?。！？])\s+|\n+/u).filter(Boolean)
    .slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}

/** Navigation describes the answer, not a repeated score or batch API failure. */
export function reportQuestionStatus(attempt?: InterviewAttempt): {
  label: string;
  state: "muted" | "working";
} | null {
  if (!attempt || attempt.status === "failed" || !attempt.analysis) return null;
  const { transcription, evaluation } = attempt.analysis;
  if (transcription.status === "failed") {
    if (["answer_too_short", "speech_too_short"].includes(transcription.error?.code ?? "")) {
      return { label: "짧은 답변", state: "muted" };
    }
    if (transcription.error?.code === "no_speech") {
      return { label: "말소리 확인 어려움", state: "muted" };
    }
  }
  if ([transcription.status, evaluation.status].some((status) => status === "queued" || status === "processing")) {
    return { label: "피드백 받는 중", state: "working" };
  }
  return null;
}

/** Only collapse the very same failed batch; older attempts keep their notice. */
export function hasSharedReportFailure(
  summary: InterviewSessionFeedbackState | undefined,
  attempt: InterviewAttempt | undefined,
): boolean {
  const evaluation = attempt?.analysis?.evaluation;
  return Boolean(summary?.status === "failed" && evaluation?.status === "failed" &&
    summary.error && evaluation.error &&
    summary.error.code === evaluation.error.code &&
    summary.error.occurredAt === evaluation.error.occurredAt &&
    summary.basis?.some((item) => item.attemptId === attempt?.id &&
      item.transcriptRevision === attempt?.analysis?.transcription.transcript?.revision));
}
