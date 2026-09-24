import { Platform } from 'react-native';

import { cleanAiLines, cleanAiText } from '@/lib/ai-text';

import type {
  AccessSession,
  ISODateString,
  LensHistoryEntry,
  LensMoment,
  LensReport,
  LensRubricKey,
  OutlineSection,
  PremindApiUser,
  PremindTokenPair,
  RecordingAnswer,
  RecordingDetail,
  RecordingSegment,
  RecordingStatus,
  RecordingStudyPack,
  RecordingSummaryRow,
  YouTubeImportInput,
  UploadInitInput,
  UploadSessionState,
  UserProfile,
} from '../../types';

const INTERACTIVE_TIMEOUT_MS = 15_000;
/** One chunk is at most a few MB, but a lecture-hall network is not fast. */
const CHUNK_UPLOAD_TIMEOUT_MS = 2 * 60_000;
/** Assembling a multi-gigabyte upload server-side is not instant. */
const COMPLETE_UPLOAD_TIMEOUT_MS = 10 * 60_000;
const EXPIRY_LEEWAY_MS = 60_000;

export interface ApiClientConfig {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    options: {
      status?: number;
      code?: ApiErrorCode;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
  }

  readonly status?: number;
  readonly code?: ApiErrorCode;
  override readonly cause?: unknown;
}

export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'UNEXPECTED_RESPONSE'
  /** 402 from the server: this month's processing minutes are used up. */
  | 'PLAN_LIMIT'
  /** 422 from `POST .../lens`: too little real speech to score. The message says why. */
  | 'LENS_INSUFFICIENT';

function detailCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const detail = (payload as Record<string, unknown>).detail;
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const code = (detail as Record<string, unknown>).code;
  return typeof code === 'string' ? code : null;
}

/** Social providers this app knows how to start a flow for. */
export type AuthProvider = 'google' | 'kakao';

export interface KakaoCodeProof {
  state: string;
  codeVerifier: string;
}

/** True when this build was given a server to talk to. */
export function hasConfiguredApi(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_API_URL?.trim());
}

function resolveDefaultBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured;
  }

  // Only reached in builds with no configured server, where the app runs its
  // offline demo. The emulator loopback alias keeps `adb reverse`-free local
  // development working for anyone who starts a server later.
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8100'
    : 'http://127.0.0.1:8100';
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function detailMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const detail = (payload as Record<string, unknown>).detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  // FastAPI lets a route raise a structured detail; the plan-limit answer
  // ({code, message, minutes_used, minutes_limit}) is one of those.
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === 'object') {
      const message = (first as Record<string, unknown>).msg;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }

  const message = (payload as Record<string, unknown>).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
}

function isApiUser(value: unknown): value is PremindApiUser {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.role === 'string'
  );
}

