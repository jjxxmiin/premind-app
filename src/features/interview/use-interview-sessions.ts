import { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '@/state/app-store';

import { getSession, listSessions, subscribeInterviewSessions } from './interview-storage';
import type { InterviewSession } from './types';

/** This device's practices for the signed-in account, kept fresh on every change. */
export function useInterviewSessions(): { sessions: InterviewSession[] | null; reload: () => void } {
  const { session } = useAppStore();
  const accountId = session?.user.id ?? '';
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);

  const reload = useCallback(() => {
    void listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    reload();
    return subscribeInterviewSessions(() => reload());
  }, [accountId, reload]);

  return { sessions, reload };
}

/** One practice, re-read whenever it changes (the analysis queue writes to it). */
export function useInterviewSession(id: string | undefined): { session: InterviewSession | null | undefined; reload: () => void } {
  const [session, setSession] = useState<InterviewSession | null | undefined>(undefined);
  const reload = useCallback(() => {
    if (!id) return;
    void getSession(id)
      .then(setSession)
      .catch(() => setSession(null));
  }, [id]);
  useEffect(() => {
    reload();
    return subscribeInterviewSessions((changed) => {
      if (changed === null || changed === id) reload();
    });
  }, [id, reload]);
  return { session: id ? session : null, reload };
}
