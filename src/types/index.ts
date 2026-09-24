export type ISODateString = string;

export type UserMode = 'teacher' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  /** Platform role returned by PREMIND. Product mode is managed separately. */
  role: string;
  mode: UserMode;
}

/**
 * A signed-in session.
 *
 * The recorder API issues a short-lived access token plus an opaque refresh
 * token that rotates on every use, so a phone stays signed in without storing
 * a password. `refreshToken` is null only for the offline demo session, which
 * has no server behind it and therefore nothing to refresh against.
 */
export interface AccessSession {
  accessToken: string;
  tokenType: 'bearer';
  issuedAt: ISODateString;
  expiresAt: ISODateString;
  refreshToken: string | null;
  refreshExpiresAt: ISODateString | null;
  user: UserProfile;
}

export type ProjectStatus =
  | 'draft'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'archived';

export interface Project {
  id: string;
  title: string;
  courseName: string;
  description: string;
  ownerName: string;
  status: ProjectStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  materialIds: string[];
  memberCount: number;
  accentColor: string;
  nextReviewAt?: ISODateString;
}

/**
 * What a material is made of. `document` is an uploaded PDF or slide deck:
 * the server reads it page by page instead of transcribing it, so it has no
 * playable audio and its positions are page numbers rather than times.
 */
export type MaterialKind = 'audio' | 'video' | 'document';
export type MaterialOrigin = 'recording' | 'import' | 'link';
export type MaterialStatus =
  | 'imported'
  | 'queued'
  | 'transcribing'
  | 'generating'
  | 'ready'
  | 'failed';
export type MaterialSyncStatus =
  | 'local-only'
  | 'uploading'
  | 'synced'
  | 'failed';

export interface LocalMediaSource {
  uri: string;
  fileName: string;
  mimeType: string;
  kind: MaterialKind;
  origin: MaterialOrigin;
  sizeBytes?: number;
  durationMs?: number;
  /** Set for `origin: 'link'`: the public YouTube video this material studies. */
  youtubeId?: string;
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  isImportant?: boolean;
  /**
   * For a page of an uploaded document: one line saying what is on it. The
   * 대본 offers this as a view; `text` stays the source either way.
   */
  summary?: string;
}

export interface StudyConcept {
  id: string;
  term: string;
  description: string;
  sourceStartMs: number;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export interface StudyNote {
  summary: string;
  keyPoints: string[];
  concepts: StudyConcept[];
  estimatedReviewMinutes: number;
  teacherVerified: boolean;
  updatedAt: ISODateString;
}

/**
 * One section of the 상세 요약 the server writes: a heading, the moment it
 * starts at, and a short paragraph. Sections arrive in lecture order and are
 * kept that way.
 */
export interface OutlineSection {
  heading: string;
  startMs: number;
  body: string;
}

/**
 * The learner's own notebook for one material: which key points they have
 * checked off, which concepts they want to see again, what they highlighted,
 * and what they wrote. Kept apart from `StudyNote` (the generated summary) so
 * a re-sync of the material can never overwrite the learner's work.
 */
export interface StudyNotebook {
  /** Key points (by text) the learner marked as understood. */
  checkedPoints: string[];
  /** Concept ids flagged "다시 볼래요". */
  reviewConcepts: string[];
  /** Sentences (by text) the learner painted with the 형광펜. */
  highlights: string[];
  memo: string;
  updatedAt: ISODateString;
}

export type StudyNotebookPatch = Partial<
  Pick<StudyNotebook, 'checkedPoints' | 'reviewConcepts' | 'highlights' | 'memo'>
>;

export type QuizQuestionType = 'multiple-choice' | 'true-false';

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  concept: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  sourceStartMs: number;
}

export interface ImportantMarker {
  id: string;
  timestampMs: number;
  label: string;
  source: 'teacher' | 'ai';
  /** Why PREMIND treated this moment as important. */
  reason?: string;
  /** Local confidence score from 0 to 1 when the marker was inferred. */
  confidence?: number;
  /** Short transcript evidence used to create an automatic marker. */
  evidenceText?: string;
}

