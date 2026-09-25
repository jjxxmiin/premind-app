/**
 * Interview audio and video on the web: IndexedDB, this browser only.
 *
 * Answers never leave the device except the audio-only copy that is sent once
 * for transcription and then deleted. Video is kept for the learner to watch
 * back and is never uploaded.
 */
import type { AudioPart } from './interview-api';
import type { StoredAudio, InterviewMediaStore } from './interview-media.types';

const DB_NAME = 'premind-interview-media';
const DB_VERSION = 1;
const AUDIO = 'pending-audio';
const VIDEO = 'video';

interface AudioRecord {
  key: string;
  sessionId: string;
  attemptId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: string;
  expiresAt: string;
}

interface VideoRecord {
  key: string;
  sessionId: string;
  blob: Blob;
  mimeType: string;
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('이 브라우저에는 녹음을 보관할 수 없어요.'));
  }
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(VIDEO)) db.createObjectStore(VIDEO, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error('녹음 저장소를 열지 못했어요.'));
    };
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onabort = () => reject(tx.error ?? new Error('녹음을 저장하지 못했어요.'));
        tx.onerror = () => reject(tx.error ?? new Error('녹음을 저장하지 못했어요.'));
      }),
  );
}

export const interviewMedia: InterviewMediaStore = {
  async putPendingAudio({ key, sessionId, attemptId, audio, mimeType, expiresAt }) {
    const blob = audio as Blob;
    if (!blob || typeof blob.size !== 'number' || blob.size === 0) {
      throw new Error('전사할 음성이 비어 있어요. 다시 답변해 주세요.');
    }
    const record: AudioRecord = {
      key,
      sessionId,
      attemptId,
      blob,
      mimeType: mimeType || blob.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    await run(AUDIO, 'readwrite', (store) => void store.put(record));
  },

  async getPendingAudio(key): Promise<StoredAudio | null> {
    const record = (await run<AudioRecord>(AUDIO, 'readonly', (store) => store.get(key))) ?? null;
    if (!record) return null;
    return { part: record.blob as AudioPart, size: record.size, mimeType: record.mimeType, expiresAt: record.expiresAt };
  },

  async deletePendingAudio(key) {
    await run(AUDIO, 'readwrite', (store) => void store.delete(key)).catch(() => undefined);
  },

  async expiredPendingAudio(nowMs) {
    const records = (await run<AudioRecord[]>(AUDIO, 'readonly', (store) => store.getAll()).catch(() => [])) ?? [];
    return records
      .filter((record) => {
        const expiresAt = Date.parse(record.expiresAt);
        return !Number.isFinite(expiresAt) || expiresAt <= nowMs;
      })
      .map((record) => record.key);
  },

  async putVideo({ key, sessionId, video, mimeType }) {
    const blob = video as Blob;
    const record: VideoRecord = { key, sessionId, blob, mimeType: mimeType || blob.type };
    await run(VIDEO, 'readwrite', (store) => void store.put(record));
  },

  async videoUri(key) {
    const record = (await run<VideoRecord>(VIDEO, 'readonly', (store) => store.get(key)).catch(() => undefined)) ?? null;
    if (!record || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    return URL.createObjectURL(record.blob);
  },

  async deleteSessionMedia(sessionId, keys) {
    await run(AUDIO, 'readwrite', (store) => {
      for (const key of keys) store.delete(key);
    }).catch(() => undefined);
    await run(VIDEO, 'readwrite', (store) => {
      for (const key of keys) store.delete(key);
    }).catch(() => undefined);
    // Orphans written before the session record was updated.
    const audio = (await run<AudioRecord[]>(AUDIO, 'readonly', (store) => store.getAll()).catch(() => [])) ?? [];
    const orphans = audio.filter((record) => record.sessionId === sessionId).map((record) => record.key);
    if (orphans.length) {
      await run(AUDIO, 'readwrite', (store) => {
        for (const key of orphans) store.delete(key);
      }).catch(() => undefined);
    }
  },
};
