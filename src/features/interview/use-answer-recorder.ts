/**
 * Native answer recording with expo-audio: audio only (no camera in v1), an
 * AAC .m4a file per answer. The file is moved into the interview media folder
 * when the answer is saved and deleted once it has been transcribed.
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useMemo, useRef } from 'react';

import type { AnswerRecorder } from './answer-recorder.types';

const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  numberOfChannels: 1,
  bitRate: 64_000,
};

export function useAnswerRecorder(): AnswerRecorder {
  const recorder = useAudioRecorder(OPTIONS);
  const startedAt = useRef(0);
  const recording = useRef(false);

  const api = useMemo<AnswerRecorder>(
    () => ({
      support() {
        return { ok: true };
      },
      async prepare() {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          throw new Error('마이크 사용이 막혀 있어요. 설정에서 PREMIND의 마이크를 허용한 뒤 다시 시도해 주세요.');
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      },
      async start() {
        if (recording.current) return false;
        try {
          await recorder.prepareToRecordAsync();
          recorder.record();
          recording.current = true;
          startedAt.current = Date.now();
          return true;
        } catch {
          return false;
        }
      },
      async stop() {
        if (!recording.current) return null;
        recording.current = false;
        const durationMs = Math.max(0, Date.now() - startedAt.current);
        try {
          await recorder.stop();
        } catch {
          return null;
        }
        const uri = recorder.uri;
        return uri
          ? { audio: uri, audioMimeType: 'audio/m4a', video: null, videoMimeType: '', durationMs }
          : null;
      },
      discard() {
        if (!recording.current) return;
        recording.current = false;
        void recorder.stop().catch(() => undefined);
      },
      release() {
        this.discard();
        void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      },
      previewStream() {
        return null;
      },
    }),
    [recorder],
  );

  useEffect(() => () => api.release(), [api]);
  return api;
}
