import { File, FileMode } from 'expo-file-system';
import { Platform } from 'react-native';

import { readWebMediaBlob } from '@/features/files/web-media-store';
import type { UploadMarkerInput, UploadSessionState } from '../../types';
import { ApiError, type PremindApiClient } from './client';
import type { SessionManager } from './session-manager';

export interface ResumableUploadInput {
  /** The device-side material id. Makes the whole upload idempotent. */
  clientReference: string;
  uri: string;
  fileName: string;
  contentType: string;
  title: string;
  /** Persisted metadata lets an idempotent completed upload recover without the local file. */
  sizeBytes?: number;
  durationMs?: number;
  markers?: UploadMarkerInput[];
}

export interface ResumableUploadProgress {
  sentBytes: number;
  totalBytes: number;
  /** 0…1. Reaches 1 only once every chunk has been acknowledged. */
  fraction: number;
}

export interface ResumableUploadOptions {
  onProgress?: (progress: ResumableUploadProgress) => void;
  signal?: AbortSignal;
  /** Test seam. Production waits between failed chunk attempts. */
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface ResumableUploadResult {
  uploadId: string;
  recordingId: string;
}

export class UploadSourceMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadSourceMissingError';
  }
}

const MAX_CHUNK_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 15_000;

function abortError(): Error {
  const error = new Error('업로드를 중단했어요.');
  error.name = 'AbortError';
  return error;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Exponential backoff with jitter. The jitter is not decoration: a lecture hall
 * full of phones that all lost Wi-Fi at the same moment would otherwise retry
 * in lockstep.
 */
function backoffMs(attempt: number): number {
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

/**
 * A failure worth another attempt: the bytes did not land, but nothing about
 * the request itself was wrong. A 4xx (a rejected token, a session the server
 * has forgotten, a body it will not take) is final — retrying it just delays
 * the error the user needs to see.
 */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return true;
  }
  return error.status !== undefined && error.status >= 500;
}

/**
 * Uploads one local recording to the server in resumable chunks.
 *
 * The server owns the chunk size and the record of which chunks have landed
 * (it derives that from the bytes actually staged on disk), so this class never
 * assumes: it asks, sends only what is missing, and asks again. That is what
 * makes an interrupted three-hour lecture resume instead of restarting — the
 * whole reason a recorder needs its own upload path.
 */
export class ResumableUploader {
  constructor(
    private readonly client: PremindApiClient,
    private readonly sessions: SessionManager,
  ) {}

  async upload(
    input: ResumableUploadInput,
    options: ResumableUploadOptions = {},
  ): Promise<ResumableUploadResult> {
    const sleep = options.sleep ?? defaultSleep;
    let file: File | null = null;
    let webBlob: Blob | null = null;
    let totalBytes =
      input.sizeBytes && input.sizeBytes > 0 ? input.sizeBytes : 0;

    const loadLocalSource = async (): Promise<number> => {
      if (Platform.OS === 'web') {
        try {
          webBlob = await readWebMediaBlob(input.uri);
          return webBlob.size;
        } catch (error) {
          throw new UploadSourceMissingError(
            error instanceof Error
              ? error.message
              : '브라우저 저장소에서 원본을 찾지 못했어요.',
          );
        }
      }
      file = new File(input.uri);
      if (!file.exists) {
        throw new UploadSourceMissingError(
          '원본 파일을 찾을 수 없어요. 기기에서 삭제되었을 수 있어요.',
        );
      }
      return file.size ?? 0;
    };

    // Old snapshots may not contain the byte count. Only those need the local
    // source before the idempotency handshake.
    if (totalBytes <= 0) {
      totalBytes = await loadLocalSource();
      if (totalBytes <= 0) {
        throw new UploadSourceMissingError('원본 파일이 비어 있어요.');
      }
    }

    this.throwIfAborted(options.signal);
    let session = await this.sessions.authorize((token) =>
      this.client.initUpload(
        token,
        {
          clientReference: input.clientReference,
          filename: input.fileName,
          totalBytes,
          contentType: input.contentType,
          title: input.title,
          durationMs: input.durationMs,
          markers: input.markers,
        },
        options.signal,
      ),
    );

    // An earlier run may have finished the whole upload and lost the answer on
    // its way back (the app was killed, the network dropped after the request
    // landed). Init is idempotent and reports that, so the completed session is
    // adopted rather than re-uploaded.
    if (session.status === 'completed' && session.recordingId) {
      this.report(options, session.totalBytes, session.totalBytes);
      return { uploadId: session.uploadId, recordingId: session.recordingId };
    }

    if (!file && !webBlob) {
      const actualBytes = await loadLocalSource();
      if (actualBytes <= 0) {
        throw new UploadSourceMissingError('원본 파일이 비어 있어요.');
      }
      if (actualBytes !== session.totalBytes) {
        throw new UploadSourceMissingError(
          '보관된 파일 크기가 업로드 기록과 달라요. 원본을 다시 선택해 주세요.',
        );
      }
      totalBytes = actualBytes;
    } else if (totalBytes !== session.totalBytes) {
      throw new UploadSourceMissingError(
        '보관된 파일 크기가 업로드 기록과 달라요. 원본을 다시 선택해 주세요.',
      );
    }

    session = webBlob
      ? await this.sendMissingBlobChunks(webBlob, session, options, sleep)
      : await this.sendMissingChunks(file!, session, options, sleep);

    this.throwIfAborted(options.signal);
    const recordingId = await this.sessions.authorize((token) =>
      this.client.completeUpload(token, session.uploadId, options.signal),
    );
    this.report(options, totalBytes, totalBytes);
    return { uploadId: session.uploadId, recordingId };
  }

