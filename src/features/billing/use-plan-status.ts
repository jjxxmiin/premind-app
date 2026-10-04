import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient, hasConfiguredApi } from '@/services/api/client';
import { isDemoSession, sessionManager } from '@/services/api/session-manager';
import { useAppStore } from '@/state/app-store';
import type { PlanId, PlanUsage } from '@/types';
import type { AppLocale } from '@/lib/i18n/core';

export interface PlanStatus {
  plan: PlanId;
  renewsAt: string | null;
  usage: PlanUsage | null;
  /** True while the first answer is on its way; false for demo/offline. */
  loading: boolean;
  /** Failed verification must never make an existing buyer look confirmed free. */
  error: boolean;
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
 * An unavailable account is unknown, not a confirmed free subscription.
 */
async function readPlanFacts(userId: string): Promise<PlanFacts | null> {
  try {
    const user = await sessionManager.authorize((token) =>
      apiClient.getCurrentUser(token),
    );
    if (user.id !== userId || sessionManager.session?.user.id !== userId) return null;
    return {
      plan: user.plan ?? 'free',
      renewsAt: user.plan_renews_at ?? null,
      usage: user.usage ?? null,
    };
  } catch {
    return null;
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
  const [loaded, setLoaded] = useState<{
    readonly userId: string;
    readonly facts: PlanFacts;
    readonly error: boolean;
  } | null>(null);
  const requestScope = useRef<{ userId: string | null; generation: number }>({
    userId: null,
    generation: 0,
  });

  const refresh = useCallback(async () => {
    if (!live || !userId || requestScope.current.userId !== userId ||
        sessionManager.session?.user.id !== userId) return;
    const generation = ++requestScope.current.generation;
    const facts = await readPlanFacts(userId);
    if (requestScope.current.userId !== userId ||
        requestScope.current.generation !== generation ||
        sessionManager.session?.user.id !== userId) return;
    setLoaded((previous) => ({
      userId,
      facts: facts ?? (previous?.userId === userId ? previous.facts : FREE),
      error: facts === null,
    }));
  }, [live, userId]);

  useEffect(() => {
    const scope = requestScope.current;
    scope.userId = live ? userId : null;
    void refresh();
    return () => {
      scope.userId = null;
      scope.generation += 1;
    };
  }, [live, userId, refresh]);

  if (!live || !userId) return { ...FREE, loading: false, error: false, refresh: NO_REFRESH };
  if (loaded && loaded.userId === userId) {
    return { ...loaded.facts, loading: false, error: loaded.error, refresh };
  }
  return { ...FREE, loading: true, error: false, refresh };
}

export function planLabel(plan: PlanId, locale: AppLocale = 'ko'): string {
  if (locale === 'en') return plan === 'standard' ? 'Standard' : 'Free';
  return plan === 'standard' ? '스탠다드' : '무료';
}

/** "이번 달 37분 / 120분" for a settings row; null when there is no usage. */
export function usageLine(usage: PlanUsage | null, locale: AppLocale = 'ko'): string | null {
  if (!usage) return null;
  if (locale === 'en') return `This month ${usage.minutes_used} / ${usage.minutes_limit} min`;
  return `이번 달 ${usage.minutes_used}분 / ${usage.minutes_limit}분`;
}
