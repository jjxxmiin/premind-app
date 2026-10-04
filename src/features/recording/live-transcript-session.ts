import type {
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';

import type { LiveTranscriptDraft } from './live-transcript-repository';

type SpeechEvents = { [K in keyof ExpoSpeechRecognitionNativeEventMap]: (value: ExpoSpeechRecognitionNativeEventMap[K]) => void };
export interface SpeechEngine {
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  abort(): void;
  addListener<K extends keyof ExpoSpeechRecognitionNativeEventMap>(
    event: K,
    listener: SpeechEvents[K],
  ): { remove(): void };
}

export type LiveTranscriptPhase = 'idle' | 'starting' | 'recording' | 'pausing' | 'paused' | 'saving' | 'completed' | 'interrupted';
export interface LiveTranscriptState {
  readonly phase: LiveTranscriptPhase;
  readonly draft: LiveTranscriptDraft;
  readonly error: string | null;
  readonly unsaved: boolean;
}

/** One microphone owner. Each resume creates another independently playable WAV. */
export class LiveTranscriptSession {
  private state: LiveTranscriptState;
  private readonly listeners: { remove(): void }[];
  private segmentStart = 0;
  private stopIntent: 'paused' | 'completed' | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private revision = 0;
  private disposed = false;
  private nativeStarted = false;
  private audioSaveFailed = false;

  constructor(
    private readonly engine: SpeechEngine,
    draft: LiveTranscriptDraft,
    private readonly outputDirectory: string,
    private readonly persist: (draft: LiveTranscriptDraft) => Promise<void>,
    private readonly onChange: (state: LiveTranscriptState) => void,
  ) {
    this.state = { phase: draft.status === 'recording' ? 'interrupted' : draft.status, draft, error: null, unsaved: false };
    this.listeners = [
      engine.addListener('start', () => {
        if (this.stopIntent) {
          try { this.engine.stop(); } catch (error) { this.abortSafely(error instanceof Error ? error.message : '녹음을 중단하지 못했어요.'); }
        } else if (this.state.phase === 'starting') this.change({ phase: 'recording' });
      }),
      engine.addListener('audiostart', (event) => {
        this.segmentStart = event.timestamp;
        if (event.uri) this.updateDraft({ parts: [...this.state.draft.parts,
          { uri: event.uri, durationMillis: 0, finalized: false }] });
      }),
      engine.addListener('audioend', (event) => {
        if (!event.uri) {
          this.audioSaveFailed = true;
          this.change({ error: '대본은 보관했지만 이번 구간의 원본 파일을 확인하지 못했어요.' });
          return;
        }
        const savedPart = { uri: event.uri, finalized: true,
          durationMillis: Math.max(0, event.timestamp - this.segmentStart) };
        const parts = this.state.draft.parts;
        this.updateDraft({ parts: parts.some((part) => part.uri === event.uri)
          ? parts.map((part) => part.uri === event.uri ? savedPart : part)
          : [...parts, savedPart] });
      }),
      engine.addListener('result', (event) => {
        const text = event.results[0]?.transcript.trim();
        if (!text) return;
        this.updateDraft(event.isFinal
          ? { paragraphs: [...this.state.draft.paragraphs, text], interim: '' }
          : { interim: text });
      }),
      engine.addListener('error', (event) => {
        this.change({ error: event.error === 'no-speech' || event.error === 'speech-timeout'
          ? '말소리가 감지되지 않았어요. 저장된 내용을 확인하고 이어서 녹음해 주세요.'
          : '음성 인식이 중단됐어요. 저장된 대본과 원본을 확인하고 다시 시작해 주세요.' });
      }),
      engine.addListener('end', () => {
        this.nativeStarted = false;
        this.clearWatchdog();
        const phase = this.audioSaveFailed ? 'interrupted' : this.stopIntent ?? 'interrupted';
        this.stopIntent = null;
        this.change({ phase });
        this.updateDraft({ status: phase });
      }),
    ];
  }

  get snapshot(): LiveTranscriptState { return this.state; }

  async start(): Promise<void> {
    if (['starting', 'recording', 'pausing', 'saving'].includes(this.state.phase)) return;
    this.change({ phase: 'starting', error: null });
    this.audioSaveFailed = false;
    // An interim result is preserved visibly as unconfirmed instead of being promoted to final.
    if (this.state.draft.interim) this.updateDraft({
      paragraphs: [...this.state.draft.paragraphs, `[미확정] ${this.state.draft.interim}`], interim: '',
    });
    this.updateDraft({ status: 'recording' });
    let saveTimeout: ReturnType<typeof setTimeout> | undefined;
    const savedInTime = await Promise.race([
      this.flush().then(() => true),
      new Promise<false>((resolve) => { saveTimeout = setTimeout(() => resolve(false), 15000); }),
    ]);
    if (saveTimeout) clearTimeout(saveTimeout);
    if (this.state.phase !== 'starting') return;
    if (!savedInTime) {
      this.change({ phase: 'interrupted', error: '기기 저장소 응답이 지연되고 있어요. 일반 녹음을 이용하거나 다시 시도해 주세요.' });
      return;
    }
    if (this.state.unsaved || this.disposed) {
      this.change({ phase: 'interrupted' });
      return;
    }
    try {
      this.armWatchdog('마이크 시작이 지연되고 있어요. 권한을 확인하고 다시 시도해 주세요.');
      this.nativeStarted = true;
      this.engine.start({ lang: 'ko-KR', continuous: true, interimResults: true,
        maxAlternatives: 1,
        recordingOptions: { persist: true, outputDirectory: this.outputDirectory,
          outputFileName: `${this.state.draft.id}-${Date.now()}.wav`,
          outputSampleRate: 16000, outputEncoding: 'pcmFormatInt16' } });
    } catch (error) {
      this.clearWatchdog();
      this.nativeStarted = false;
      this.change({ phase: 'interrupted', error: error instanceof Error ? error.message : '음성 인식을 시작하지 못했어요.' });
      this.updateDraft({ status: 'interrupted' });
    }
  }

  pause(): void { this.stop('paused'); }
  finish(): void {
    if (this.state.phase === 'paused' || this.state.phase === 'interrupted') {
      this.change({ phase: 'completed' });
      this.updateDraft({ status: 'completed' });
      return;
    }
    this.stop('completed');
  }

  private stop(intent: 'paused' | 'completed'): void {
    if (this.state.phase !== 'recording' && this.state.phase !== 'starting') return;
    if (!this.nativeStarted) {
      this.change({ phase: intent });
      this.updateDraft({ status: intent });
      return;
    }
    this.clearWatchdog();
    this.stopIntent = intent;
    this.change({ phase: intent === 'paused' ? 'pausing' : 'saving' });
    try {
      this.armWatchdog('음성 인식 종료가 지연되어 중단했어요. 미확정 대본은 따로 보관했어요.');
      this.engine.stop();
    } catch (error) {
      this.clearWatchdog();
      this.stopIntent = null;
      this.abortSafely('녹음을 종료하지 못했어요.');
      this.change({ phase: 'interrupted', error: error instanceof Error ? error.message : '녹음을 종료하지 못했어요.' });
      this.updateDraft({ status: 'interrupted' });
    }
  }

  async retrySave(): Promise<void> { this.change({ error: null }); this.updateDraft({}); await this.flush(); }
  async flush(): Promise<void> { await this.writeTail; }

  dispose(): void {
    this.disposed = true;
    this.clearWatchdog();
    if (['starting', 'recording', 'pausing', 'saving'].includes(this.state.phase)) {
      this.abortSafely('음성 인식을 중단하지 못했어요.');
      this.updateDraft({ status: 'interrupted' });
    }
    for (const listener of this.listeners) listener.remove();
  }

  private updateDraft(patch: Partial<LiveTranscriptDraft>): void {
    const draft = { ...this.state.draft, ...patch, updatedAt: new Date().toISOString() };
    const revision = ++this.revision;
    this.change({ draft, unsaved: true });
    this.writeTail = this.writeTail.then(() => this.persist(draft)).then(() => {
      if (revision === this.revision) this.change({ unsaved: false });
    }, (error: unknown) => {
      this.change({ unsaved: true, error: error instanceof Error
        ? `기기 저장 실패: ${error.message}` : '기기에 저장하지 못했어요. 다시 저장을 눌러 주세요.' });
    });
  }

  private change(patch: Partial<LiveTranscriptState>): void {
    this.state = { ...this.state, ...patch };
    if (this.state.phase === 'recording') this.clearWatchdog();
    if (!this.disposed) this.onChange(this.state);
  }

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private armWatchdog(message: string): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.stopIntent = null;
      this.abortSafely(message);
      this.change({ phase: 'interrupted', error: message });
      this.updateDraft({ status: 'interrupted' });
    }, 15000);
  }

  private abortSafely(message: string): void {
    try { this.engine.abort(); }
    catch (error) { this.change({ error: error instanceof Error ? `${message} ${error.message}` : message }); }
    this.nativeStarted = false;
  }
}
