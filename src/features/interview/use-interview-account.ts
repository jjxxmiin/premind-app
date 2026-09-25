/**
 * Who the learner is to the interview service (`/api/interview/me`): their
 * role (member, student of an institution, manager) and this month's
 * allowance. One shared, per-account cache so every screen shows the same
 * numbers and a charge made in the room is reflected on the home tab.
 *
 * The offline demo has no server: it reads as a free account with the free AI
 * trial still unused, and seeds two example practices once.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { sessionManager } from '@/services/api/session-manager';
import { useAppStore } from '@/state/app-store';

import { DEMO_ALLOWANCE, demoMember, demoSessions } from './demo-fixtures';
import { fetchInterviewMe, interviewServerAvailable, type InterviewAllowance, type InterviewMember } from './interview-api';
import { getSession, putSession } from './interview-storage';

export type InterviewAccount =
  | { status: 'loading' }
  | { status: 'ready'; user: InterviewMember; allowance: InterviewAllowance | null; demo: boolean }
  | { status: 'error'; message: string };

let cache: { accountId: string; value: InterviewAccount } | null = null;
let inflight: Promise<InterviewAccount> | null = null;
const listeners = new Set<() => void>();

function accountId(): string {
  return sessionManager.session?.user.id ?? '';
}

function publish(value: InterviewAccount): InterviewAccount {
  cache = { accountId: accountId(), value };
  for (const listener of [...listeners]) listener();
  return value;
}

/** A charge answered with a fresh allowance: show it everywhere at once. */
export function setInterviewAllowance(allowance: InterviewAllowance | undefined): void {
  if (!allowance || cache?.value.status !== 'ready' || cache.accountId !== accountId()) return;
  publish({ ...cache.value, allowance });
}

async function seedDemo(): Promise<void> {
  const key = `premind.interview.v1.${accountId()}.demo-seeded`;
  if (await AsyncStorage.getItem(key)) return;
  for (const session of demoSessions()) {
    if (!(await getSession(session.id))) await putSession(session);
  }
  await AsyncStorage.setItem(key, '1');
}

export function refreshInterviewAccount(): Promise<InterviewAccount> {
  inflight ??= (async () => {
    if (!sessionManager.session) return publish({ status: 'error', message: '로그인이 필요해요.' });
    if (!interviewServerAvailable()) {
      const user = sessionManager.session?.user;
      await seedDemo().catch(() => undefined);
      return publish({
        status: 'ready',
        demo: true,
        user: demoMember(user?.name ?? 'PREMIND 사용자', user?.email ?? ''),
        allowance: DEMO_ALLOWANCE,
      });
    }
    try {
      const { user, allowance } = await fetchInterviewMe();
      return publish({ status: 'ready', demo: false, user, allowance: allowance ?? null });
    } catch (reason) {
      // Keep what we knew: a network blip is not a sign-out.
      if (cache?.accountId === accountId() && cache.value.status === 'ready') return cache.value;
      return publish({
        status: 'error',
        message: reason instanceof Error && reason.message ? reason.message : '면접 연습 정보를 불러오지 못했어요.',
      });
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useInterviewAccount(): InterviewAccount & { refresh: () => Promise<InterviewAccount> } {
  const { session } = useAppStore();
  const id = session?.user.id ?? '';
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    if (!cache || cache.accountId !== id) void refreshInterviewAccount();
    return () => {
      listeners.delete(listener);
    };
  }, [id]);

  const refresh = useCallback(() => refreshInterviewAccount(), []);
  const value: InterviewAccount = cache && cache.accountId === id ? cache.value : { status: 'loading' };
  return { ...value, refresh };
}