function isTokenPair(value: unknown): value is PremindTokenPair {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Record<string, unknown>;
  return (
    typeof response.access_token === 'string' &&
    response.access_token.length > 0 &&
    typeof response.expires_in === 'number' &&
    typeof response.refresh_token === 'string' &&
    response.refresh_token.length > 0 &&
    typeof response.refresh_expires_in === 'number' &&
    isApiUser(response.user)
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('응답 형식을 확인할 수 없어요. 다시 시도해 주세요.', {
      code: 'UNEXPECTED_RESPONSE',
    });
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** A string the model wrote: same as `text`, minus the banned middot. */
function prose(value: unknown, fallback = ''): string {
  return cleanAiText(text(value, fallback));
}

function count(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function proseList(value: unknown): string[] {
  return cleanAiLines(stringList(value));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const RECORDING_STATUSES: RecordingStatus[] = [
  'stored',
  'transcribing',
  'ready',
  'failed',
];

function recordingStatus(value: unknown): RecordingStatus {
  return RECORDING_STATUSES.includes(value as RecordingStatus)
    ? (value as RecordingStatus)
    : 'stored';
}

function toRecordingSummary(value: unknown): RecordingSummaryRow {
  const row = record(value);
  if (typeof row.id !== 'string') {
    throw new ApiError('녹음 응답에 ID가 없어요.', {
      code: 'UNEXPECTED_RESPONSE',
    });
  }
  return {
    id: row.id,
    title: text(row.title),
    durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    status: recordingStatus(row.status),
    byteSize: count(row.byte_size),
    createdAt: text(row.created_at, new Date().toISOString()),
    youtubeId:
      typeof row.youtube_id === 'string' && row.youtube_id ? row.youtube_id : null,
  };
}

/**
 * Study packs are model output. Anything that would not render — an answer
 * index pointing past the choices, a question with nothing to pick — is
 * dropped here rather than defended against at every screen. The server
 * validates the same rules; this is the second half of that contract, because
 * a client cannot assume it is talking to the version of the server it shipped
 * against.
 */
function toStudyPack(value: unknown): RecordingStudyPack | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const pack = value as Record<string, unknown>;

  const concepts = (Array.isArray(pack.concepts) ? pack.concepts : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const concept = item as Record<string, unknown>;
      const term = prose(concept.term).trim();
      const description = prose(concept.description).trim();
      if (!term || !description) {
        return null;
      }
      const difficulty = text(concept.difficulty);
      return {
        term,
        description,
        sourceStartMs: Math.max(0, count(concept.source_start_ms)),
        difficulty:
          difficulty === 'intermediate' || difficulty === 'advanced'
            ? difficulty
            : ('basic' as const),
      };
    })
    .filter((concept): concept is RecordingStudyPack['concepts'][number] =>
      Boolean(concept),
    );

  const quiz = (Array.isArray(pack.quiz) ? pack.quiz : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const question = item as Record<string, unknown>;
      const prompt = prose(question.prompt).trim();
      const choices = proseList(question.choices).filter((choice) =>
        choice.trim(),
      );
      const answer = count(question.correct_choice_index, -1);
      if (!prompt || choices.length < 2 || !choices[answer]) {
        return null;
      }
      return {
        type:
          text(question.type) === 'true-false'
            ? ('true-false' as const)
            : ('multiple-choice' as const),
        concept: prose(question.concept),
        prompt,
        choices,
        correctChoiceIndex: answer,
        explanation: prose(question.explanation),
        sourceStartMs: Math.max(0, count(question.source_start_ms)),
      };
    })
    .filter((question): question is RecordingStudyPack['quiz'][number] =>
      Boolean(question),
    );

  if (!concepts.length && !quiz.length) {
    return null;
  }
  return { concepts, quiz };
}

const LENS_RUBRIC: LensRubricKey[] = ['structure', 'clarity', 'evidence', 'delivery'];

function toLensMoment(value: unknown, withAction: boolean): LensMoment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const body = prose(raw.text).trim();
  if (!body) {
    return null;
  }
  const moment: LensMoment = {
    text: body,
    sourceStartMs: Math.max(0, count(raw.source_start_ms)),
  };
  if (withAction) {
    const action = prose(raw.action).trim();
    if (!action) {
      return null;
    }
    moment.action = action;
  }
  return moment;
}

/**
 * Same stance as the study pack: the report is model output, and a rubric
 * missing a score would render as a chart with a hole in it, so the whole
 * report is dropped rather than half-drawn.
 */
function toLensReport(value: unknown): LensReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const scored = new Map<LensRubricKey, LensReport['rubric'][number]>();
  for (const item of Array.isArray(raw.rubric) ? raw.rubric : []) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const key = text(entry.key) as LensRubricKey;
    const score = count(entry.score, Number.NaN);
    if (LENS_RUBRIC.includes(key) && Number.isFinite(score)) {
      scored.set(key, {
        key,
        label: text(entry.label),
        score: Math.min(5, Math.max(0, score)),
        evidence: prose(entry.evidence),
      });
    }
  }
  if (scored.size !== LENS_RUBRIC.length) {
    return null;
  }
  const rubric = LENS_RUBRIC.map((key) => scored.get(key) as LensReport['rubric'][number]);
  const strengths = (Array.isArray(raw.strengths) ? raw.strengths : [])
    .map((item) => toLensMoment(item, false))
    .filter((moment): moment is LensMoment => moment !== null);
  const improvements = (Array.isArray(raw.improvements) ? raw.improvements : [])
    .map((item) => toLensMoment(item, true))
    .filter((moment): moment is LensMoment => moment !== null);
  if (!strengths.length && !improvements.length) {
    return null;
  }
  const overall = count(raw.overall, Number.NaN);
  return {
    overall: Number.isFinite(overall)
      ? Math.min(5, Math.max(0, overall))
      : Math.round((rubric.reduce((sum, r) => sum + r.score, 0) / rubric.length) * 10) / 10,
    rubric,
    strengths,
    improvements,
    priority: toLensMoment(raw.priority, true) ?? improvements[0] ?? null,
  };
}

