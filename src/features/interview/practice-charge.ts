/**
 * The charge protocol for a practice, ported from
 * apps/interview/lib/interview/practice-charge.ts.
 *
 * Called at the first real answer — never when the practice is created, and
 * never when a finished report is opened again:
 *   reserve(`practice:<id>`, ai|basic) → commit → open the answer window.
 * If anything between reserve and a successfully opened answer window fails,
 * the reservation is cancelled, so the learner never pays for a practice they
 * could not start. Basic practice is free (the server still records it for
 * institutions' participation counts); AI practice spends the one free trial,
 * then a 스탠다드 monthly use. A reservation the server already committed for
 * this practice comes back `alreadyPaid`, so re-answering inside the same
 * practice is never charged twice.
 */
import { cancelUsage, commitUsage, reserveUsage, type InterviewAllowance, type Reservation, type UsageKind } from './interview-api';
import type { InterviewSession } from './types';

export interface ChargeApi {
  reserve(id: string, kind: UsageKind): Promise<{ result: Reservation; allowance?: InterviewAllowance }>;
  commit(reservation: Reservation): Promise<InterviewAllowance | undefined>;
  cancel(reservation: Reservation): Promise<InterviewAllowance | undefined>;
}

export const serverChargeApi: ChargeApi = { reserve: reserveUsage, commit: commitUsage, cancel: cancelUsage };

/**
 * `start` opens the answer window and returns whether it really opened.
 * `canceled` reports that the learner left while the charge was in flight.
 */
export async function startPaidPractice(
  session: InterviewSession,
  start: () => boolean | Promise<boolean>,
  canceled: () => boolean,
  api: ChargeApi = serverChargeApi,
): Promise<void> {
  if (canceled()) return;
  // Sessions from before billing are grandfathered: no retroactive charge.
  if (session.billingVersion !== 1) {
    await start();
    return;
  }
  let reservation: Reservation | undefined;
  let started = false;
  try {
    reservation = (await api.reserve(`practice:${session.id}`, session.feedbackMode === 'ai' ? 'ai' : 'basic')).result;
    if (canceled()) return;
    await api.commit(reservation);
    if (canceled()) return;
    started = await start();
  } finally {
    if (reservation && !started) await api.cancel(reservation).catch(() => undefined);
  }
}

/** 시작 전에 미리 알려 주는 한 줄. 최종 판단은 예약 때 학생 서버가 한다. */
export function aiAllowanceProblem(allowance: InterviewAllowance | null): string | null {
  if (!allowance || allowance.ai.freeTrial) return null;
  if (allowance.plan !== 'standard') {
    return '무료 체험을 이미 썼어요. AI 피드백 연습은 스탠다드에서 매달 할 수 있어요.';
  }
  if (allowance.ai.used >= allowance.ai.limit) {
    return `이번 달 AI 피드백 연습 ${allowance.ai.limit}회를 모두 썼어요. 다음 달 1일에 다시 채워져요.`;
  }
  return null;
}

/** 이번 달 남은 AI 피드백 연습 횟수. 무료 체험이 남았으면 1, 모르면 null. */
export function aiPracticesLeft(allowance: InterviewAllowance | null): number | null {
  if (!allowance) return null;
  if (allowance.ai.freeTrial) return 1;
  return Math.max(0, allowance.ai.limit - allowance.ai.used);
}

/** AI 연습 버튼 옆 한 줄: 첫 회 무료 / 이번 달 N회 남음 / 스탠다드. */
export function aiPriceLabel(allowance: InterviewAllowance | null): string {
  if (!allowance || allowance.ai.freeTrial) return '첫 회 무료';
  if (allowance.plan === 'standard') return `이번 달 ${aiPracticesLeft(allowance) ?? 0}회 남음`;
  return '스탠다드';
}
