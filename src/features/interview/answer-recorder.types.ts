export interface RecordedAnswer {
  /** Audio-only copy for transcription: a Blob (web) or a file URI (native). */
  audio: Blob | string | null;
  audioMimeType: string;
  /** Camera recording kept on this device only (web, optional). */
  video: Blob | null;
  videoMimeType: string;
  durationMs: number;
}

export interface AnswerRecorder {
  /** Whether this device can record; `reason` says why not, in Korean. */
  support(options: { video: boolean }): { ok: true } | { ok: false; reason: string };
  /** Ask for the microphone (and camera) and keep them open. Throws a Korean message. */
  prepare(options: { video: boolean }): Promise<void>;
  /** Start one answer. Resolves false when the recorder could not start. */
  start(): Promise<boolean>;
  /** Finish the answer. Null when nothing usable was recorded. */
  stop(): Promise<RecordedAnswer | null>;
  /** Drop the answer in progress without keeping it. */
  discard(): void;
  /** Close the microphone and camera. */
  release(): void;
  /** The open camera stream, for the preview (web only). */
  previewStream(): MediaStream | null;
}
