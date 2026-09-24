const DATABASE_NAME = 'premind-local-media';
const DATABASE_VERSION = 2;
const STORE_NAME = 'sources';
const RECORDING_CHUNK_STORE_NAME = 'recording-chunks';
const RECORDING_CHUNK_SESSION_INDEX = 'sessionId';
const URI_PREFIX = 'premind-web-media:';
const RECORDING_CHECKPOINT_URI_PREFIX = 'premind-web-recording-checkpoint:';

interface StoredWebMedia {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
}

interface StoredWebRecordingChunk {
  key: string;
  sessionId: string;
  index: number;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

export interface PersistedWebMedia {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface WebRecordingCheckpointPart {
  index: number;
  blob: Blob;
  mimeType: string;
}

export interface PersistWebMediaInput {
  sourceUri: string;
  storageKey: string;
  name: string;
  mimeType?: string;
}

export function isPersistedWebMediaUri(uri: string): boolean {
  return uri.startsWith(URI_PREFIX);
}

/** A durable, incrementally-written browser recording that can survive reloads. */
export function isWebRecordingCheckpointUri(uri: string): boolean {
  return uri.startsWith(RECORDING_CHECKPOINT_URI_PREFIX);
}

function idFromUri(uri: string): string | null {
  if (!isPersistedWebMediaUri(uri)) return null;
  try {
    return decodeURIComponent(uri.slice(URI_PREFIX.length)) || null;
  } catch {
    return null;
  }
}

function uriFor(id: string): string {
  return `${URI_PREFIX}${encodeURIComponent(id)}`;
}

function checkpointIdFromUri(uri: string): string | null {
  if (!isWebRecordingCheckpointUri(uri)) return null;
  try {
    return decodeURIComponent(uri.slice(RECORDING_CHECKPOINT_URI_PREFIX.length)) || null;
  } catch {
    return null;
  }
}

export function webRecordingCheckpointUri(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized) {
    throw new Error('녹음 복구 ID를 확인하지 못했어요.');
  }
  return `${RECORDING_CHECKPOINT_URI_PREFIX}${encodeURIComponent(normalized)}`;
}

/** Fails before capture starts when durable browser storage is unavailable. */
export async function prepareWebRecordingCheckpoint(
  sessionId: string,
): Promise<void> {
  if (!sessionId.trim()) {
    throw new Error('녹음 복구 ID를 확인하지 못했어요.');
  }
  const database = await openDatabase();
  database.close();
}

function nameForMimeType(name: string, mimeType: string): string {
  const extension =
    mimeType === 'audio/webm'
      ? '.webm'
      : mimeType === 'audio/mp4'
        ? '.m4a'
        : mimeType === 'video/webm'
          ? '.webm'
          : mimeType === 'video/mp4'
            ? '.mp4'
            : null;
  if (!extension) return name;
  const stem = name.replace(/\.[^.]+$/, '') || 'source';
  return `${stem}${extension}`;
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('이 브라우저에서는 로컬 원본 보관을 사용할 수 없어요.');
  }
  return indexedDB;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = requireIndexedDb().open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(RECORDING_CHUNK_STORE_NAME)) {
        const chunkStore = database.createObjectStore(
          RECORDING_CHUNK_STORE_NAME,
          { keyPath: 'key' },
        );
        chunkStore.createIndex(
          RECORDING_CHUNK_SESSION_INDEX,
          'sessionId',
          { unique: false },
        );
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('브라우저 저장소를 열지 못했어요.'));
  });
}

async function getRecordingChunks(
  sessionId: string,
): Promise<StoredWebRecordingChunk[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(RECORDING_CHUNK_STORE_NAME, 'readonly')
        .objectStore(RECORDING_CHUNK_STORE_NAME)
        .index(RECORDING_CHUNK_SESSION_INDEX)
        .getAll(IDBKeyRange.only(sessionId));
      request.onsuccess = () =>
        resolve(
          (request.result as StoredWebRecordingChunk[]).sort(
            (left, right) => left.index - right.index,
          ),
        );
      request.onerror = () =>
        reject(request.error ?? new Error('녹음 복구 조각을 읽지 못했어요.'));
    });
  } finally {
    database.close();
  }
}