export interface StudyMaterial {
  id: string;
  projectId: string;
  title: string;
  source: LocalMediaSource;
  status: MaterialStatus;
  progress: number;
  progressLabel: string;
  syncStatus: MaterialSyncStatus;
  serverRecordingId?: string;
  serverAssetId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  transcript: TranscriptSegment[];
  note?: StudyNote;
  /** The 자세히 view of 요약: server-built sections in lecture order. */
  outline?: OutlineSection[];
  quiz: QuizQuestion[];
  markers: ImportantMarker[];
  /** Server-authored, source-timed speaking feedback when Lens was run. */
  lensReport?: LensReport;
  /** When `lensReport` was written. */
  lensEvaluatedAt?: ISODateString;
  /** How many times this material has been evaluated. */
  lensCount?: number;
  /** Every evaluation so far, newest first. Loaded on demand from the server. */
  lensHistory?: LensHistoryEntry[];
  /**
   * How many pages of this document the server rendered to images. Absent or
   * 0 means there are none to fetch and the 미리보기 shows the page text: a
   * slide deck, or a document processed before the server rendered pages.
   */
  pageImageCount?: number;
  lastError?: string;
}

export interface MaterialImportInput {
  projectId: string;
  uri: string;
  fileName: string;
  mimeType?: string;
  title?: string;
  kind?: MaterialKind;
  sizeBytes?: number;
  durationMs?: number;
  origin?: MaterialOrigin;
  markers?: ImportantMarker[];
}

export type ShareRoomStatus = 'active' | 'revoked' | 'expired';
export type ShareRoomDistribution = 'local-preview' | 'published';

export interface ShareRoomContent {
  audio: boolean;
  summary: boolean;
  keyPoints: boolean;
  transcript: boolean;
  quiz: boolean;
}

export interface ShareRoom {
  id: string;
  projectId: string;
  materialId: string;
  title: string;
  slug: string;
  url: string;
  /** Local previews are navigable only inside this installation. */
  distribution: ShareRoomDistribution;
  status: ShareRoomStatus;
  content: ShareRoomContent;
  createdAt: ISODateString;
  expiresAt?: ISODateString;
  participantCount: number;
  viewCount: number;
  quizCompletionCount: number;
  averageQuizScore?: number;
}

/**
 * Why a passage did not land. `question-mismatch` is gone: it was about a
 * quiz question disagreeing with its explanation, which is not something a
 * reader can say about a line of the 대본, and it was the one reason with no
 * sensible follow-up question. `unclear` replaces it.
 */
export type ConfusionReason =
  | 'terminology'
  | 'needs-example'
  | 'too-fast'
  | 'unclear';

export interface ConfusionFeedback {
  id: string;
  materialId: string;
  segmentId?: string;
  reason: ConfusionReason;
  createdAt: ISODateString;
}

export interface QuizAttempt {
  id: string;
  materialId: string;
  questionId: string;
  selectedChoiceIndex: number;
  isCorrect: boolean;
  attemptedAt: ISODateString;
}

export interface AppSettings {
  mode: UserMode;
  notificationsEnabled: boolean;
  recordingQuality: 'standard' | 'high';
  /** The "첫 결과까지 3단계" card on home has been closed by the user. */
  homeChecklistDismissed?: boolean;
}

export interface PersistedAppSnapshot {
  schemaVersion: 1;
  projects: Project[];
  materials: StudyMaterial[];
  shareRooms: ShareRoom[];
  activeProjectId: string | null;
  savedMaterialIds: string[];
  confusionFeedback: ConfusionFeedback[];
  quizAttempts: QuizAttempt[];
  settings: AppSettings;
  /** Per-material notebooks by material id. Absent in snapshots written before 2026-09-06. */
  studyNotes?: Record<string, StudyNotebook>;
}

export type PlanId = 'free' | 'standard';

/** This month's processing minutes, as `/api/auth/me` reports them. */
export interface PlanUsage {
  minutes_used: number;
  minutes_limit: number;
  period_start: ISODateString;
  period_end: ISODateString;
}

export interface PremindApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
  /** Effective plan; older servers omit it, which reads as free. */
  plan?: PlanId;
  plan_renews_at?: ISODateString | null;
  usage?: PlanUsage;
}

/** `POST /api/auth/token`, `/token/refresh` and `/register` all answer this. */
export interface PremindTokenPair {
  access_token: string;
  token_type?: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: PremindApiUser;
}

/** Server-side lifecycle of one recording: `stored` until the AI pass runs. */
export type RecordingStatus = 'stored' | 'transcribing' | 'ready' | 'failed';

