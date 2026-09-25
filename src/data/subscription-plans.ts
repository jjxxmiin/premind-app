/**
 * The subscription offer, in one place.
 *
 * Decided 2026-09-06: one paid plan to start (스탠다드), priced on monthly
 * processing minutes; the free tier keeps every feature and limits volume,
 * retention and AI depth.
 *
 * Decided 2026-09-07: the Android app sells it through Google Play billing, so
 * the prices below are the planned offer and the *store* is the authority once
 * it answers — a Play price change must never be contradicted by this table.
 * The web build still checks out on the web.
 */

export type PlanId = 'free' | 'standard';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanPrice {
  /** KRW per month when billed monthly. */
  monthly: number;
  /** KRW per year when billed yearly (two months free). */
  yearly: number;
  /** KRW per month for verified students, billed monthly. */
  student: number;
}

export interface PlanBenefit {
  key: string;
  label: string;
  /** What the free tier gets; `false` renders as "없음". */
  free: string | false;
  /** What 스탠다드 gets; `true` renders as "포함". */
  standard: string | true;
}

export const PLAN_PRICES: Record<Exclude<PlanId, 'free'>, PlanPrice> = {
  standard: { monthly: 9_900, yearly: 99_000, student: 5_900 },
};

export const PLAN_BENEFITS: readonly PlanBenefit[] = [
  { key: 'minutes', label: '월 처리 분량', free: '120분', standard: '1,200분' },
  { key: 'pack', label: '마인드팩 자동 생성', free: '포함', standard: '우선 처리' },
  { key: 'chat', label: '자료에 질문', free: '하루 10회', standard: '무제한' },
  { key: 'lens', label: '발표 평가', free: '체험 1회', standard: '월 5회' },
  // interview.premind.co.kr runs on the same account and plan since 2026-09-26
  // (premind-recorder-api INTERVIEW_AI_STANDARD_MONTHLY).
  { key: 'interview', label: '면접 AI 피드백', free: '체험 1회', standard: '월 10회' },
  { key: 'youtube', label: '유튜브 링크', free: '월 3개', standard: '무제한' },
  { key: 'retention', label: '보관 기간', free: '30일', standard: '무제한' },
  { key: 'export', label: '대본, 요약 내보내기', free: false, standard: true },
  { key: 'backup', label: '원본 클라우드 백업', free: false, standard: true },
];

/**
 * The pricing page, for a web build with no student server (demo). A signed-in
 * web build checks out through the student server's Polar checkout instead;
 * Android and iOS use the store. (premind.co.kr/credits is the teacher's
 * credit shop and never sold 스탠다드.)
 */
export const SUBSCRIPTION_WEB_URL = 'https://premind.co.kr/student';

/**
 * The pages that govern the offer.
 *
 * Google Play requires both to sit next to the price on the purchase screen,
 * and 설정 lists them too, so they live here once rather than as two copies of
 * the same string.
 */
export const TERMS_URL = 'https://premind.co.kr/terms';
export const PRIVACY_URL = 'https://premind.co.kr/privacy';

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** Monthly-equivalent price for a yearly plan, rounded to the hundred. */
export function yearlyPerMonth(price: PlanPrice): number {
  return Math.round(price.yearly / 12 / 100) * 100;
}
