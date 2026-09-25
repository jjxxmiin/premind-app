/**
 * Interview sessions on this device, per account.
 *
 * Only text lives here (questions, transcripts, feedback, notes) — the same
 * `InterviewSession` JSON the interview web app kept in IndexedDB and sends to
 * `/api/interview/backups`, so a session written here and one restored from a
 * web backup are the same shape. Recordings live in `interview-media`.
 *
 * Every write goes through `mutateSession`, which reads the latest stored copy,
 * applies a pure transform from `session-machine.ts`, and writes it back while
 * holding a per-session lock. That lock is what the web's IndexedDB readwrite
 * transaction gave: the analysis queue and a screen can both update one session
 * without either losing the other's change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { sessionManager } from '@/services/api/session-manager';

import { parseDday, type Dday } from './dday';
import { interviewMedia } from './interview-media';
import type { InterviewSession } from './types';

const PREFIX = 'premind.interview.v1';

function account(): string {
  return sessionManager.session?.user.id ?? 'signed-out';
}

function key(name: string): string {
  return `${PREFIX}.${account()}.${name}`;
}

const listeners = new Set<(sessionId: string | null) => void>();

/** Called with the changed session id (null when the list itself changed). */
export function subscribeInterviewSessions(listener: (sessionId: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(sessionId: string | null): void {
  for (const listener of [...listeners]) {
    try {
      listener(sessionId);
    } catch {
      // A screen that unmounted mid-notify must not stop the others.
    }
  }
}

export class InterviewStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterviewStorageError';
  }
}

async function readJson<T>(storageKey: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(storageKey: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    throw new InterviewStorageError('기기에 연습 기록을 저장하지 못했어요. 저장 공간을 확인해 주세요.');
  }
}

/** Accepts only records shaped like an `InterviewSession` (also from a web backup). */
export function isInterviewSession(value: unknown): value is InterviewSession {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.companyId === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.currentQuestionIndex === 'number' &&
    ['active', 'completed', 'abandoned'].includes(record.status as string) &&
    Array.isArray(record.attempts)
  );
}

async function readIndex(): Promise<string[]> {
  const ids = await readJson<unknown>(key('index'));
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

export async function getSession(id: string): Promise<InterviewSession | null> {
  const value = await readJson<unknown>(key(`session.${id}`));
  return isInterviewSession(value) ? value : null;
}

export async function listSessions(): Promise<InterviewSession[]> {
  const ids = await readIndex();
  const sessions = await Promise.all(ids.map((id) => getSession(id)));
  return sessions
    .filter((session): session is InterviewSession => session !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function write(session: InterviewSession): Promise<void> {
  await writeJson(key(`session.${session.id}`), session);
  const ids = await readIndex();
  if (!ids.includes(session.id)) await writeJson(key('index'), [session.id, ...ids]);
}

// One promise chain per session: the in-process "transaction".
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  locks.set(id, next);
  void next.finally(() => {
    if (locks.get(id) === next) locks.delete(id);
  }).catch(() => undefined);
  return next;
}

export async function putSession(session: InterviewSession): Promise<void> {
  await withLock(session.id, () => write(session));
  notify(session.id);
}

/**
 * Read, transform, write — under the session's lock. `transform` returns the
 * next session, or null to leave the stored copy untouched. The second value
 * is whatever else the transform wants to hand back (a claimed attempt, ...).
 */
export async function mutateSession<R = undefined>(
  id: string,
  transform: (current: InterviewSession) => { session: InterviewSession; result?: R } | null,
): Promise<{ session: InterviewSession | null; changed: boolean; result?: R }> {
  const outcome = await withLock(id, async () => {
    const current = await getSession(id);
    if (!current) return { session: null, changed: false } as const;
    const next = transform(current);
    if (!next || next.session === current) return { session: current, changed: false, result: next?.result };
    await write(next.session);
    return { session: next.session, changed: true, result: next.result };
  });
  if (outcome.changed) notify(id);
  return outcome;
}

export async function deleteSession(id: string): Promise<void> {
  await withLock(id, async () => {
    const session = await getSession(id);
    const keys = session
      ? session.attempts.flatMap((attempt) =>
          [attempt.mediaKey, attempt.analysis?.audioKey].filter((item): item is string => Boolean(item)),
        )
      : [];
    await interviewMedia.deleteSessionMedia(id, keys).catch(() => undefined);
    await AsyncStorage.removeItem(key(`session.${id}`));
    const ids = await readIndex();
    await writeJson(key('index'), ids.filter((item) => item !== id));
  });
  notify(null);
}

// ── server copies of past practices ─────────────────────────────

/** A backup made on another device (or the old interview site), kept read-only here. */
export async function getRemoteCopy(id: string): Promise<InterviewSession | null> {
  const value = await readJson<unknown>(key(`remote.${id}`));
  return isInterviewSession(value) ? value : null;
}

export async function putRemoteCopy(session: InterviewSession): Promise<void> {
  await writeJson(key(`remote.${session.id}`), session).catch(() => undefined);
}

/** What was last sent to `/backups`, per session, so an unchanged one is not re-sent. */
export async function readBackupSignatures(): Promise<Record<string, string>> {
  return (await readJson<Record<string, string>>(key('backup-signatures'))) ?? {};
}

export async function writeBackupSignatures(value: Record<string, string>): Promise<void> {
  await writeJson(key('backup-signatures'), value).catch(() => undefined);
}

// ── interview date ──────────────────────────────────────────────

export async function readDday(): Promise<Dday | null> {
  return parseDday(await readJson<unknown>(key('dday')));
}

export async function saveDday(value: Dday | null): Promise<void> {
  if (value) await writeJson(key('dday'), value);
  else await AsyncStorage.removeItem(key('dday'));
  notify(null);
}

export function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (bytes: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
