import type { ResultPreparationState } from "./result-preparation";

export const RESULT_SLOW_NOTICE_MS = 30_000;

const transcriptionTexts = ["내가 한 말을 정리하고 있어요"] as const;
const feedbackTexts = [
  "답변에서 잘한 점을 살펴보고 있어요",
  "다음엔 어떻게 말하면 좋을지 정리하고 있어요",
] as const;
const connectingTexts = ["인터넷 연결이 끊겼어요."] as const;
const openingTexts = ["연습 기록을 확인하고 있어요"] as const;

/** 문구 순환은 실제 피드백 작업 안에서만 한다. 시간이 흘렀다고 단계를 바꾸지 않는다. */
export function getResultPreparationCopy(state: ResultPreparationState | null, online: boolean, slow: boolean) {
  if (!online) return {
    key: "offline", texts: connectingTexts, animated: false,
    description: "연결 상태를 확인해 주세요.", note: "저장한 답변은 그대로 남아 있어요.",
  };
  const phase = state?.kind === "working" ? state.phase : "opening";
  return {
    key: phase,
    texts: phase === "transcription" ? transcriptionTexts : phase === "feedback" ? feedbackTexts : openingTexts,
    animated: state?.kind === "working",
    description: "준비되면 결과를 바로 보여드릴게요.",
    note: state?.kind === "working" && slow ? "평소보다 시간이 조금 더 걸리고 있어요." : "",
  };
}