/** `GET /api/recordings` row — no transcript, so a library list stays light. */
export interface RecordingSummaryRow {
  id: string;
  title: string;
  durationMs: number | null;
  status: RecordingStatus;
  byteSize: number;
  createdAt: ISODateString;
  /** Non-null for a recording imported from a YouTube link; it has no media file. */
  youtubeId: string | null;
}

/** `POST /api/recordings/import-youtube` body. */
export interface YouTubeImportInput {
  url: string;
  title?: string;
}

export interface RecordingConcept {
  term: string;
  description: string;
  sourceStartMs: number;
  difficulty: StudyConcept['difficulty'];
}

export interface RecordingQuizQuestion {
  type: QuizQuestionType;
  concept: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  sourceStartMs: number;
}

/** Concepts and check questions the server generated from the transcript. */
export interface RecordingStudyPack {
  concepts: RecordingConcept[];
  quiz: RecordingQuizQuestion[];
}

export type LensRubricKey = 'structure' | 'clarity' | 'evidence' | 'delivery';

export interface LensRubricScore {
  key: LensRubricKey;
  label: string;
  /** 0–5, one decimal. */
  score: number;
  /** The line in the transcript that earned the score. */
  evidence: string;
}

export interface LensMoment {
  text: string;
  sourceStartMs: number;
  /** What to do differently next time. Present on improvements only. */
  action?: string;
}

/**
 * PREMIND Lens: the speaker-facing delivery report the server writes after
 * transcription. Every moment carries a timestamp, so the report is something
 * to jump into, not just a number to take on faith.
 */
export interface LensReport {
  overall: number;
  rubric: LensRubricScore[];
  strengths: LensMoment[];
  improvements: LensMoment[];
  priority: LensMoment | null;
}

/**
 * One past evaluation of a recording. The server keeps every report the
 * learner asked for (`GET /api/recordings/{id}/lens`, newest first), so a
 * second attempt at the same talk can be read next to the first.
 */
export interface LensHistoryEntry {
  id: string;
  evaluatedAt: ISODateString;
  report: LensReport;
}

/** One line of the transcript an answer leaned on. */
export interface RecordingAnswerCitation {
  quote: string;
  sourceStartMs: number;
}

/** `POST /api/recordings/{id}/ask`: the answer, in the model's own words. */
export interface RecordingAnswer {
  answer: string;
  /** False when the transcript could not actually answer the question. */
  grounded: boolean;
  citations: RecordingAnswerCitation[];
}

export interface RecordingDetail extends RecordingSummaryRow {
  contentType: string;
  transcript: string | null;
  summary: string | null;
  keyPoints: string[];
  /** 상세 요약 sections, absent on recordings processed before the server wrote them. */
  outline?: OutlineSection[];
  studyPack: RecordingStudyPack | null;
  lensReport: LensReport | null;
  /** When the newest Lens report was written; null until the learner asks for one. */
  lensEvaluatedAt: ISODateString | null;
  /** How many Lens reports exist for this recording. */
  lensCount: number;
  /**
   * How many pages of an uploaded PDF the server rendered to images, servable
   * at `GET /api/recordings/{id}/pages/{n}`. 0 for audio, video, YouTube, a
   * slide deck, and any document processed before the server did this — in all
   * of those the app shows the extracted page text instead.
   */
  pageImageCount: number;
}

/**
 * One timed caption line. Served by `GET /api/recordings/{id}/segments` rather
 * than inline on the detail body: a lecture has thousands of them.
 */
export interface RecordingSegment {
  startMs: number;
  endMs: number;
  text: string;
  /** The page number, for an uploaded document. Absent for spoken audio. */
  page?: number;
  /** One line saying what is on that page, from the server's page pass. */
  summary?: string;
}

/** A 중요 표시 carried to the server so the AI pass can weight that span. */
export interface UploadMarkerInput {
  timestampMs: number;
  createdAt?: ISODateString;
}

export interface UploadInitInput {
  /** The device-side material id. Makes `POST /api/uploads` idempotent. */
  clientReference: string;
  filename: string;
  totalBytes: number;
  contentType: string;
  title: string;
  durationMs?: number;
  markers?: UploadMarkerInput[];
}

/**
 * Resume state for one upload. `chunkSize` is decided by the server, so the
 * client must split using this value and never a constant of its own.
 */
export interface UploadSessionState {
  uploadId: string;
  status: 'pending' | 'completed' | 'aborted';
  totalBytes: number;
  chunkSize: number;
  chunkCount: number;
  receivedChunks: number[];
  receivedBytes: number;
  recordingId: string | null;
}