/**
 * The 상세 요약 the server writes: sections in lecture order. A section with
 * no heading or no body would render as an empty row, so it is dropped rather
 * than half-drawn; a missing or negative `start_ms` becomes 0 so its chip
 * still seeks somewhere real. Server order is kept as sent.
 */
function toOutline(value: unknown): OutlineSection[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const sections: OutlineSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const heading = prose(row.heading).trim();
    const body = prose(row.body).trim();
    if (!heading || !body) {
      continue;
    }
    sections.push({
      heading,
      startMs: Math.max(0, Math.round(count(row.start_ms))),
      body,
    });
  }
  return sections.length ? sections : undefined;
}

function toRecordingDetail(value: unknown): RecordingDetail {
  const row = record(value);
  return {
    ...toRecordingSummary(value),
    contentType: text(row.content_type, 'application/octet-stream'),
    transcript: typeof row.transcript === 'string' ? cleanAiText(row.transcript) : null,
    summary: typeof row.summary === 'string' ? cleanAiText(row.summary) : null,
    keyPoints: proseList(row.key_points),
    outline: toOutline(row.outline),
    studyPack: toStudyPack(row.study_pack),
    lensReport: toLensReport(row.lens_report),
    lensEvaluatedAt:
      typeof row.lens_evaluated_at === 'string' && row.lens_evaluated_at
        ? row.lens_evaluated_at
        : null,
    lensCount: Math.max(0, Math.round(count(row.lens_count))),
    pageImageCount: Math.max(0, Math.round(count(row.page_image_count))),
  };
}

/**
 * One row of `GET /api/recordings/{id}/lens`. An entry whose report would
 * not render is dropped the same way an inline report is, so the history
 * never lists a date the screen cannot open.
 */
function toLensHistoryEntry(value: unknown): LensHistoryEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const report = toLensReport(row.report);
  if (typeof row.id !== 'string' || !row.id || !report) {
    return null;
  }
  return {
    id: row.id,
    evaluatedAt: text(row.created_at, ''),
    report,
  };
}

function toUploadSession(value: unknown): UploadSessionState {
  const row = record(value);
  if (typeof row.upload_id !== 'string') {
    throw new ApiError('업로드 응답에 ID가 없어요. 다시 시도해 주세요.', {
      code: 'UNEXPECTED_RESPONSE',
    });
  }
  const chunkSize = count(row.chunk_size);
  if (chunkSize <= 0) {
    // Every resume calculation divides by this, so a missing value is fatal
    // rather than something to paper over with a client-side default.
    throw new ApiError('업로드 조각 크기를 확인할 수 없어요. 다시 시도해 주세요.', {
      code: 'UNEXPECTED_RESPONSE',
    });
  }
  const status = text(row.status, 'pending');
  return {
    uploadId: row.upload_id,
    status:
      status === 'completed' || status === 'aborted' ? status : 'pending',
    totalBytes: count(row.total_bytes),
    chunkSize,
    chunkCount: count(row.chunk_count),
    receivedChunks: Array.isArray(row.received_chunks)
      ? row.received_chunks.filter(
          (index): index is number => typeof index === 'number',
        )
      : [],
    receivedBytes: count(row.received_bytes),
    recordingId:
      typeof row.recording_id === 'string' ? row.recording_id : null,
  };
}

function toSession(pair: PremindTokenPair, mode: UserProfile['mode']): AccessSession {
  const issuedAt = new Date();
  const user: UserProfile = { ...pair.user, mode };
  return {
    accessToken: pair.access_token,
    tokenType: 'bearer',
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(
      issuedAt.getTime() + Math.max(0, pair.expires_in) * 1_000,
    ).toISOString(),
    refreshToken: pair.refresh_token,
    refreshExpiresAt: new Date(
      issuedAt.getTime() + Math.max(0, pair.refresh_expires_in) * 1_000,
    ).toISOString(),
    user,
  };
}

