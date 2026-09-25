/** Same bounds as apps/interview/lib/interview/transcription.ts (checked again by the server). */
export const TRANSCRIPTION_LIMITS = {
  audioBytes: 8 * 1024 * 1024,
  durationMs: 5 * 60 * 1000,
  vocabularyItems: 20,
} as const;
