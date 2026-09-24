import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestNotificationPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioMode,
  type PermissionResponse,
  type RecorderState,
  type RecordingOptions,
  type RecordingStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  appendWebRecordingCheckpointChunk,
  prepareWebRecordingCheckpoint,
  readWebRecordingCheckpointParts,
  webRecordingCheckpointUri,
} from '@/features/files/web-media-store';

export const PREMIND_RECORDER_STATE_INTERVAL_MS = 140;

export const PREMIND_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'cache',
  numberOfChannels: 1,
  isMeteringEnabled: true,
};

export const PREMIND_STANDARD_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  extension: '.m4a',
  directory: 'cache',
  numberOfChannels: 1,
  bitRate: 64_000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64_000,
  },
};

const RECORDING_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: true,
  allowsBackgroundRecording: true,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'doNotMix',
};

const RELEASED_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: false,
  allowsBackgroundRecording: false,
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'mixWithOthers',
};

export type PremindRecorderPhase =
  | 'idle'
  | 'preparing'
  | 'prepared'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'permission-denied'
  | 'interrupted'
  | 'error';

export interface PremindRecordingMarker {
  id: string;
  timestampMillis: number;
  createdAt: string;
  label?: string;
}

export interface PremindRecordingResult {
  uri: string;
  durationMillis: number;
  markers: readonly PremindRecordingMarker[];
}

export type PremindRecordingInterruptionReason =
  | 'media-services-reset'
  | 'native-error'
  | 'unexpected-stop'
  | 'component-unmounted';

export interface PremindRecordingInterruption {
  reason: PremindRecordingInterruptionReason;
  error: Error;
  recoverableResult: PremindRecordingResult | null;
}

export interface UsePremindRecorderOptions {
  recordingOptions?: RecordingOptions;
  /** Called after best-effort native stop so a recoverable file can be persisted. */
  onInterruption?: (
    interruption: PremindRecordingInterruption,
  ) => void | Promise<void>;
}

