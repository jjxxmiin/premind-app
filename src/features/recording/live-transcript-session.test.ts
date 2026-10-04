import { EventEmitter } from 'expo';
import type { ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
import { LiveTranscriptSession, type SpeechEngine } from './live-transcript-session';
import { LiveTranscriptRepository, transcriptText, type LiveTranscriptDraft } from './live-transcript-repository';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

type Events = { [K in keyof ExpoSpeechRecognitionNativeEventMap]: (value: ExpoSpeechRecognitionNativeEventMap[K]) => void };
function setup(persist: (draft: LiveTranscriptDraft) => Promise<void> = jest.fn(async (_draft: LiveTranscriptDraft): Promise<void> => undefined)) {
  const events = new EventEmitter<Events>();
  const engine: SpeechEngine = { start: jest.fn(), stop: jest.fn(), abort: jest.fn(),
    addListener: (name, listener) => events.addListener(name, listener) };
  const draft: LiveTranscriptDraft = { id: 'one', title: '녹음', updatedAt: '2026-10-04', status: 'paused', paragraphs: [], interim: '', parts: [] };
  const session = new LiveTranscriptSession(engine, draft, 'file:///documents', persist, jest.fn());
  const result = (text: string, isFinal: boolean) => events.emit('result', { isFinal, results: [{ transcript: text, confidence: 1, segments: [] }] });
  return { session, engine, events, persist, result, draft };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('persists evolving interim without duplicating it and finalizes before completing', async () => {
  const { session, engine, events, persist, result } = setup();
  await session.start();
  events.emit('start', null);
  events.emit('audiostart', { uri: 'file:///one.wav', timestamp: 1000 });
  result('안녕', false); result('안녕하세요', false);
  session.finish();
  expect(session.snapshot.phase).toBe('saving');
  expect(engine.stop).toHaveBeenCalledTimes(1);
  events.emit('audioend', { uri: 'file:///one.wav', timestamp: 8000 });
  result('안녕하세요.', true);
  events.emit('end', null);
  await session.flush();
  expect(session.snapshot.phase).toBe('completed');
  expect(session.snapshot.draft.paragraphs).toEqual(['안녕하세요.']);
  expect(session.snapshot.draft.interim).toBe('');
  expect(session.snapshot.draft.parts).toEqual([{ uri: 'file:///one.wav', durationMillis: 7000, finalized: true }]);
  expect(persist).toHaveBeenLastCalledWith(session.snapshot.draft);
  expect(session.snapshot.unsaved).toBe(false);
  session.dispose();
});

it('keeps two independently finalized audio parts across pause and resume', async () => {
  const { session, events, result, engine } = setup();
  await session.start(); events.emit('start', null);
  events.emit('audiostart', { uri: 'file:///one.wav', timestamp: 1000 });
  result('첫 문장', true); session.pause();
  events.emit('audioend', { uri: 'file:///one.wav', timestamp: 3000 }); events.emit('end', null);
  expect(session.snapshot.phase).toBe('paused');
  await session.start(); events.emit('start', null);
  events.emit('audiostart', { uri: 'file:///two.wav', timestamp: 5000 }); result('둘째 문장', true);
  session.finish(); events.emit('audioend', { uri: 'file:///two.wav', timestamp: 8000 }); events.emit('end', null);
  await session.flush();
  expect(session.snapshot.draft.paragraphs).toEqual(['첫 문장', '둘째 문장']);
  expect(session.snapshot.draft.parts.map((part) => part.durationMillis)).toEqual([2000, 3000]);
  expect(engine.start).toHaveBeenCalledTimes(2);
  session.dispose();
});

it('does not acquire microphone when durable draft creation fails and can retry save', async () => {
  const persist = jest.fn(async (_draft: LiveTranscriptDraft) => undefined).mockRejectedValueOnce(new Error('disk full'));
  const { session, engine } = setup(persist);
  await session.start();
  expect(engine.start).not.toHaveBeenCalled();
  expect(session.snapshot.unsaved).toBe(true);
  await session.retrySave();
  expect(session.snapshot.unsaved).toBe(false);
  session.dispose();
});

it('bounds a native engine that never starts and retains unconfirmed words after interruption', async () => {
  const { session, engine, events, result } = setup();
  await session.start();
  jest.advanceTimersByTime(15000);
  expect(engine.abort).toHaveBeenCalledTimes(1);
  expect(session.snapshot.phase).toBe('interrupted');
  await session.start(); events.emit('start', null); result('미완성 문장', false);
  events.emit('error', { error: 'network', message: 'offline' }); events.emit('end', null);
  await session.flush();
  expect(session.snapshot.draft.status).toBe('interrupted');
  expect(transcriptText(session.snapshot.draft)).toContain('[미확정 대본]\n미완성 문장');
  session.dispose();
});

it('ignores duplicate start and clears startup watchdog once the actual start arrives', async () => {
  const { session, engine, events } = setup();
  await session.start(); await session.start(); events.emit('start', null);
  jest.advanceTimersByTime(15001);
  expect(engine.start).toHaveBeenCalledTimes(1);
  expect(engine.abort).not.toHaveBeenCalled();
  session.dispose();
});

it('serializes account-scoped saves and retains other accounts when purging', async () => {
  const data = new Map<string, string>();
  const repository = new LiveTranscriptRepository({
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  });
  const { draft, session } = setup();
  await Promise.all([repository.save('A', draft), repository.save('A', { ...draft, paragraphs: ['마지막'] }), repository.save('B', { ...draft, title: '다른 계정' })]);
  expect((await repository.list('A'))[0]?.paragraphs).toEqual(['마지막']);
  expect((await repository.list('B'))[0]?.title).toBe('다른 계정');
  await repository.purge('A');
  expect(await repository.list('A')).toEqual([]);
  expect(await repository.list('B')).toHaveLength(1);
  session.dispose();
});

it('pauses a delayed native startup without becoming recording in the background', async () => {
  const { session, engine, events } = setup();
  await session.start(); session.pause();
  expect(session.snapshot.phase).toBe('pausing');
  events.emit('start', null);
  expect(session.snapshot.phase).toBe('pausing');
  expect(engine.stop).toHaveBeenCalledTimes(2);
  events.emit('end', null);
  expect(session.snapshot.phase).toBe('paused');
  session.dispose();
});

it('cancels before storage finishes without ever acquiring the microphone', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { session, engine } = setup(jest.fn(async (_draft: LiveTranscriptDraft) => gate));
  const starting = session.start();
  session.pause(); release?.(); await starting;
  expect(engine.start).not.toHaveBeenCalled();
  expect(session.snapshot.phase).toBe('paused');
  session.dispose();
});

it('cleans listeners and persists interruption even if native abort throws', async () => {
  const { session, engine, events } = setup();
  engine.abort = () => { throw new Error('native teardown error'); };
  await session.start(); events.emit('start', null);
  expect(() => session.dispose()).not.toThrow();
  await session.flush();
  expect(session.snapshot.draft.status).toBe('interrupted');
  events.emit('result', { isFinal: true, results: [{ transcript: 'late', confidence: 1, segments: [] }] });
  expect(session.snapshot.draft.paragraphs).toEqual([]);
});

it('does not claim a successful audio save when the engine finishes without a file', async () => {
  const { session, events, result } = setup();
  await session.start(); events.emit('start', null); result('대본은 보관', true);
  session.finish(); events.emit('audioend', { uri: null, timestamp: 1000 }); events.emit('end', null);
  await session.flush();
  expect(session.snapshot.phase).toBe('interrupted');
  expect(session.snapshot.error).toContain('원본 파일');
  expect(session.snapshot.draft.paragraphs).toEqual(['대본은 보관']);
  session.dispose();
});

it('writes only the active draft when interim text changes, without rewriting history', async () => {
  const data = new Map<string, string>();
  const writes: string[] = [];
  const repository = new LiveTranscriptRepository({
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { writes.push(key); data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  });
  const { draft, session } = setup();
  await repository.save('A', { ...draft, id: 'history', paragraphs: ['long saved history'.repeat(10000)] });
  await repository.save('A', draft);
  writes.length = 0;
  await repository.save('A', { ...draft, interim: '새로 인식한 문장' });
  expect(writes).toEqual(['premind.live-transcripts.v1.A.draft.one']);
  expect((await repository.list('A')).find((item) => item.id === 'history')?.paragraphs[0]?.length).toBe(180000);
  await repository.purge('A');
  expect(data.size).toBe(0);
  session.dispose();
});

it('bounds a hung initial storage write without capturing audio', async () => {
  const { session, engine } = setup(jest.fn(() => new Promise<void>(() => undefined)));
  const starting = session.start();
  jest.advanceTimersByTime(15000);
  await starting;
  expect(session.snapshot.phase).toBe('interrupted');
  expect(session.snapshot.error).toContain('저장소 응답');
  expect(engine.start).not.toHaveBeenCalled();
  session.dispose();
});
