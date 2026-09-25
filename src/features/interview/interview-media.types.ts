import type { AudioPart } from './interview-api';

export interface StoredAudio {
  /** What goes into the transcription upload: a Blob on the web, a file on native. */
  part: AudioPart;
  size: number;
  mimeType: string;
  expiresAt: string;
}

/**
 * Where an answer's recordings live on this device. Nothing here is ever sent
 * to a server except the audio part handed to the transcription request.
 */
export interface InterviewMediaStore {
  /** `audio` is a Blob (web) or a file URI from the recorder (native). */
  putPendingAudio(input: {
    key: string;
    sessionId: string;
    attemptId: string;
    audio: Blob | string;
    mimeType: string;
    expiresAt: string;
  }): Promise<void>;
  getPendingAudio(key: string): Promise<StoredAudio | null>;
  deletePendingAudio(key: string): Promise<void>;
  /** Keys whose retention ended; the caller also closes their answers. */
  expiredPendingAudio(nowMs: number): Promise<string[]>;
  putVideo(input: { key: string; sessionId: string; video: Blob | string; mimeType: string }): Promise<void>;
  /** A playable URI for a kept video, or null when it is gone. */
  videoUri(key: string): Promise<string | null>;
  deleteSessionMedia(sessionId: string, keys: string[]): Promise<void>;
}
