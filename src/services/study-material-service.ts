import type {
  LensHistoryEntry,
  LensReport,
  ImportantMarker,
  MaterialImportInput,
  MaterialKind,
  QuizQuestion,
  RecordingDetail,
  RecordingSegment,
  RecordingSummaryRow,
  StudyConcept,
  StudyMaterial,
  StudyNote,
  TranscriptSegment,
  YouTubeImportInput,
} from '../types';
import {
  localSourceGroundedChatService,
  type GroundedChatAnswer,
} from '../features/chat/source-grounded-chat';
import { generateLocalHighlightCandidates } from '../features/highlights';
import { parseYouTubeId, youtubeWatchUrl } from '../lib/youtube';
import { apiClient, hasConfiguredApi, type PremindApiClient } from './api/client';
import { ResumableUploader } from './api/resumable-upload';
import {
  isDemoSession,
  sessionManager,
  type SessionManager,
} from './api/session-manager';

export interface MaterialProcessingProgress {
  status: StudyMaterial['status'];
  progress: number;
  label: string;
}

export interface ProcessMaterialOptions {
  onProgress?: (progress: MaterialProcessingProgress) => void;
  /** Persisted immediately so a polling retry never uploads the source twice. */
  onUploaded?: (recordingId: string) => void | Promise<void>;
  signal?: AbortSignal;
  /** Test seam; production keeps a short, visible mock processing cadence. */
  stepDelayMs?: number;
  /** Test seam; production polls the server on a fixed, gentle interval. */
  pollIntervalMs?: number;
}

export interface SyncMaterialOptions {
  signal?: AbortSignal;
  onProgress?: (progress: MaterialProcessingProgress) => void;
}

export interface SyncMaterialResult {
  recordingId: string;
}

/** What one `requestLens` produced, with the history the server keeps. */
export interface LensEvaluation {
  report: LensReport;
  evaluatedAt: string;
  /** Total evaluations of this recording, the new one included. */
  count: number;
  /** Every evaluation so far, newest first. */
  history: LensHistoryEntry[];
}

/** How long a recording may sit at `stored` before we call the AI pass absent. */
const AI_PASS_GRACE_MS = 30_000;
/** A three-hour lecture takes a while, but not forever. */
const PROCESSING_TIMEOUT_MS = 90 * 60_000;
const POLL_INTERVAL_MS = 3_000;

export class UnsupportedMaterialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMaterialError';
  }
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function kindFrom(input: MaterialImportInput): MaterialKind {
  if (input.kind) {
    return input.kind;
  }
  const mimeType = input.mimeType?.toLowerCase() ?? '';
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  // A PDF or a slide deck: the server reads it rather than listening to it.
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('presentationml') ||
    mimeType === 'application/vnd.ms-powerpoint'
  ) {
    return 'document';
  }

  const extension = input.fileName.split('.').pop()?.toLowerCase();
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension ?? '')) {
    return 'video';
  }
  if (['m4a', 'mp3', 'wav', 'aac', 'ogg', 'opus'].includes(extension ?? '')) {
    return 'audio';
  }
  if (['pdf', 'pptx', 'ppt'].includes(extension ?? '')) {
    return 'document';
  }
  throw new UnsupportedMaterialError(
    '녹음, 영상, PDF, 슬라이드만 올릴 수 있어요.',
  );
}

function defaultMimeType(kind: MaterialKind, fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (kind === 'document') {
    return extension === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (kind === 'video') {
    return extension === 'webm' ? 'video/webm' : 'video/mp4';
  }
  if (extension === 'mp3') {
    return 'audio/mpeg';
  }
  if (extension === 'wav') {
    return 'audio/wav';
  }
  return 'audio/mp4';
}

function titleFromFile(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').trim() || '새 자료';
}

function abortError(): Error {
  const error = new Error('마인드팩 만들기를 중단했어요.');
  error.name = 'AbortError';
  return error;
}

async function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw abortError();
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal) {
      setTimeout(() => signal.removeEventListener('abort', onAbort), milliseconds);
    }
  });
}

function sourceTime(durationMs: number, ratio: number): number {
  return Math.max(0, Math.round(durationMs * ratio));
}

