import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export const RECORDING_SESSION_SCHEMA_VERSION = 1 as const;
export const RECORDING_SNAPSHOT_INTERVAL_MS = 5_000;
export const RECORDING_DIRECTORY_NAME = 'premind-recordings';

const LEGACY_RECORDING_SESSIONS_KEY = 'premind.rn.recording-sessions.v1';
const RECORDING_SESSIONS_KEY_PREFIX =
  'premind.rn.recording-sessions.v1.workspace.';
const UNASSIGNED_RECORDING_SESSIONS_KEY =
  'premind.rn.recording-sessions.v1.unassigned';

export interface ActivateRecordingWorkspaceOptions {
  /** Claim legacy metadata only for a session restored across the upgrade. */
  migrateLegacy?: boolean;
}

export type RecordingSessionStatus =
  | 'recording'
  | 'paused'
  | 'completed'
  | 'interrupted'
  | 'failed';

export type RecordingUploadStatus =
  | 'pending'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface RecordingSessionMarkerSnapshot {
  id: string;
  timestampMillis: number;
  createdAt: string;
  label?: string;
}

export interface RecordingSessionSnapshot {
  schemaVersion: typeof RECORDING_SESSION_SCHEMA_VERSION;
  id: string;
  projectId?: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  localFileUri: string | null;
  durationMillis: number;
  status: RecordingSessionStatus;
  uploadStatus: RecordingUploadStatus;
  markers: readonly RecordingSessionMarkerSnapshot[];
  updatedAt: string;
}

export interface PreservedRecordingFile {
  sourceUri: string;
  uri: string;
  name: string;
  sizeBytes: number;
}

export interface FinalizedRecordingSession {
  session: RecordingSessionSnapshot;
  file: PreservedRecordingFile;
}

export type RecordingSnapshotReader = () =>
  | RecordingSessionSnapshot
  | null
  | Promise<RecordingSessionSnapshot | null>;

export interface SnapshotPersistenceOptions {
  /** Defaults to the product recovery cadence of five seconds. */
  intervalMillis?: number;
  /** Timer writes are best-effort and report failures here instead of throwing globally. */
  onError?: (error: unknown) => void;
}

export interface SnapshotPersistenceHandle {
  readonly intervalMillis: number;
  flush(): Promise<void>;
  /** Stops the timer and performs a final flush unless explicitly disabled. */
  stop(options?: { flush?: boolean }): Promise<void>;
}

type RecordingStorage = Pick<
  AsyncStorageStatic,
  'getItem' | 'setItem' | 'removeItem'
>;

const SESSION_STATUSES = new Set<RecordingSessionStatus>([
  'recording',
  'paused',
  'completed',
  'interrupted',
  'failed',
]);

const UPLOAD_STATUSES = new Set<RecordingUploadStatus>([
  'pending',
  'uploading',
  'completed',
  'failed',
]);

let finalFileSequence = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function markerFrom(value: unknown): RecordingSessionMarkerSnapshot | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isFiniteNonNegativeNumber(value.timestampMillis) ||
    !isNonEmptyString(value.createdAt) ||
    (value.label !== undefined && typeof value.label !== 'string')
  ) {
    return null;
  }

  return {
    id: value.id,
    timestampMillis: Math.round(value.timestampMillis),
    createdAt: value.createdAt,
    ...(value.label === undefined ? {} : { label: value.label }),
  };
}

