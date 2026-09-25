/**
 * Session text follows the account: every settled practice is copied to the
 * student server's `/api/interview/backups` (the same table the interview web
 * app's optional backup wrote to). Only text goes up — `textOnly` nulls the
 * video and audio keys, and the server refuses a payload that still has them.
 *
 * Practices backed up elsewhere (another device, or interview.premind.co.kr
 * before it closed) are listed alongside this device's and open read-only:
 * their recordings stayed on the device that made them.
 *
 * A failed upload is not an error the learner can act on; it is simply tried
 * again on the next change or the next visit.
 */
import {
  deleteBackup,
  fetchBackup,
  interviewServerAvailable,
  listBackups,
  saveBackup,
  type BackupMeta,
} from './interview-api';
import {
  getRemoteCopy,
  isInterviewSession,
  listSessions,
  putRemoteCopy,
  readBackupSignatures,
  subscribeInterviewSessions,
  writeBackupSignatures,
} from './interview-storage';
import { textOnly } from './session-machine';
import { resolveSessionSource } from './session-source';
import type { InterviewSession } from './types';

/** Finished and not waiting on any AI work: safe to copy without racing the queue. */
export function isSettled(session: InterviewSession): boolean {
  if (session.status !== 'completed' || session.attempts.length === 0) return false;
  return !session.attempts.some((attempt) => {
    const analysis = attempt.analysis;
    return Boolean(
      analysis &&
        (['queued', 'processing'].includes(analysis.transcription.status) ||
          ['queued', 'processing'].includes(analysis.evaluation.status)),
    );
  });
}

/** A cheap, stable fingerprint of what would be sent. */
export function signature(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

export function backupTitle(session: InterviewSession): string {
  return (resolveSessionSource(session)?.title ?? '면접 연습').slice(0, 120);
}

let syncing: Promise<number> | null = null;

export function syncBackups(): Promise<number> {
  if (!interviewServerAvailable()) return Promise.resolve(0);
  syncing ??= (async () => {
    const signatures = await readBackupSignatures();
    let sent = 0;
    for (const session of await listSessions()) {
      if (!isSettled(session)) continue;
      const payload = textOnly(session);
      const next = signature(payload);
      if (signatures[session.id] === next) continue;
      try {
        await saveBackup(payload, backupTitle(session));
        signatures[session.id] = next;
        sent += 1;
      } catch {
        // Offline, or the server's 200-backup cap: try again later.
      }
    }
    await writeBackupSignatures(signatures);
    return sent;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let installed = 0;
let unsubscribe: (() => void) | null = null;

/** Watches local changes and copies settled practices a few seconds later. */
export function installBackupSync(): () => void {
  installed += 1;
  if (installed === 1) {
    unsubscribe = subscribeInterviewSessions(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void syncBackups().catch(() => undefined);
      }, 3_000);
    });
    void syncBackups().catch(() => undefined);
  }
  return () => {
    installed -= 1;
    if (installed === 0) {
      unsubscribe?.();
      unsubscribe = null;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

/** Backups on the server that this device does not hold. */
export async function remoteOnlyBackups(localIds: ReadonlySet<string>): Promise<BackupMeta[]> {
  if (!interviewServerAvailable()) return [];
  const backups = await listBackups();
  return backups.filter((backup) => !localIds.has(backup.session_id));
}

/** A past practice from the server, cached for offline reading. Read-only. */
export async function openRemoteSession(id: string): Promise<InterviewSession | null> {
  const cached = await getRemoteCopy(id);
  if (!interviewServerAvailable()) return cached;
  try {
    const value = await fetchBackup(id);
    if (!isInterviewSession(value)) return cached;
    await putRemoteCopy(value);
    return value;
  } catch {
    return cached;
  }
}

export async function forgetBackup(id: string): Promise<void> {
  if (!interviewServerAvailable()) return;
  await deleteBackup(id).catch(() => undefined);
  const signatures = await readBackupSignatures();
  delete signatures[id];
  await writeBackupSignatures(signatures);
}