function generatedTranscript(
  material: StudyMaterial,
  durationMs: number,
): TranscriptSegment[] {
  const entries = [
    ['오늘 학습할 핵심 질문을 먼저 확인하고 전체 흐름을 살펴보겠습니다.', 0.04],
    ['첫 번째 개념은 정의만 외우기보다 어떤 문제를 해결하기 위해 등장했는지 함께 이해해야 합니다.', 0.19],
    ['이 사례에서는 조건을 하나씩 비교하면 개념이 실제 상황에서 어떻게 쓰이는지 분명해집니다.', 0.41],
    ['여기까지가 오늘 내용에서 가장 중요한 부분입니다. 결과보다 판단 과정에 주목해 주세요.', 0.62],
    ['마지막으로 핵심 개념을 서로 연결하고 다음 시간에 이어질 질문을 정리하겠습니다.', 0.84],
  ] as const;

  return entries.map(([text, ratio], index) => {
    const startMs = sourceTime(durationMs, ratio);
    return {
      id: `${material.id}-segment-${index + 1}`,
      startMs,
      endMs: Math.min(durationMs, startMs + 42_000),
      speaker: '화자 1',
      text,
      isImportant: index === 3,
    };
  });
}

function generatedConcepts(
  material: StudyMaterial,
  durationMs: number,
): StudyConcept[] {
  return [
    {
      id: `${material.id}-concept-1`,
      term: '핵심 개념',
      description: `${material.title}에서 먼저 이해해야 하는 중심 정의와 적용 범위`,
      sourceStartMs: sourceTime(durationMs, 0.19),
      difficulty: 'basic',
    },
    {
      id: `${material.id}-concept-2`,
      term: '적용 조건',
      description: '개념을 실제 문제에 사용할 때 확인해야 하는 전제와 판단 기준',
      sourceStartMs: sourceTime(durationMs, 0.41),
      difficulty: 'intermediate',
    },
    {
      id: `${material.id}-concept-3`,
      term: '비교 관점',
      description: '비슷해 보이는 개념을 결과가 아닌 과정과 조건으로 구분하는 방법',
      sourceStartMs: sourceTime(durationMs, 0.62),
      difficulty: 'intermediate',
    },
  ];
}

function generatedNote(
  material: StudyMaterial,
  concepts: StudyConcept[],
): StudyNote {
  return {
    summary: `${material.title}의 흐름을 핵심 정의, 적용 사례, 비교 기준 순서로 정리했어요. 원본 구간을 함께 들으며 짧게 복습할 수 있어요.`,
    keyPoints: [
      '핵심 정의를 먼저 확인하고 등장 배경과 연결한다.',
      '적용 사례에서는 전제 조건과 판단 과정을 구분한다.',
      '비슷한 개념은 결과보다 기준의 차이로 비교한다.',
      '마지막 질문을 다음 학습의 출발점으로 남긴다.',
    ],
    concepts,
    estimatedReviewMinutes: 5,
    teacherVerified: false,
    updatedAt: new Date().toISOString(),
  };
}