export async function readWebRecordingCheckpointParts(
  sessionId: string,
): Promise<WebRecordingCheckpointPart[]> {
  return (await getRecordingChunks(sessionId)).map((chunk) => ({
    index: chunk.index,
    blob: chunk.blob,
    mimeType: chunk.mimeType,
  }));
}

/** Stores one MediaRecorder chunk without rewriting the chunks already saved. */
export async function appendWebRecordingCheckpointChunk(
  sessionId: string,
  index: number,
  blob: Blob,
): Promise<void> {
  if (!sessionId.trim() || !Number.isSafeInteger(index) || index < 0) {
    throw new Error('녹음 복구 조각 정보를 확인하지 못했어요.');
  }
  if (blob.size <= 0) return;

  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        RECORDING_CHUNK_STORE_NAME,
        'readwrite',
      );
      const chunk: StoredWebRecordingChunk = {
        key: `${sessionId}:${index.toString().padStart(10, '0')}`,
        sessionId,
        index,
        blob,
        mimeType: blob.type || 'audio/webm',
        createdAt: new Date().toISOString(),
      };
      transaction.objectStore(RECORDING_CHUNK_STORE_NAME).put(chunk);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error('녹음 복구 조각을 보관하지 못했어요.'),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error('녹음 복구 조각 보관이 중단됐어요.'),
        );
    });
  } finally {
    database.close();
  }
}

export async function readWebRecordingCheckpointBlob(
  sessionId: string,
): Promise<Blob> {
  const chunks = await readWebRecordingCheckpointParts(sessionId);
  if (chunks.length === 0) {
    throw new Error('복구할 수 있는 녹음 원본 조각이 아직 없어요.');
  }
  const blob = new Blob(
    chunks.map((chunk) => chunk.blob),
    { type: chunks[0]?.mimeType || 'audio/webm' },
  );
  if (blob.size <= 0) {
    throw new Error('보관된 녹음 원본이 비어 있어요.');
  }
  return blob;
}

export async function clearWebRecordingCheckpoint(
  sessionId: string,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        RECORDING_CHUNK_STORE_NAME,
        'readwrite',
      );
      const store = transaction.objectStore(RECORDING_CHUNK_STORE_NAME);
      const cursorRequest = store
        .index(RECORDING_CHUNK_SESSION_INDEX)
        .openKeyCursor(IDBKeyRange.only(sessionId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      cursorRequest.onerror = () => transaction.abort();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error('녹음 복구 조각을 정리하지 못했어요.'),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error('녹음 복구 조각 정리가 중단됐어요.'),
        );
    });
  } finally {
    database.close();
  }
}

/**
 * Removes one app-owned browser source.
 *
 * Callers pass the opaque URI stored on a material or recovery snapshot. URLs
 * outside PREMIND's IndexedDB namespace are deliberately ignored so account
 * cleanup can never delete a user-selected file outside the app sandbox.
 */
export async function deleteWebMediaSource(uri: string): Promise<void> {
  const storedId = idFromUri(uri);
  if (storedId) {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(storedId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(
            transaction.error ??
              new Error('브라우저 원본을 삭제하지 못했어요.'),
          );
        transaction.onabort = () =>
          reject(
            transaction.error ??
              new Error('브라우저 원본 삭제가 중단됐어요.'),
          );
      });
    } finally {
      database.close();
    }
    return;
  }

  const checkpointId = checkpointIdFromUri(uri);
  if (checkpointId) {
    await clearWebRecordingCheckpoint(checkpointId);
  }
}

async function getStoredMedia(id: string): Promise<StoredWebMedia | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(id);
      request.onsuccess = () =>
        resolve((request.result as StoredWebMedia | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error('보관된 원본을 읽지 못했어요.'));
    });
  } finally {
    database.close();
  }
}

