import type { UploadSessionState } from '../../types';
import { ApiError, type PremindApiClient } from './client';
import { ResumableUploader } from './resumable-upload';
import type { SessionManager } from './session-manager';

const mockFiles = new Map<string, Uint8Array | null>();

jest.mock('expo-file-system', () => ({
  FileMode: { ReadOnly: 'r' },
  File: class {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get exists() {
      return mockFiles.get(this.uri) !== undefined;
    }

    get size() {
      return mockFiles.get(this.uri)?.length ?? null;
    }

    open() {
      const bytes = mockFiles.get(this.uri);
      const handle = {
        offset: 0,
        readBytes(length: number) {
          if (!bytes) {
            throw new Error('파일이 없습니다.');
          }
          return bytes.slice(handle.offset, handle.offset + length);
        },
        close: jest.fn(),
      };
      return handle;
    }
  },
}));

/** Passes every operation the real access token; refresh is tested elsewhere. */
const sessions = {
  authorize: <T,>(operation: (token: string) => Promise<T>) =>
    operation('access-token'),
} as unknown as SessionManager;

function sessionState(overrides: Partial<UploadSessionState> = {}): UploadSessionState {
  return {
    uploadId: 'upload-1',
    status: 'pending',
    totalBytes: 25,
    chunkSize: 10,
    chunkCount: 3,
    receivedChunks: [],
    receivedBytes: 0,
    recordingId: null,
    ...overrides,
  };
}

function input(uri = 'file:///documents/lecture.m4a') {
  return {
    clientReference: 'material-1',
    uri,
    fileName: 'lecture.m4a',
    contentType: 'audio/mp4',
    title: '2주차 강의',
    durationMs: 1_500_000,
    markers: [{ timestampMs: 42_000 }],
  };
}

beforeEach(() => {
  mockFiles.clear();
  mockFiles.set(
    'file:///documents/lecture.m4a',
    Uint8Array.from({ length: 25 }, (_value, index) => index),
  );
});