function generatedQuiz(
  material: StudyMaterial,
  durationMs: number,
): QuizQuestion[] {
  return [
    {
      id: `${material.id}-quiz-1`,
      type: 'multiple-choice',
      concept: '핵심 개념',
      prompt: '새 개념을 학습할 때 가장 먼저 확인할 내용은 무엇인가요?',
      choices: ['정의와 등장 배경', '자료의 파일 크기', '말하는 속도', '녹음 길이'],
      correctChoiceIndex: 0,
      explanation: '정의와 등장 배경을 함께 이해하면 단순 암기보다 적용 범위를 정확히 알 수 있어요.',
      sourceStartMs: sourceTime(durationMs, 0.19),
    },
    {
      id: `${material.id}-quiz-2`,
      type: 'multiple-choice',
      concept: '적용 조건',
      prompt: '사례를 분석할 때 우선 구분해야 하는 것은?',
      choices: ['전제 조건과 판단 과정', '자막 색상과 크기', '녹음 기기 종류', '강의 요일'],
      correctChoiceIndex: 0,
      explanation: '사례의 전제와 판단 과정을 나누면 개념이 적용되는 이유를 설명할 수 있어요.',
      sourceStartMs: sourceTime(durationMs, 0.41),
    },
    {
      id: `${material.id}-quiz-3`,
      type: 'true-false',
      concept: '비교 관점',
      prompt: '비슷한 개념은 결과만 같으면 같은 개념으로 보아도 된다.',
      choices: ['맞아요', '아니에요'],
      correctChoiceIndex: 1,
      explanation: '결과가 비슷해도 전제와 판단 기준이 다르면 서로 다른 개념일 수 있어요.',
      sourceStartMs: sourceTime(durationMs, 0.62),
    },
    {
      id: `${material.id}-quiz-4`,
      type: 'true-false',
      concept: '복습 전략',
      prompt: '틀린 문제는 근거가 되는 원본 구간과 함께 다시 보는 것이 좋다.',
      choices: ['맞아요', '아니에요'],
      correctChoiceIndex: 0,
      explanation: '정답만 확인하는 것보다 실제 설명 구간을 다시 들으면 오개념을 바로잡기 쉬워요.',
      sourceStartMs: sourceTime(durationMs, 0.74),
    },
    {
      id: `${material.id}-quiz-5`,
      type: 'multiple-choice',
      concept: '학습 연결',
      prompt: '강의 마지막 질문을 남기는 가장 큰 이유는?',
      choices: ['다음 학습과 연결하기 위해', '파일 이름을 정하기 위해', '재생 시간을 늘리기 위해', '파일 크기를 줄이기 위해'],
      correctChoiceIndex: 0,
      explanation: '남은 질문은 다음 학습에서 확인할 목표가 돼요.',
      sourceStartMs: sourceTime(durationMs, 0.84),
    },
  ];
}

/** Wraps the server's flat transcript when the STT engine returned no timings. */
function segmentsFromPlainText(
  material: StudyMaterial,
  transcript: string,
  durationMs: number,
): TranscriptSegment[] {
  const text = transcript.trim();
  if (!text) {
    return [];
  }
  return [
    {
      id: `${material.id}-segment-1`,
      startMs: 0,
      endMs: durationMs,
      text,
    },
  ];
}

function transcriptFromServer(
  material: StudyMaterial,
  segments: RecordingSegment[],
  recording: RecordingDetail,
): TranscriptSegment[] {
  const durationMs =
    recording.durationMs ?? material.source.durationMs ?? 0;
  if (!segments.length) {
    return segmentsFromPlainText(material, recording.transcript ?? '', durationMs);
  }
  return segments.map((segment, index) => ({
    id: `${material.id}-segment-${index + 1}`,
    startMs: segment.startMs,
    endMs: Math.max(segment.startMs, segment.endMs),
    text: segment.text,
    // A document page's one-line summary. Dropping it here is what made the
    // 대본's 쪽 요약 chip never appear: the server sent it, the client parsed
    // it, and this mapping threw it away.
    ...(segment.summary ? { summary: segment.summary } : {}),
  }));
}

function conceptsFromServer(
  material: StudyMaterial,
  recording: RecordingDetail,
): StudyConcept[] {
  return (recording.studyPack?.concepts ?? []).map((concept, index) => ({
    id: `${material.id}-concept-${index + 1}`,
    term: concept.term,
    description: concept.description,
    sourceStartMs: concept.sourceStartMs,
    difficulty: concept.difficulty,
  }));
}

function quizFromServer(
  material: StudyMaterial,
  recording: RecordingDetail,
): QuizQuestion[] {
  return (recording.studyPack?.quiz ?? []).map((question, index) => ({
    id: `${material.id}-quiz-${index + 1}`,
    type: question.type,
    concept: question.concept,
    prompt: question.prompt,
    choices: question.choices,
    correctChoiceIndex: question.correctChoiceIndex,
    explanation: question.explanation,
    sourceStartMs: question.sourceStartMs,
  }));
}

/**
 * Reading time, from the transcript rather than a constant: a 12-minute clip
 * and a 3-hour lecture do not take the same time to review.
 */
function reviewMinutes(transcript: TranscriptSegment[]): number {
  const characters = transcript.reduce(
    (total, segment) => total + segment.text.length,
    0,
  );
  // ~350 Korean characters a minute when skim-reading a transcript.
  return Math.min(30, Math.max(3, Math.round(characters / 350)));
}