async function putStoredMedia(media: StoredWebMedia): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(media);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error('브라우저에 원본을 보관하지 못했어요.'),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error('브라우저 원본 보관이 중단됐어요.'),
        );
    });
  } finally {
    database.close();
  }
}

async function blobFromSource(sourceUri: string): Promise<Blob> {
  const storedId = idFromUri(sourceUri);
  if (storedId) {
    const stored = await getStoredMedia(storedId);
    if (!stored) {
      throw new Error('브라우저 저장소에서 원본을 찾지 못했어요.');
    }
    return stored.blob;
  }

  const checkpointId = checkpointIdFromUri(sourceUri);
  if (checkpointId) {
    return readWebRecordingCheckpointBlob(checkpointId);
  }

  let response: Response;
  try {
    response = await fetch(sourceUri);
  } catch {
    throw new Error('브라우저가 선택한 원본을 읽지 못했어요.');
  }
  if (!response.ok && response.status !== 0) {
    throw new Error('브라우저가 선택한 원본을 읽지 못했어요.');
  }
  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error('선택한 원본 파일이 비어 있어요.');
  }
  return blob;
}

/** Copies a browser Blob URL into IndexedDB so reloads do not invalidate it. */
export async function persistWebMediaSource(
  input: PersistWebMediaInput,
): Promise<PersistedWebMedia> {
  const existingId = idFromUri(input.sourceUri);
  if (existingId) {
    const existing = await getStoredMedia(existingId);
    if (!existing) {
      throw new Error('브라우저 저장소에서 원본을 찾지 못했어요.');
    }
    return {
      uri: uriFor(existing.id),
      name: existing.name,
      mimeType: existing.mimeType,
      sizeBytes: existing.sizeBytes,
    };
  }

  const blob = await blobFromSource(input.sourceUri);
  const id = input.storageKey.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'source';
  const mimeType = blob.type || input.mimeType || 'application/octet-stream';
  const media: StoredWebMedia = {
    id,
    blob,
    name: nameForMimeType(input.name, mimeType),
    mimeType,
    sizeBytes: blob.size,
    updatedAt: new Date().toISOString(),
  };
  try {
    await putStoredMedia(media);
  } catch {
    throw new Error(
      '브라우저 저장 공간에 원본을 보관하지 못했어요. 저장 공간을 확인해 주세요.',
    );
  }
  return {
    uri: uriFor(media.id),
    name: media.name,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
  };
}

/** Returns the durable Blob for upload or creates a temporary playback URL. */
export async function readWebMediaBlob(uri: string): Promise<Blob> {
  return blobFromSource(uri);
}

export async function createWebMediaPlaybackUrl(
  uri: string,
): Promise<{ uri: string; release: () => void }> {
  if (!isPersistedWebMediaUri(uri) && !isWebRecordingCheckpointUri(uri)) {
    return { uri, release: () => undefined };
  }
  const blob = await readWebMediaBlob(uri);
  const objectUrl = URL.createObjectURL(blob);
  return {
    uri: objectUrl,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}

/** Best-effort metadata read; unsupported codecs remain explicitly unknown. */
export async function readWebMediaDurationMs(
  uri: string,
  kind: 'audio' | 'video',
): Promise<number | undefined> {
  if (typeof document === 'undefined') return undefined;
  let playback: { uri: string; release: () => void } | null = null;
  try {
    playback = await createWebMediaPlaybackUrl(uri);
    return await new Promise<number | undefined>((resolve) => {
      const element = document.createElement(kind);
      let finished = false;
      const finish = (value?: number) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        element.onloadedmetadata = null;
        element.onerror = null;
        element.removeAttribute('src');
        element.load();
        resolve(value);
      };
      const timeout = setTimeout(() => finish(), 8_000);
      element.preload = 'metadata';
      element.onloadedmetadata = () => {
        const durationMs = element.duration * 1_000;
        finish(
          Number.isFinite(durationMs) && durationMs > 0
            ? Math.round(durationMs)
            : undefined,
        );
      };
      element.onerror = () => finish();
      element.src = playback?.uri ?? '';
    });
  } catch {
    return undefined;
  } finally {
    playback?.release();
  }
}