function snapshotFrom(value: unknown): RecordingSessionSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== RECORDING_SESSION_SCHEMA_VERSION ||
    !isNonEmptyString(value.id) ||
    (value.projectId !== undefined && typeof value.projectId !== 'string') ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.startedAt) ||
    !isNullableString(value.endedAt) ||
    !isNullableString(value.localFileUri) ||
    !isFiniteNonNegativeNumber(value.durationMillis) ||
    typeof value.status !== 'string' ||
    !SESSION_STATUSES.has(value.status as RecordingSessionStatus) ||
    typeof value.uploadStatus !== 'string' ||
    !UPLOAD_STATUSES.has(value.uploadStatus as RecordingUploadStatus) ||
    !Array.isArray(value.markers) ||
    !isNonEmptyString(value.updatedAt)
  ) {
    return null;
  }

  const markers = value.markers
    .map(markerFrom)
    .filter((marker): marker is RecordingSessionMarkerSnapshot => marker !== null);

  return {
    schemaVersion: RECORDING_SESSION_SCHEMA_VERSION,
    id: value.id,
    ...(value.projectId === undefined ? {} : { projectId: value.projectId }),
    title: value.title,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    localFileUri: value.localFileUri,
    durationMillis: Math.round(value.durationMillis),
    status: value.status as RecordingSessionStatus,
    uploadStatus: value.uploadStatus as RecordingUploadStatus,
    markers,
    updatedAt: value.updatedAt,
  };
}

function decodeSnapshots(encoded: string | null): RecordingSessionSnapshot[] {
  if (!encoded) {
    return [];
  }

  try {
    const decoded: unknown = JSON.parse(encoded);
    if (!Array.isArray(decoded)) {
      return [];
    }
    return decoded
      .map(snapshotFrom)
      .filter((snapshot): snapshot is RecordingSessionSnapshot => snapshot !== null);
  } catch {
    return [];
  }
}

function cloneSnapshot(snapshot: RecordingSessionSnapshot): RecordingSessionSnapshot {
  return {
    ...snapshot,
    markers: snapshot.markers.map((marker) => ({ ...marker })),
  };
}

function recordingSessionsKey(workspaceId: string | null): string {
  return workspaceId
    ? `${RECORDING_SESSIONS_KEY_PREFIX}${encodeURIComponent(workspaceId)}`
    : UNASSIGNED_RECORDING_SESSIONS_KEY;
}

function safeFilePart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'recording';
}

function safeExtension(source: File): string {
  return /^\.[a-zA-Z0-9]{1,10}$/.test(source.extension)
    ? source.extension.toLowerCase()
    : '.m4a';
}

/**
 * Recovery metadata and durable-file boundary for native lecture recordings.
 * Metadata removal never removes audio; finalization copies the cache source.
 */
export class RecordingSessionRepository {
  private static operationTail: Promise<void> = Promise.resolve();
  private workspaceId: string | null;
  private readonly snapshotWorkspaceKeys = new Map<string, string>();

  constructor(
    private readonly storage: RecordingStorage = AsyncStorage,
    workspaceId: string | null = null,
  ) {
    this.workspaceId = workspaceId || null;
  }

  /**
   * Switches the recovery namespace before any screen for the new account can
   * mount. Queued operations retain the key captured when they were requested,
   * so an account change cannot redirect an older write into the new workspace.
   */
  activateWorkspace(
    workspaceId: string | null,
    options: ActivateRecordingWorkspaceOptions = {},
  ): Promise<void> {
    this.workspaceId = workspaceId || null;
    const destinationKey = recordingSessionsKey(this.workspaceId);
    if (!this.workspaceId || !options.migrateLegacy) {
      return Promise.resolve();
    }

    return this.serialized(async () => {
      const legacyEncoded = await this.storage.getItem(
        LEGACY_RECORDING_SESSIONS_KEY,
      );
      if (!legacyEncoded) {
        return;
      }

      const legacy = decodeSnapshots(legacyEncoded);
      if (legacy.length === 0) {
        // Invalid legacy data remains isolated instead of being assigned to an
        // account or silently destroyed.
        return;
      }

      const scoped = decodeSnapshots(await this.storage.getItem(destinationKey));
      const merged = new Map(legacy.map((snapshot) => [snapshot.id, snapshot]));
      for (const snapshot of scoped) {
        // The already-scoped value is newer and has explicit ownership.
        merged.set(snapshot.id, snapshot);
      }

      await this.storage.setItem(
        destinationKey,
        JSON.stringify([...merged.values()]),
      );
      // Persist the owned copy before removing the legacy key for crash safety.
      await this.storage.removeItem(LEGACY_RECORDING_SESSIONS_KEY);
    });
  }