  private async sendMissingBlobChunks(
    blob: Blob,
    session: UploadSessionState,
    options: ResumableUploadOptions,
    sleep: (milliseconds: number) => Promise<void>,
  ): Promise<UploadSessionState> {
    const { chunkSize, chunkCount, totalBytes } = session;
    const landed = new Set(session.receivedChunks);
    let sentBytes = session.receivedBytes;
    this.report(options, sentBytes, totalBytes);

    for (let index = 0; index < chunkCount; index += 1) {
      if (landed.has(index)) continue;
      this.throwIfAborted(options.signal);
      const start = index * chunkSize;
      const end = Math.min(totalBytes, start + chunkSize);
      const bytes = new Uint8Array(await blob.slice(start, end).arrayBuffer());
      const accepted = await this.putWithRetries(
        session.uploadId,
        index,
        bytes,
        options,
        sleep,
      );
      sentBytes = accepted.receivedBytes;
      for (const received of accepted.receivedChunks) landed.add(received);
      this.report(options, sentBytes, totalBytes);
    }

    return { ...session, receivedBytes: sentBytes, receivedChunks: [...landed] };
  }

  private async sendMissingChunks(
    file: File,
    session: UploadSessionState,
    options: ResumableUploadOptions,
    sleep: (milliseconds: number) => Promise<void>,
  ): Promise<UploadSessionState> {
    const { chunkSize, chunkCount, totalBytes } = session;
    const landed = new Set(session.receivedChunks);
    let sentBytes = session.receivedBytes;
    this.report(options, sentBytes, totalBytes);

    // One handle for the whole upload: reopening the file per chunk on a
    // three-hour lecture is thousands of syscalls for nothing.
    const handle = file.open(FileMode.ReadOnly);
    try {
      for (let index = 0; index < chunkCount; index += 1) {
        if (landed.has(index)) {
          continue;
        }
        this.throwIfAborted(options.signal);

        const start = index * chunkSize;
        const length = Math.min(chunkSize, totalBytes - start);
        handle.offset = start;
        const bytes = handle.readBytes(length);

        const accepted = await this.putWithRetries(
          session.uploadId,
          index,
          bytes,
          options,
          sleep,
        );
        // The server's own count is authoritative — it is derived from the
        // staged bytes, so it stays right even when a request landed twice.
        sentBytes = accepted.receivedBytes;
        for (const received of accepted.receivedChunks) {
          landed.add(received);
        }
        this.report(options, sentBytes, totalBytes);
      }
    } finally {
      handle.close();
    }

    return { ...session, receivedBytes: sentBytes, receivedChunks: [...landed] };
  }

  private async putWithRetries(
    uploadId: string,
    index: number,
    bytes: Uint8Array,
    options: ResumableUploadOptions,
    sleep: (milliseconds: number) => Promise<void>,
  ): Promise<{ receivedChunks: number[]; receivedBytes: number }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt += 1) {
      try {
        return await this.sessions.authorize((token) =>
          this.client.putChunk(token, uploadId, index, bytes, options.signal),
        );
      } catch (error) {
        if (options.signal?.aborted) {
          throw abortError();
        }
        if (!isRetryable(error) || attempt === MAX_CHUNK_ATTEMPTS) {
          throw error;
        }
        lastError = error;
        await sleep(backoffMs(attempt));
      }
    }
    throw lastError;
  }

  private report(
    options: ResumableUploadOptions,
    sentBytes: number,
    totalBytes: number,
  ): void {
    options.onProgress?.({
      sentBytes,
      totalBytes,
      fraction: totalBytes > 0 ? Math.min(1, sentBytes / totalBytes) : 0,
    });
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw abortError();
    }
  }
}
