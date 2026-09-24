import { useCallback, useEffect, useState } from 'react';

import { apiClient, hasConfiguredApi } from '@/services/api/client';
import { isDemoSession, sessionManager } from '@/services/api/session-manager';
import { useAppStore } from '@/state/app-store';
import type { PlanId, PlanUsage } from '@/types';

export interface PlanStatus {
  plan: PlanId;
  renewsAt: string | null;
  usage: PlanUsage | null;
  /** True while the first answer is on its way; false for demo/offline. */
  loading: boolean;
  /**
   * Re-read `/api/auth/me`. Resolves once the answer has been applied, so a
   * screen that just changed the plan can await it before saying so.
   */
  refresh: () => Promise<void>;
}

interface PlanFacts {
  plan: PlanId;
  renewsAt: string | null;
  usage: PlanUsage | null;
}

const FREE: PlanFacts = { plan: 'free', renewsAt: null, usage: null };
const NO_REFRESH = async () => undefined;

/**
 * One read of `/api/auth/me`, with no state of its own.
 *
 * A server that will not answer is not an error the learner can act on: the
 * plan simply reads as free, the same as an account that is.
 */
async function readPlanFacts(): Promise<PlanFacts> {
  try {
    const user = await sessionManager.authorize((token) =>
      apiClient.getCurrentUser(token),
    );
    return {
      plan: user.plan ?? 'free',
      renewsAt: user.plan_renews_at ?? null,
      usage: user.usage ?? null,
    };
  } catch {
    return FREE;
  }
}

/**
 * The account's plan and this month's usage, read from `/api/auth/me`.
 *
 * The server owns the plan: a store purchase is pushed to it by
 * `syncStorePurchase`, and this hook then re-reads the truth rather than
 * guessing from the receipt. A demo session or a build without a server is
 * simply free with no usage line, never an error.
 */
export function usePlanStatus(): PlanStatus {
  const { session } = useAppStore();
  const userId = session?.user.id ?? null;
  const live = hasConfiguredApi() && session !== null && !isDemoSession(session);
  // The last answer, tagged with the account it belongs to, so switching
  // accounts never shows the previous person's plan while the next loads —
  // and so a slow answer for a signed-out account is dropped on arrival.
  const [loaded, setLoaded] = useState<{ userId: string; facts: PlanFacts } | null>(null);

  const refresh = useCallback(async () => {
    if (!live || !userId) return;
    setLoaded({ userId, facts: await readPlanFacts() });
  }, [live, userId]);

  useEffect(() => {
    if (!live || !userId) return;
    let cancelled = false;
    void readPlanFacts().then((facts) => {
      if (!cancelled) setLoaded({ userId, facts });
    });
    return () => {
      cancelled = true;
    };
  }, [live, userId]);

  if (!live || !userId) return { ...FREE, loading: false, refresh: NO_REFRESH };
  if (loaded && loaded.userId === userId) {
    return { ...loaded.facts, loading: false, refresh };
  }
  return { ...FREE, loading: true, refresh };
}

export function planLabel(plan: PlanId): string {
  return plan === 'standard' ? '스탠다드' : '무료';
}

/** "이번 달 37분 / 120분" for a settings row; null when there is no usage. */
export function usageLine(usage: PlanUsage | null): string | null {
  if (!usage) return null;
  return `이번 달 ${usage.minutes_used}분 / ${usage.minutes_limit}분`;
}
