/**
 * @jest-environment node
 *
 * End-to-end against a running `premind-recorder-api`.
 *
 * Everything the app owns runs for real here — the HTTP client, token rotation,
 * the resumable uploader, and the study-material mapping — over real HTTP to a
 * real server with a real database. Only the device filesystem is substituted,
 * because Jest has no `expo-file-system`; the bytes it serves come from an
 * actual audio file on disk.
 *
 * Skipped unless you point it at a server, because it costs real Gemini calls:
 *
 *   PREMIND_LIVE_API_URL=http://127.0.0.1:8100 \
 *   PREMIND_LIVE_AUDIO=/absolute/path/to/lecture.wav \
 *   npx jest src/services/api/live-pipeline.integration.test.ts
 *
 * Runs in the `node` environment and brings its own HTTP transport: the Expo
 * Jest preset stubs `fetch` in every environment, so a test that must actually
 * reach a server has to go around it.
 */

// Node types are scoped to this file with a reference directive rather than
// tsconfig's `types`: it is the only file that touches the host runtime, and
// enabling them globally would let Node's `setTimeout` shadow React Native's.
/// <reference types="node" />

import type { StudyMaterial } from '../../types';
import { PremindApiClient } from './client';
import { ResumableUploader } from './resumable-upload';
import { SessionManager } from './session-manager';
import { StudyMaterialService } from '../study-material-service';

const LIVE_API_URL = process.env.PREMIND_LIVE_API_URL;
const LIVE_AUDIO = process.env.PREMIND_LIVE_AUDIO;

// `fs` is required inside the factory, not imported: Jest hoists module
// factories above every import, so a top-level binding would not exist yet.
jest.mock('expo-file-system', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, statSync } = require('fs');

  return {
  FileMode: { ReadOnly: 'r' },
  File: class {
    path: string;

    constructor(uri: string) {
      this.path = uri.replace(/^file:\/\//, '');
    }

    get exists() {
      try {
        return statSync(this.path).isFile();
      } catch {
        return false;
      }
    }

    get size() {
      try {
        return statSync(this.path).size;
      } catch {
        return null;
      }
    }

    open() {
      const bytes = readFileSync(this.path);
      const handle = {
        offset: 0,
        readBytes: (length: number) =>
          new Uint8Array(
            bytes.subarray(handle.offset, handle.offset + length),
          ),
        close: () => undefined,
      };
      return handle;
    }
  },
  };
});

/**
 * A `fetch` over `node:http`, covering exactly what the client asks of it:
 * a method, headers, a string or byte body, and a text response.
 */
const nodeFetch = (async (input: string, init: RequestInit = {}) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require('http');
  const url = new URL(input);

  return new Promise<Response>((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? 'GET',
        headers: init.headers as Record<string, string>,
      },
      (response: {
        statusCode: number;
        setEncoding: (encoding: string) => void;
        on: (event: string, listener: (chunk?: unknown) => void) => void;
      }) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk as Buffer));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            text: async () => body,
          } as Response);
        });
      },
    );
    request.on('error', reject);
    init.signal?.addEventListener('abort', () => request.destroy(), {
      once: true,
    });
    if (init.body) {
      request.write(
        typeof init.body === 'string' ? init.body : Buffer.from(init.body as Uint8Array),
      );
    }
    request.end();
  });
}) as unknown as typeof fetch;

function memorySession() {
  let stored: unknown = null;
  return {
    loadSession: async () => stored,
    saveSession: async (session: unknown) => {
      stored = session;
    },
    clearSession: async () => {
      stored = null;
    },
  };
}

const describeLive = LIVE_API_URL && LIVE_AUDIO ? describe : describe.skip;

describeLive('recorder API, end to end', () => {
  const client = new PremindApiClient({
    baseUrl: LIVE_API_URL,
    fetcher: nodeFetch,
  });
  const sessions = new SessionManager(
    client,
    memorySession() as unknown as ConstructorParameters<typeof SessionManager>[1],
  );
  const service = new StudyMaterialService(
    client,
    sessions,
    new ResumableUploader(client, sessions),
  );
  const email = `live-${Date.now()}@premind.test`;
  let material: StudyMaterial;
  let processed: StudyMaterial;

  it('registers an account and identifies it', async () => {
    const session = await sessions.register(email, '통합 테스트', 'password123');
    expect(session.user.email).toBe(email);
    expect(session.refreshToken).toBeTruthy();

    const me = await client.getCurrentUser(session.accessToken);
    expect(me.email).toBe(email);
  }, 60_000);

  it('rotates the refresh token and retires the old one', async () => {
    const before = sessions.session;
    const usedToken = String(before?.refreshToken);

    const rotated = await client.refresh(usedToken);
    expect(rotated.refreshToken).not.toBe(usedToken);
    await sessions.replace(rotated);

    // The retired token is single-use: presenting it again must be refused.
    await expect(client.refresh(usedToken)).rejects.toMatchObject({ status: 401 });
  }, 60_000);

  it('uploads, transcribes and returns a study pack', async () => {
    material = service.createLocalMaterial({
      projectId: 'project-live',
      uri: `file://${LIVE_AUDIO}`,
      fileName: 'lecture.wav',
      mimeType: 'audio/wav',
      title: '통합 테스트 강의',
      markers: [
        {
          id: 'marker-live',
          timestampMs: 30_000,
          label: '중요 표시',
          source: 'teacher',
        },
      ],
    });

    const stages: string[] = [];
    processed = await service.processOnServer(material, {
      onProgress: (progress) => stages.push(progress.label),
      pollIntervalMs: 2_000,
    });

    expect(processed.status).toBe('ready');
    expect(processed.syncStatus).toBe('synced');
    expect(processed.serverRecordingId).toBeTruthy();
    expect(stages).toContain('녹음을 서버로 올리고 있어요');

    // Real speech in, real text out: no fixture can produce these.
    expect(processed.transcript.length).toBeGreaterThan(0);
    expect(processed.transcript.map((s) => s.text).join('').length).toBeGreaterThan(
      50,
    );
    expect(processed.note?.summary).toBeTruthy();
    expect(processed.note?.keyPoints.length).toBeGreaterThan(0);
    expect(processed.quiz.length).toBeGreaterThan(0);
    for (const question of processed.quiz) {
      expect(question.choices[question.correctChoiceIndex]).toBeTruthy();
    }
    // The user's own marker survives the round trip.
    expect(
      processed.markers.some((marker) => marker.source === 'teacher'),
    ).toBe(true);
  }, 15 * 60_000);

  it('lists the recording and can delete it', async () => {
    const recordings = await sessions.authorize((token) =>
      client.listRecordings(token),
    );
    expect(recordings.map((row) => row.id)).toContain(processed.serverRecordingId);

    await sessions.authorize((token) =>
      client.deleteRecording(token, String(processed.serverRecordingId)),
    );

    const remaining = await sessions.authorize((token) =>
      client.listRecordings(token),
    );
    expect(remaining.map((row) => row.id)).not.toContain(
      processed.serverRecordingId,
    );
  }, 60_000);

  it('signs out and revokes the refresh token', async () => {
    const refreshToken = String(sessions.session?.refreshToken);
    await sessions.signOut();

    expect(sessions.session).toBeNull();
    await expect(client.refresh(refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  }, 60_000);
});