describe('ResumableUploader', () => {
  it('adopts an idempotently completed upload before requiring the local source', async () => {
    const missingUri = 'file:///documents/already-uploaded.m4a';
    mockFiles.delete(missingUri);
    const client = {
      initUpload: jest.fn(async () =>
        sessionState({ status: 'completed', recordingId: 'recording-existing' }),
      ),
      putChunk: jest.fn(),
      completeUpload: jest.fn(),
    } as unknown as PremindApiClient;

    const result = await new ResumableUploader(client, sessions).upload({
      ...input(missingUri),
      sizeBytes: 25,
    });

    expect(result).toEqual({
      uploadId: 'upload-1',
      recordingId: 'recording-existing',
    });
    expect(client.putChunk).not.toHaveBeenCalled();
  });

  it('splits the file with the size the server chose and completes', async () => {
    const putChunk = jest.fn(
      async (
        _token: string,
        _uploadId: string,
        index: number,
        bytes: Uint8Array,
      ) => ({
        receivedChunks: Array.from({ length: index + 1 }, (_v, i) => i),
        receivedBytes: Math.min(25, (index + 1) * 10),
        sentBytes: bytes.length,
      }),
    );
    const client = {
      initUpload: jest.fn(async () => sessionState()),
      putChunk,
      completeUpload: jest.fn(async () => 'recording-9'),
    } as unknown as PremindApiClient;

    const progress: number[] = [];
    const result = await new ResumableUploader(client, sessions).upload(input(), {
      onProgress: ({ fraction }) => progress.push(fraction),
    });

    expect(result).toEqual({ uploadId: 'upload-1', recordingId: 'recording-9' });
    expect(putChunk.mock.calls.map(([, , index]) => index)).toEqual([0, 1, 2]);
    // The last chunk is the remainder, not a full-size one.
    expect(putChunk.mock.calls.map(([, , , bytes]) => bytes.length)).toEqual([
      10, 10, 5,
    ]);
    // …and it is the right slice of the file, not a re-read of the start.
    expect([...(putChunk.mock.calls[2]?.[3] ?? [])]).toEqual([20, 21, 22, 23, 24]);
    expect(progress.at(-1)).toBe(1);
  });

  it('sends only the chunks the server has not already got', async () => {
    const putChunk = jest.fn(
      async (_token: string, _uploadId: string, _index: number) => ({
        receivedChunks: [0, 1],
        receivedBytes: 20,
      }),
    );
    const client = {
      initUpload: jest.fn(async () =>
        sessionState({ receivedChunks: [0, 2], receivedBytes: 15 }),
      ),
      putChunk,
      completeUpload: jest.fn(async () => 'recording-9'),
    } as unknown as PremindApiClient;

    await new ResumableUploader(client, sessions).upload(input());

    expect(putChunk).toHaveBeenCalledTimes(1);
    expect(putChunk.mock.calls[0]?.[2]).toBe(1);
  });

  it('adopts an upload a previous run already completed', async () => {
    const client = {
      initUpload: jest.fn(async () =>
        sessionState({ status: 'completed', recordingId: 'recording-earlier' }),
      ),
      putChunk: jest.fn(),
      completeUpload: jest.fn(),
    } as unknown as PremindApiClient;

    await expect(
      new ResumableUploader(client, sessions).upload(input()),
    ).resolves.toEqual({
      uploadId: 'upload-1',
      recordingId: 'recording-earlier',
    });
    expect(client.putChunk).not.toHaveBeenCalled();
    expect(client.completeUpload).not.toHaveBeenCalled();
  });

  it('retries a chunk that failed on the network, then carries on', async () => {
    const putChunk = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('네트워크', { code: 'NETWORK' }))
      .mockImplementation(async (_t, _u, index: number) => ({
        receivedChunks: Array.from({ length: index + 1 }, (_v, i) => i),
        receivedBytes: Math.min(25, (index + 1) * 10),
      }));
    const client = {
      initUpload: jest.fn(async () => sessionState()),
      putChunk,
      completeUpload: jest.fn(async () => 'recording-9'),
    } as unknown as PremindApiClient;
    const sleep = jest.fn(async () => undefined);

    await new ResumableUploader(client, sessions).upload(input(), { sleep });

    expect(putChunk).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('gives up immediately on a failure retrying cannot fix', async () => {
    const putChunk = jest
      .fn()
      .mockRejectedValue(new ApiError('용량을 초과했어요.', { status: 413 }));
    const client = {
      initUpload: jest.fn(async () => sessionState()),
      putChunk,
      completeUpload: jest.fn(),
    } as unknown as PremindApiClient;
    const sleep = jest.fn(async () => undefined);

    await expect(
      new ResumableUploader(client, sessions).upload(input(), { sleep }),
    ).rejects.toMatchObject({ status: 413 });
    expect(putChunk).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(client.completeUpload).not.toHaveBeenCalled();
  });

  it('stops on abort without completing the upload', async () => {
    const controller = new AbortController();
    const putChunk = jest.fn(async (_t, _u, index: number) => {
      controller.abort();
      return {
        receivedChunks: [index],
        receivedBytes: 10,
      };
    });
    const client = {
      initUpload: jest.fn(async () => sessionState()),
      putChunk,
      completeUpload: jest.fn(),
    } as unknown as PremindApiClient;

    await expect(
      new ResumableUploader(client, sessions).upload(input(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.completeUpload).not.toHaveBeenCalled();
  });

  it('refuses a source file that is no longer on the device', async () => {
    const client = {
      initUpload: jest.fn(),
    } as unknown as PremindApiClient;

    await expect(
      new ResumableUploader(client, sessions).upload(input('file:///gone.m4a')),
    ).rejects.toMatchObject({ name: 'UploadSourceMissingError' });
    expect(client.initUpload).not.toHaveBeenCalled();
  });
});
