import { ApiError, apiClient, hasConfiguredApi } from '@/services/api/client';
import { isDemoSession, sessionManager } from '@/services/api/session-manager';

/**
 * 웹(Polar)에서 결제한 스탠다드를 앱 안에서 해지 예약, 해지 취소(2026-09-26 CEO "결제 했는데 결제 해지가 없네").
 * 학생 서버 `GET /api/billing/subscription`, `POST .../cancel`, `POST .../resume`. 해지는 이번 결제 기간이 끝날 때
 * 적용되고 그때까지 스탠다드는 그대로다. 스토어 구독은 스토어 화면에서 관리한다(source: 'store').
 */
export interface WebSubscription {
  source: 'web' | 'store' | 'none';
  plan: 'free' | 'standard';
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
}

const TIMEOUT_MS = 15_000;

function read(payload: unknown): WebSubscription {
  const row = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return {
    source: row.source === 'web' || row.source === 'store' ? row.source : 'none',
    plan: row.plan === 'standard' ? 'standard' : 'free',
    renewsAt: typeof row.renewsAt === 'string' && row.renewsAt ? row.renewsAt : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
  };
}

async function call(path: string, method: 'GET' | 'POST', token: string): Promise<WebSubscription> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${apiClient.baseUrl}${path}`, {
      method,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        payload && typeof payload === 'object' && typeof (payload as { detail?: unknown }).detail === 'string'
          ? (payload as { detail: string }).detail
          : '구독을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.';
      // 401 은 ApiError 여야 sessionManager 가 토큰을 새로 받아 한 번 더 부른다.
      throw new ApiError(detail, { status: response.status });
    }
    return read(payload);
  } finally {
    clearTimeout(timer);
  }
}

function available(): boolean {
  const session = sessionManager.session;
  return hasConfiguredApi() && !(session && isDemoSession(session));
}

export async function fetchWebSubscription(): Promise<WebSubscription | null> {
  if (!available()) return null;
  try {
    return await sessionManager.authorize((token) => call('/api/billing/subscription', 'GET', token));
  } catch {
    return null;
  }
}

export function cancelWebSubscription(): Promise<WebSubscription> {
  return sessionManager.authorize((token) => call('/api/billing/subscription/cancel', 'POST', token));
}

export function resumeWebSubscription(): Promise<WebSubscription> {
  return sessionManager.authorize((token) => call('/api/billing/subscription/resume', 'POST', token));
}
