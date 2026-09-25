/**
 * Browser answer recording: MediaRecorder, audio-only for transcription
 * (`audio/webm;codecs=opus`, `audio/mp4` on Safari) and, when the learner turns
 * the camera on, a separate camera+microphone recording that never leaves this
 * browser. Same split as the interview web app (interview-room.tsx).
 */
import type { AnswerRecorder, RecordedAnswer } from './answer-recorder.types';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const VIDEO_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

function pick(types: string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return types.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? null;
}

function deviceMessage(reason: unknown, video: boolean): string {
  const name = reason && typeof reason === 'object' && 'name' in reason ? String((reason as { name: unknown }).name) : '';
  const device = video ? '카메라와 마이크' : '마이크';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `${device} 사용이 막혀 있어요. 브라우저 주소창의 권한 설정에서 허용한 뒤 다시 시도해 주세요.`;
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `${device}를 찾지 못했어요. 연결을 확인해 주세요.`;
  if (name === 'NotReadableError') return `다른 앱이 ${device}를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요.`;
  return `${device}를 켜지 못했어요. 잠시 후 다시 시도해 주세요.`;
}

class Take {
  chunks: Blob[] = [];
  done: Promise<Blob>;
  private resolve!: (blob: Blob) => void;
  constructor(readonly recorder: MediaRecorder, readonly mimeType: string) {
    this.done = new Promise((resolve) => {
      this.resolve = resolve;
    });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    recorder.onstop = () => this.resolve(new Blob(this.chunks, { type: recorder.mimeType || mimeType }));
  }
}

export function createAnswerRecorder(): AnswerRecorder {
  let stream: MediaStream | null = null;
  let withVideo = false;
  let audioTake: Take | null = null;
  let videoTake: Take | null = null;
  let startedAt = 0;

  const stopTracks = () => {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  };

  return {
    support({ video }) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return { ok: false, reason: '이 브라우저에서는 녹음할 수 없어요. 최신 Chrome, Edge, Safari에서 열어 주세요.' };
      }
      if (!pick(AUDIO_TYPES)) return { ok: false, reason: '이 브라우저는 답변 녹음을 지원하지 않아요. 최신 Chrome, Edge, Safari에서 열어 주세요.' };
      if (video && !pick(VIDEO_TYPES)) return { ok: false, reason: '이 브라우저는 영상 녹화를 지원하지 않아요. 영상 없이 연습해 주세요.' };
      return { ok: true };
    },

    async prepare({ video }) {
      withVideo = video;
      if (stream?.active) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        });
      } catch (reason) {
        stopTracks();
        throw new Error(deviceMessage(reason, video));
      }
    },

    async start() {
      if (!stream?.active || audioTake) return false;
      const audioType = pick(AUDIO_TYPES);
      if (!audioType) return false;
      try {
        const audioStream = new MediaStream(stream.getAudioTracks());
        audioTake = new Take(new MediaRecorder(audioStream, { mimeType: audioType, audioBitsPerSecond: 64_000 }), audioType);
        const videoType = withVideo && stream.getVideoTracks().length ? pick(VIDEO_TYPES) : null;
        videoTake = videoType ? new Take(new MediaRecorder(stream, { mimeType: videoType }), videoType) : null;
        audioTake.recorder.start(1_000);
        videoTake?.recorder.start(1_000);
        startedAt = Date.now();
        return true;
      } catch {
        audioTake = null;
        videoTake = null;
        return false;
      }
    },

    async stop(): Promise<RecordedAnswer | null> {
      const audio = audioTake;
      const video = videoTake;
      audioTake = null;
      videoTake = null;
      if (!audio) return null;
      const durationMs = Math.max(0, Date.now() - startedAt);
      for (const take of [audio, video]) {
        if (take && take.recorder.state !== 'inactive') take.recorder.stop();
      }
      const [audioBlob, videoBlob] = await Promise.all([audio.done, video ? video.done : Promise.resolve(null)]);
      return {
        audio: audioBlob.size > 0 ? audioBlob : null,
        audioMimeType: audioBlob.type || audio.mimeType,
        video: videoBlob && videoBlob.size > 0 ? videoBlob : null,
        videoMimeType: videoBlob?.type || video?.mimeType || '',
        durationMs,
      };
    },

    discard() {
      for (const take of [audioTake, videoTake]) {
        if (take && take.recorder.state !== 'inactive') {
          take.recorder.ondataavailable = null;
          take.recorder.stop();
        }
      }
      audioTake = null;
      videoTake = null;
    },

    release() {
      this.discard();
      stopTracks();
    },

    previewStream() {
      return withVideo && stream?.getVideoTracks().length ? stream : null;
    },
  };
}