  save(snapshot: RecordingSessionSnapshot): Promise<void> {
    const normalized = snapshotFrom(snapshot);
    if (!normalized) {
      return Promise.reject(new Error('Invalid recording session snapshot.'));
    }
    const key =
      this.snapshotWorkspaceKeys.get(normalized.id) ??
      recordingSessionsKey(this.workspaceId);
    return this.saveNormalizedToKey(normalized, key);
  }

  private saveToKey(
    snapshot: RecordingSessionSnapshot,
    key: string,
  ): Promise<void> {
    const normalized = snapshotFrom(snapshot);
    if (!normalized) {
      return Promise.reject(new Error('Invalid recording session snapshot.'));
    }
    return this.saveNormalizedToKey(normalized, key);
  }

  private saveNormalizedToKey(
    normalized: RecordingSessionSnapshot,
    key: string,
  ): Promise<void> {
    // Once a recording is created, later interruption/finalization callbacks
    // retain that ownership even if an account switch happens mid-await.
    this.snapshotWorkspaceKeys.set(normalized.id, key);
    return this.serialized(async () => {
      const sessions = decodeSnapshots(
        await this.storage.getItem(key),
      );
      const index = sessions.findIndex((session) => session.id === normalized.id);
      if (index === -1) {
        sessions.push(normalized);
      } else {
        sessions[index] = normalized;
      }
      await this.storage.setItem(key, JSON.stringify(sessions));
    });
  }

  get(id: string): Promise<RecordingSessionSnapshot | null> {
    const key = recordingSessionsKey(this.workspaceId);
    return this.serialized(async () => {
      const sessions = decodeSnapshots(
        await this.storage.getItem(key),
      );
      const session = sessions.find((candidate) => candidate.id === id);
      if (session) {
        this.snapshotWorkspaceKeys.set(session.id, key);
      }
      return session ? cloneSnapshot(session) : null;
    });
  }

  getAll(): Promise<RecordingSessionSnapshot[]> {
    const key = recordingSessionsKey(this.workspaceId);
    return this.serialized(async () => {
      const sessions = decodeSnapshots(
        await this.storage.getItem(key),
      );
      sessions.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      for (const session of sessions) {
        this.snapshotWorkspaceKeys.set(session.id, key);
      }
      return sessions.map(cloneSnapshot);
    });
  }

  getRecoverable(): Promise<RecordingSessionSnapshot[]> {
    return this.getAll().then((sessions) =>
      sessions.filter(
        (session) =>
          session.status !== 'completed' || session.uploadStatus !== 'completed',
      ),
    );
  }

  /** Remove every recovery-metadata row owned by one deleted account. */
  clearWorkspace(workspaceId: string): Promise<void> {
    const key = recordingSessionsKey(workspaceId || null);
    return this.serialized(async () => {
      await this.storage.removeItem(key);
      for (const [snapshotId, snapshotKey] of this.snapshotWorkspaceKeys) {
        if (snapshotKey === key) {
          this.snapshotWorkspaceKeys.delete(snapshotId);
        }
      }
    });
  }

  /** Removes only recovery metadata. Any source or preserved recording remains. */
  remove(id: string): Promise<void> {
    const key =
      this.snapshotWorkspaceKeys.get(id) ??
      recordingSessionsKey(this.workspaceId);
    return this.serialized(async () => {
      const sessions = decodeSnapshots(
        await this.storage.getItem(key),
      ).filter((session) => session.id !== id);
      if (sessions.length === 0) {
        await this.storage.removeItem(key);
        return;
      }
      await this.storage.setItem(key, JSON.stringify(sessions));
    });
  }