function expiryOf(value: ISODateString | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * True when `session` can still authorize a request on its own.
 *
 * The leeway keeps a token that expires mid-flight from being sent at all.
 * A session that fails this is not necessarily signed out: if it still holds a
 * refresh token, `SessionManager` trades it for a new pair.
 */
export function isSessionUsable(
  session: AccessSession | null,
  now = Date.now(),
): session is AccessSession {
  if (!session) {
    return false;
  }
  const expiry = expiryOf(session.expiresAt);
  return expiry !== null && expiry - EXPIRY_LEEWAY_MS > now;
}

/** True when `session` can still be traded for a fresh token pair. */
export function isSessionRefreshable(
  session: AccessSession | null,
  now = Date.now(),
): session is AccessSession & { refreshToken: string } {
  if (!session?.refreshToken) {
    return false;
  }
  const expiry = expiryOf(session.refreshExpiresAt);
  // A server that did not date the refresh token is trusted over refusing to
  // try: the worst case is one 401, which signs the user out anyway.
  return expiry === null || expiry > now;
}

/**
 * API boundary for the PREMIND recorder service (`../premind-recorder-api`).
 *
 * Every method here is stateless: an access token is passed in, never held.
 * Token lifetime — refreshing, rotating, persisting — belongs to
 * `SessionManager`, so a screen can never accidentally use a stale token that
 * this class happened to be caching.
 */
export class PremindApiClient {
  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? resolveDefaultBaseUrl());
    // Wrapped, not stored bare: `this.fetcher(...)` would call the browser's
    // native `fetch` with this client as its receiver, which throws "Illegal
    // invocation" and surfaces as an unexplained network failure. React
    // Native's fetch is an ordinary function and does not care, so the bug is
    // invisible until the app runs on the web.
    const fetcher = config.fetcher;
    this.fetcher = fetcher
      ? (input, init) => fetcher(input, init)
      : (input, init) => fetch(input, init);
  }

  readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  // --- auth ------------------------------------------------------------------

  async register(
    email: string,
    name: string,
    password: string,
    mode: UserProfile['mode'] = 'teacher',
  ): Promise<AccessSession> {
    const pair = await this.request<unknown>('/api/auth/register', {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password,
      }),
    });
    return toSession(this.tokenPair(pair), mode);
  }

  async login(
    email: string,
    password: string,
    options: { deviceName?: string; mode?: UserProfile['mode'] } = {},
  ): Promise<AccessSession> {
    const pair = await this.request<unknown>('/api/auth/token', {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        device_name: options.deviceName,
      }),
    });
    return toSession(this.tokenPair(pair), options.mode ?? 'teacher');
  }

  /**
   * Trade a provider's token for this service's own pair.
   *
   * The provider token is passed through untouched: the server is the only
   * side that may decide what it proves, because it is the only side that can
   * ask Google or Kakao whether it is real.
   */
  async startKakaoSignIn(codeChallenge: string): Promise<{
    authorizationUrl: string; state: string;
  }> {
    const payload = record(await this.request<unknown>('/api/auth/oauth/kakao/start', {
      method: 'POST', headers: this.jsonHeaders(),
      body: JSON.stringify({ code_challenge: codeChallenge }),
    }));
    const authorizationUrl = payload.authorization_url;
    const state = payload.state;
    if (typeof authorizationUrl !== 'string' || typeof state !== 'string' || !state) {
      throw new ApiError('로그인을 준비하지 못했어요.');
    }
    const url = new URL(authorizationUrl);
    if (url.origin !== 'https://kauth.kakao.com' || url.pathname !== '/oauth/authorize') {
      throw new ApiError('로그인 주소를 확인하지 못했어요.');
    }
    return { authorizationUrl, state };
  }

  async signInWithProvider(
    provider: AuthProvider,
    token: string,
    options: { deviceName?: string; mode?: UserProfile['mode']; kakaoCode?: KakaoCodeProof } = {},
  ): Promise<AccessSession> {
    const proof = provider === 'kakao' ? options.kakaoCode : undefined;
    const pair = await this.request<unknown>(
      proof ? '/api/auth/oauth/kakao/exchange' : `/api/auth/oauth/${encodeURIComponent(provider)}`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(proof
          ? { code: token, state: proof.state, code_verifier: proof.codeVerifier, device_name: options.deviceName }
          : { token, device_name: options.deviceName }),
      },
    );
    return toSession(this.tokenPair(pair), options.mode ?? 'teacher');
  }

  /** Which social sign-ins the server can actually complete. */
  async getAuthProviders(): Promise<AuthProvider[]> {
    const payload = await this.request<unknown>('/api/auth/providers');
    const providers = record(payload).providers;
    return Array.isArray(providers)
      ? providers.filter(
          (value): value is AuthProvider => value === 'google'
            || (value === 'kakao' && record(payload).kakao_code_flow === true),
        )
      : [];
  }

  async refresh(
    refreshToken: string,
    mode: UserProfile['mode'] = 'teacher',
  ): Promise<AccessSession> {
    const pair = await this.request<unknown>('/api/auth/token/refresh', {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return toSession(this.tokenPair(pair), mode);
  }

  /** Best-effort sign-out. Idempotent server-side, so a repeat is harmless. */
  async revoke(refreshToken: string): Promise<void> {
    await this.request<unknown>('/api/auth/token/revoke', {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async getCurrentUser(accessToken: string): Promise<PremindApiUser> {
    const user = await this.request<unknown>('/api/auth/me', {
      headers: this.authorization(accessToken),
    });
    if (!isApiUser(user)) {
      throw new ApiError('사용자 응답 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return user;
  }

  // --- uploads ---------------------------------------------------------------

  /** Idempotent on `clientReference`: a retry resumes, never re-uploads. */
  async initUpload(
    accessToken: string,
    input: UploadInitInput,
    signal?: AbortSignal,
  ): Promise<UploadSessionState> {
    const session = await this.request<unknown>('/api/uploads', {
      method: 'POST',
      headers: this.jsonHeaders(accessToken),
      body: JSON.stringify({
        client_reference: input.clientReference,
        filename: input.filename,
        total_bytes: input.totalBytes,
        content_type: input.contentType,
        title: input.title,
        duration_ms: input.durationMs,
        markers: (input.markers ?? []).map((marker) => ({
          timestamp_ms: Math.max(0, Math.round(marker.timestampMs)),
          created_at: marker.createdAt,
        })),
      }),
      signal,
    });
    return toUploadSession(session);
  }

  async getUpload(
    accessToken: string,
    uploadId: string,
    signal?: AbortSignal,
  ): Promise<UploadSessionState> {
    const session = await this.request<unknown>(
      `/api/uploads/${encodeURIComponent(uploadId)}`,
      { headers: this.authorization(accessToken), signal },
    );
    return toUploadSession(session);
  }

  /** Raw bytes for one chunk. Re-sending an index overwrites it server-side. */
  async putChunk(
    accessToken: string,
    uploadId: string,
    index: number,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ): Promise<{ receivedChunks: number[]; receivedBytes: number }> {
    const accepted = await this.request<unknown>(
      `/api/uploads/${encodeURIComponent(uploadId)}/chunks/${index}`,
      {
        method: 'PUT',
        headers: {
          ...this.authorization(accessToken),
          'Content-Type': 'application/octet-stream',
        },
        // React Native's fetch sends a typed array as the raw request body.
        body: bytes as unknown as BodyInit,
        signal,
      },
      CHUNK_UPLOAD_TIMEOUT_MS,
    );
    const row = record(accepted);
    return {
      receivedChunks: Array.isArray(row.received_chunks)
        ? row.received_chunks.filter(
            (value): value is number => typeof value === 'number',
          )
        : [],
      receivedBytes: count(row.received_bytes),
    };
  }

  /** Assembles the chunks into the stored recording. Returns its id. */
  async completeUpload(
    accessToken: string,
    uploadId: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const completed = await this.request<unknown>(
      `/api/uploads/${encodeURIComponent(uploadId)}/complete`,
      { method: 'POST', headers: this.authorization(accessToken), signal },
      COMPLETE_UPLOAD_TIMEOUT_MS,
    );
    const row = record(completed);
    if (typeof row.recording_id !== 'string' || !row.recording_id) {
      throw new ApiError('업로드 결과에 녹음 ID가 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return row.recording_id;
  }

  async abortUpload(accessToken: string, uploadId: string): Promise<void> {
    await this.request<unknown>(
      `/api/uploads/${encodeURIComponent(uploadId)}`,
      { method: 'DELETE', headers: this.authorization(accessToken) },
    );
  }

  // --- recordings ------------------------------------------------------------

  async listRecordings(accessToken: string): Promise<RecordingSummaryRow[]> {
    const rows = await this.request<unknown>('/api/recordings', {
      headers: this.authorization(accessToken),
    });
    if (!Array.isArray(rows)) {
      throw new ApiError('녹음 목록 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return rows.map(toRecordingSummary);
  }

  async getRecording(
    accessToken: string,
    recordingId: string,
    signal?: AbortSignal,
  ): Promise<RecordingDetail> {
    const detail = await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}`,
      { headers: this.authorization(accessToken), signal },
    );
    return toRecordingDetail(detail);
  }

  async getRecordingSegments(
    accessToken: string,
    recordingId: string,
    signal?: AbortSignal,
  ): Promise<RecordingSegment[]> {
    const rows = await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}/segments`,
      { headers: this.authorization(accessToken), signal },
    );
    if (!Array.isArray(rows)) {
      throw new ApiError('대본 구간 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return rows
      .map((row) => {
        const segment = record(row);
        const page = Math.max(0, Math.round(count(segment.page)));
        const summary = text(segment.summary).trim();
        return {
          startMs: Math.max(0, count(segment.start_ms)),
          endMs: Math.max(0, count(segment.end_ms)),
          text: text(segment.text).trim(),
          // Both are documents-only and absent for spoken audio.
          ...(page > 0 ? { page } : {}),
          ...(summary ? { summary: cleanAiText(summary) } : {}),
        };
      })
      .filter((segment) => segment.text);
  }

  /**
   * Where a recording's media lives, and the header a player must send.
   *
   * Native players (expo-audio, expo-video) take `{ uri, headers }` as a
   * source, so the file is served under the same bearer token as everything
   * else rather than through a signed-URL scheme. The token is the caller's
   * current one; a player that outlives it re-asks.
   */
  recordingMediaSource(
    accessToken: string,
    recordingId: string,
  ): { uri: string; headers: Record<string, string> } {
    return {
      uri: `${this.baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/media`,
      headers: this.authorization(accessToken),
    };
  }

  /**
   * Where one rendered page of an uploaded PDF lives, and the header to send.
   *
   * Shaped like `recordingMediaSource` for the same reason: `expo-image` takes
   * `{ uri, headers }`, so a page is served under the caller's bearer token
   * like every other route rather than through a signed URL.
   */
  recordingPageSource(
    accessToken: string,
    recordingId: string,
    page: number,
  ): { uri: string; headers: Record<string, string> } {
    return {
      uri: `${this.baseUrl}/api/recordings/${encodeURIComponent(recordingId)}/pages/${Math.max(1, Math.round(page))}`,
      headers: this.authorization(accessToken),
    };
  }

  /**
   * Create a study room from a public YouTube link. The server never downloads
   * the video: Gemini reads the URL directly for the transcript, and playback
   * is the YouTube player. Answers 201 with the new recording (status
   * `transcribing`), 422 for a non-YouTube or private URL.
   */
  async importYouTube(
    accessToken: string,
    input: YouTubeImportInput,
  ): Promise<RecordingDetail> {
    const detail = await this.request<unknown>('/api/recordings/import-youtube', {
      method: 'POST',
      headers: { ...this.authorization(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.url, title: input.title ?? null }),
    });
    return toRecordingDetail(detail);
  }

  /**
   * Ask the server to write a new Lens report. Resolves once queued. Rejects
   * with `LENS_INSUFFICIENT` (422) when the recording holds too little real
   * speech to score; the error message carries the server's reason.
   */
  async regenerateLens(accessToken: string, recordingId: string): Promise<void> {
    await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}/lens`,
      { method: 'POST', headers: this.authorization(accessToken) },
    );
  }

  /** Every Lens report written for a recording, newest first. */
  async listLensHistory(
    accessToken: string,
    recordingId: string,
    signal?: AbortSignal,
  ): Promise<LensHistoryEntry[]> {
    const rows = await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}/lens`,
      { headers: this.authorization(accessToken), signal },
    );
    if (!Array.isArray(rows)) {
      throw new ApiError('평가 이력 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return rows
      .map(toLensHistoryEntry)
      .filter((entry): entry is LensHistoryEntry => entry !== null)
      .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
  }

  /**
   * Ask one question about a recording. The server writes the answer from the
   * transcript and cites the lines it used, so the app can offer to play them.
   */
  async askRecording(
    accessToken: string,
    recordingId: string,
    question: string,
    signal?: AbortSignal,
  ): Promise<RecordingAnswer> {
    const body = await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}/ask`,
      {
        method: 'POST',
        headers: this.jsonHeaders(accessToken),
        body: JSON.stringify({ question }),
        signal,
      },
    );
    const row = record(body);
    const answer = cleanAiText(text(row.answer)).trim();
    if (!answer) {
      throw new ApiError('답변 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    const citations = (Array.isArray(row.citations) ? row.citations : [])
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const cited = item as Record<string, unknown>;
        const quote = prose(cited.quote).trim();
        if (!quote) return null;
        return {
          quote,
          sourceStartMs: Math.max(0, Math.round(count(cited.source_start_ms))),
        };
      })
      .filter((cited): cited is RecordingAnswer['citations'][number] => cited !== null);
    return { answer, grounded: row.grounded !== false && citations.length > 0, citations };
  }

  /** Delete the caller's account and everything it owns. Irreversible. */
  async deleteAccount(accessToken: string): Promise<void> {
    await this.request<unknown>('/api/auth/me', {
      method: 'DELETE',
      headers: this.authorization(accessToken),
    });
  }

  async deleteRecording(
    accessToken: string,
    recordingId: string,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/recordings/${encodeURIComponent(recordingId)}`,
      { method: 'DELETE', headers: this.authorization(accessToken) },
    );
  }

  // --- plumbing --------------------------------------------------------------

  private tokenPair(value: unknown): PremindTokenPair {
    if (!isTokenPair(value)) {
      throw new ApiError('로그인 응답 형식을 확인할 수 없어요.', {
        code: 'UNEXPECTED_RESPONSE',
      });
    }
    return value;
  }

  private authorization(accessToken: string): Record<string, string> {
    if (!accessToken) {
      throw new ApiError('다시 로그인해 주세요.', { code: 'SESSION_EXPIRED' });
    }
    return { Authorization: `Bearer ${accessToken}` };
  }

  private jsonHeaders(accessToken?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json; charset=utf-8',
      ...(accessToken ? this.authorization(accessToken) : {}),
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = INTERACTIVE_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();
    init.signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      });

      const body = await response.text();
      let payload: unknown = null;
      if (body) {
        try {
          payload = JSON.parse(body) as unknown;
        } catch {
          payload = body;
        }
      }

      if (!response.ok) {
        throw new ApiError(
          detailMessage(payload, `요청을 처리하지 못했어요. (${response.status})`),
          {
            status: response.status,
            code:
              response.status === 401
                ? 'SESSION_EXPIRED'
                : response.status === 402 && detailCode(payload) === 'plan_limit'
                  ? 'PLAN_LIMIT'
                  : response.status === 422 &&
                      detailCode(payload) === 'lens_insufficient'
                    ? 'LENS_INSUFFICIENT'
                    : undefined,
          },
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (timedOut) {
        throw new ApiError('응답이 늦어지고 있어요. 다시 시도해 주세요.', {
          code: 'TIMEOUT',
          cause: error,
        });
      }
      if (controller.signal.aborted && init.signal?.aborted) {
        throw error;
      }
      throw new ApiError('연결하지 못했어요. 네트워크를 확인해 주세요.', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

export const apiClient = new PremindApiClient();