export interface PremindRecorderController {
  phase: PremindRecorderPhase;
  nativeState: RecorderState;
  permission: PermissionResponse | null;
  markers: readonly PremindRecordingMarker[];
  error: Error | null;
  prepare(): Promise<PermissionResponse>;
  record(checkpointId?: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<PremindRecordingResult>;
  addMarker(label?: string): PremindRecordingMarker;
}

interface ExpoWebRecorderBridge {
  mediaRecorder?: MediaRecorder | null;
}

interface WebRecordingCheckpointState {
  sessionId: string;
  mediaRecorder: MediaRecorder;
  unsavedChunks: Map<number, Blob>;
  nextIndex: number;
  writeTail: Promise<void>;
  writeError: Error | null;
  onDataAvailable: (event: BlobEvent) => void;
}

const WEB_RECORDING_CHECKPOINT_INTERVAL_MS = 2_000;

export type PremindRecorderErrorCode =
  | 'permission-denied'
  | 'invalid-state'
  | 'missing-recording'
  | 'native-error'
  | 'interrupted';

export class PremindRecorderError extends Error {
  constructor(
    public readonly code: PremindRecorderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PremindRecorderError';
  }
}

function asError(value: unknown, fallbackMessage: string): Error {
  return value instanceof Error ? value : new Error(fallbackMessage);
}

function isActivePhase(phase: PremindRecorderPhase): boolean {
  return phase === 'recording' || phase === 'paused';
}

function resultFrom(
  recorderUri: string | null,
  before: RecorderState,
  after: RecorderState,
  markers: readonly PremindRecordingMarker[],
): PremindRecordingResult | null {
  const uri = recorderUri ?? after.url ?? before.url;
  if (!uri) {
    return null;
  }
  return {
    uri,
    durationMillis: Math.max(
      0,
      Math.round(Math.max(before.durationMillis, after.durationMillis)),
    ),
    markers: markers.map((marker) => ({ ...marker })),
  };
}

export function usePremindRecorder(
  options: UsePremindRecorderOptions = {},
): PremindRecorderController {
  const [phase, setPhase] = useState<PremindRecorderPhase>('idle');
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [markers, setMarkers] = useState<readonly PremindRecordingMarker[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [nativeFailure, setNativeFailure] = useState<RecordingStatus | null>(null);

  const mountedRef = useRef(true);
  const phaseRef = useRef<PremindRecorderPhase>('idle');
  const markersRef = useRef<readonly PremindRecordingMarker[]>([]);
  const markerSequenceRef = useRef(0);
  const transitionTailRef = useRef<Promise<void>>(Promise.resolve());
  const interruptionInFlightRef = useRef(false);
  const observedNativeRecordingRef = useRef(false);
  const onInterruptionRef = useRef(options.onInterruption);
  const webCheckpointRef = useRef<WebRecordingCheckpointState | null>(null);
  const nativeStatusHandlerRef = useRef<(status: RecordingStatus) => void>(
    () => undefined,
  );

  const recorder = useAudioRecorder(
    options.recordingOptions ?? PREMIND_RECORDING_OPTIONS,
    (status) => nativeStatusHandlerRef.current(status),
  );
  const nativeState = useAudioRecorderState(
    recorder,
    PREMIND_RECORDER_STATE_INTERVAL_MS,
  );

  const updatePhase = useCallback((nextPhase: PremindRecorderPhase) => {
    phaseRef.current = nextPhase;
    if (mountedRef.current) {
      setPhase(nextPhase);
    }
  }, []);

  const updateMarkers = useCallback(
    (nextMarkers: readonly PremindRecordingMarker[]) => {
      markersRef.current = nextMarkers;
      if (mountedRef.current) {
        setMarkers(nextMarkers);
      }
    },
    [],
  );

  const updateError = useCallback((nextError: Error | null) => {
    if (mountedRef.current) {
      setError(nextError);
    }
  }, []);

  const runTransition = useCallback(
    function runTransition<T>(operation: () => Promise<T>): Promise<T> {
      const result = transitionTailRef.current
        .catch(() => undefined)
        .then(operation);
      transitionTailRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [],
  );

  const releaseRecordingMode = useCallback(async () => {
    try {
      await setAudioModeAsync(RELEASED_AUDIO_MODE);
    } catch {
      // The recording file is more important than restoring a global mode.
    }
  }, []);

  const prepareNativeRecorder = useCallback(async (): Promise<PermissionResponse> => {
    const currentPhase = phaseRef.current;
    if (currentPhase === 'recording' || currentPhase === 'paused') {
      throw new PremindRecorderError(
        'invalid-state',
        '진행 중인 녹음을 먼저 종료해 주세요.',
      );
    }

    updatePhase('preparing');
    updateError(null);
    setNativeFailure(null);

    let nextPermission = await getRecordingPermissionsAsync();
    if (!nextPermission.granted && nextPermission.canAskAgain) {
      nextPermission = await requestRecordingPermissionsAsync();
    }
    if (mountedRef.current) {
      setPermission(nextPermission);
    }
    if (!nextPermission.granted) {
      const permissionError = new PremindRecorderError(
        'permission-denied',
        '녹음하려면 마이크 권한이 필요해요.',
      );
      updateError(permissionError);
      updatePhase('permission-denied');
      throw permissionError;
    }

    try {
      // Android keeps a recording alive in the background with a foreground
      // service, and a foreground service needs the notification permission
      // (expo-audio rejects prepare otherwise, as of SDK 57). Ask once; if
      // the user declines, record in the foreground only rather than not at
      // all — the lecture matters more than the lock-screen notification.
      let backgroundAllowed = true;
      if (Platform.OS === 'android') {
        try {
          const notification = await requestNotificationPermissionsAsync();
          backgroundAllowed = notification.granted;
        } catch {
          backgroundAllowed = false;
        }
      }
      await setAudioModeAsync({
        ...RECORDING_AUDIO_MODE,
        allowsBackgroundRecording: backgroundAllowed,
      });
      await recorder.prepareToRecordAsync();
      markerSequenceRef.current = 0;
      observedNativeRecordingRef.current = false;
      updateMarkers([]);
      updatePhase('prepared');
      return nextPermission;
    } catch (cause) {
      await releaseRecordingMode();
      const nativeError = asError(cause, '녹음을 준비하지 못했어요.');
      updateError(nativeError);
      updatePhase('error');
      throw nativeError;
    }
  }, [recorder, releaseRecordingMode, updateError, updateMarkers, updatePhase]);

  const prepare = useCallback(
    () => runTransition(prepareNativeRecorder),
    [prepareNativeRecorder, runTransition],
  );

  const startWebCheckpoint = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (Platform.OS !== 'web') return false;
      await prepareWebRecordingCheckpoint(sessionId);
      const mediaRecorder = (recorder as unknown as ExpoWebRecorderBridge)
        .mediaRecorder;
      if (!mediaRecorder) {
        throw new Error('브라우저 녹음 복구 저장소를 준비하지 못했어요.');
      }

      const checkpoint: WebRecordingCheckpointState = {
        sessionId,
        mediaRecorder,
        unsavedChunks: new Map(),
        nextIndex: 0,
        writeTail: Promise.resolve(),
        writeError: null,
        onDataAvailable: () => undefined,
      };
      checkpoint.onDataAvailable = (event) => {
        const chunk = event.data;
        if (!(chunk instanceof Blob) || chunk.size <= 0) return;
        const chunkIndex = checkpoint.nextIndex;
        checkpoint.nextIndex += 1;
        checkpoint.unsavedChunks.set(chunkIndex, chunk);
        checkpoint.writeTail = checkpoint.writeTail
          .then(async () => {
            await appendWebRecordingCheckpointChunk(
              checkpoint.sessionId,
              chunkIndex,
              chunk,
            );
            checkpoint.unsavedChunks.delete(chunkIndex);
          })
          .catch((cause: unknown) => {
            checkpoint.writeError ??= asError(
              cause,
              '녹음 복구 조각을 브라우저에 보관하지 못했어요.',
            );
          });
      };
      mediaRecorder.addEventListener(
        'dataavailable',
        checkpoint.onDataAvailable,
      );
      webCheckpointRef.current = checkpoint;
      try {
        mediaRecorder.start(WEB_RECORDING_CHECKPOINT_INTERVAL_MS);
      } catch (cause) {
        mediaRecorder.removeEventListener(
          'dataavailable',
          checkpoint.onDataAvailable,
        );
        webCheckpointRef.current = null;
        throw cause;
      }
      return true;
    },
    [recorder],
  );

  const finalizeWebCheckpoint = useCallback(
    async (fallbackUri: string | null): Promise<string | null> => {
      const checkpoint = webCheckpointRef.current;
      if (!checkpoint) return fallbackUri;
      checkpoint.mediaRecorder.removeEventListener(
        'dataavailable',
        checkpoint.onDataAvailable,
      );
      webCheckpointRef.current = null;
      await checkpoint.writeTail;

      if (checkpoint.nextIndex === 0) return fallbackUri;
      if (!checkpoint.writeError && checkpoint.unsavedChunks.size === 0) {
        return webRecordingCheckpointUri(checkpoint.sessionId);
      }

      // Only failed/in-flight writes stay in memory. If storage fills up, merge
      // that small remainder with the durable prefix instead of retaining an
      // entire multi-hour lecture in the JS heap.
      const durableParts = await readWebRecordingCheckpointParts(
        checkpoint.sessionId,
      ).catch(() => []);
      const parts = new Map<number, Blob>(
        durableParts.map((part) => [part.index, part.blob]),
      );
      for (const [index, chunk] of checkpoint.unsavedChunks) {
        parts.set(index, chunk);
      }
      const orderedParts = Array.from(parts.entries()).sort(
        ([left], [right]) => left - right,
      );
      const complete =
        orderedParts.length === checkpoint.nextIndex &&
        orderedParts.every(([index], expectedIndex) => index === expectedIndex);
      if (!complete) return fallbackUri;
      const blob = new Blob(
        orderedParts.map(([, chunk]) => chunk),
        {
          type:
            durableParts[0]?.mimeType ||
            orderedParts[0]?.[1].type ||
            'audio/webm',
        },
      );
      return blob.size > 0 ? URL.createObjectURL(blob) : fallbackUri;
    },
    [],
  );

  const record = useCallback(
    (checkpointId?: string) =>
      runTransition(async () => {
        if (phaseRef.current !== 'prepared') {
          await prepareNativeRecorder();
        }
        const startedWithCheckpoint =
          Platform.OS === 'web' && checkpointId
            ? await startWebCheckpoint(checkpointId)
            : false;
        if (!startedWithCheckpoint) {
          recorder.record();
        }
        observedNativeRecordingRef.current = false;
        updateError(null);
        updatePhase('recording');
      }),
    [
      prepareNativeRecorder,
      recorder,
      runTransition,
      startWebCheckpoint,
      updateError,
      updatePhase,
    ],
  );

  const pause = useCallback(
    () =>
      runTransition(async () => {
        if (phaseRef.current !== 'recording') {
          throw new PremindRecorderError(
            'invalid-state',
            '녹음 중일 때만 일시정지할 수 있어요.',
          );
        }
        recorder.pause();
        updatePhase('paused');
      }),
    [recorder, runTransition, updatePhase],
  );

  const resume = useCallback(
    () =>
      runTransition(async () => {
        if (phaseRef.current !== 'paused') {
          throw new PremindRecorderError(
            'invalid-state',
            '일시정지된 녹음만 다시 시작할 수 있어요.',
          );
        }
        // SDK 57 resumes a paused AudioRecorder by calling record() again.
        recorder.record();
        updateError(null);
        updatePhase('recording');
      }),
    [recorder, runTransition, updateError, updatePhase],
  );

  const stop = useCallback(
    () =>
      runTransition(async () => {
        if (!isActivePhase(phaseRef.current)) {
          throw new PremindRecorderError(
            'invalid-state',
            '종료할 녹음이 없어요.',
          );
        }
        updatePhase('stopping');
        const before = recorder.getStatus();
        try {
          await recorder.stop();
          const after = recorder.getStatus();
          const finalizedUri = await finalizeWebCheckpoint(recorder.uri);
          const result = resultFrom(
            finalizedUri,
            before,
            after,
            markersRef.current,
          );
          if (!result) {
            throw new PremindRecorderError(
              'missing-recording',
              '녹음 파일 위치를 확인하지 못했어요.',
            );
          }
          observedNativeRecordingRef.current = false;
          updateError(null);
          updatePhase('stopped');
          return result;
        } catch (cause) {
          const nativeError = asError(cause, '녹음을 종료하지 못했어요.');
          updateError(nativeError);
          updatePhase('error');
          throw nativeError;
        } finally {
          await releaseRecordingMode();
        }
      }),
    [
      finalizeWebCheckpoint,
      recorder,
      releaseRecordingMode,
      runTransition,
      updateError,
      updatePhase,
    ],
  );

  const addMarker = useCallback(
    (label?: string): PremindRecordingMarker => {
      if (!isActivePhase(phaseRef.current)) {
        throw new PremindRecorderError(
          'invalid-state',
          '녹음 중일 때만 중요 표시를 남길 수 있어요.',
        );
      }
      const currentNativeState = recorder.getStatus();
      markerSequenceRef.current += 1;
      const marker: PremindRecordingMarker = {
        id: `marker-${Date.now().toString(36)}-${markerSequenceRef.current.toString(36)}`,
        timestampMillis: Math.max(
          0,
          Math.round(currentNativeState.durationMillis),
        ),
        createdAt: new Date().toISOString(),
        ...(label?.trim() ? { label: label.trim() } : {}),
      };
      updateMarkers([...markersRef.current, marker]);
      return marker;
    },
    [recorder, updateMarkers],
  );

  const handleInterruption = useCallback(
    (
      reason: Exclude<PremindRecordingInterruptionReason, 'component-unmounted'>,
      cause: unknown,
    ) => {
      if (interruptionInFlightRef.current) {
        return;
      }
      interruptionInFlightRef.current = true;
      void runTransition(async () => {
        const before = recorder.getStatus();
        let stopError: unknown;
        try {
          if (before.canRecord || isActivePhase(phaseRef.current)) {
            await recorder.stop();
          }
        } catch (errorWhileStopping) {
          stopError = errorWhileStopping;
        }
        const after = recorder.getStatus();
        const finalizedUri = await finalizeWebCheckpoint(recorder.uri);
        const interruptionError = asError(
          cause ?? stopError,
          '시스템 오디오 중단으로 녹음이 멈췄어요.',
        );
        const recoverableResult = resultFrom(
          finalizedUri,
          before,
          after,
          markersRef.current,
        );
        observedNativeRecordingRef.current = false;
        updateError(interruptionError);
        updatePhase('interrupted');
        await releaseRecordingMode();
        try {
          await onInterruptionRef.current?.({
            reason,
            error: interruptionError,
            recoverableResult,
          });
        } finally {
          interruptionInFlightRef.current = false;
        }
      }).catch(() => {
        interruptionInFlightRef.current = false;
      });
    },
    [
      finalizeWebCheckpoint,
      recorder,
      releaseRecordingMode,
      runTransition,
      updateError,
      updatePhase,
    ],
  );

  useEffect(() => {
    onInterruptionRef.current = options.onInterruption;
  }, [options.onInterruption]);

  useEffect(() => {
    nativeStatusHandlerRef.current = (status) => {
      if (!mountedRef.current || status.isFinished) {
        return;
      }
      if (status.hasError || status.mediaServicesDidReset) {
        setNativeFailure(status);
      }
    };
    return () => {
      nativeStatusHandlerRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    if (!nativeFailure) {
      return;
    }
    handleInterruption(
      nativeFailure.mediaServicesDidReset
        ? 'media-services-reset'
        : 'native-error',
      new PremindRecorderError(
        nativeFailure.mediaServicesDidReset ? 'interrupted' : 'native-error',
        nativeFailure.error || '시스템 오디오 중단으로 녹음이 멈췄어요.',
      ),
    );
  }, [handleInterruption, nativeFailure]);

  useEffect(() => {
    if (nativeState.mediaServicesDidReset) {
      handleInterruption(
        'media-services-reset',
        new PremindRecorderError(
          'interrupted',
          '시스템 오디오가 재시작되어 녹음이 멈췄어요.',
        ),
      );
      return;
    }

    if (nativeState.isRecording) {
      observedNativeRecordingRef.current = true;
      return;
    }
    if (
      observedNativeRecordingRef.current &&
      phaseRef.current === 'recording'
    ) {
      handleInterruption(
        'unexpected-stop',
        new PremindRecorderError(
          'interrupted',
          '다른 오디오 사용으로 녹음이 예기치 않게 멈췄어요.',
        ),
      );
    }
  }, [handleInterruption, nativeState.isRecording, nativeState.mediaServicesDidReset]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const currentPhase = phaseRef.current;
      if (
        currentPhase === 'idle' ||
        currentPhase === 'stopped' ||
        currentPhase === 'permission-denied'
      ) {
        return;
      }

      // A recorder whose native object was already released (a media-services
      // reset, or Expo Go tearing the module down) throws from getStatus();
      // on unmount there is nothing left to stop, so treat that as "gone".
      const readStatus = (): RecorderState | null => {
        try {
          return recorder.getStatus();
        } catch {
          return null;
        }
      };
      const before = readStatus();
      if (!before) {
        void releaseRecordingMode().catch(() => undefined);
        return;
      }
      const cleanupError = new PremindRecorderError(
        'interrupted',
        '녹음 화면이 종료되어 진행 중인 녹음을 안전하게 마쳤어요.',
      );
      void (async () => {
        try {
          if (before.canRecord || isActivePhase(currentPhase)) {
            await recorder.stop();
          }
        } catch {
          // A media-services reset can invalidate the recorder before cleanup.
        }
        const finalizedUri = await finalizeWebCheckpoint(recorder.uri);
        const recoverableResult = resultFrom(
          finalizedUri,
          before,
          readStatus() ?? before,
          markersRef.current,
        );
        await releaseRecordingMode();
        await onInterruptionRef.current?.({
          reason: 'component-unmounted',
          error: cleanupError,
          recoverableResult,
        });
      })().catch(() => undefined);
    };
  }, [finalizeWebCheckpoint, recorder, releaseRecordingMode]);

  return {
    phase,
    nativeState,
    permission,
    markers,
    error,
    prepare,
    record,
    pause,
    resume,
    stop,
    addMarker,
  };
}