  /**
   * Starts an immediate recovery write followed by serialized interval writes.
   * The reader is evaluated at write time, so each persisted value is current.
   */
  startSnapshotPersistence(
    readSnapshot: RecordingSnapshotReader,
    options: SnapshotPersistenceOptions = {},
  ): SnapshotPersistenceHandle {
    const intervalMillis = options.intervalMillis ?? RECORDING_SNAPSHOT_INTERVAL_MS;
    if (!Number.isFinite(intervalMillis) || intervalMillis <= 0) {
      throw new Error('Snapshot interval must be a positive number.');
    }

    let stopped = false;
    let flushTail: Promise<void> = Promise.resolve();
    // A persistence handle belongs to the account that started the recording.
    // Capture its key once so a logout that races the final flush cannot move
    // the old account's recovery metadata into the next account's namespace.
    const key = recordingSessionsKey(this.workspaceId);

    const flush = (): Promise<void> => {
      if (stopped) {
        return Promise.resolve();
      }
      const next = flushTail.catch(() => undefined).then(async () => {
        const snapshot = await readSnapshot();
        if (snapshot) {
          await this.saveToKey(snapshot, key);
        }
      });
      flushTail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };

    const reportTimerError = (error: unknown) => options.onError?.(error);
    void flush().catch(reportTimerError);
    const timer = setInterval(() => {
      void flush().catch(reportTimerError);
    }, intervalMillis);

    return {
      intervalMillis,
      flush,
      stop: async (stopOptions = {}) => {
        if (stopped) {
          return;
        }
        clearInterval(timer);
        if (stopOptions.flush !== false) {
          await flush();
        }
        stopped = true;
      },
    };
  }

  /**
   * Copies a completed cache recording into durable document storage. `copy`
   * intentionally leaves the source URI untouched for retry/recovery safety.
   */
  async copyFinalFile(
    sourceUri: string,
    sessionId: string,
  ): Promise<PreservedRecordingFile> {
    const source = new File(sourceUri);
    if (!source.exists || source.size <= 0) {
      throw new Error('The completed recording file is missing or empty.');
    }

    const directory = new Directory(Paths.document, RECORDING_DIRECTORY_NAME);
    directory.create({ intermediates: true, idempotent: true });

    const extension = safeExtension(source);
    const prefix = `premind-${safeFilePart(sessionId)}-${Date.now().toString(36)}`;
    let destination: File;
    do {
      finalFileSequence += 1;
      destination = new File(
        directory,
        `${prefix}-${finalFileSequence.toString(36)}${extension}`,
      );
    } while (destination.exists);

    await source.copy(destination);
    if (!destination.exists || destination.size !== source.size) {
      throw new Error('The completed recording could not be copied safely.');
    }

    return {
      sourceUri,
      uri: destination.uri,
      name: destination.name,
      sizeBytes: destination.size,
    };
  }

  async finalize(
    snapshot: RecordingSessionSnapshot,
    sourceUri = snapshot.localFileUri,
  ): Promise<FinalizedRecordingSession> {
    if (!sourceUri) {
      throw new Error('A completed recording URI is required.');
    }

    // Copying may take long enough for a logout/account switch to happen. Keep
    // completion metadata owned by the workspace that initiated finalization.
    const key =
      this.snapshotWorkspaceKeys.get(snapshot.id) ??
      recordingSessionsKey(this.workspaceId);
    const file = await this.copyFinalFile(sourceUri, snapshot.id);
    const now = new Date().toISOString();
    const session: RecordingSessionSnapshot = {
      ...cloneSnapshot(snapshot),
      endedAt: snapshot.endedAt ?? now,
      localFileUri: file.uri,
      status: 'completed',
      updatedAt: now,
    };
    await this.saveToKey(session, key);
    return { session, file };
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = RecordingSessionRepository.operationTail
      .catch(() => undefined)
      .then(operation);
    RecordingSessionRepository.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export const recordingSessionRepository = new RecordingSessionRepository();
