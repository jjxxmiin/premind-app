import { type AppLocale, enDuration } from "./locale";
import type {
  CustomInterviewSet,
  InterviewQuestion,
  InterviewSession,
} from "./types";

/**
 * 자유 면접 연습 헬퍼.
 *
 * 회사 팩(CompanyPack)이 정해 주는 질문 대신 사용자가 질문과 답변 시간을 직접
 * 정하는 모드다. 면접실은 실전과 자유를 구분하지 않고 InterviewQuestion 만 받으므로,
 * 변환은 전부 여기서 한다.
 */

/**
 * 답변 시간은 초를 직접 입력하게 하지 않고 고르게 한다. 실제 면접에서 쓰이는
 * 길이만 남겨 두면 고민이 줄고, 130초 같은 값이 들어올 일도 없다.
 */
export const ANSWER_DURATION_OPTIONS = [
  { seconds: 30, label: "30초" },
  { seconds: 60, label: "1분" },
  { seconds: 90, label: "1분 30초" },
  { seconds: 120, label: "2분" },
  { seconds: 180, label: "3분" },
] as const;

export const DEFAULT_ANSWER_DURATION_SEC = 120;
export const DEFAULT_PREP_DURATION_SEC = 10;
export const MAX_CUSTOM_QUESTIONS = 20;
export const UNTITLED_SET_TITLE = "제목 없는 자유 면접";

export function answerDurationLabel(seconds: number, locale: AppLocale = "ko"): string {
  if (locale === "en") return enDuration(seconds);
  return (
    ANSWER_DURATION_OPTIONS.find((option) => option.seconds === seconds)?.label ??
    `${seconds}초`
  );
}

/** 묶음을 다 답하는 데 걸리는 최대 시간. 목록에서 분량을 가늠하는 데 쓴다. */
export function totalAnswerLabel(
  questions: { answerDurationSec: number }[],
  locale: AppLocale = "ko",
): string {
  const total = questions.reduce((sum, item) => sum + item.answerDurationSec, 0);
  if (locale === "en") return enDuration(total);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

/**
 * 면접실과 리포트는 실전 팩과 자유 묶음을 구분하지 않는다 — 여기서 같은 모양으로
 * 바꿔 준다. 인재상 대조는 회사 팩에만 있는 개념이라 traitIds 는 비운다.
 */
export function customSetQuestions(
  questions: CustomInterviewSet["questions"],
): InterviewQuestion[] {
  return questions.map((item, index) => ({
    id: item.id,
    order: index + 1,
    text: item.question,
    traitIds: [],
    maxDurationMs: item.answerDurationSec * 1000,
    prepDurationMs:
      (item.prepDurationSec ?? DEFAULT_PREP_DURATION_SEC) * 1000,
    ...(item.kind ? { kind: item.kind } : {}),
    ...(item.claimId !== undefined ? { claimId: item.claimId } : {}),
    ...(item.parentQuestionId !== undefined
      ? { parentQuestionId: item.parentQuestionId }
      : {}),
    ...(item.sourceQuote !== undefined ? { sourceQuote: item.sourceQuote } : {}),
  }));
}

export function isCustomSession(session: InterviewSession): boolean {
  return Boolean(session.customSet);
}
