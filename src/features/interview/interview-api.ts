/**
 * The student server's interview API (`/api/interview/*`), called with the
 * app's own Bearer token.
 *
 * The contract is the one the interview web app already used through its Next
 * server (docs: scratchpad brief, apps/interview/app/api/**): JSON in, JSON out,
 * errors as `{error, message}` with a Korean message. Every call sends
 * `X-Locale: ko` so the AI writes Korean.
 *
 * Token lifetime belongs to `sessionManager.authorize`: it refreshes once on a
 * 401, which is why errors are raised as `ApiError` subclasses.
 */
import { Platform } from 'react-native';

import { ApiError, apiClient, hasConfiguredApi } from '@/services/api/client';
import { isDemoSession, sessionManager } from '@/services/api/session-manager';

import type { GuidedExpandResponse, GuidedPrepareRequest, GuidedPrepareResponse } from './guided';
import type { InterviewSession } from './types';

const DEFAULT_TIMEOUT_MS = 20_000;
/** Longer than the server's own transcription budget (about 3 minutes). */
export const ANALYSIS_REQUEST_TIMEOUT_MS = 4 * 60 * 1000;

export type UsageKind = 'basic' | 'ai' | 'questions';

/** 이번 달 요금제 한도. 학생 서버(app/interview/service.py Allowance.view)가 계산한다. */
export interface InterviewAllowance {
  plan: 'free' | 'standard';
  planRenewsAt: number | null;
  ai: { used: number; limit: number; freeTrial: boolean };
  questions: { used: number; limit: number };
  periodEnd: number | null;
}

export interface InterviewMember {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  role: 'member' | 'student' | 'manager' | 'admin';
  orgId: string | null;
  orgName: string | null;
  groupName: string | null;
}

export interface Reservation {
  id: string;
  token: string;
  kind: UsageKind;
  alreadyPaid: boolean;
  free?: boolean;
}

export interface InviteInfo {
  orgName: string;
  orgKind: string;
  groupName: string;
  licenseUntil: number | null;
}

export interface BackupMeta {
  session_id: string;
  title: string;
  updated_at: number;
}

export interface OrgReport {
  org: { id: string; name: string; kind: string; licenseUntil: number | null };
  from: number;
  to: number;
  totals: {
    members: number;
    activeMembers: number;
    practices: number;
    aiPractices: number;
    questionSets: number;
    aiFeedbacks: number;
  };
  groups: { name: string; members: number; activeMembers: number; practices: number; aiPractices: number }[];
  weeks: { weekStart: number; practices: number; activeMembers: number }[];
  members: {
    displayName: string;
    username: string;
    group: string;
    joinedAt: number;
    practices: number;
    aiPractices: number;
    lastActiveAt: number | null;
  }[];
  invites: { code: string; group: string; uses: number; maxUses: number; expiresAt: number | null; disabled: boolean }[];
}

export interface OrgShare {
  id: string;
  studentName: string;
  group: string;
  title: string;
  sharedAt: number;
  payload: {
    items: { question: string; transcript: string; durationMs: number; nextFocus: string | null; missingPoints: string[] }[];
    nextPractice: string | null;
  };
}

export interface SharePayload {
  sessionId: string;
  title: string;
  items: { question: string; transcript: string; durationMs: number; nextFocus: string | null; missingPoints: string[] }[];
  nextPractice: string | null;
}

/** A refusal from the interview API, with the server's own `error` code. */
export class InterviewApiError extends ApiError {
  constructor(
    message: string,
    options: { status?: number; errorCode?: string; retryAfterMs?: number; cause?: unknown; code?: ApiError['code'] } = {},
  ) {
    super(message, {
      status: options.status,
      code: options.code ?? (options.status === 401 ? 'SESSION_EXPIRED' : undefined),
      cause: options.cause,
    });
    this.name = 'InterviewApiError';
    this.errorCode = options.errorCode ?? '';
    this.retryAfterMs = options.retryAfterMs;
  }

