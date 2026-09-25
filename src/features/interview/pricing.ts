/**
 * 요금제(통합 4단계, 2026-09-26). 코인은 없어졌다. 면접은 PREMIND 학생 요금제의 한 줄이다 —
 * 실제 한도는 학생 서버가 정하고(app/interview/service.py, 설정값), 여기 값은 화면 문구에만 쓴다.
 *
 * - 기본 연습: 누구나 무료, 무제한
 * - AI 피드백 연습: 계정마다 무료 체험 1회, 스탠다드는 매달 AI_STANDARD_MONTHLY 회
 * - 자기소개서 질문 만들기: 무료 매달 QUESTIONS_FREE_MONTHLY 회, 스탠다드 QUESTIONS_STANDARD_MONTHLY 회
 */
export const PLAN = {
  standardWon: 9_900,
  aiStandardMonthly: 10,
  questionsFreeMonthly: 1,
  questionsStandardMonthly: 20,
} as const;

export type CoinUse = "basic" | "ai" | "questions";
export type PlanName = "free" | "standard";

export function planLabel(plan: PlanName | null | undefined): string {
  return plan === "standard" ? "스탠다드" : "무료";
}