function noteFromServer(
  recording: RecordingDetail,
  concepts: StudyConcept[],
  transcript: TranscriptSegment[],
): StudyNote | undefined {
  const summary = recording.summary?.trim() ?? '';
  if (!summary && !recording.keyPoints.length && !concepts.length) {
    return undefined;
  }
  return {
    summary,
    keyPoints: recording.keyPoints,
    concepts,
    estimatedReviewMinutes: reviewMinutes(transcript),
    teacherVerified: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Adds the on-device highlight pass on top of the markers the user placed
 * while recording. The heuristics are the same ones the offline path uses, but
 * here they run over the real transcript, so what they surface is real too.
 */
function withAutomaticHighlights(
  material: StudyMaterial,
  transcript: TranscriptSegment[],
  concepts: StudyConcept[],
): { transcript: TranscriptSegment[]; markers: ImportantMarker[] } {
  const teacherMarkers = material.markers.filter(
    (marker) => marker.source !== 'ai',
  );
  const candidates = generateLocalHighlightCandidates({
    concepts,
    maxCandidates: 6,
    minimumConfidence: 0.5,
    transcript,
  }).filter(
    (candidate) =>
      !teacherMarkers.some(
        (marker) => Math.abs(marker.timestampMs - candidate.timestampMs) < 5_000,
      ),
  );
  const highlighted = new Set(candidates.map((candidate) => candidate.segmentId));

  return {
    transcript: transcript.map((segment) => ({
      ...segment,
      isImportant: segment.isImportant || highlighted.has(segment.id),
    })),
    markers: [
      ...teacherMarkers,
      ...candidates.map((candidate) => ({
        confidence: candidate.confidence,
        evidenceText: candidate.evidenceSentence,
        id: `${material.id}-auto-${candidate.segmentId}`,
        label: candidate.label,
        reason: candidate.reasons[0],
        source: 'ai' as const,
        timestampMs: candidate.timestampMs,
      })),
    ].sort((left, right) => left.timestampMs - right.timestampMs),
  };
}

const LENS_POLL_MS = 4_000;
const LENS_TIMEOUT_MS = 3 * 60_000;

export class StudyMaterialService {
  constructor(
    private readonly client: PremindApiClient = apiClient,
    private readonly sessions: SessionManager = sessionManager,
    private readonly uploader: ResumableUploader = new ResumableUploader(
      client,
      sessions,
    ),
  ) {}

  /**
   * True when this build can actually reach a server with a real account.
   *
   * The demo session is deliberately excluded: it holds no token any server
   * would accept, so letting it near the upload path would turn every demo
   * import into a failed one.
   */
  canUseServer(): boolean {
    return hasConfiguredApi() && !isDemoSession(this.sessions.session);
  }

  createLocalMaterial(input: MaterialImportInput): StudyMaterial {
    if (!input.projectId.trim() || !input.uri.trim() || !input.fileName.trim()) {
      throw new UnsupportedMaterialError('파일 정보와 폴더를 확인해 주세요.');
    }
    const kind = kindFrom(input);
    const now = new Date().toISOString();
    return {
      id: id('material'),
      projectId: input.projectId,
      title: input.title?.trim() || titleFromFile(input.fileName),
      source: {
        uri: input.uri,
        fileName: input.fileName,
        mimeType: input.mimeType || defaultMimeType(kind, input.fileName),
        kind,
        origin: input.origin ?? 'import',
        sizeBytes: input.sizeBytes,
        durationMs: input.durationMs,
      },
      status: 'imported',
      progress: 0,
      progressLabel: '기기에 저장됨',
      syncStatus: 'local-only',
      createdAt: now,
      updatedAt: now,
      transcript: [],
      quiz: [],
      markers: input.markers?.map((marker) => ({ ...marker })) ?? [],
    };
  }

  /**
   * Ask the server to open a study room from a public YouTube link and return
   * the material that tracks it.
   *
   * Server-only: there is no file to fall back to, so the demo session and a
   * build without a server get a plain refusal instead of a fake room. The
   * returned material already carries `serverRecordingId`, so
   * `processOnServer` skips the upload and goes straight to polling.
   */
  async importYouTubeMaterial(
    projectId: string,
    input: YouTubeImportInput,
  ): Promise<StudyMaterial> {
    if (!this.canUseServer()) {
      throw new UnsupportedMaterialError(
        '유튜브 링크 가져오기는 PREMIND 계정으로 로그인했을 때만 쓸 수 있어요.',
      );
    }
    const youtubeId = parseYouTubeId(input.url);
    if (!youtubeId) {
      throw new UnsupportedMaterialError(
        '유튜브 영상 주소가 아니에요. youtube.com/watch?v=… 또는 youtu.be/… 형태로 넣어 주세요.',
      );
    }
    const recording = await this.sessions.authorize((token) =>
      this.client.importYouTube(token, { url: youtubeWatchUrl(youtubeId), title: input.title }),
    );
    const now = new Date().toISOString();
    return {
      id: id('material'),
      projectId,
      title: recording.title || input.title?.trim() || '유튜브 강의',
      source: {
        uri: youtubeWatchUrl(youtubeId),
        fileName: `${youtubeId}.youtube`,
        mimeType: 'video/youtube',
        kind: 'video',
        origin: 'link',
        durationMs: recording.durationMs ?? undefined,
        youtubeId,
      },
      status: 'transcribing',
      progress: 0.55,
      progressLabel: '유튜브 영상을 읽고 대본을 만들고 있어요',
      syncStatus: 'synced',
      serverRecordingId: recording.id,
      createdAt: now,
      updatedAt: now,
      transcript: [],
      quiz: [],
      markers: [],
    };
  }

  /** The account's recordings as the server lists them (no transcript). */
  async listServerRecordings(): Promise<RecordingSummaryRow[]> {
    if (!this.canUseServer()) return [];
    return this.sessions.authorize((token) => this.client.listRecordings(token));
  }

  /**
   * A material for a recording that exists on the server but not on this
   * device — the case after signing in on a new phone. There is no local
   * file: playback streams from the server, and the study pack is folded in
   * by `processOnServer`, which skips the upload because `serverRecordingId`
   * is already known.
   */
  createRemoteMaterial(row: RecordingSummaryRow, projectId: string): StudyMaterial {
    const now = new Date().toISOString();
    const link = Boolean(row.youtubeId);
    const status: StudyMaterial['status'] =
      row.status === 'failed'
        ? 'failed'
        : row.status === 'stored'
          ? 'imported'
          : 'transcribing';
    return {
      id: id('material'),
      projectId,
      title: row.title || (link ? '유튜브 강의' : '보관된 녹음'),
      source: link
        ? {
            uri: youtubeWatchUrl(row.youtubeId as string),
            fileName: `${row.youtubeId}.youtube`,
            mimeType: 'video/youtube',
            kind: 'video',
            origin: 'link',
            durationMs: row.durationMs ?? undefined,
            youtubeId: row.youtubeId as string,
          }
        : {
            uri: '',
            fileName: row.title || 'recording',
            mimeType: 'application/octet-stream',
            kind: 'audio',
            origin: 'import',
            sizeBytes: row.byteSize || undefined,
            durationMs: row.durationMs ?? undefined,
          },
      status,
      progress: status === 'transcribing' ? 0.55 : status === 'imported' ? 0 : 0,
      progressLabel:
        status === 'failed'
          ? '이 녹음을 처리하지 못했어요'
          : status === 'imported'
            ? '보관됨 / 마인드팩 만들기 전'
            : '마인드팩을 불러오고 있어요',
      syncStatus: 'synced',
      serverRecordingId: row.id,
      createdAt: row.createdAt || now,
      updatedAt: row.createdAt || now,
      transcript: [],
      quiz: [],
      markers: [],
    };
  }

  /** Delete the server copy of a recording. The local material is the caller's. */
  async deleteServerRecording(recordingId: string): Promise<void> {
    await this.sessions.authorize((token) =>
      this.client.deleteRecording(token, recordingId),
    );
  }

  /**
   * Every evaluation the server keeps for a material, newest first.
   *
   * Only a server-backed material has a history to fetch; the demo (and a
   * material that never left the device) answers with whatever it already
   * carries, so a screen can call this without checking the session first.
   */
  async loadLensHistory(
    material: StudyMaterial,
    options: { signal?: AbortSignal } = {},
  ): Promise<LensHistoryEntry[]> {
    const recordingId = material.serverRecordingId;
    if (!this.canUseServer() || !recordingId) {
      return material.lensHistory ?? [];
    }
    return this.sessions.authorize((token) =>
      this.client.listLensHistory(token, recordingId, options.signal),
    );
  }

  /**
   * Answer one question about a material.
   *
   * A server-backed material gets a real answer: the model reads the
   * transcript and explains in its own words, citing the lines it used. Every
   * other case (the demo, a material still on the device, a server that
   * cannot answer right now) falls back to the on-device retrieval, which
   * quotes the closest lines instead. The caller never has to decide which.
   */
  async askMaterial(
    material: StudyMaterial,
    question: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<GroundedChatAnswer> {
    const recordingId = material.serverRecordingId;
    const local = () => localSourceGroundedChatService.answer(material, question);
    if (!this.canUseServer() || !recordingId || !question.trim()) {
      return local();
    }
    try {
      const result = await this.sessions.authorize((token) =>
        this.client.askRecording(token, recordingId, question.trim(), options.signal),
      );
      return {
        status: result.grounded ? 'answered' : 'insufficient-evidence',
        answer: result.answer,
        citations: result.citations.map((cited, index) => ({
          id: `server-${index}`,
          sourceKind: 'transcript' as const,
          timestampMs: cited.sourceStartMs,
          excerpt: cited.quote,
        })),
        confidence: result.grounded ? 1 : 0,
        mode: 'server-grounded' as const,
      };
    } catch {
      // A server that is down, busy, or has no model must not end the
      // conversation: the device can still answer from what it holds.
      return local();
    }
  }

  /**
   * Write a new Lens report for a processed recording and wait for it.
   *
   * Nothing is evaluated until this is called: the server only scores a
   * recording when asked. It answers 202 and works in the background, or 422
   * (`LENS_INSUFFICIENT`) at once when there is too little real speech to
   * score; that error carries the server's reason and is passed through. The
   * report is ready when the detail body dates a newer `lens_evaluated_at`.
   * Polls every few seconds for up to three minutes, which covers a long
   * lecture with margin. The history is fetched afterwards so the caller can
   * show the new report next to the earlier ones.
   */
  async requestLens(
    material: StudyMaterial,
    options: { signal?: AbortSignal; pollIntervalMs?: number } = {},
  ): Promise<LensEvaluation> {
    if (!this.canUseServer()) {
      throw new UnsupportedMaterialError(
        '데모 계정에서는 예시 평가만 볼 수 있어요. 새로 평가하려면 PREMIND 계정으로 로그인해 주세요.',
      );
    }
    const recordingId = material.serverRecordingId;
    if (!recordingId || material.status !== 'ready') {
      throw new UnsupportedMaterialError(
        '마인드팩이 준비된 자료만 평가할 수 있어요.',
      );
    }
    const before = JSON.stringify(material.lensReport ?? null);
    const beforeAt = material.lensEvaluatedAt ?? null;
    const beforeCount = material.lensCount ?? 0;
    await this.sessions.authorize((token) =>
      this.client.regenerateLens(token, recordingId),
    );
    const startedAt = Date.now();
    for (;;) {
      await wait(options.pollIntervalMs ?? LENS_POLL_MS, options.signal);
      const recording = await this.sessions.authorize((token) =>
        this.client.getRecording(token, recordingId, options.signal),
      );
      const report = recording.lensReport;
      const isNew =
        report !== null &&
        (recording.lensCount > beforeCount ||
          (recording.lensEvaluatedAt !== null &&
            recording.lensEvaluatedAt !== beforeAt) ||
          JSON.stringify(report) !== before);
      if (report && isNew) {
        const evaluatedAt = recording.lensEvaluatedAt ?? new Date().toISOString();
        const history = await this.sessions
          .authorize((token) =>
            this.client.listLensHistory(token, recordingId, options.signal),
          )
          // The report is already in hand; a history that failed to load
          // must not turn a finished evaluation into an error.
          .catch(() => [
            { id: `local-${evaluatedAt}`, evaluatedAt, report },
            ...(material.lensHistory ?? []),
          ]);
        return {
          report,
          evaluatedAt,
          count: Math.max(recording.lensCount, history.length, beforeCount + 1),
          history,
        };
      }
      if (Date.now() - startedAt > LENS_TIMEOUT_MS) {
        throw new Error(
          '평가가 예상보다 오래 걸리고 있어요. 잠시 후 자료를 다시 열어 확인해 주세요.',
        );
      }
    }
  }

  /**
   * The offline demo pipeline: a scripted study pack, produced on the device.
   *
   * This is what a build with no `EXPO_PUBLIC_API_URL` runs, and what the demo
   * session runs in any build. It is a product tour, not a transcription — the
   * text it writes is fixed, so nothing here should ever be mistaken for the
   * server's output.
   */
  async processLocalMaterial(
    material: StudyMaterial,
    options: ProcessMaterialOptions = {},
  ): Promise<StudyMaterial> {
    const delay = options.stepDelayMs ?? 180;
    const stages: MaterialProcessingProgress[] = [
      { status: 'queued', progress: 0.08, label: '마인드팩 만들기를 준비하고 있어요' },
      { status: 'transcribing', progress: 0.36, label: '말한 내용을 시간순으로 정리하고 있어요' },
      { status: 'generating', progress: 0.68, label: '핵심 개념과 요약을 만들고 있어요' },
      { status: 'generating', progress: 0.88, label: '문제를 만들고 있어요' },
    ];

    for (const stage of stages) {
      options.onProgress?.(stage);
      await wait(delay, options.signal);
    }

    const durationMs = Math.max(material.source.durationMs ?? 35 * 60_000, 60_000);
    const transcript = generatedTranscript(material, durationMs);
    const concepts = generatedConcepts(material, durationMs);
    const automaticHighlights = generateLocalHighlightCandidates({
      concepts,
      maxCandidates: 6,
      minimumConfidence: 0.5,
      transcript,
    }).filter(
      (candidate) =>
        !material.markers.some(
          (marker) => Math.abs(marker.timestampMs - candidate.timestampMs) < 5_000,
        ),
    );
    const highlightedSegmentIds = new Set(
      automaticHighlights.map((candidate) => candidate.segmentId),
    );
    const updatedAt = new Date().toISOString();
    options.onProgress?.({
      status: 'ready',
      progress: 1,
      label: '마인드팩 준비 완료',
    });
    return {
      ...material,
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      transcript: transcript.map((segment) => ({
        ...segment,
        isImportant: segment.isImportant || highlightedSegmentIds.has(segment.id),
      })),
      note: generatedNote(material, concepts),
      quiz: generatedQuiz(material, durationMs),
      markers: [
        ...material.markers,
        ...automaticHighlights.map((candidate) => ({
          confidence: candidate.confidence,
          evidenceText: candidate.evidenceSentence,
          id: `${material.id}-auto-${candidate.segmentId}`,
          label: candidate.label,
          reason: candidate.reasons[0],
          source: 'ai' as const,
          timestampMs: candidate.timestampMs,
        })),
      ].sort((left, right) => left.timestampMs - right.timestampMs),
      updatedAt,
      lastError: undefined,
    };
  }

  /**
   * Upload the original file to the recorder API, resumably.
   *
   * Returns as soon as the bytes are stored and the `Recording` exists. The
   * AI pass that follows is the server's business; `processOnServer` is what
   * waits for it.
   */
  async uploadMaterial(
    material: StudyMaterial,
    options: SyncMaterialOptions = {},
  ): Promise<SyncMaterialResult> {
    const { recordingId } = await this.uploader.upload(
      {
        clientReference: material.id,
        uri: material.source.uri,
        fileName: material.source.fileName,
        contentType: material.source.mimeType,
        title: material.title,
        sizeBytes: material.source.sizeBytes,
        durationMs: material.source.durationMs,
        markers: material.markers
          .filter((marker) => marker.source !== 'ai')
          .map((marker) => ({ timestampMs: marker.timestampMs })),
      },
      {
        signal: options.signal,
        onProgress: (progress) =>
          options.onProgress?.({
            status: 'queued',
            // Uploading is the first half of the job the user is waiting on.
            progress: 0.05 + progress.fraction * 0.45,
            label: '녹음을 올리고 있어요',
          }),
      },
    );
    return { recordingId };
  }

  /**
   * The real pipeline: upload the file, wait for the server's transcription
   * and study pass, and fold the result into the material.
   *
   * The local file is never touched — a server that fails costs the user their
   * study pack, never their recording.
   */
  async processOnServer(
    material: StudyMaterial,
    options: ProcessMaterialOptions = {},
  ): Promise<StudyMaterial> {
    let recordingId = material.serverRecordingId;
    if (!recordingId) {
      options.onProgress?.({
        status: 'queued',
        progress: 0.05,
        label: '업로드를 준비하고 있어요',
      });
      const uploaded = await this.uploadMaterial(material, {
        signal: options.signal,
        onProgress: options.onProgress,
      });
      recordingId = uploaded.recordingId;
      await options.onUploaded?.(recordingId);
    } else {
      options.onProgress?.({
        status: 'transcribing',
        progress: Math.max(material.progress, 0.55),
        label: '보관된 원본의 처리 상태를 확인하고 있어요',
      });
    }

    const recording = await this.awaitProcessed(recordingId, options);
    const segments = await this.sessions.authorize((token) =>
      this.client.getRecordingSegments(token, recordingId, options.signal),
    );

    const transcript = transcriptFromServer(material, segments, recording);
    const concepts = conceptsFromServer(material, recording);
    const highlighted = withAutomaticHighlights(material, transcript, concepts);

    options.onProgress?.({ status: 'ready', progress: 1, label: '마인드팩 준비 완료' });
    return {
      ...material,
      source: {
        ...material.source,
        durationMs: recording.durationMs ?? material.source.durationMs,
      },
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      syncStatus: 'synced',
      serverRecordingId: recordingId,
      transcript: highlighted.transcript,
      note: noteFromServer(recording, concepts, transcript),
      outline: recording.outline,
      quiz: quizFromServer(material, recording),
      markers: highlighted.markers,
      lensReport: recording.lensReport ?? undefined,
      lensEvaluatedAt: recording.lensEvaluatedAt ?? undefined,
      lensCount: recording.lensCount || undefined,
      pageImageCount: recording.pageImageCount || undefined,
      updatedAt: new Date().toISOString(),
      lastError: undefined,
    };
  }

  /**
   * Poll one recording until the server is done with it.
   *
   * Three ways out, and the third is the interesting one: a recording that
   * never leaves `stored` means the server has no transcription engine
   * configured. That is a deployment fact, not a slow lecture, so it is
   * reported after a short grace period instead of polling for 90 minutes.
   */
  private async awaitProcessed(
    recordingId: string,
    options: ProcessMaterialOptions,
  ): Promise<RecordingDetail> {
    const startedAt = Date.now();
    for (;;) {
      const recording = await this.sessions.authorize((token) =>
        this.client.getRecording(token, recordingId, options.signal),
      );

      if (recording.status === 'ready') {
        return recording;
      }
      if (recording.status === 'failed') {
        throw new Error(
          '이 녹음을 처리하지 못했어요. 원본은 기기에 그대로 있어요.',
        );
      }
      const waited = Date.now() - startedAt;
      if (recording.status === 'stored' && waited > AI_PASS_GRACE_MS) {
        throw new Error(
          '음성 인식이 준비되지 않아 마인드팩을 만들지 못했어요. 녹음은 안전하게 올라갔어요.',
        );
      }
      if (waited > PROCESSING_TIMEOUT_MS) {
        throw new Error(
          '처리가 예상보다 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.',
        );
      }

      options.onProgress?.({
        status: 'transcribing',
        // Server-side work has no reportable percentage, so the bar creeps
        // toward — and never reaches — the end rather than claiming a number.
        progress: Math.min(0.95, 0.55 + waited / PROCESSING_TIMEOUT_MS),
        label: '말한 내용을 정리하고 마인드팩을 만들고 있어요',
      });
      await wait(options.pollIntervalMs ?? POLL_INTERVAL_MS, options.signal);
    }
  }

}

export const studyMaterialService = new StudyMaterialService();