  /** The server's `error` field (`plan_limit`, `daily_limit`, `timeout`, ...). */
  readonly errorCode: string;
  readonly retryAfterMs?: number;
}

/** 402 from the server: 스탠다드가 필요하거나(plan_required) 이번 달 한도를 다 썼다(plan_limit). */
export function isPlanLimit(error: unknown): error is InterviewApiError {
  return error instanceof InterviewApiError && error.status === 402;
}

/** True when this session talks to a real server (not the offline demo). */
export function interviewServerAvailable(): boolean {
  return hasConfiguredApi() && sessionManager.session !== null && !isDemoSession(sessionManager.session);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

export interface InterviewRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  json?: unknown;
  form?: FormData;
  operation?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Public routes (invite lookup) work without a token. */
  anonymous?: boolean;
}

type Fetcher = typeof fetch;
let fetcher: Fetcher = (input, init) => fetch(input, init);

/** Tests swap the network for a fake. */
export function setInterviewFetcher(next: Fetcher | null): void {
  fetcher = next ?? ((input, init) => fetch(input, init));
}

async function send<T>(path: string, options: InterviewRequestOptions, token: string | null): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Locale': 'ko' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.operation) headers['x-premind-operation'] = options.operation;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(options.json);
  }
  try {
    const response = await fetcher(`${apiClient.baseUrl}/api/interview${path}`, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const record = (payload ?? {}) as Record<string, unknown>;
      const detail = record.detail;
      const message =
        typeof record.message === 'string' && record.message.length <= 300
          ? record.message
          : typeof detail === 'string'
            ? detail
            : response.status === 401
              ? '다시 로그인해 주세요.'
              : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
      throw new InterviewApiError(message, {
        status: response.status,
        errorCode: typeof record.error === 'string' ? record.error : '',
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }
    if (payload === null) {
      throw new InterviewApiError('응답을 확인하지 못했어요.', { status: response.status, errorCode: 'invalid_response' });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof InterviewApiError) throw error;
    if (timedOut) {
      throw new InterviewApiError('응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.', {
        errorCode: 'timeout',
        code: 'TIMEOUT',
        cause: error,
      });
    }
    if (options.signal?.aborted) throw error;
    throw new InterviewApiError('인터넷 연결을 확인한 뒤 다시 시도해 주세요.', {
      errorCode: 'network',
      code: 'NETWORK',
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export function interviewRequest<T>(path: string, options: InterviewRequestOptions = {}): Promise<T> {
  if (options.anonymous) return send<T>(path, options, null);
  return sessionManager.authorize((token) => send<T>(path, options, token));
}

// ── account and allowance ───────────────────────────────────────

export async function fetchInterviewMe(): Promise<{ user: InterviewMember; allowance: InterviewAllowance }> {
  return interviewRequest('/me');
}

export async function reserveUsage(id: string, kind: UsageKind): Promise<{ result: Reservation; allowance?: InterviewAllowance }> {
  return interviewRequest('/ops/reserve', { json: { id, kind } });
}

export async function commitUsage(reservation: Reservation): Promise<InterviewAllowance | undefined> {
  if (reservation.alreadyPaid) return undefined;
  const payload = await interviewRequest<{ allowance?: InterviewAllowance }>('/ops/commit', {
    json: { id: reservation.id, token: reservation.token },
  });
  return payload.allowance;
}

export async function cancelUsage(reservation: Reservation): Promise<InterviewAllowance | undefined> {
  if (reservation.alreadyPaid) return undefined;
  const payload = await interviewRequest<{ allowance?: InterviewAllowance }>('/ops/cancel', {
    json: { id: reservation.id, token: reservation.token },
  });
  return payload.allowance;
}

// ── AI ─────────────────────────────────────────────────────────

export async function requestGuidedQuestions(input: GuidedPrepareRequest, signal?: AbortSignal): Promise<GuidedPrepareResponse> {
  return interviewRequest('/guided', { json: input, timeoutMs: 90_000, signal });
}

export async function requestGuidedExpansion(
  input: GuidedPrepareRequest & { existingQuestions: { question: string; sourceQuote: string | null }[] },
  operation: string,
  signal?: AbortSignal,
): Promise<GuidedExpandResponse> {
  return interviewRequest('/guided/expand', { json: input, operation, timeoutMs: 90_000, signal });
}

// ── backups ────────────────────────────────────────────────────

export async function listBackups(): Promise<BackupMeta[]> {
  const payload = await interviewRequest<{ backups?: BackupMeta[] }>('/backups');
  return Array.isArray(payload.backups) ? payload.backups : [];
}

export async function fetchBackup(id: string): Promise<unknown> {
  const payload = await interviewRequest<{ session?: unknown }>(`/backups?id=${encodeURIComponent(id)}`);
  return payload.session ?? null;
}

export async function saveBackup(session: InterviewSession, title: string): Promise<void> {
  await interviewRequest('/backups', { json: { session, title } });
}

export async function deleteBackup(id: string): Promise<void> {
  await interviewRequest(`/backups?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── checkout ───────────────────────────────────────────────────

/** Polar checkout for 스탠다드 on the web; the server stamps the account on it. */
export async function startWebCheckout(successUrl: string, cycle: 'monthly' | 'yearly' = 'monthly'): Promise<string> {
  const { url } = await interviewRequest<{ url?: string | null }>('/checkout', { json: { successUrl, cycle } });
  if (!url) throw new InterviewApiError('결제 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.', { status: 502, errorCode: 'checkout_failed' });
  return url;
}

// ── institutions ───────────────────────────────────────────────

export async function lookupInvite(code: string): Promise<InviteInfo> {
  const payload = await interviewRequest<{ invite?: InviteInfo }>(`/invites/${encodeURIComponent(code)}`, {
    anonymous: !interviewServerAvailable(),
  });
  if (!payload.invite) throw new InterviewApiError('초대 코드를 확인하지 못했어요.');
  return payload.invite;
}

export async function joinOrg(code: string): Promise<{ user: InterviewMember; allowance: InterviewAllowance }> {
  return interviewRequest('/join', { json: { code } });
}

export async function fetchOrgReport(days: number): Promise<OrgReport> {
  const payload = await interviewRequest<{ report: OrgReport }>(`/org/report?days=${days}`);
  return payload.report;
}

export async function createOrgInvite(group: string, maxUses: number, days: number): Promise<string> {
  const payload = await interviewRequest<{ code: string }>('/org/invites', { json: { group, maxUses, days } });
  return payload.code;
}

export async function closeOrgInvite(code: string): Promise<void> {
  await interviewRequest(`/org/invites?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function fetchOrgShares(): Promise<OrgShare[]> {
  const payload = await interviewRequest<{ shares?: OrgShare[] }>('/org/shares');
  return payload.shares ?? [];
}

export async function fetchShareStatus(sessionId: string): Promise<boolean> {
  const payload = await interviewRequest<{ shared?: boolean }>(`/shares?sessionId=${encodeURIComponent(sessionId)}`);
  return Boolean(payload.shared);
}

export async function shareWithOrg(body: SharePayload): Promise<void> {
  await interviewRequest('/shares', { json: body });
}

export async function unshareWithOrg(sessionId: string): Promise<void> {
  await interviewRequest(`/shares?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

/** `FormData` part for an audio file: a Blob on the web, a file URI on native. */
export type AudioPart = Blob | { uri: string; name: string; type: string };

export function appendAudio(form: FormData, audio: AudioPart): void {
  if (Platform.OS === 'web' || typeof (audio as Blob).size === 'number') {
    form.append('audio', audio as Blob, 'interview-answer');
    return;
  }
  // React Native's FormData takes a `{uri, name, type}` record for a file.
  form.append('audio', audio as unknown as Blob);
}
