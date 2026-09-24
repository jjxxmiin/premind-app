import { ApiError, apiClient, hasConfiguredApi } from '@/services/api/client';
import { isDemoSession, sessionManager } from '@/services/api/session-manager';
import type { PlanId } from '@/types';

/**
 * Tell the PREMIND server about a store purchase that just happened.
 *
 * RevenueCat also sends a webhook, but a webhook arrives when it arrives, and
 * a learner who has just paid should not have to wait for it to see 스탠다드.
 * `POST /api/billing/revenuecat/sync` asks the server to look the buyer up in
 * RevenueCat now and answer with the plan it decided on; 202 means the
 * entitlement is not visible to RevenueCat yet, which is normal for a few
 * seconds after a Play purchase and is not an error.
 *
 * This lives here rather than on `PremindApiClient` because the client is not
 * this task's file. It reuses the client's base URL and the session manager's
 * token handling, so it refreshes and retries exactly like every other call.
 */

const SYNC_PATH = '/api/billing/revenuecat/sync';
const SYNC_TIMEOUT_MS = 15_000;

export type BillingSyncResult =
  /** The server has decided the plan. */
  | { status: 'synced'; plan: PlanId; planRenewsAt: string | null }
  /** 202: the purchase is not visible to RevenueCat yet. Try again later. */
  | { status: 'pending' }
  /** No server, no session, or a demo session: there is nothing to sync to. */
  | { status: 'unavailable' }
  | { status: 'failed' };

function readPlan(value: unknown): PlanId {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return row.plan === 'standard' ? 'standard' : 'free';
}

function readRenewsAt(value: unknown): string | null {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return typeof row.plan_renews_at === 'string' && row.plan_renews_at
    ? row.plan_renews_at
    : null;
}

async function postSync(
  accessToken: string,
  appUserId: string,
): Promise<BillingSyncResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiClient.baseUrl}${SYNC_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ app_user_id: appUserId }),
      signal: controller.signal,
    });
    if (response.status === 202) {
      return { status: 'pending' };
    }
    if (!response.ok) {
      // 401 has to be an ApiError so `sessionManager.authorize` refreshes the
      // token and runs this once more instead of giving up on a stale token.
      throw new ApiError('구독 정보를 계정에 반영하지 못했어요.', {
        status: response.status,
      });
    }
    const payload: unknown = await response.json().catch(() => null);
    return {
      status: 'synced',
      plan: readPlan(payload),
      planRenewsAt: readRenewsAt(payload),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Push `appUserId` (RevenueCat's id for this buyer) to the server.
 *
 * Never throws: a purchase must not look broken because the sync leg failed,
 * so every problem comes back as `failed` and the caller says "it will catch
 * up" rather than "it did not work".
 */
export async function syncStorePurchase(
  appUserId: string | null,
): Promise<BillingSyncResult> {
  if (!appUserId || !hasConfiguredApi()) return { status: 'unavailable' };
  const session = sessionManager.session;
  if (!session || isDemoSession(session)) return { status: 'unavailable' };
  try {
    return await sessionManager.authorize((token) => postSync(token, appUserId));
  } catch {
    return { status: 'failed' };
  }
}
