import * as Haptics from 'expo-haptics';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Check,
  CircleStop,
  FolderOpen,
  HardDrive,
  Lock,
  Mic,
  MicOff,
  Pause,
  Play,
  Settings,
  ShieldCheck,
  Star,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DeskCard } from '@/components/recording/DeskCard';
import {
  AnimatedReveal,
  AppText,
  AuthField,
  BottomSheetModal,
  BreathingView,
  Button,
  Card,
  Dialog,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  StatusBadge,
  type StatusTone,
} from '@/components/ui';
import {
  RECORDING_DIRECTORY_NAME,
  recordingSessionRepository,
  type PreservedRecordingFile,
  type RecordingSessionSnapshot,
  type SnapshotPersistenceHandle,
} from '@/features/recording/recording-session-repository';
import {
  clearWebRecordingCheckpoint,
  isPersistedWebMediaUri,
  isWebRecordingCheckpointUri,
  persistWebMediaSource,
  readWebMediaBlob,
  webRecordingCheckpointUri,
} from '@/features/files/web-media-store';
import {
  PREMIND_RECORDING_OPTIONS,
  usePremindRecorder,
  type PremindRecorderPhase,
  type PremindRecordingInterruption,
  type PremindRecordingMarker,
  type PremindRecordingResult,
} from '@/features/recording/use-premind-recorder';
import { decorative } from '@/lib/a11y';
import { createId, formatDuration } from '@/lib/format';
import { enShortDate, getLocale, useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, motion, radii, sizes, spacing } from '@/theme/tokens';
import type { Project } from '@/types';

interface RecoverableRecording {
  file: PreservedRecordingFile;
  needsPreservation?: boolean;
  snapshot: RecordingSessionSnapshot;
}

/**
 * Expo Audio returns browser media rather than a native file on web. Copy the
 * result (including an incremental checkpoint URI) into IndexedDB so it stays
 * valid across reloads and later study sessions.
 */
async function inspectWebRecording(
  sourceUri: string,
  sessionId: string,
): Promise<PreservedRecordingFile> {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const stored = await persistWebMediaSource({
    mimeType: 'audio/webm',
    name: `premind-${safeSessionId || 'recording'}.webm`,
    sourceUri,
    storageKey: `recording-${safeSessionId || 'recording'}`,
  });
  return {
    sourceUri,
    uri: stored.uri,
    name: stored.name,
    sizeBytes: stored.sizeBytes,
  };
}

async function preserveRecordingFile(
  sourceUri: string,
  sessionId: string,
): Promise<PreservedRecordingFile> {
  if (Platform.OS === 'web') {
    return inspectWebRecording(sourceUri, sessionId);
  }
  return recordingSessionRepository.copyFinalFile(sourceUri, sessionId);
}

/**
 * Keeps a stopped recorder result usable in the current screen even when the
 * durable copy fails (for example, when IndexedDB is full). This is deliberately
 * marked as temporary: callers must retry `finalizeRecordingSnapshot` before
 * importing it or leaving the screen.
 */
async function inspectTemporaryRecording(
  sourceUri: string,
  sessionId: string,
): Promise<PreservedRecordingFile> {
  if (Platform.OS === 'web') {
    const blob = await readWebMediaBlob(sourceUri);
    if (blob.size <= 0) {
      throw new Error('중단된 녹음 원본이 비어 있어 복구할 수 없어요.');
    }
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    return {
      sourceUri,
      uri: sourceUri,
      name: `premind-${sessionId}.${extension}`,
      sizeBytes: blob.size,
    };
  }

  const source = new File(sourceUri);
  if (!source.exists || source.size <= 0) {
    throw new Error('중단된 녹음 원본을 다시 열 수 없어요.');
  }
  return {
    sourceUri,
    uri: source.uri,
    name: source.name,
    sizeBytes: source.size,
  };
}

