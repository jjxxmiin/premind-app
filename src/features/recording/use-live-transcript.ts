import { requireOptionalNativeModule } from 'expo';
import { Directory, Paths } from 'expo-file-system';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { createId } from '@/lib/format';
import { LIVE_TRANSCRIPT_DIRECTORY_NAME } from './live-transcript-constants';
import { liveTranscriptRepository, type LiveTranscriptDraft } from './live-transcript-repository';
import { LiveTranscriptSession, type LiveTranscriptState } from './live-transcript-session';

type NativeSpeech = typeof ExpoSpeechRecognitionModule;
const speech = Platform.OS === 'web' ? null
  : requireOptionalNativeModule<NativeSpeech>('ExpoSpeechRecognition');

export function useLiveTranscript(workspaceId: string) {
  const controller = useRef<LiveTranscriptSession | null>(null);
  const mounted = useRef(true);
  const starting = useRef(false);
  const [state, setState] = useState<LiveTranscriptState | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LiveTranscriptDraft[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const supported = Boolean(speech?.isRecognitionAvailable() && speech.supportsRecording());

  const refresh = useCallback(async () => {
    try {
      const drafts = await liveTranscriptRepository.list(workspaceId);
      if (mounted.current) setHistory(drafts);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '저장한 대본을 불러오지 못했어요.');
    } finally {
      if (mounted.current) setLoadingHistory(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    mounted.current = true;
    void liveTranscriptRepository.list(workspaceId).then((drafts) => {
      if (mounted.current) setHistory(drafts);
    }, (failure: unknown) => {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '저장한 대본을 불러오지 못했어요.');
    }).finally(() => { if (mounted.current) setLoadingHistory(false); });
    const subscription = AppState.addEventListener('change', (next) => {
      // The OS recognizer is a foreground feature; pause explicitly instead of silently losing text.
      if (next !== 'active') controller.current?.pause();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      controller.current?.dispose();
    };
  }, [workspaceId]);

  const start = useCallback(async (title: string, existing?: LiveTranscriptDraft) => {
    if (!speech || !supported || starting.current) return;
    starting.current = true;
    setPreparing(true);
    setError(null);
    try {
      const permission = await speech.requestPermissionsAsync();
      if (!permission.granted) throw new Error('마이크와 음성 인식 권한이 필요해요. 기기 설정에서 허용하거나 일반 녹음을 이용해 주세요.');
      const languages = await speech.getSupportedLocales({});
      if (!languages.locales.some((locale) => /^ko([_-]|$)/i.test(locale))) {
        throw new Error('이 기기의 음성 인식 서비스에서 한국어 지원을 확인하지 못했어요. 일반 녹음을 이용해 주세요.');
      }
      if (!mounted.current) return;
      if (AppState.currentState !== 'active') throw new Error('앱 화면으로 돌아온 뒤 녹음을 시작해 주세요.');
      controller.current?.dispose();
      const directory = new Directory(Paths.document, LIVE_TRANSCRIPT_DIRECTORY_NAME);
      directory.create({ intermediates: true, idempotent: true });
      const draft: LiveTranscriptDraft = existing ?? {
        id: createId('transcript'), title: title.trim() || '실시간 녹음 대본',
        updatedAt: new Date().toISOString(), status: 'paused', paragraphs: [], interim: '', parts: [],
      };
      const session = new LiveTranscriptSession(speech, draft, directory.uri,
        (snapshot) => liveTranscriptRepository.save(workspaceId, snapshot),
        (snapshot) => { if (mounted.current) setState(snapshot); });
      controller.current = session;
      setState(session.snapshot);
      await session.start();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '음성 인식을 준비하지 못했어요.');
    } finally {
      starting.current = false;
      if (mounted.current) setPreparing(false);
    }
  }, [supported, workspaceId]);

  const finish = useCallback(() => controller.current?.finish(), []);
  const pause = useCallback(() => controller.current?.pause(), []);
  const resume = useCallback(() => { void controller.current?.start(); }, []);
  const retrySave = useCallback(() => { void controller.current?.retrySave(); }, []);
  const reset = useCallback(async () => {
    await controller.current?.flush();
    if (controller.current?.snapshot.unsaved) return;
    controller.current?.dispose();
    controller.current = null;
    setState(null);
    await refresh();
  }, [refresh]);
  return { state, preparing, error, supported, history, loadingHistory, start, finish, pause, resume, retrySave, reset, refresh };
}