async function finalizeRecordingSnapshot(
  snapshot: RecordingSessionSnapshot,
  sourceUri: string,
): Promise<RecoverableRecording> {
  if (Platform.OS !== 'web') {
    const finalized = await recordingSessionRepository.finalize(
      snapshot,
      sourceUri,
    );
    return { file: finalized.file, snapshot: finalized.session };
  }

  const file = await inspectWebRecording(sourceUri, snapshot.id);
  const now = new Date().toISOString();
  const completedSnapshot: RecordingSessionSnapshot = {
    ...snapshot,
    endedAt: snapshot.endedAt ?? now,
    localFileUri: file.uri,
    status: 'completed',
    updatedAt: now,
  };
  await recordingSessionRepository.save(completedSnapshot);
  if (isWebRecordingCheckpointUri(sourceUri)) {
    // Cleanup happens only after both the final Blob and its metadata point at
    // the durable URI, so a crash cannot strand an otherwise valid recording.
    await clearWebRecordingCheckpoint(snapshot.id).catch(() => undefined);
  }
  return { file, snapshot: completedSnapshot };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function defaultRecordingTitle(): string {
  if (getLocale() === 'en') {
    return `Lecture recording, ${enShortDate(new Date())}`;
  }
  const date = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  return `${date} 강의 녹음`;
}

function sessionStatusForPhase(
  phase: PremindRecorderPhase,
  current: RecordingSessionSnapshot['status'],
): RecordingSessionSnapshot['status'] {
  if (phase === 'paused') return 'paused';
  if (phase === 'interrupted') return 'interrupted';
  if (phase === 'error') return 'failed';
  if (phase === 'recording' || phase === 'preparing' || phase === 'prepared') {
    return 'recording';
  }
  return current;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '녹음을 저장하지 못했어요. 저장공간과 마이크 상태를 확인해 주세요.';
}

function audioMimeType(fileName: string): string {
  return fileName.toLowerCase().endsWith('.webm')
    ? 'audio/webm'
    : 'audio/mp4';
}

function recoveryStatusLabel(status: RecordingSessionSnapshot['status']): string {
  if (status === 'completed') return '녹음 완료';
  if (status === 'interrupted') return '중단 후 보관';
  if (status === 'failed') return '확인 필요';
  if (status === 'paused') return '일시정지 중 종료';
  return '녹음 중 종료';
}

function confirmInBrowser(title: string, message: string): boolean {
  return typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
}

function hasRecoverableRecordingSource(
  snapshot: RecordingSessionSnapshot,
): boolean {
  if (!snapshot.localFileUri) return false;
  return (
    Platform.OS !== 'web' ||
    isPersistedWebMediaUri(snapshot.localFileUri) ||
    isWebRecordingCheckpointUri(snapshot.localFileUri)
  );
}

function recordingPresentation(input: {
  canUseRecovered: boolean;
  isFinalizing: boolean;
  needsPreservation: boolean;
  phase: PremindRecorderPhase;
}) {
  if (input.isFinalizing || input.phase === 'stopping') {
    return {
      description: '새 음성 입력은 멈췄고, 지금까지의 원본을 안전한 보관 영역으로 옮기고 있어요.',
      label: '원본 보관 중',
      safety: '저장이 끝나면 마인드팩 만들기로 넘어가요.',
    };
  }
  if (input.phase === 'paused') {
    return {
      description: '새 음성은 기록하지 않아요. 계속하기 전까지 녹음 시간도 멈춰 있어요.',
      label: '일시정지',
      safety: '지금까지 녹음한 원본과 중요 표시는 기기에 남아 있어요.',
    };
  }
  if (input.phase === 'recording') {
    return {
      description: '마이크 입력을 원본 파일에 기록하고 있어요.',
      label: '녹음 중',
      safety: '복구 정보는 5초마다 기기에 저장돼요.',
    };
  }
  if (input.canUseRecovered) {
    if (input.needsPreservation) {
      return {
        description: '녹음은 멈췄고 원본이 이 화면에 임시로 남아 있어요.',
        label: '보관 다시 시도',
        safety: '이 탭을 닫기 전에 아래 버튼으로 원본 보관을 다시 시도해 주세요.',
      };
    }
    return {
      description: '녹음은 중단됐지만 사용할 수 있는 원본을 기기에 보관했어요.',
      label: '원본 보관됨',
      safety: '저장된 구간으로 마인드팩 만들기를 이어갈 수 있어요.',
    };
  }
  return {
    description: '녹음 장치가 중단되어 새 음성을 기록하지 않고 있어요.',
    label: '확인 필요',
    safety: '아래 안내를 확인한 뒤 안전하게 화면을 나가 주세요.',
  };
}

export default function RecordScreen() {
  const t = useT();
  const { isTablet } = useLayout();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    projectId?: string | string[];
  }>();
  const {
    activeProjectId,
    importMaterial,
    materials,
    projects,
    selectProject,
  } =
    useAppStore();
  const requestedProjectId = firstParam(params.projectId);
  const preferredProjectId =
    (requestedProjectId &&
    projects.some((project) => project.id === requestedProjectId)
      ? requestedProjectId
      : undefined) ??
    (activeProjectId &&
    projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : undefined) ??
    projects[0]?.id ??
    null;

  const [chosenProjectId, setChosenProjectId] = useState<string | null>(
    preferredProjectId,
  );
  const [title, setTitle] = useState(defaultRecordingTitle);
  const [titleFocused, setTitleFocused] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [stopConfirmationVisible, setStopConfirmationVisible] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [markerNotice, setMarkerNotice] = useState<string | null>(null);
  const [recoverable, setRecoverable] =
    useState<RecoverableRecording | null>(null);
  const [recoverableSessions, setRecoverableSessions] = useState<
    RecordingSessionSnapshot[]
  >([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recoveryBusyId, setRecoveryBusyId] = useState<string | null>(null);
  const [recoveryLoadError, setRecoveryLoadError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const sessionRef = useRef<RecordingSessionSnapshot | null>(null);
  const snapshotHandleRef = useRef<SnapshotPersistenceHandle | null>(null);
  const finalizingRef = useRef(false);
  const interruptionHandledRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const recoveryBusyIdRef = useRef<string | null>(null);
  const allowNavigationRef = useRef(false);

  const handleRecorderInterruption = useCallback(
    async (interruption: PremindRecordingInterruption) => {
      if (interruptionHandledRef.current) {
        return;
      }
      interruptionHandledRef.current = true;

      const snapshotHandle = snapshotHandleRef.current;
      snapshotHandleRef.current = null;
      await snapshotHandle?.stop({ flush: false });

      const current = sessionRef.current;
      if (!current) {
        return;
      }

      const endedAt = new Date().toISOString();
      let nextSnapshot: RecordingSessionSnapshot = {
        ...current,
        durationMillis:
          interruption.recoverableResult?.durationMillis ??
          current.durationMillis,
        endedAt,
        markers:
          interruption.recoverableResult?.markers ?? current.markers,
        status: interruption.recoverableResult ? 'interrupted' : 'failed',
        updatedAt: endedAt,
      };
      let preservedFile: PreservedRecordingFile | null = null;
      let needsPreservation = false;

      if (interruption.recoverableResult) {
        try {
          preservedFile = await preserveRecordingFile(
            interruption.recoverableResult.uri,
            current.id,
          );
          nextSnapshot = {
            ...nextSnapshot,
            localFileUri: preservedFile.uri,
          };
        } catch {
          needsPreservation = true;
          preservedFile = await inspectTemporaryRecording(
            interruption.recoverableResult.uri,
            current.id,
          ).catch(() => null);
          nextSnapshot = {
            ...nextSnapshot,
            localFileUri:
              interruption.recoverableResult.uri ?? current.localFileUri,
          };
        }
      }

      sessionRef.current = nextSnapshot;
      await recordingSessionRepository.save(nextSnapshot);
      if (
        preservedFile &&
        interruption.recoverableResult &&
        isWebRecordingCheckpointUri(interruption.recoverableResult.uri)
      ) {
        await clearWebRecordingCheckpoint(current.id).catch(() => undefined);
      }

      if (
        mountedRef.current &&
        interruption.reason !== 'component-unmounted' &&
        !finalizingRef.current
      ) {
        if (preservedFile) {
          setRecoverable({
            file: preservedFile,
            needsPreservation,
            snapshot: nextSnapshot,
          });
        }
        setScreenError(interruption.error.message);
      }
    },
    [],
  );

  // Always the better quality. The setting that used to choose was one more
  // thing to read in MY for a difference nobody wanted the worse side of.
  const recorder = usePremindRecorder({
    onInterruption: handleRecorderInterruption,
    recordingOptions: PREMIND_RECORDING_OPTIONS,
  });
  const {
    addMarker: addRecorderMarker,
    pause: pauseRecorder,
    phase: recorderPhase,
    prepare: prepareRecorder,
    record: beginRecording,
    resume: resumeRecorder,
    stop: stopRecorder,
  } = recorder;

  const selectedProjectId =
    chosenProjectId &&
    projects.some((project) => project.id === chosenProjectId)
      ? chosenProjectId
      : preferredProjectId;
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const isPaused = recorderPhase === 'paused';
  const isRecording = recorderPhase === 'recording';
  const displayDurationMillis =
    recoverable?.snapshot.durationMillis ?? recorder.nativeState.durationMillis;
  const displayMarkers = recoverable?.snapshot.markers ?? recorder.markers;
  const visibleRecoverableSessions = useMemo(
    () =>
      recoverableSessions.filter(
        (session) => session.id !== currentSessionId,
      ),
    [currentSessionId, recoverableSessions],
  );
  const recoverableSourceCount = visibleRecoverableSessions.filter(
    hasRecoverableRecordingSource,
  ).length;
  const metadataOnlyCount =
    visibleRecoverableSessions.length - recoverableSourceCount;
  const levelBars = useMemo(
    () =>
      makeLevelBars(
        recorder.nativeState.metering,
        isPaused || !isRecording,
        recorder.nativeState.durationMillis,
      ),
    [
      isPaused,
      isRecording,
      recorder.nativeState.durationMillis,
      recorder.nativeState.metering,
    ],
  );

  const loadRecoverableSessions = useCallback(async () => {
    try {
      const sessions = await recordingSessionRepository.getRecoverable();
      if (mountedRef.current) {
        setRecoveryLoadError(null);
        setRecoverableSessions(
          sessions.filter(
            (session) => session.id !== currentSessionIdRef.current,
          ),
        );
      }
    } catch {
      if (mountedRef.current) {
        setRecoveryLoadError(
          '이전에 보관한 녹음 목록을 불러오지 못했어요.',
        );
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void recordingSessionRepository
      .getRecoverable()
      .then((sessions) => {
        if (!canceled && mountedRef.current) {
          setRecoverableSessions(
            sessions.filter(
              (session) => session.id !== currentSessionIdRef.current,
            ),
          );
        }
      })
      .catch(() => {
        if (!canceled && mountedRef.current) {
          setRecoveryLoadError(
            '이전에 보관한 녹음 목록을 불러오지 못했어요.',
          );
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    sessionRef.current = {
      ...current,
      durationMillis: Math.max(
        current.durationMillis,
        Math.round(recorder.nativeState.durationMillis),
      ),
      localFileUri: recorder.nativeState.url ?? current.localFileUri,
      markers: recorder.markers,
      status: sessionStatusForPhase(recorder.phase, current.status),
      updatedAt: new Date().toISOString(),
    };
  }, [
    recorder.markers,
    recorder.nativeState.durationMillis,
    recorder.nativeState.url,
    recorder.phase,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        void snapshotHandleRef.current?.flush().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  const chooseProject = (projectId: string) => {
    setChosenProjectId(projectId);
    selectProject(projectId);
    setScreenError(null);
  };

  const startRecording = useCallback(async () => {
    const normalizedTitle = title.trim();
    if (!selectedProjectId) {
      setScreenError('녹음을 담을 폴더를 먼저 선택해 주세요.');
      return;
    }
    if (!normalizedTitle) {
      setScreenError('녹음 제목을 입력해 주세요.');
      return;
    }
    if (isStarting || finalizingRef.current) {
      return;
    }

    setIsStarting(true);
    setScreenError(null);
    setMarkerNotice(null);
    setRecoverable(null);
    allowNavigationRef.current = false;
    interruptionHandledRef.current = false;

    let createdSnapshot: RecordingSessionSnapshot | null = null;
    try {
      await prepareRecorder();
      const startedAt = new Date().toISOString();
      const recordingId = createId('recording');
      createdSnapshot = {
        schemaVersion: 1,
        id: recordingId,
        projectId: selectedProjectId,
        title: normalizedTitle,
        startedAt,
        endedAt: null,
        localFileUri:
          Platform.OS === 'web'
            ? webRecordingCheckpointUri(recordingId)
            : null,
        durationMillis: 0,
        status: 'recording',
        uploadStatus: 'pending',
        markers: [],
        updatedAt: startedAt,
      };
      sessionRef.current = createdSnapshot;
      currentSessionIdRef.current = createdSnapshot.id;
      setCurrentSessionId(createdSnapshot.id);
      setRecoverableSessions((sessions) =>
        sessions.filter((session) => session.id !== createdSnapshot?.id),
      );
      await recordingSessionRepository.save(createdSnapshot);
      await beginRecording(createdSnapshot.id);
      setHasSession(true);
      selectProject(selectedProjectId);
      snapshotHandleRef.current =
        recordingSessionRepository.startSnapshotPersistence(
          () => sessionRef.current,
          {
            onError: () => {
              if (mountedRef.current) {
                setScreenError(
                  '복구 정보 저장이 잠시 지연되고 있어요. 녹음은 계속됩니다.',
                );
              }
            },
          },
        );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    } catch (error) {
      if (createdSnapshot) {
        const failedAt = new Date().toISOString();
        const failedSnapshot: RecordingSessionSnapshot = {
          ...createdSnapshot,
          endedAt: failedAt,
          localFileUri: null,
          status: 'failed',
          updatedAt: failedAt,
        };
        sessionRef.current = failedSnapshot;
        await recordingSessionRepository.save(failedSnapshot).catch(
          () => undefined,
        );
        if (Platform.OS === 'web') {
          await clearWebRecordingCheckpoint(createdSnapshot.id).catch(
            () => undefined,
          );
        }
      }
      currentSessionIdRef.current = null;
      setCurrentSessionId(null);
      setScreenError(errorMessage(error));
    } finally {
      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [
    isStarting,
    beginRecording,
    prepareRecorder,
    selectProject,
    selectedProjectId,
    title,
  ]);

  const addMarker = useCallback(() => {
    try {
      const marker = addRecorderMarker('중요 표시');
      setMarkerNotice(
        t('{time}에 중요 표시했어요.', {
          time: formatDuration(marker.timestampMillis / 1_000),
        }),
      );
      void snapshotHandleRef.current?.flush().catch(() => undefined);
      void Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      setScreenError(errorMessage(error));
    }
  }, [addRecorderMarker, t]);

  const togglePause = useCallback(async () => {
    try {
      if (recorderPhase === 'paused') {
        await resumeRecorder();
      } else {
        await pauseRecorder();
      }
      setScreenError(null);
      await snapshotHandleRef.current?.flush();
      void Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      setScreenError(errorMessage(error));
    }
  }, [pauseRecorder, recorderPhase, resumeRecorder]);

  const prepareStoredRecovery = useCallback(
    async (
      snapshot: RecordingSessionSnapshot,
    ): Promise<RecoverableRecording> => {
      if (!snapshot.localFileUri) {
        throw new Error('보관된 녹음 파일 위치를 찾지 못했어요.');
      }
      const now = new Date().toISOString();
      const completedSnapshot: RecordingSessionSnapshot = {
        ...snapshot,
        endedAt: snapshot.endedAt ?? now,
        status: 'completed',
        updatedAt: now,
      };

      if (Platform.OS === 'web') {
        return finalizeRecordingSnapshot(
          completedSnapshot,
          snapshot.localFileUri,
        );
      }

      const source = new File(snapshot.localFileUri);
      if (!source.exists || source.size <= 0) {
        throw new Error(
          '저장된 녹음 파일을 열 수 없어요. 기록만 지울 수 있어요.',
        );
      }
      const recordingDirectory = new Directory(
        Paths.document,
        RECORDING_DIRECTORY_NAME,
      );
      const directoryPrefix = recordingDirectory.uri.endsWith('/')
        ? recordingDirectory.uri
        : `${recordingDirectory.uri}/`;

      if (source.uri.startsWith(directoryPrefix)) {
        await recordingSessionRepository.save(completedSnapshot);
        return {
          file: {
            sourceUri: source.uri,
            uri: source.uri,
            name: source.name,
            sizeBytes: source.size,
          },
          snapshot: completedSnapshot,
        };
      }

      return finalizeRecordingSnapshot(completedSnapshot, source.uri);
    },
    [],
  );

  const importRecoveredRecording = useCallback(
    async (recovery: RecoverableRecording) => {
      if (!recovery.snapshot.projectId) {
        throw new Error('녹음을 담을 폴더를 찾을 수 없어요.');
      }
      const existingMaterial = materials.find(
        (material) => material.source.uri === recovery.file.uri,
      );
      const material =
        existingMaterial ??
        (await importMaterial({
          projectId: recovery.snapshot.projectId,
          uri: recovery.file.uri,
          fileName: recovery.file.name,
          mimeType: audioMimeType(recovery.file.name),
          title: recovery.snapshot.title,
          kind: 'audio',
          origin: 'recording',
          sizeBytes: recovery.file.sizeBytes,
          durationMs: recovery.snapshot.durationMillis,
          markers: recovery.snapshot.markers.map((marker) => ({
            id: marker.id,
            timestampMs: marker.timestampMillis,
            label: marker.label ?? '중요 표시',
            source: 'teacher',
          })),
        }));
      // The source is now represented by a durable local material. Remove only
      // the recovery metadata; "uploadStatus: completed" is reserved for a
      // real server upload and the audio file itself is deliberately retained.
      await recordingSessionRepository.remove(recovery.snapshot.id);
      if (sessionRef.current?.id === recovery.snapshot.id) {
        sessionRef.current = null;
        currentSessionIdRef.current = null;
        setCurrentSessionId(null);
      }
      setRecoverable(null);
      setRecoverableSessions((sessions) =>
        sessions.filter((session) => session.id !== recovery.snapshot.id),
      );
      allowNavigationRef.current = true;
      router.replace({
        pathname: '/processing/[id]',
        params: { id: material.id },
      });
    },
    [importMaterial, materials],
  );

  const recoverStoredSession = useCallback(
    async (snapshot: RecordingSessionSnapshot) => {
      if (
        snapshot.id === currentSessionIdRef.current ||
        recoveryBusyIdRef.current !== null
      ) {
        return;
      }
      recoveryBusyIdRef.current = snapshot.id;
      setRecoveryBusyId(snapshot.id);
      setRecoveryLoadError(null);
      try {
        const recovery = await prepareStoredRecovery(snapshot);
        await importRecoveredRecording(recovery);
      } catch (error) {
        if (mountedRef.current) {
          setRecoveryLoadError(errorMessage(error));
        }
      } finally {
        if (mountedRef.current) {
          setRecoveryBusyId(null);
        }
        recoveryBusyIdRef.current = null;
      }
    },
    [importRecoveredRecording, prepareStoredRecovery],
  );

  const discardStoredSession = useCallback(
    (snapshot: RecordingSessionSnapshot) => {
      if (snapshot.id === currentSessionIdRef.current) {
        return;
      }
      const removeMetadata = () => {
        void recordingSessionRepository
          .remove(snapshot.id)
          .then(() => {
            if (mountedRef.current) {
              setRecoverableSessions((sessions) =>
                sessions.filter((session) => session.id !== snapshot.id),
              );
            }
          })
          .catch(() => {
            if (mountedRef.current) {
              setRecoveryLoadError('복구 정보를 지우지 못했어요.');
            }
          });
      };
      if (
        Platform.OS === 'web' &&
        confirmInBrowser(
          t('복구 목록에서 지울까요?'),
          t('녹음 파일은 남기고 기록만 지워요.'),
        )
      ) {
        removeMetadata();
        return;
      }
      if (Platform.OS === 'web') return;
      Alert.alert(
        t('복구 목록에서 지울까요?'),
        t('녹음 파일은 남기고 기록만 지워요.'),
        [
          { text: t('취소'), style: 'cancel' },
          {
            text: t('기록 지우기'),
            style: 'destructive',
            onPress: removeMetadata,
          },
        ],
      );
    },
    [t],
  );

  const finishRecording = useCallback(async () => {
    if (finalizingRef.current) {
      return;
    }
    finalizingRef.current = true;
    setIsFinalizing(true);
    setStopConfirmationVisible(false);
    setScreenError(null);

    try {
      const result = await stopRecorder();
      const snapshotHandle = snapshotHandleRef.current;
      snapshotHandleRef.current = null;
      await snapshotHandle?.stop({ flush: false });

      const current = sessionRef.current;
      if (!current) {
        throw new Error('녹음 복구 정보를 찾지 못했어요.');
      }
      const endedAt = new Date().toISOString();
      const completedSnapshot: RecordingSessionSnapshot = {
        ...current,
        durationMillis: result.durationMillis,
        endedAt,
        localFileUri: result.uri,
        markers: result.markers,
        status: 'completed',
        updatedAt: endedAt,
      };
      // Persist the cache URI and exact final duration before the Documents
      // copy, so a full-storage error still leaves a recoverable session.
      sessionRef.current = completedSnapshot;
      const temporaryRecovery: RecoverableRecording = {
        file: await inspectTemporaryRecording(result.uri, current.id),
        needsPreservation: true,
        snapshot: completedSnapshot,
      };
      if (mountedRef.current) {
        setRecoverable(temporaryRecovery);
      }
      await recordingSessionRepository.save(completedSnapshot);
      const finalized = await finalizeRecordingSnapshot(
        completedSnapshot,
        result.uri,
      );
      sessionRef.current = finalized.snapshot;
      const recovery = finalized;
      if (mountedRef.current) {
        setRecoverable(recovery);
      }
      await importRecoveredRecording(recovery);
    } catch (error) {
      await snapshotHandleRef.current?.flush().catch(() => undefined);
      if (mountedRef.current) {
        setScreenError(errorMessage(error));
      }
    } finally {
      finalizingRef.current = false;
      if (mountedRef.current) {
        setIsFinalizing(false);
      }
    }
  }, [importRecoveredRecording, stopRecorder]);

  const continueWithRecoverable = useCallback(async () => {
    if (!recoverable || finalizingRef.current) {
      return;
    }
    finalizingRef.current = true;
    setIsFinalizing(true);
    setScreenError(null);
    try {
      const readyRecovery = recoverable.needsPreservation
        ? await finalizeRecordingSnapshot(
            recoverable.snapshot,
            recoverable.file.sourceUri,
          )
        : recoverable;
      if (mountedRef.current) {
        setRecoverable(readyRecovery);
      }
      await importRecoveredRecording(readyRecovery);
    } catch (error) {
      if (mountedRef.current) {
        setScreenError(errorMessage(error));
      }
    } finally {
      finalizingRef.current = false;
      if (mountedRef.current) {
        setIsFinalizing(false);
      }
    }
  }, [importRecoveredRecording, recoverable]);

  const preserveAndLeave = useCallback(async () => {
    if (finalizingRef.current) {
      return;
    }
    finalizingRef.current = true;
    setIsFinalizing(true);
    setScreenError(null);
    try {
      const result: PremindRecordingResult = await stopRecorder();
      const snapshotHandle = snapshotHandleRef.current;
      snapshotHandleRef.current = null;
      await snapshotHandle?.stop({ flush: false });
      const current = sessionRef.current;
      if (!current) {
        throw new Error('녹음 복구 정보를 찾지 못했어요.');
      }
      const endedAt = new Date().toISOString();
      let interruptedSnapshot: RecordingSessionSnapshot = {
        ...current,
        durationMillis: result.durationMillis,
        endedAt,
        localFileUri: result.uri,
        markers: result.markers,
        status: 'interrupted',
        updatedAt: endedAt,
      };
      sessionRef.current = interruptedSnapshot;
      const temporaryRecovery: RecoverableRecording = {
        file: await inspectTemporaryRecording(result.uri, current.id),
        needsPreservation: true,
        snapshot: interruptedSnapshot,
      };
      if (mountedRef.current) {
        setRecoverable(temporaryRecovery);
      }
      await recordingSessionRepository.save(interruptedSnapshot);
      const file = await preserveRecordingFile(result.uri, current.id);
      interruptedSnapshot = {
        ...interruptedSnapshot,
        localFileUri: file.uri,
        updatedAt: new Date().toISOString(),
      };
      sessionRef.current = interruptedSnapshot;
      await recordingSessionRepository.save(interruptedSnapshot);
      if (isWebRecordingCheckpointUri(result.uri)) {
        await clearWebRecordingCheckpoint(current.id).catch(() => undefined);
      }
      allowNavigationRef.current = true;
      goBackOrReplace('/(tabs)/create');
    } catch (error) {
      await snapshotHandleRef.current?.flush().catch(() => undefined);
      if (mountedRef.current) {
        setScreenError(
          t('{error} 이 화면을 닫기 전에 원본 보관을 다시 시도해 주세요.', {
            error: t(errorMessage(error)),
          }),
        );
      }
    } finally {
      finalizingRef.current = false;
      if (mountedRef.current) {
        setIsFinalizing(false);
      }
    }
  }, [stopRecorder, t]);

  const requestBack = useCallback(() => {
    if (isStarting || recorderPhase === 'preparing') {
      if (Platform.OS === 'web') {
        setScreenError('마이크 준비가 끝나면 안전하게 나갈 수 있어요.');
        return;
      }
      Alert.alert(
        t('마이크를 준비하고 있어요'),
        t('권한과 저장공간 확인이 끝나면 안전하게 종료할 수 있어요.'),
        [{ text: t('확인') }],
      );
      return;
    }
    if (isFinalizing || recorderPhase === 'stopping') {
      if (Platform.OS === 'web') {
        setScreenError('브라우저 저장소에 원본을 보관하고 있어요. 잠시만 기다려 주세요.');
        return;
      }
      Alert.alert(
        t('녹음을 보관하고 있어요'),
        t('기기 저장이 끝날 때까지 잠시만 기다려 주세요.'),
        [{ text: t('확인') }],
      );
      return;
    }
    if (isRecording || isPaused) {
      if (Platform.OS === 'web') {
        if (
          confirmInBrowser(
            t('녹음을 보관하고 나갈까요?'),
            t('지금까지 녹음한 원본을 브라우저에 저장해요.'),
          )
        ) {
          void preserveAndLeave();
        }
        return;
      }
      Alert.alert(
        t('녹음을 보관하고 나갈까요?'),
        t('지금까지 녹음한 내용은 기기에 남고, 나중에 다시 찾을 수 있어요.'),
        [
          { text: t('계속 녹음'), style: 'cancel' },
          {
            text: t('보관 후 나가기'),
            style: 'destructive',
            onPress: () => void preserveAndLeave(),
          },
        ],
      );
      return;
    }
    if (recoverable?.needsPreservation) {
      setScreenError(
        '이 원본은 아직 임시 저장 상태예요. 다시 저장을 눌러 주세요.',
      );
      return;
    }
    allowNavigationRef.current = true;
    goBackOrReplace('/(tabs)/create');
  }, [
    isFinalizing,
    isPaused,
    isRecording,
    isStarting,
    preserveAndLeave,
    recoverable?.needsPreservation,
    recorderPhase,
    t,
  ]);

  const openMicrophoneSettings = () => {
    if (Platform.OS === 'web') {
      setScreenError(
        '주소창 옆 사이트 설정에서 마이크를 허용한 뒤 이 페이지를 새로고침해 주세요.',
      );
      return;
    }
    void Linking.openSettings().catch(() => {
      setScreenError('기기 설정에서 PREMIND의 마이크 권한을 확인해 주세요.');
    });
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        requestBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [requestBack]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!hasSession || allowNavigationRef.current) return;
        event.preventDefault();
        requestBack();
      }),
    [hasSession, navigation, requestBack],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !hasSession) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasSession]);

  if (!hasSession) {
    const permissionDenied = recorderPhase === 'permission-denied';
    return (
      <Screen
        maxWidth={640}
        padded={false}
        safeAreaEdges={['top', 'left', 'right', 'bottom']}
      >
        <AppHeader onBack={requestBack} title={t.ctx('record', '녹음')} />
        <ScrollView
          contentContainerStyle={[
            styles.setupContent,
            isTablet ? styles.setupContentWide : null,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
        >
          {visibleRecoverableSessions.length > 0 || recoveryLoadError ? (
            <View style={styles.section}>
              <SectionHeader
                description={
                  recoverableSourceCount > 0
                    ? t('원본을 고르면 이어서 마인드팩을 만들어요.')
                    : undefined
                }
                title={
                  recoverableSourceCount > 0
                    ? t('이어갈 녹음 {n}개', { n: recoverableSourceCount })
                    : t('녹음 기록')
                }
              />

              {metadataOnlyCount > 0 ? (
                <AppText tone="negative" variant="meta">
                  {t('원본이 없는 기록이 {n}개 있어요. 아래에서 지울 수 있어요.', {
                    n: metadataOnlyCount,
                  })}
                </AppText>
              ) : null}

              {visibleRecoverableSessions.length > 0 ? (
                <Card padding={false}>
                  {visibleRecoverableSessions.map((snapshot, index) => (
                    <View
                      key={snapshot.id}
                      style={[
                        styles.recoveryRow,
                        index < visibleRecoverableSessions.length - 1
                          ? styles.rowDivider
                          : null,
                      ]}
                    >
                      <View style={styles.recoveryRowHead}>
                        <View style={styles.flex}>
                          <AppText numberOfLines={2} variant="itemTitle">
                            {snapshot.title}
                          </AppText>
                          <AppText tone="muted" variant="meta">
                            {formatDuration(snapshot.durationMillis / 1_000)}
                          </AppText>
                          {!hasRecoverableRecordingSource(snapshot) ? (
                            <AppText tone="negative" variant="meta">
                              {t('원본을 찾을 수 없어요. 기록만 지울 수 있어요.')}
                            </AppText>
                          ) : null}
                        </View>
                        <StatusBadge
                          label={t(recoveryStatusLabel(snapshot.status))}
                          tone={recoveryStatusTone(snapshot.status)}
                        />
                      </View>
                      <View style={styles.recoveryRowActions}>
                        <Button
                          disabled={
                            !hasRecoverableRecordingSource(snapshot) ||
                            (recoveryBusyId !== null && recoveryBusyId !== snapshot.id)
                          }
                          loading={recoveryBusyId === snapshot.id}
                          onPress={() => void recoverStoredSession(snapshot)}
                          size="small"
                          variant="primary"
                        >
                          {t('마인드팩 만들기')}
                        </Button>
                        <Button
                          disabled={recoveryBusyId !== null}
                          onPress={() => discardStoredSession(snapshot)}
                          size="small"
                          variant="ghost"
                        >
                          {t('기록 지우기')}
                        </Button>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}

              {recoveryLoadError ? (
                <View style={styles.errorBox}>
                  <AppText style={styles.errorCopy} tone="negative" variant="meta">
                    {t(recoveryLoadError)}
                  </AppText>
                  <Button
                    onPress={() => void loadRecoverableSessions()}
                    size="small"
                    variant="ghost"
                  >
                    {t('다시 불러오기')}
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}

          <DeskCard style={isTablet ? null : styles.readyGroup}>
            <AnimatedReveal style={styles.readyBlock}>
              <View style={styles.readyHalo}>
                <Pressable
                  accessibilityHint={t('녹음을 시작해요')}
                  accessibilityLabel={t('녹음 시작')}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isStarting, disabled: isStarting }}
                  disabled={isStarting}
                  onPress={() => void startRecording()}
                  style={({
                    hovered,
                    pressed,
                  }: {
                    hovered?: boolean;
                    pressed: boolean;
                  }) => [
                    styles.readyButton,
                    hovered ? styles.readyButtonHovered : null,
                    pressed ? styles.readyButtonPressed : null,
                  ]}
                  testID="record-start"
                >
                  {isStarting ? (
                    <ActivityIndicator color={colors.textInverse} size="large" />
                  ) : (
                    <Mic
                      {...decorative}
                      color={colors.textInverse}
                      size={40}
                      strokeWidth={2}
                    />
                  )}
                </Pressable>
              </View>
              <View style={styles.readyCopy}>
                <AppText align="center" variant="heading">
                  {Platform.OS === 'web'
                    ? t('누르면 바로 시작돼요')
                    : t('탭하면 바로 시작돼요')}
                </AppText>
                <AppText align="center" tone="muted" variant="meta">
                  {t('원본은 기기에 먼저 저장돼요')}
                </AppText>
              </View>
            </AnimatedReveal>

            <AnimatedReveal delay={45}>
              <SetupOptions
                disabled={isStarting}
                onChangeTitle={setTitle}
                onChooseProject={chooseProject}
                onTitleFocusChange={setTitleFocused}
                projects={projects}
                recordingTitle={title}
                selectedProject={selectedProject}
                titleFocused={titleFocused}
              />
            </AnimatedReveal>

            {isTablet ? <SetupReassurance /> : null}
          </DeskCard>

          {permissionDenied ? (
            <Card style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <MicOff {...decorative} color={colors.negativeStrong} size={iconSizes.section} />
              </View>
              <View style={styles.flex}>
                <AppText variant="itemTitle">{t('마이크 권한이 필요해요')}</AppText>
                <AppText tone="muted" variant="meta">
                  {t('설정에서 마이크를 허용한 뒤 다시 시작해 주세요.')}
                </AppText>
                <Button
                  leftIcon={<Settings color={colors.text} size={iconSizes.inline} />}
                  onPress={openMicrophoneSettings}
                  size="small"
                  style={styles.inlineAction}
                  variant="outline"
                >
                  {Platform.OS === 'web' ? t('권한 안내') : t('설정 열기')}
                </Button>
              </View>
            </Card>
          ) : null}

          {screenError && (!permissionDenied || Platform.OS === 'web') ? (
            <View style={styles.errorBox}>
              <View style={styles.errorCopy}>
                <AppText tone="negative" variant="bodyStrong">
                  {t('녹음을 시작하지 못했어요')}
                </AppText>
                <AppText tone="muted" variant="meta">
                  {t(screenError)}
                </AppText>
              </View>
            </View>
          ) : null}

          {isTablet ? null : <SetupReassurance />}
        </ScrollView>
      </Screen>
    );
  }

  const canUseRecovered = recoverable !== null;
  const activeControls = isRecording || isPaused;
  const isSaving = isFinalizing || recorderPhase === 'stopping';
  const recordingState = recordingPresentation({
    canUseRecovered,
    isFinalizing: isSaving,
    needsPreservation: Boolean(recoverable?.needsPreservation),
    phase: recorderPhase,
  });
  const visibleSafety =
    screenError && activeControls
      ? t('원본은 그대로 있어요. 아래 안내를 확인해 주세요.')
      : t(recordingState.safety);
  const recordingStatusTone: StatusTone = isSaving
    ? 'neutral'
    : isRecording
      ? 'brand'
      : isPaused
        ? 'neutral'
        : canUseRecovered
          ? recoverable?.needsPreservation
            ? 'warning'
            : 'positive'
          : 'negative';
  const waveformColor =
    isPaused || !activeControls ? colors.stageMuted : colors.brand;

  return (
    <>
      <StatusBar style="light" />
      <Screen
        background="stage"
        maxWidth={640}
        padded={false}
        safeAreaEdges={['top', 'left', 'right', 'bottom']}
      >
        <AppHeader
          inverse
          onBack={requestBack}
          title={title.trim() || t('강의 녹음')}
        />

        <ScrollView
          contentContainerStyle={styles.recordingContent}
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
        >
          <AnimatedReveal style={styles.liveBlock}>
            <View accessibilityLiveRegion="polite" style={styles.statusLine}>
              <BreathingView active={isRecording}>
                <StatusBadge
                  label={t.ctx('state', recordingState.label)}
                  showDot
                  tone={recordingStatusTone}
                />
              </BreathingView>
            </View>

            <View style={styles.timerBlock}>
              <AppText
                accessibilityLabel={t('녹음 시간 {time}', {
                  time: formatDuration(displayDurationMillis / 1_000),
                })}
                align="center"
                style={[styles.timer, isTablet ? styles.timerWide : null]}
                tabular
                tone="inverse"
                variant="display"
              >
                {formatDuration(displayDurationMillis / 1_000)}
              </AppText>
              {selectedProject ? (
                <AppText align="center" style={styles.stageMuted} variant="meta">
                  {selectedProject.title}
                </AppText>
              ) : null}
            </View>

            <BreathingView active={isRecording} style={styles.waveformMotion}>
              <View
                accessible
                accessibilityLabel={
                  isRecording
                    ? t('마이크 입력 신호를 표시하고 있어요')
                    : t('마이크 입력을 기록하지 않고 있어요')
                }
                style={styles.waveform}
              >
                {levelBars.map((height, index) => (
                  <View
                    key={index}
                    style={[
                      styles.waveBar,
                      { backgroundColor: waveformColor, height },
                    ]}
                  />
                ))}
              </View>
            </BreathingView>

            <AppText align="center" style={styles.stageMuted} variant="meta">
              {t(recordingState.description)}
            </AppText>

            <MarkerTimeline
              durationMillis={displayDurationMillis}
              markers={displayMarkers}
            />

            {markerNotice ? (
              <AppText
                accessibilityLiveRegion="polite"
                align="center"
                style={styles.stageBrandText}
                variant="meta"
              >
                {markerNotice}
              </AppText>
            ) : null}

            <Card style={styles.stageStateCard} variant="stage">
              <View
                accessible
                accessibilityLabel={t('현재 상태 {state}. {safety}', {
                  safety: visibleSafety,
                  state: t.ctx('state', recordingState.label),
                })}
                style={styles.stageStateContent}
              >
                <View style={styles.stageStateIcon}>
                  <HardDrive color={colors.stageText} size={iconSizes.section} strokeWidth={1.9} />
                </View>
                <View style={styles.flex}>
                  <AppText style={styles.stageMuted} variant="badge">
                    {t('원본 상태')}
                  </AppText>
                  <AppText tone="inverse" variant="meta">
                    {visibleSafety}
                  </AppText>
                </View>
              </View>
            </Card>
          </AnimatedReveal>

          {screenError ? (
            <AnimatedReveal delay={45}>
              <Card style={styles.stageErrorCard} variant="stage">
                <AppText style={styles.stageNegativeText} variant="bodyStrong">
                  {activeControls
                    ? t('녹음은 계속되고 있어요')
                    : t('원본 상태를 확인해 주세요')}
                </AppText>
                <AppText style={styles.stageMuted} variant="meta">
                  {t(screenError)}
                </AppText>
              </Card>
            </AnimatedReveal>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.stageBottomBar,
            isTablet ? styles.stageBottomBarWide : null,
          ]}
        >
          <AnimatedReveal delay={80} style={styles.controlReveal}>
            {isSaving ? (
              <Button
                accessibilityLabel={t('원본 저장 중')}
                disabled
                fullWidth
                leftIcon={<HardDrive color={colors.text} size={iconSizes.section} />}
                size="large"
                variant="secondary"
              >
                {t('원본 저장 중')}
              </Button>
            ) : activeControls ? (
              <View style={styles.recordingActions}>
                <RecordingAction
                  accent={isPaused}
                  hint={isPaused ? t('녹음을 다시 이어가요') : t('녹음을 잠시 멈춰요')}
                  icon={isPaused ? Play : Pause}
                  label={isPaused ? t.ctx('record', '계속하기') : t.ctx('record', '일시정지')}
                  onPress={() => void togglePause()}
                  prominent={isPaused}
                />
                <RecordingAction
                  accent={!isPaused}
                  hint={t('지금 시점을 표시해요')}
                  icon={Star}
                  label={t('중요 표시')}
                  onPress={addMarker}
                  prominent={!isPaused}
                />
                <RecordingAction
                  hint={t('녹음을 끝내고 원본을 저장해요')}
                  icon={CircleStop}
                  label={t.ctx('record', '종료')}
                  onPress={() => setStopConfirmationVisible(true)}
                />
              </View>
            ) : canUseRecovered ? (
              <View style={styles.recoveryActions}>
                <Button
                  fullWidth
                  loading={isFinalizing}
                  onPress={() => void continueWithRecoverable()}
                  size="large"
                  variant="brand"
                >
                  {recoverable?.needsPreservation ? t('다시 저장') : t('마인드팩 만들기')}
                </Button>
                {!recoverable?.needsPreservation ? (
                  <Button
                    fullWidth
                    onPress={requestBack}
                    size="large"
                    variant="secondary"
                  >
                    {t('나중에 하기')}
                  </Button>
                ) : null}
              </View>
            ) : (
              <Button
                fullWidth
                onPress={requestBack}
                size="large"
                variant="secondary"
              >
                {t.ctx('record', '나가기')}
              </Button>
            )}
          </AnimatedReveal>

          <View style={styles.stageReassurance}>
            <Lock {...decorative} color={colors.stageMuted} size={iconSizes.inline} strokeWidth={1.9} />
            <AppText style={[styles.flex, styles.stageMuted]} variant="meta">
              {screenError && activeControls
                ? visibleSafety
                : isRecording
                  ? Platform.OS === 'web'
                    ? t('이 탭을 열어 두세요. 종료하면 원본을 브라우저에 저장해요.')
                    : t('화면을 잠가도 녹음은 계속돼요. 전화가 오면 원본을 자동으로 저장해요.')
                  : isPaused
                    ? t('멈춘 동안은 녹음하지 않아요. 지금까지의 원본과 중요 표시는 그대로 있어요.')
                    : visibleSafety}
            </AppText>
          </View>
        </View>
      </Screen>

      <Dialog
        cancel={{
          disabled: isFinalizing,
          label: t('계속 녹음'),
          onPress: () => setStopConfirmationVisible(false),
        }}
        confirm={{
          label: t('녹음 종료'),
          loading: isFinalizing,
          onPress: () => void finishRecording(),
        }}
        description={
          Platform.OS === 'web'
            ? t('원본을 브라우저에 저장한 뒤 마인드팩을 만들어요.')
            : t('원본을 기기에 저장한 뒤 마인드팩을 만들어요.')
        }
        onRequestClose={() => {
          if (!isFinalizing) setStopConfirmationVisible(false);
        }}
        title={t('녹음을 종료할까요?')}
        visible={stopConfirmationVisible}
      >
        <View style={styles.stopSummary}>
          <ShieldCheck {...decorative} color={colors.positiveStrong} size={iconSizes.section} />
          <View style={styles.flex}>
            <AppText variant="itemTitle">
              {t('{time} 녹음됨', {
                time: formatDuration(displayDurationMillis / 1_000),
              })}
            </AppText>
            <AppText tone="muted" variant="meta">
              {t('중요 표시 {n}개도 함께 저장돼요.', { n: displayMarkers.length })}
            </AppText>
          </View>
        </View>
      </Dialog>
    </>
  );
}

/** The one "your recording is safe" line under the ready screen. */
function SetupReassurance() {
  const t = useT();
  return (
    <View style={styles.reassuranceRow}>
      <Lock {...decorative} color={colors.textFaint} size={iconSizes.inline} strokeWidth={1.9} />
      <AppText style={styles.flex} tone="muted" variant="meta">
        {Platform.OS === 'web'
          ? t('녹음 중에도 원본을 브라우저에 저장해 두어 새로고침해도 이어갈 수 있어요.')
          : t('화면이 잠겨도 녹음은 계속돼요. 원본은 기기에 남아요.')}
      </AppText>
    </View>
  );
}

function recoveryStatusTone(
  status: RecordingSessionSnapshot['status'],
): StatusTone {
  if (status === 'completed') return 'positive';
  if (status === 'failed') return 'negative';
  if (status === 'paused') return 'neutral';
  return 'warning';
}

/**
 * The two things a learner may still want to change before tapping the big
 * button: the auto title and the subject. Both open a picker rather than
 * living inline, so the ready screen stays one tap.
 */
function SetupOptions({
  disabled,
  onChangeTitle,
  onChooseProject,
  onTitleFocusChange,
  projects,
  recordingTitle,
  selectedProject,
  titleFocused,
}: {
  disabled: boolean;
  onChangeTitle: (title: string) => void;
  onChooseProject: (projectId: string) => void;
  onTitleFocusChange: (focused: boolean) => void;
  projects: readonly Project[];
  recordingTitle: string;
  selectedProject: Project | undefined;
  titleFocused: boolean;
}) {
  const t = useT();
  const [titleDialogVisible, setTitleDialogVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState(recordingTitle);
  const [subjectSheetVisible, setSubjectSheetVisible] = useState(false);
  const canSaveTitle = draftTitle.trim().length > 0;
  const visibleTitle = recordingTitle.trim() || t('제목 없음');
  const visibleSubject = selectedProject?.title ?? t('폴더 없음');

  const openTitleDialog = () => {
    setDraftTitle(recordingTitle);
    setTitleDialogVisible(true);
  };
  const closeTitleDialog = () => {
    onTitleFocusChange(false);
    setTitleDialogVisible(false);
  };
  const saveTitle = () => {
    if (!canSaveTitle) return;
    onChangeTitle(draftTitle.trim());
    closeTitleDialog();
  };

  return (
    <>
      <Card padding={false}>
        <ListRow
          accessibilityHint={t('녹음 제목을 바꿔요')}
          accessibilityLabel={t('제목, {title}', { title: visibleTitle })}
          compact
          disabled={disabled}
          onPress={openTitleDialog}
          testID="record-title-row"
          title={t('제목')}
          trailing={<OptionValue value={visibleTitle} />}
        />
        <ListRow
          accessibilityHint={t('폴더를 골라요')}
          accessibilityLabel={t('폴더, {folder}', { folder: visibleSubject })}
          compact
          disabled={disabled}
          divider={false}
          onPress={() => setSubjectSheetVisible(true)}
          testID="record-subject-row"
          title={t.ctx('record', '폴더')}
          trailing={<OptionValue value={visibleSubject} />}
        />
      </Card>

      <Dialog
        cancel={{ label: t('취소'), onPress: closeTitleDialog }}
        confirm={{ disabled: !canSaveTitle, label: t('저장'), onPress: saveTitle }}
        onRequestClose={closeTitleDialog}
        testID="record-title-dialog"
        title={t('녹음 제목')}
        visible={titleDialogVisible}
      >
        <AuthField
          autoFocus
          hint={
            titleFocused
              ? t('최대 80자까지 입력할 수 있어요.')
              : t('나중에 찾기 쉬운 이름이 좋아요.')
          }
          label={t('제목')}
          maxLength={80}
          onBlur={() => onTitleFocusChange(false)}
          onChangeText={setDraftTitle}
          onFocus={() => onTitleFocusChange(true)}
          onSubmitEditing={saveTitle}
          placeholder={t('예: 인공지능 개론 5주차')}
          returnKeyType="done"
          value={draftTitle}
        />
      </Dialog>

      <BottomSheetModal
        onClose={() => setSubjectSheetVisible(false)}
        scrollable={false}
        testID="record-subject-sheet"
        title={t('폴더 선택')}
        visible={subjectSheetVisible}
      >
        {projects.length > 0 ? (
          <Card padding={false}>
            {projects.map((project, index) => (
              <ProjectRow
                disabled={false}
                key={project.id}
                last={index === projects.length - 1}
                onPress={() => {
                  onChooseProject(project.id);
                  setSubjectSheetVisible(false);
                }}
                project={project}
                selected={project.id === selectedProject?.id}
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            actionLabel={t('폴더 만들기')}
            description={t('녹음을 담을 폴더가 필요해요')}
            icon={FolderOpen}
            onAction={() => {
              setSubjectSheetVisible(false);
              router.dismissTo({
                pathname: '/(tabs)/library',
                params: { newProject: Date.now().toString(36) },
              });
            }}
            title={t('폴더가 없어요')}
          />
        )}
      </BottomSheetModal>
    </>
  );
}

function OptionValue({ value }: { value: string }) {
  return (
    <View style={styles.optionValue}>
      <AppText numberOfLines={1} tone="muted" variant="body">
        {value}
      </AppText>
    </View>
  );
}

function ProjectRow({
  disabled,
  last,
  onPress,
  project,
  selected,
}: {
  disabled: boolean;
  last: boolean;
  onPress: () => void;
  project: Project;
  selected: boolean;
}) {
  const t = useT();
  return (
    <Pressable
      aria-pressed={selected}
      accessibilityLabel={t('{title} 폴더', { title: project.title })}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.projectRow,
        !last ? styles.rowDivider : null,
        disabled ? styles.projectRowDisabled : null,
        pressed ? styles.projectRowPressed : null,
      ]}
    >
      <View
        {...decorative}
        style={[styles.projectDot, { backgroundColor: project.accentColor }]}
      />
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {project.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {project.courseName}
        </AppText>
      </View>
      {selected ? (
        <View {...decorative} style={styles.selectedCheck}>
          <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

function MarkerTimeline({
  durationMillis,
  markers,
}: {
  durationMillis: number;
  markers: readonly PremindRecordingMarker[];
}) {
  const t = useT();
  const lastMarker = markers.at(-1);
  return (
    <View
      accessibilityLabel={
        markers.length > 0
          ? t('중요 표시 {n}개', { n: markers.length })
          : t('아직 중요 표시가 없어요')
      }
      style={styles.markerBlock}
    >
      <View style={styles.markerTrack}>
        {markers.map((marker) => {
          const ratio =
            durationMillis > 0
              ? Math.min(1, Math.max(0, marker.timestampMillis / durationMillis))
              : 0;
          return (
            <View
              key={marker.id}
              style={[styles.markerTick, { left: `${ratio * 100}%` }]}
            />
          );
        })}
      </View>
      <AppText align="center" style={styles.stageMuted} variant="meta">
        {lastMarker
          ? t('중요 표시 {n}개, 마지막 {time}', {
              n: markers.length,
              time: formatDuration(lastMarker.timestampMillis / 1_000),
            })
          : t('기억할 순간에 중요 표시를 남겨요')}
      </AppText>
    </View>
  );
}

/**
 * A round stage control. The prominent one is the accent circle — the single
 * live action of the screen; the others wear the inverse (translucent white)
 * treatment so the accent keeps its meaning.
 */
function RecordingAction({
  accent = false,
  hint,
  icon: Icon,
  label,
  onPress,
  prominent = false,
}: {
  accent?: boolean;
  hint: string;
  icon: typeof Pause;
  label: string;
  onPress: () => void;
  prominent?: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordingAction,
        pressed ? styles.actionPressed : null,
      ]}
    >
      {({ hovered }: { hovered?: boolean; pressed: boolean }) => (
        <>
          <View
            style={[
              styles.actionCircle,
              hovered ? styles.actionCircleHovered : null,
              prominent ? styles.actionCircleProminent : null,
              accent ? styles.actionCircleAccent : null,
              accent && hovered ? styles.actionCircleAccentHovered : null,
            ]}
          >
            <Icon
              {...decorative}
              color={accent ? colors.textInverse : colors.stageText}
              fill={accent ? colors.textInverse : 'transparent'}
              size={prominent ? 30 : 24}
              strokeWidth={2}
            />
          </View>
          <AppText
            style={hovered ? styles.stageLabelHovered : styles.stageMuted}
            variant="badge"
          >
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

function makeLevelBars(
  metering: number | undefined,
  paused: boolean,
  durationMillis: number,
): number[] {
  const normalized = paused
    ? 0.04
    : Math.min(1, Math.max(0.05, ((metering ?? -54) + 60) / 60));
  const time = Math.floor(durationMillis / 140);
  return Array.from({ length: 27 }, (_, index) => {
    const wave = (Math.sin(index * 0.78 + time * 0.34) + 1) / 2;
    const center = 1 - Math.abs(index - 13) / 18;
    return Math.round(8 + normalized * (18 + 48 * wave * center));
  });
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  scroller: {
    flex: 1,
  },
  setupContent: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  setupContentWide: {
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  readyGroup: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  readyHalo: {
    alignItems: 'center',
    backgroundColor: colors.brandSubtle,
    borderColor: colors.brandSoft,
    borderRadius: radii.full,
    borderWidth: 1,
    height: spacing.massive + spacing.huge + spacing.md,
    justifyContent: 'center',
    width: spacing.massive + spacing.huge + spacing.md,
  },
  readyBlock: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  readyButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radii.full,
    height: spacing.massive + spacing.xxl,
    justifyContent: 'center',
    width: spacing.massive + spacing.xxl,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  readyButtonHovered: {
    backgroundColor: colors.brandStrong,
  },
  readyButtonPressed: {
    backgroundColor: colors.brandPressed,
    transform: [{ scale: motion.press.buttonScale }],
  },
  readyCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  optionValue: {
    maxWidth: 190,
  },
  section: {
    gap: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recoveryRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  recoveryRowHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  recoveryRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.alert,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  projectRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  projectRowDisabled: {
    opacity: 0.45,
  },
  projectRowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  projectDot: {
    borderRadius: radii.full,
    height: spacing.sm,
    width: spacing.sm,
  },
  selectedCheck: {
    alignItems: 'center',
    backgroundColor: colors.action,
    borderRadius: radii.full,
    height: sizes.badge,
    justifyContent: 'center',
    width: sizes.badge,
  },
  permissionCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  permissionIcon: {
    alignItems: 'center',
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  inlineAction: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  reassuranceRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recordingContent: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  liveBlock: {
    alignItems: 'stretch',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  statusLine: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  timer: {
    fontSize: 52,
    letterSpacing: -1,
    lineHeight: 60,
  },
  timerWide: {
    fontSize: 64,
    lineHeight: 72,
  },
  stageMuted: {
    color: colors.stageMuted,
  },
  stageBrandText: {
    color: colors.brand,
  },
  stageNegativeText: {
    color: colors.negative,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveformMotion: {
    alignSelf: 'stretch',
  },
  waveBar: {
    borderRadius: radii.full,
    width: 4,
  },
  stageStateCard: {
    alignSelf: 'stretch',
    padding: spacing.md,
  },
  stageStateContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stageStateIcon: {
    alignItems: 'center',
    backgroundColor: colors.stage,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  markerBlock: {
    gap: spacing.sm,
  },
  markerTrack: {
    backgroundColor: colors.stageBorder,
    borderRadius: radii.full,
    height: 3,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.sm,
    position: 'relative',
  },
  markerTick: {
    backgroundColor: colors.brand,
    borderRadius: radii.full,
    height: 18,
    marginLeft: -1.5,
    position: 'absolute',
    top: -7.5,
    width: 3,
  },
  stageErrorCard: {
    gap: spacing.xs,
  },
  stageBottomBar: {
    backgroundColor: colors.stage,
    borderTopColor: colors.stageBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
  stageBottomBarWide: {
    borderTopWidth: 0,
    paddingBottom: spacing.xxl,
  },
  recordingActions: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  recordingAction: {
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 78,
  },
  actionCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.full,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  actionCircleHovered: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  actionCircleAccentHovered: {
    backgroundColor: colors.brandStrong,
    borderColor: colors.brandStrong,
  },
  stageLabelHovered: {
    color: colors.stageText,
  },
  actionCircleProminent: {
    height: 76,
    width: 76,
  },
  actionCircleAccent: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  actionPressed: {
    opacity: 0.72,
  },
  recoveryActions: {
    gap: spacing.sm,
  },
  controlReveal: {
    alignSelf: 'stretch',
  },
  stageReassurance: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stopSummary: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.alert,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
});
