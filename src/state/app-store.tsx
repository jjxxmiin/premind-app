import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import * as Device from 'expo-device';
import { AppState as NativeAppState } from 'react-native';

import { createEmptySnapshot, createMockSnapshot } from '../data/mock-data';
import { createId } from '../lib/format';
import {
  applyStudyNotebookPatch,
  normalizeStudyNotebooks,
} from '../lib/study-notebook';
import { deleteLocalStudySources } from '../features/files/delete-local-study-sources';
import {
  legacyFlutterRecordingMigrationService,
  type LegacyFlutterRecordingMigrationService,
} from '../features/migration/legacy-flutter-recording-migration';
import {
  ApiError,
  apiClient,
  type AuthProvider,
  type KakaoCodeProof,
  type PremindApiClient,
} from '../services/api/client';
import {
  SessionManager,
  isDemoSession,
  sessionManager as defaultSessionManager,
} from '../services/api/session-manager';
import {
  StudyMaterialService,
  type SyncMaterialOptions,
} from '../services/study-material-service';
import {
  ensureStudyNotificationPermission,
  notifyStudyPackReady,
} from '../services/notifications';
import { AppStorage, appStorage } from '../services/storage';
import {
  recordingSessionRepository,
  type RecordingSessionSnapshot,
  type RecordingSessionRepository,
} from '../features/recording/recording-session-repository';
import type {
  AccessSession,
  AppSettings,
  ConfusionFeedback,
  LensHistoryEntry,
  MaterialImportInput,
  PersistedAppSnapshot,
  Project,
  QuizAttempt,
  ShareRoom,
  ShareRoomContent,
  StudyMaterial,
  StudyNotebook,
  StudyNotebookPatch,
} from '../types';

export type AuthStatus =
  | 'restoring'
  | 'signed-out'
  | 'authenticating'
  | 'signed-in';

export interface AppState {
  isHydrated: boolean;
  authStatus: AuthStatus;
  session: AccessSession | null;
  projects: Project[];
  materials: StudyMaterial[];
  shareRooms: ShareRoom[];
  activeProjectId: string | null;
  savedMaterialIds: string[];
  confusionFeedback: ConfusionFeedback[];
  quizAttempts: QuizAttempt[];
  settings: AppSettings;
  /** The learner's notebook per material id; see `StudyNotebook`. */
  studyNotes: Record<string, StudyNotebook>;
  processingMaterialIds: string[];
  syncingMaterialIds: string[];
  /** Materials whose Lens report is being (re)built on the server. */
  evaluatingMaterialIds: string[];
  error: string | null;
}

export interface CreateProjectInput {
  title: string;
  courseName?: string;
  description?: string;
  accentColor?: string;
}

export interface ImportMaterialOptions {
  autoProcess?: boolean;
}

export interface CreateShareRoomInput {
  materialId: string;
  title?: string;
  content?: Partial<ShareRoomContent>;
  expiresAt?: string;
}

export interface SubmitQuizResult {
  attempt: QuizAttempt;
  isCorrect: boolean;
  explanation: string;
}

export interface AppStoreActions {
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<AccessSession>;
  register: (
    email: string,
    name: string,
    password: string,
  ) => Promise<AccessSession>;
  signInWithProvider: (
    provider: AuthProvider,
    token: string,
    kakaoCode?: KakaoCodeProof,
  ) => Promise<AccessSession>;
  loginForDevelopment: () => Promise<AccessSession>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
  selectProject: (projectId: string | null) => void;
  createProject: (input: CreateProjectInput) => Project;
  importMaterial: (
    input: MaterialImportInput,
    options?: ImportMaterialOptions,
  ) => Promise<StudyMaterial>;
  processMaterial: (materialId: string) => Promise<StudyMaterial>;
  syncMaterial: (
    materialId: string,
    options?: SyncMaterialOptions,
  ) => Promise<StudyMaterial>;
  toggleSavedMaterial: (materialId: string) => void;
  /**
   * Open a study room from a public YouTube link. Server-only; the material
   * appears immediately in `transcribing` and resolves when the study pack is
   * ready (same pipeline as an upload, minus the upload).
   */
  importYouTubeMaterial: (input: {
    projectId: string;
    url: string;
    title?: string;
  }) => Promise<StudyMaterial>;
  /**
   * Write a new Lens report for a ready material and wait for it. Nothing is
   * evaluated unless this is called. Resolves with the material carrying the
   * new report and the full history.
   */
  requestLens: (materialId: string) => Promise<StudyMaterial>;
  /**
   * Fetch every past evaluation of a material into `lensHistory`. Server-backed
   * materials only; the demo keeps what it has. Resolves with the entries.
   */
  loadLensHistory: (materialId: string) => Promise<LensHistoryEntry[]>;
  renameMaterial: (materialId: string, title: string) => Promise<void>;
  /** Put a material in a different folder. Rejects for an unknown folder. */
  moveMaterial: (materialId: string, projectId: string) => Promise<void>;
  /**
   * Pull recordings that exist on the server but not on this device into the
   * library (signing in on a new phone, or a link imported elsewhere). Runs by
   * itself after a real sign-in; call it for pull-to-refresh. Resolves with
   * the number of materials added.
   */
  refreshFromServer: () => Promise<number>;
  /**
   * Remove a material everywhere: the store, the server recording (best
   * effort), and any locally owned media file. Irreversible.
   */
  deleteMaterial: (materialId: string) => Promise<void>;
  submitQuizAnswer: (
    materialId: string,
    questionId: string,
    selectedChoiceIndex: number,
  ) => SubmitQuizResult;
  reportConfusion: (
    materialId: string,
    reason: ConfusionFeedback['reason'],
    segmentId?: string,
  ) => ConfusionFeedback;
  /** Take a marked passage off the 헷갈린 곳 list once it is sorted out. */
  resolveConfusion: (feedbackId: string) => void;
  createShareRoom: (input: CreateShareRoomInput) => ShareRoom;
  updateShareRoomContent: (
    shareRoomId: string,
    content: Partial<ShareRoomContent>,
  ) => void;
  revokeShareRoom: (shareRoomId: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  /**
   * Merge a change into the learner's notebook for a material: checked key
   * points, concepts flagged for review, or the memo. Ignored for a material
   * that is not in the library.
   */
  updateStudyNote: (materialId: string, patch: StudyNotebookPatch) => void;
}

/** Both flattened state and `state` are exposed for ergonomic screen usage. */
export type AppStoreValue = AppState & AppStoreActions & { state: AppState };

type Action =
  | {
      type: 'hydrate';
      snapshot: PersistedAppSnapshot;
      session: AccessSession | null;
      error?: string | null;
    }
  | { type: 'workspace-loading'; session: AccessSession | null }
  | { type: 'auth-start' }
  | { type: 'session'; session: AccessSession | null }
  | { type: 'error'; message: string | null }
  | { type: 'select-project'; projectId: string | null }
  | { type: 'add-project'; project: Project }
  | { type: 'add-material'; material: StudyMaterial }
  | {
      type: 'patch-material';
      materialId: string;
      patch: Partial<StudyMaterial>;
    }
  | {
      type: 'material-operation';
      operation: 'processing' | 'syncing' | 'evaluating';
      materialId: string;
      active: boolean;
    }
  | { type: 'toggle-saved'; materialId: string }
  | { type: 'remove-material'; materialId: string }
  | { type: 'quiz-attempt'; attempt: QuizAttempt }
  | { type: 'confusion'; feedback: ConfusionFeedback }
  | { type: 'resolve-confusion'; feedbackId: string }
  | { type: 'move-material'; materialId: string; projectId: string }
  | { type: 'add-share-room'; room: ShareRoom }
  | {
      type: 'update-share-room-content';
      shareRoomId: string;
      content: ShareRoomContent;
    }
  | { type: 'revoke-share-room'; shareRoomId: string; revokedAt: string }
  | { type: 'settings'; patch: Partial<AppSettings> }
  | {
      type: 'study-note';
      materialId: string;
      patch: StudyNotebookPatch;
      updatedAt: string;
    };

const seed = createEmptySnapshot();

const initialState: AppState = {
  isHydrated: false,
  authStatus: 'restoring',
  session: null,
  projects: seed.projects,
  materials: seed.materials,
  shareRooms: seed.shareRooms,
  activeProjectId: seed.activeProjectId,
  savedMaterialIds: seed.savedMaterialIds,
  confusionFeedback: seed.confusionFeedback,
  quizAttempts: seed.quizAttempts,
  settings: seed.settings,
  studyNotes: {},
  processingMaterialIds: [],
  syncingMaterialIds: [],
  evaluatingMaterialIds: [],
  error: null,
};

/**
 * Every real account owns at least one project, so recording, importing and
 * pasting a link work on the first launch without a setup detour. The demo
 * workspace ships its own projects and is left alone.
 */
function withDefaultProject(
  snapshot: PersistedAppSnapshot,
  session: AccessSession | null,
): PersistedAppSnapshot {
  if (!session || isDemoSession(session) || snapshot.projects.length > 0) {
    return snapshot;
  }
  const now = new Date().toISOString();
  const project: Project = {
    id: createId('project'),
    title: '내 강의',
    courseName: '기본 폴더',
    description: '녹음과 가져온 영상이 기본으로 담기는 곳이에요.',
    ownerName: session.user.name,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    materialIds: [],
    memberCount: 1,
    accentColor: '#E25A1C',
  };
  return { ...snapshot, projects: [project], activeProjectId: project.id };
}

function operationIds(
  current: string[],
  materialId: string,
  active: boolean,
): string[] {
  if (active) {
    return current.includes(materialId) ? current : [...current, materialId];
  }
  return current.filter((id) => id !== materialId);
}

function deriveProjectStatus(
  projectId: string,
  materials: StudyMaterial[],
): Project['status'] {
  const projectMaterials = materials.filter(
    (material) => material.projectId === projectId,
  );
  if (projectMaterials.some((material) => material.status === 'transcribing' || material.status === 'generating' || material.status === 'queued')) {
    return 'processing';
  }
  if (projectMaterials.some((material) => material.status === 'ready')) {
    return 'ready';
  }
  return 'draft';
}

function updateProjectForMaterial(
  projects: Project[],
  material: StudyMaterial,
  materials: StudyMaterial[],
): Project[] {
  return projects.map((project) => {
    if (project.id !== material.projectId) {
      return project;
    }
    return {
      ...project,
      materialIds: project.materialIds.includes(material.id)
        ? project.materialIds
        : [...project.materialIds, material.id],
      status: deriveProjectStatus(project.id, materials),
      updatedAt: material.updatedAt,
    };
  });
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        projects: action.snapshot.projects,
        materials: action.snapshot.materials,
        shareRooms: action.snapshot.shareRooms,
        activeProjectId: action.snapshot.activeProjectId,
        savedMaterialIds: action.snapshot.savedMaterialIds,
        confusionFeedback: action.snapshot.confusionFeedback,
        quizAttempts: action.snapshot.quizAttempts,
        // The product is for studying alone; the teacher mode is retired and
        // any persisted value is folded into 'student'.
        settings: { ...action.snapshot.settings, mode: 'student' },
        // Older snapshots have no notebooks; a damaged entry is dropped, not fatal.
        studyNotes: normalizeStudyNotebooks(action.snapshot.studyNotes),
        isHydrated: true,
        authStatus: action.session ? 'signed-in' : 'signed-out',
        session: action.session,
        processingMaterialIds: [],
        syncingMaterialIds: [],
        evaluatingMaterialIds: [],
        error: action.error ?? null,
      };
    case 'workspace-loading': {
      const empty = createEmptySnapshot();
      return {
        ...state,
        projects: empty.projects,
        materials: empty.materials,
        shareRooms: empty.shareRooms,
        activeProjectId: empty.activeProjectId,
        savedMaterialIds: empty.savedMaterialIds,
        confusionFeedback: empty.confusionFeedback,
        quizAttempts: empty.quizAttempts,
        settings: empty.settings,
        studyNotes: {},
        isHydrated: false,
        authStatus: action.session ? 'signed-in' : 'signed-out',
        session: action.session,
        processingMaterialIds: [],
        syncingMaterialIds: [],
        evaluatingMaterialIds: [],
        error: null,
      };
    }
    case 'auth-start':
      return { ...state, authStatus: 'authenticating', error: null };
    case 'session':
      return {
        ...state,
        session: action.session,
        authStatus: action.session ? 'signed-in' : 'signed-out',
        error: null,
      };
    case 'error':
      return { ...state, error: action.message };
    case 'select-project':
      return { ...state, activeProjectId: action.projectId };
    case 'add-project':
      return {
        ...state,
        projects: [action.project, ...state.projects],
        activeProjectId: action.project.id,
      };
    case 'add-material': {
      const materials = [action.material, ...state.materials];
      return {
        ...state,
        materials,
        projects: updateProjectForMaterial(
          state.projects,
          action.material,
          materials,
        ),
      };
    }
    case 'patch-material': {
      let updated: StudyMaterial | undefined;
      const materials = state.materials.map((material) => {
        if (material.id !== action.materialId) {
          return material;
        }
        updated = { ...material, ...action.patch };
        return updated;
      });
      return updated
        ? {
            ...state,
            materials,
            projects: updateProjectForMaterial(state.projects, updated, materials),
          }
        : state;
    }
    case 'material-operation': {
      const key =
        action.operation === 'processing'
          ? 'processingMaterialIds'
          : action.operation === 'syncing'
            ? 'syncingMaterialIds'
            : 'evaluatingMaterialIds';
      return {
        ...state,
        [key]: operationIds(state[key], action.materialId, action.active),
      };
    }
    case 'remove-material': {
      const materials = state.materials.filter(
        (material) => material.id !== action.materialId,
      );
      return {
        ...state,
        materials,
        savedMaterialIds: state.savedMaterialIds.filter(
          (id) => id !== action.materialId,
        ),
        projects: state.projects.map((project) => ({
          ...project,
          materialIds: project.materialIds.filter((id) => id !== action.materialId),
        })),
        shareRooms: state.shareRooms.filter(
          (room) => room.materialId !== action.materialId,
        ),
        confusionFeedback: state.confusionFeedback.filter(
          (item) => item.materialId !== action.materialId,
        ),
        quizAttempts: state.quizAttempts.filter(
          (item) => item.materialId !== action.materialId,
        ),
        studyNotes: Object.fromEntries(
          Object.entries(state.studyNotes).filter(
            ([materialId]) => materialId !== action.materialId,
          ),
        ),
      };
    }
    case 'study-note':
      return {
        ...state,
        studyNotes: {
          ...state.studyNotes,
          [action.materialId]: applyStudyNotebookPatch(
            state.studyNotes[action.materialId],
            action.patch,
            action.updatedAt,
          ),
        },
      };
    case 'toggle-saved':
      return {
        ...state,
        savedMaterialIds: state.savedMaterialIds.includes(action.materialId)
          ? state.savedMaterialIds.filter((id) => id !== action.materialId)
          : [...state.savedMaterialIds, action.materialId],
      };
    case 'quiz-attempt':
      return {
        ...state,
        quizAttempts: [action.attempt, ...state.quizAttempts],
      };
    case 'confusion':
      return {
        ...state,
        confusionFeedback: [action.feedback, ...state.confusionFeedback],
      };
    case 'move-material': {
      const moving = state.materials.find(
        (material) => material.id === action.materialId,
      );
      if (!moving || moving.projectId === action.projectId) return state;
      return {
        ...state,
        materials: state.materials.map((material) =>
          material.id === action.materialId
            ? {
                ...material,
                projectId: action.projectId,
                updatedAt: new Date().toISOString(),
              }
            : material,
        ),
        // `materialIds` is the folder's own copy of the membership and is what
        // a folder row counts, so both ends have to be corrected or the counts
        // go wrong in two places at once.
        projects: state.projects.map((project) => {
          if (project.id === action.projectId) {
            return project.materialIds.includes(action.materialId)
              ? project
              : { ...project, materialIds: [...project.materialIds, action.materialId] };
          }
          if (project.id === moving.projectId) {
            return {
              ...project,
              materialIds: project.materialIds.filter(
                (id) => id !== action.materialId,
              ),
            };
          }
          return project;
        }),
      };
    }
    case 'resolve-confusion':
      return {
        ...state,
        confusionFeedback: state.confusionFeedback.filter(
          (item) => item.id !== action.feedbackId,
        ),
      };
    case 'add-share-room':
      return { ...state, shareRooms: [action.room, ...state.shareRooms] };
    case 'update-share-room-content':
      return {
        ...state,
        shareRooms: state.shareRooms.map((room) =>
          room.id === action.shareRoomId
            ? { ...room, content: action.content }
            : room,
        ),
      };
    case 'revoke-share-room':
      return {
        ...state,
        shareRooms: state.shareRooms.map((room) =>
          room.id === action.shareRoomId
            ? { ...room, status: 'revoked' as const, expiresAt: action.revokedAt }
            : room,
        ),
      };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    default:
      return state;
  }
}

function toSnapshot(state: AppState): PersistedAppSnapshot {
  return {
    schemaVersion: 1,
    projects: state.projects,
    materials: state.materials,
    shareRooms: state.shareRooms,
    activeProjectId: state.activeProjectId,
    savedMaterialIds: state.savedMaterialIds,
    confusionFeedback: state.confusionFeedback,
    quizAttempts: state.quizAttempts,
    settings: state.settings,
    studyNotes: state.studyNotes,
  };
}

/** Labels the refresh token server-side so a user can tell their devices apart. */
function deviceName(): string | undefined {
  const name = Device.deviceName ?? Device.modelName;
  return name ? name.slice(0, 120) : undefined;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function userFacingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return '이메일 또는 비밀번호가 맞지 않아요.';
    }
    if (error.status === 429) {
      return '로그인 시도가 많았어요. 잠시 후 다시 시도해 주세요.';
    }
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 다시 시도해 주세요.';
}

export type AppStoreProviderProps = PropsWithChildren<{
  storage?: AppStorage;
  client?: PremindApiClient;
  sessions?: SessionManager;
  materialService?: StudyMaterialService;
  recordingRepository?: Pick<
    RecordingSessionRepository,
    'activateWorkspace' | 'clearWorkspace' | 'getAll'
  >;
  deleteLocalSources?: typeof deleteLocalStudySources;
  legacyMigrationService?: Pick<
    LegacyFlutterRecordingMigrationService,
    'migrate'
  >;
}>;

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({
  children,
  storage = appStorage,
  client = apiClient,
  sessions = defaultSessionManager,
  materialService,
  recordingRepository = recordingSessionRepository,
  deleteLocalSources = deleteLocalStudySources,
  legacyMigrationService = legacyFlutterRecordingMigrationService,
}: AppStoreProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const hydrateStarted = useRef(false);
  const restoringSession = useRef(false);
  const legacyMigrationStarted = useRef(false);
  const legacyMigrationOwner = useRef<string | null>(null);
  const processingControllers = useRef(new Map<string, AbortController>());
  const workspaceTransitionVersion = useRef(0);
  const workspaceTransition = useRef<{
    userId: string | null;
    promise: Promise<void>;
  } | null>(null);
  const latestWorkspaceSession = useRef<AccessSession | null>(null);
  // Defined after the material actions it needs; activation calls through it.
  const refreshFromServerRef = useRef<(() => Promise<number>) | null>(null);
  const resolvedMaterialService = useMemo(
    () => materialService ?? new StudyMaterialService(client, sessions),
    [client, materialService, sessions],
  );

  const dispatchAction = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    dispatch(action);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activateWorkspace = useCallback(
    (
      requestedSession: AccessSession | null,
      options: {
        force?: boolean;
        migrateLegacy?: boolean;
        waitUntilReady?: Promise<void>;
      } = {},
    ): Promise<void> => {
      const userId = requestedSession?.user.id ?? null;
      latestWorkspaceSession.current = requestedSession;

      const currentUserId = stateRef.current.session?.user.id ?? null;
      if (
        !options.force &&
        stateRef.current.isHydrated &&
        currentUserId === userId
      ) {
        if (stateRef.current.session !== requestedSession) {
          dispatchAction({ type: 'session', session: requestedSession });
        }
        return recordingRepository.activateWorkspace(userId);
      }

      const pending = workspaceTransition.current;
      if (!options.force && pending?.userId === userId) {
        // A token can rotate while its workspace is still loading. Keep the
        // freshest session and share the one in-flight load.
        if (stateRef.current.session !== requestedSession) {
          dispatchAction({ type: 'session', session: requestedSession });
        }
        return pending.promise;
      }

      const version = workspaceTransitionVersion.current + 1;
      workspaceTransitionVersion.current = version;
      for (const controller of processingControllers.current.values()) {
        controller.abort();
      }
      processingControllers.current.clear();

      // `activateWorkspace` changes the recording key synchronously, before its
      // migration promise resolves. Clearing app state in the same tick means
      // neither content nor recovery metadata can flash across accounts.
      const recordingActivation = recordingRepository.activateWorkspace(userId, {
        migrateLegacy: options.migrateLegacy,
      });
      dispatchAction({ type: 'workspace-loading', session: requestedSession });

      const promise = (async () => {
        try {
          const storedSnapshot = requestedSession
            ? await storage.loadSnapshot(userId ?? undefined, {
                migrateLegacy: options.migrateLegacy,
              })
            : null;
          await recordingActivation;
          await options.waitUntilReady;

          if (workspaceTransitionVersion.current !== version) {
            return;
          }
          const latestSession = latestWorkspaceSession.current;
          const session =
            (latestSession?.user.id ?? null) === userId
              ? latestSession
              : requestedSession;
          const loaded = storedSnapshot ??
            (isDemoSession(session)
              ? createMockSnapshot()
              : createEmptySnapshot());
          const snapshot = withDefaultProject(loaded, session);
          dispatchAction({ type: 'hydrate', snapshot, session });
          // A seeded default project is persisted at once so its id survives
          // the next launch; otherwise a fresh id would be minted every time.
          if (snapshot !== loaded && userId) {
            await storage
              .saveSnapshot(toSnapshot(stateRef.current), userId)
              .catch(() => undefined);
          }
          // The library is local-first, but a real account's recordings live
          // on the server too; fetch the ones this device has never seen.
          if (session && !isDemoSession(session)) {
            void refreshFromServerRef.current?.().catch(() => undefined);
          }
        } catch (error) {
          if (workspaceTransitionVersion.current !== version) {
            return;
          }
          const latestSession = latestWorkspaceSession.current;
          const session =
            (latestSession?.user.id ?? null) === userId
              ? latestSession
              : requestedSession;
          dispatchAction({
            type: 'hydrate',
            snapshot: createEmptySnapshot(),
            session,
            error: userFacingError(error),
          });
        }
      })();

      workspaceTransition.current = { userId, promise };
      void promise.finally(() => {
        if (workspaceTransition.current?.promise === promise) {
          workspaceTransition.current = null;
        }
      });
      return promise;
    },
    [dispatchAction, recordingRepository, storage],
  );

  const hydrate = useCallback(async () => {
    if (hydrateStarted.current) {
      return;
    }
    hydrateStarted.current = true;
    restoringSession.current = true;
    try {
      const session = await sessions.restore();
      restoringSession.current = false;
      const restoredOwner =
        session && !isDemoSession(session) ? session.user.id : null;
      // Keep lightweight test/custom storage adapters that predate the claim
      // API working; the production AppStorage always persists the decision.
      const migrateLegacy =
        typeof storage.claimLegacyWorkspace === 'function'
          ? await storage.claimLegacyWorkspace(restoredOwner)
          : Boolean(restoredOwner);
      legacyMigrationOwner.current = migrateLegacy ? restoredOwner : null;
      await activateWorkspace(session, {
        force: true,
        // Demo is a disposable, seeded tour and must never claim data from the
        // former unscoped workspace or recording-recovery keys.
        migrateLegacy,
      });
    } catch (error) {
      restoringSession.current = false;
      legacyMigrationOwner.current = null;
      // A failed/invalid session restore is not proof of ownership. Persist a
      // quarantine decision when possible so a later account cannot inherit
      // data that was present during this signed-out launch.
      if (typeof storage.claimLegacyWorkspace === 'function') {
        await storage.claimLegacyWorkspace(null).catch(() => false);
      }
      await activateWorkspace(null, { force: true });
      dispatchAction({ type: 'error', message: userFacingError(error) });
    }
  }, [activateWorkspace, dispatchAction, sessions, storage]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The session manager owns token rotation and expiry. A change of account
  // swaps the whole workspace; a token refresh for the same account only updates
  // the session object.
  useEffect(
    () =>
      sessions.subscribe((session) => {
        if (restoringSession.current) {
          return;
        }
        void activateWorkspace(session);
      }),
    [activateWorkspace, sessions],
  );

  useEffect(() => {
    if (!state.isHydrated || !state.session) {
      return;
    }
    void storage.saveSnapshot(toSnapshot(state), state.session.user.id);
  }, [state, storage]);

  useEffect(
    () => () => {
      for (const controller of processingControllers.current.values()) {
        controller.abort();
      }
      processingControllers.current.clear();
    },
    [],
  );

  const authenticate = useCallback(
    async (issue: () => Promise<AccessSession>) => {
      dispatchAction({ type: 'auth-start' });
      try {
        const session = await issue();
        await activateWorkspace(session);
        return session;
      } catch (error) {
        dispatchAction({ type: 'session', session: stateRef.current.session });
        dispatchAction({ type: 'error', message: userFacingError(error) });
        throw error;
      }
    },
    [activateWorkspace, dispatchAction],
  );

  const login = useCallback(
    (email: string, password: string) =>
      authenticate(() =>
        sessions.signIn(email, password, {
          deviceName: deviceName(),
          mode: stateRef.current.settings.mode,
        }),
      ),
    [authenticate, sessions],
  );

  const register = useCallback(
    (email: string, name: string, password: string) =>
      authenticate(() =>
        sessions.register(email, name, password, stateRef.current.settings.mode),
      ),
    [authenticate, sessions],
  );

  const signInWithProvider = useCallback(
    (provider: AuthProvider, token: string, kakaoCode?: KakaoCodeProof) =>
      authenticate(() =>
        sessions.signInWithProvider(provider, token, {
          kakaoCode,
          deviceName: deviceName(),
          mode: stateRef.current.settings.mode,
        }),
      ),
    [authenticate, sessions],
  );

  const loginForDevelopment = useCallback(
    () =>
      authenticate(() =>
        sessions.startDemo(stateRef.current.settings.mode),
      ),
    [authenticate, sessions],
  );

  const logout = useCallback(async () => {
    let releaseSignOut!: () => void;
    const signOutSettled = new Promise<void>((resolve) => {
      releaseSignOut = resolve;
    });
    // Clear sensitive content synchronously, but do not expose the login
    // routes until SessionManager has finished clearing its credential. This
    // prevents a fast second login from racing an older token revocation.
    const workspaceCleared = activateWorkspace(null, {
      waitUntilReady: signOutSettled,
    });
    let signOutFailed = false;
    let signOutError: unknown;
    try {
      await sessions.signOut();
    } catch (error) {
      signOutFailed = true;
      signOutError = error;
    } finally {
      releaseSignOut();
    }
    await workspaceCleared;
    if (signOutFailed) {
      throw signOutError;
    }
  }, [activateWorkspace, sessions]);

  const deleteAccount = useCallback(async () => {
    dispatchAction({ type: 'error', message: null });
    const accountSession = stateRef.current.session;
    if (!accountSession) {
      const error = new Error('회원 탈퇴를 진행하려면 다시 로그인해 주세요.');
      dispatchAction({ type: 'error', message: error.message });
      throw error;
    }

    const workspaceId = accountSession.user.id;
    let recoveries: RecordingSessionSnapshot[];
    try {
      // Read every owned URI before the workspace is detached. This lets the
      // cleanup remove interrupted recordings that never became materials.
      recoveries = await recordingRepository.getAll();
      if (!isDemoSession(accountSession)) {
        await sessions.authorize((accessToken) =>
          client.deleteAccount(accessToken),
        );
      }
    } catch (error) {
      const message =
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.code === 'SESSION_EXPIRED')
          ? '로그인 시간이 만료됐어요. 다시 로그인한 뒤 회원 탈퇴를 진행해 주세요.'
          : userFacingError(error);
      dispatchAction({ type: 'error', message });
      throw error;
    }

    const sourceUris = [
      ...stateRef.current.materials.map((material) => material.source.uri),
      ...recoveries.flatMap((recovery) =>
        recovery.localFileUri ? [recovery.localFileUri] : [],
      ),
    ];
    let releaseCleanup!: () => void;
    const cleanupSettled = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    // The account no longer exists on the server. Hide its content now, while
    // keeping protected routes suspended until local cleanup has settled.
    const workspaceCleared = activateWorkspace(null, {
      waitUntilReady: cleanupSettled,
    });

    const cleanupResults = await Promise.allSettled([
      deleteLocalSources(sourceUris),
      storage.clearSnapshot(workspaceId),
      recordingRepository.clearWorkspace(workspaceId),
    ]);
    let credentialError: unknown;
    try {
      // Account deletion already invalidated the server tokens, so clear the
      // credential locally without sending a redundant revoke request.
      await sessions.replace(null);
    } catch (error) {
      credentialError = error;
    } finally {
      releaseCleanup();
    }
    await workspaceCleared;

    const localCleanupFailed = cleanupResults.some(
      (result) => result.status === 'rejected',
    );
    if (localCleanupFailed || credentialError) {
      const error = new Error(
        '계정은 삭제됐지만 이 기기의 일부 데이터를 정리하지 못했어요. 브라우저 또는 앱 저장공간을 확인해 주세요.',
      );
      dispatchAction({ type: 'error', message: error.message });
      throw error;
    }
  }, [
    activateWorkspace,
    client,
    deleteLocalSources,
    dispatchAction,
    recordingRepository,
    sessions,
    storage,
  ]);

  const clearError = useCallback(
    () => dispatchAction({ type: 'error', message: null }),
    [dispatchAction],
  );

  const selectProject = useCallback(
    (projectId: string | null) => {
      if (
        projectId &&
        !stateRef.current.projects.some((project) => project.id === projectId)
      ) {
        return;
      }
      dispatchAction({ type: 'select-project', projectId });
    },
    [dispatchAction],
  );

  const createProject = useCallback(
    (input: CreateProjectInput): Project => {
      const title = input.title.trim();
      if (!title) {
        throw new Error('폴더 이름을 입력해 주세요.');
      }
      const now = new Date().toISOString();
      const project: Project = {
        id: uniqueId('project'),
        title,
        courseName: input.courseName?.trim() || '새 폴더',
        description:
          input.description?.trim() ||
          '강의를 녹음하면 마인드팩이 만들어져요.',
        ownerName: stateRef.current.session?.user.name ?? 'PREMIND 사용자',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        materialIds: [],
        memberCount: 1,
        accentColor: input.accentColor ?? '#D25417',
      };
      dispatchAction({ type: 'add-project', project });
      return project;
    },
    [dispatchAction],
  );

  const assertServerUploadAllowed = useCallback(async (): Promise<void> => {
    if (!resolvedMaterialService.canUseServer()) {
      throw new Error(
        '올리려면 PREMIND 계정으로 로그인해 주세요. 데모에서는 올릴 수 없어요.',
      );
    }
  }, [resolvedMaterialService]);

  const processMaterial = useCallback(
    async (materialId: string): Promise<StudyMaterial> => {
      const current = stateRef.current.materials.find(
        (material) => material.id === materialId,
      );
      if (!current) {
        throw new Error('자료를 찾을 수 없어요.');
      }

      const existing = processingControllers.current.get(materialId);
      if (existing) {
        throw new Error('이미 마인드팩을 만들고 있어요.');
      }
      const useServer = resolvedMaterialService.canUseServer();
      const controller = new AbortController();
      const operationStartedAt = Date.now();
      processingControllers.current.set(materialId, controller);
      dispatchAction({
        type: 'material-operation',
        operation: 'processing',
        materialId,
        active: true,
      });

      // Android 13+ shows nothing to an app that never asked, and the ask has
      // to land while the learner is looking at the screen rather than minutes
      // later when the pack is done. Starting a 마인드팩 is that moment. Saying
      // yes to the system dialog turns the switch in MY on; saying no leaves
      // it off, and a switch the learner turned off themselves is never
      // flipped back, because `asked` is only true when we really prompted.
      void ensureStudyNotificationPermission()
        .then(({ asked, granted }) => {
          if (asked && granted && !stateRef.current.settings.notificationsEnabled) {
            dispatchAction({
              type: 'settings',
              patch: { notificationsEnabled: true },
            });
          }
        })
        .catch(() => undefined);

      const persistMaterialPatch = async (
        patch: Partial<StudyMaterial>,
      ) => {
        const action: Action = {
          type: 'patch-material',
          materialId,
          patch,
        };
        const workspaceId = stateRef.current.session?.user.id;
        if (workspaceId) {
          const nextState = reducer(stateRef.current, action);
          await storage.saveSnapshot(toSnapshot(nextState), workspaceId);
        }
        dispatchAction(action);
      };

      try {
        // Only a real upload needs an account. A YouTube link or a recording
        // the server already holds sends no bytes, so gating it would only
        // stop the app from reading a result the server is already producing.
        const willUpload =
          useServer && current.source.origin !== 'link' && !current.serverRecordingId;
        if (willUpload) {
          await assertServerUploadAllowed();
        }
        // The server pipeline is the real one; the local pipeline is the demo
        // tour. Which runs is decided per call, because a user can sign in (or
        // out of) a real account without restarting the app.
        const process = useServer
          ? resolvedMaterialService.processOnServer.bind(resolvedMaterialService)
          : resolvedMaterialService.processLocalMaterial.bind(
              resolvedMaterialService,
            );
        const result = await process(current, {
          signal: controller.signal,
          onUploaded: async (recordingId) => {
            await persistMaterialPatch({
              serverRecordingId: recordingId,
              syncStatus: 'synced',
              updatedAt: new Date().toISOString(),
            });
          },
          onProgress: (progress) => {
            dispatchAction({
              type: 'patch-material',
              materialId,
              patch: {
                status: progress.status,
                progress: progress.progress,
                progressLabel: progress.label,
                updatedAt: new Date().toISOString(),
                lastError: undefined,
              },
            });
          },
        });
        await persistMaterialPatch(result);
        const shouldNotify =
          stateRef.current.settings.notificationsEnabled &&
          (NativeAppState.currentState !== 'active' ||
            Date.now() - operationStartedAt >= 5_000);
        if (shouldNotify) {
          void notifyStudyPackReady({
            materialId: result.id,
            title: result.title,
          }).catch(() => undefined);
        }
        return result;
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          dispatchAction({
            type: 'patch-material',
            materialId,
            patch: {
              status: 'failed',
              progressLabel: '마인드팩을 만들지 못했어요',
              lastError: userFacingError(error),
              updatedAt: new Date().toISOString(),
            },
          });
          const workspaceId = stateRef.current.session?.user.id;
          if (workspaceId) {
            await storage
              .saveSnapshot(toSnapshot(stateRef.current), workspaceId)
              .catch(() => undefined);
          }
        }
        throw error;
      } finally {
        processingControllers.current.delete(materialId);
        dispatchAction({
          type: 'material-operation',
          operation: 'processing',
          materialId,
          active: false,
        });
      }
    },
    [assertServerUploadAllowed, dispatchAction, resolvedMaterialService, storage],
  );

  const importMaterial = useCallback(
    async (
      input: MaterialImportInput,
      options: ImportMaterialOptions = {},
    ): Promise<StudyMaterial> => {
      if (
        !stateRef.current.projects.some(
          (project) => project.id === input.projectId,
        )
      ) {
        throw new Error('자료를 담을 폴더를 찾을 수 없어요.');
      }
      const material = resolvedMaterialService.createLocalMaterial(input);
      const workspaceId = stateRef.current.session?.user.id;
      if (!workspaceId) {
        throw new Error('자료를 저장하려면 먼저 로그인해 주세요.');
      }
      // Local-first: the material appears and is persisted before any AI or
      // network work starts. A failed process never removes the original URI.
      dispatchAction({ type: 'add-material', material });
      await storage.saveSnapshot(toSnapshot(stateRef.current), workspaceId);
      if (options.autoProcess) {
        return processMaterial(material.id);
      }
      return material;
    },
    [dispatchAction, processMaterial, resolvedMaterialService, storage],
  );

  useEffect(() => {
    const workspaceId = state.session?.user.id;
    if (
      !state.isHydrated ||
      !workspaceId ||
      workspaceId !== legacyMigrationOwner.current ||
      legacyMigrationStarted.current
    ) {
      return;
    }
    legacyMigrationStarted.current = true;
    const ownsMigrationWorkspace = () =>
      stateRef.current.isHydrated &&
      stateRef.current.session?.user.id === workspaceId;
    const assertMigrationWorkspace = () => {
      if (!ownsMigrationWorkspace()) {
        throw new Error('The recording migration workspace changed.');
      }
    };

    void legacyMigrationService
      .migrate({
        existingMaterials: stateRef.current.materials,
        ensureProject: (suggestion) => {
          assertMigrationWorkspace();
          const existingProject = stateRef.current.projects.find(
            (project) =>
              project.title === suggestion.title &&
              project.courseName === suggestion.courseName &&
              project.description === suggestion.description,
          );
          return existingProject?.id ?? createProject(suggestion).id;
        },
        importMaterial: (input) => {
          assertMigrationWorkspace();
          return importMaterial(input, { autoProcess: false });
        },
      })
      .then((result) => {
        if (ownsMigrationWorkspace() && result.status === 'partial') {
          dispatchAction({
            type: 'error',
            message:
              '이전 녹음 일부를 복구하지 못했어요. 원본은 그대로 보관되어 있고, 앱을 다시 열면 재시도해요.',
          });
        }
      })
      .catch(() => {
        if (!ownsMigrationWorkspace()) {
          return;
        }
        dispatchAction({
          type: 'error',
          message:
            '이전 녹음을 확인하지 못했어요. 원본은 그대로 보관되어 있고, 앱을 다시 열면 재시도해요.',
        });
      });
  }, [
    createProject,
    dispatchAction,
    importMaterial,
    legacyMigrationService,
    state.isHydrated,
    state.session,
  ]);

  const syncMaterial = useCallback(
    async (
      materialId: string,
      options: SyncMaterialOptions = {},
    ): Promise<StudyMaterial> => {
      const material = stateRef.current.materials.find(
        (candidate) => candidate.id === materialId,
      );
      if (!material) {
        throw new Error('올릴 자료를 찾을 수 없어요.');
      }
      await assertServerUploadAllowed();

      dispatchAction({
        type: 'material-operation',
        operation: 'syncing',
        materialId,
        active: true,
      });
      dispatchAction({
        type: 'patch-material',
        materialId,
        patch: {
          syncStatus: 'uploading',
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        },
      });
      try {
        const { recordingId } = await resolvedMaterialService.uploadMaterial(
          material,
          {
            ...options,
            onProgress: (progress) => {
              options.onProgress?.(progress);
              dispatchAction({
                type: 'patch-material',
                materialId,
                patch: {
                  progress: progress.progress,
                  progressLabel: progress.label,
                },
              });
            },
          },
        );
        const updated: StudyMaterial = {
          ...material,
          syncStatus: 'synced',
          serverRecordingId: recordingId,
          updatedAt: new Date().toISOString(),
          lastError: undefined,
        };
        dispatchAction({
          type: 'patch-material',
          materialId,
          patch: updated,
        });
        return updated;
      } catch (error) {
        dispatchAction({
          type: 'patch-material',
          materialId,
          patch: {
            syncStatus: 'failed',
            lastError: userFacingError(error),
            updatedAt: new Date().toISOString(),
          },
        });
        throw error;
      } finally {
        dispatchAction({
          type: 'material-operation',
          operation: 'syncing',
          materialId,
          active: false,
        });
      }
    },
    [assertServerUploadAllowed, dispatchAction, resolvedMaterialService],
  );

  const toggleSavedMaterial = useCallback(
    (materialId: string) => {
      if (
        stateRef.current.materials.some(
          (material) => material.id === materialId,
        )
      ) {
        dispatchAction({ type: 'toggle-saved', materialId });
      }
    },
    [dispatchAction],
  );

  const importYouTubeMaterial = useCallback(
    async (input: { projectId: string; url: string; title?: string }) => {
      if (!stateRef.current.projects.some((project) => project.id === input.projectId)) {
        throw new Error('자료를 담을 폴더를 찾을 수 없어요.');
      }
      const workspaceId = stateRef.current.session?.user.id;
      if (!workspaceId) {
        throw new Error('자료를 저장하려면 먼저 로그인해 주세요.');
      }
      const material = await resolvedMaterialService.importYouTubeMaterial(
        input.projectId,
        { url: input.url, title: input.title },
      );
      dispatchAction({ type: 'add-material', material });
      await storage.saveSnapshot(toSnapshot(stateRef.current), workspaceId);
      // The server is already transcribing; this only polls and folds the
      // result in. A failure here leaves the room in `failed` with a retry.
      void processMaterial(material.id).catch(() => undefined);
      return material;
    },
    [dispatchAction, processMaterial, resolvedMaterialService, storage],
  );

  const refreshFromServer = useCallback(async (): Promise<number> => {
    const workspaceId = stateRef.current.session?.user.id;
    if (!workspaceId || !resolvedMaterialService.canUseServer()) {
      return 0;
    }
    const rows = await resolvedMaterialService.listServerRecordings();
    const known = new Set(
      stateRef.current.materials
        .map((material) => material.serverRecordingId)
        .filter((id): id is string => Boolean(id)),
    );
    const projectId =
      stateRef.current.activeProjectId ?? stateRef.current.projects[0]?.id;
    if (!projectId) return 0;
    const added = rows
      .filter((row) => !known.has(row.id))
      .map((row) => resolvedMaterialService.createRemoteMaterial(row, projectId));
    for (const material of added) {
      dispatchAction({ type: 'add-material', material });
    }
    if (added.length > 0) {
      await storage
        .saveSnapshot(toSnapshot(stateRef.current), workspaceId)
        .catch(() => undefined);
    }

    /**
     * Everything that still owes this device a result, in one list.
     *
     * `added` is the easy half: recordings made somewhere else. The other half
     * is the one that stranded a real tester — a material this device already
     * knows, whose 마인드팩 the server finished while the app was not running.
     * The polling loop that folds the result in lives in the app process, so
     * if that process goes away mid-upload the result is never collected, and
     * nothing ever went back for it: `refreshFromServer` only looked at
     * recordings it had never seen. The material then sits there forever
     * saying 요약이 없어요 while the server holds a complete study pack.
     */
    const stranded = stateRef.current.materials.filter(
      (material) =>
        material.serverRecordingId &&
        !added.some((item) => item.id === material.id) &&
        // Unfinished, not merely thin. A material that reached `ready` without
        // a summary is one the server could not summarise, and polling it
        // again on every launch would never produce one.
        material.status !== 'ready',
    );

    // One at a time: a phone that just signed in must not open twenty polling
    // loops at once.
    for (const material of [...added, ...stranded]) {
      if (stateRef.current.session?.user.id !== workspaceId) break;
      const current = stateRef.current.materials.find(
        (item) => item.id === material.id,
      );
      if (!current || current.status === 'ready') continue;
      await processMaterial(material.id).catch(() => undefined);
    }
    return added.length;
  }, [dispatchAction, processMaterial, resolvedMaterialService, storage]);
  useEffect(() => {
    refreshFromServerRef.current = refreshFromServer;
  }, [refreshFromServer]);

  const requestLens = useCallback(
    async (materialId: string): Promise<StudyMaterial> => {
      const current = stateRef.current.materials.find(
        (material) => material.id === materialId,
      );
      if (!current) {
        throw new Error('자료를 찾을 수 없어요.');
      }
      if (stateRef.current.evaluatingMaterialIds.includes(materialId)) {
        throw new Error('이미 평가를 만들고 있어요.');
      }
      dispatchAction({
        type: 'material-operation',
        operation: 'evaluating',
        materialId,
        active: true,
      });
      try {
        const evaluation = await resolvedMaterialService.requestLens(current);
        const patch: Partial<StudyMaterial> = {
          lensReport: evaluation.report,
          lensEvaluatedAt: evaluation.evaluatedAt,
          lensCount: evaluation.count,
          lensHistory: evaluation.history,
          updatedAt: new Date().toISOString(),
        };
        const action: Action = { type: 'patch-material', materialId, patch };
        dispatchAction(action);
        const workspaceId = stateRef.current.session?.user.id;
        if (workspaceId) {
          await storage.saveSnapshot(
            toSnapshot(reducer(stateRef.current, action)),
            workspaceId,
          );
        }
        return { ...current, ...patch };
      } finally {
        dispatchAction({
          type: 'material-operation',
          operation: 'evaluating',
          materialId,
          active: false,
        });
      }
    },
    [dispatchAction, resolvedMaterialService, storage],
  );

  const loadLensHistory = useCallback(
    async (materialId: string): Promise<LensHistoryEntry[]> => {
      const current = stateRef.current.materials.find(
        (material) => material.id === materialId,
      );
      if (!current) {
        throw new Error('자료를 찾을 수 없어요.');
      }
      const history = await resolvedMaterialService.loadLensHistory(current);
      if (history === current.lensHistory) {
        return history;
      }
      const newest = history[0];
      const action: Action = {
        type: 'patch-material',
        materialId,
        patch: {
          lensHistory: history,
          lensCount: Math.max(current.lensCount ?? 0, history.length),
          ...(newest && !current.lensEvaluatedAt
            ? { lensEvaluatedAt: newest.evaluatedAt }
            : {}),
        },
      };
      dispatchAction(action);
      const workspaceId = stateRef.current.session?.user.id;
      if (workspaceId) {
        await storage
          .saveSnapshot(toSnapshot(reducer(stateRef.current, action)), workspaceId)
          .catch(() => undefined);
      }
      return history;
    },
    [dispatchAction, resolvedMaterialService, storage],
  );

  const renameMaterial = useCallback(
    async (materialId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        throw new Error('제목을 입력해 주세요.');
      }
      const action: Action = {
        type: 'patch-material',
        materialId,
        patch: { title: trimmed.slice(0, 300), updatedAt: new Date().toISOString() },
      };
      dispatchAction(action);
      const workspaceId = stateRef.current.session?.user.id;
      if (workspaceId) {
        await storage.saveSnapshot(
          toSnapshot(reducer(stateRef.current, action)),
          workspaceId,
        );
      }
    },
    [dispatchAction, storage],
  );

  /**
   * Put a material in a different folder. Local only: folders are how this
   * device organises the library and the server does not model them.
   */
  const moveMaterial = useCallback(
    async (materialId: string, projectId: string) => {
      const target = stateRef.current.projects.find(
        (project) => project.id === projectId,
      );
      if (!target) {
        throw new Error('폴더를 찾을 수 없어요.');
      }
      const action: Action = { type: 'move-material', materialId, projectId };
      dispatchAction(action);
      const workspaceId = stateRef.current.session?.user.id;
      if (workspaceId) {
        await storage.saveSnapshot(
          toSnapshot(reducer(stateRef.current, action)),
          workspaceId,
        );
      }
    },
    [dispatchAction, storage],
  );

  const deleteMaterial = useCallback(
    async (materialId: string) => {
      const current = stateRef.current.materials.find(
        (material) => material.id === materialId,
      );
      if (!current) return;
      processingControllers.current.get(materialId)?.abort();
      const action: Action = { type: 'remove-material', materialId };
      dispatchAction(action);
      const workspaceId = stateRef.current.session?.user.id;
      if (workspaceId) {
        await storage.saveSnapshot(
          toSnapshot(reducer(stateRef.current, action)),
          workspaceId,
        );
      }
      // The row is gone locally either way; the server copy and the file are
      // cleaned up best-effort so a flaky network never blocks a delete.
      if (current.serverRecordingId && resolvedMaterialService.canUseServer()) {
        await resolvedMaterialService
          .deleteServerRecording(current.serverRecordingId)
          .catch(() => undefined);
      }
      if (current.source.origin !== 'link') {
        await deleteLocalSources([current.source.uri]).catch(() => undefined);
      }
    },
    [deleteLocalSources, dispatchAction, resolvedMaterialService, storage],
  );

  const submitQuizAnswer = useCallback(
    (
      materialId: string,
      questionId: string,
      selectedChoiceIndex: number,
    ): SubmitQuizResult => {
      const material = stateRef.current.materials.find(
        (candidate) => candidate.id === materialId,
      );
      const question = material?.quiz.find(
        (candidate) => candidate.id === questionId,
      );
      if (!question || !question.choices[selectedChoiceIndex]) {
        throw new Error('문제 또는 선택지를 확인할 수 없어요.');
      }
      const attempt: QuizAttempt = {
        id: uniqueId('attempt'),
        materialId,
        questionId,
        selectedChoiceIndex,
        isCorrect: question.correctChoiceIndex === selectedChoiceIndex,
        attemptedAt: new Date().toISOString(),
      };
      dispatchAction({ type: 'quiz-attempt', attempt });
      return {
        attempt,
        isCorrect: attempt.isCorrect,
        explanation: question.explanation,
      };
    },
    [dispatchAction],
  );

  const reportConfusion = useCallback(
    (
      materialId: string,
      reason: ConfusionFeedback['reason'],
      segmentId?: string,
    ): ConfusionFeedback => {
      const feedback: ConfusionFeedback = {
        id: uniqueId('confusion'),
        materialId,
        segmentId,
        reason,
        createdAt: new Date().toISOString(),
      };
      dispatchAction({ type: 'confusion', feedback });
      return feedback;
    },
    [dispatchAction],
  );

  /**
   * Take a marked passage off the 헷갈린 곳 list. Without this the list only
   * ever grows, and a list of things you sorted out weeks ago is noise that
   * hides the one you have not.
   */
  const resolveConfusion = useCallback(
    (feedbackId: string): void => {
      dispatchAction({ type: 'resolve-confusion', feedbackId });
    },
    [dispatchAction],
  );

  const createShareRoom = useCallback(
    (input: CreateShareRoomInput): ShareRoom => {
      const material = stateRef.current.materials.find(
        (candidate) => candidate.id === input.materialId,
      );
      if (!material || material.status !== 'ready') {
        throw new Error('마인드팩이 준비된 자료만 공유할 수 있어요.');
      }
      const slug = `${material.id.slice(-10)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const content: ShareRoomContent = {
        audio: true,
        summary: Boolean(material.note?.summary.trim()),
        keyPoints: Boolean(material.note?.keyPoints.length),
        transcript: false,
        quiz: material.quiz.length > 0,
        ...input.content,
      };
      if (!Object.values(content).some(Boolean)) {
        throw new Error('공유할 항목을 하나 이상 선택해 주세요.');
      }
      const room: ShareRoom = {
        id: uniqueId('share'),
        projectId: material.projectId,
        materialId: material.id,
        title: input.title?.trim() || `${material.title} 마인드팩`,
        slug,
        url: `premind://watch/${slug}`,
        distribution: 'local-preview',
        status: 'active',
        content,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt,
        participantCount: 0,
        viewCount: 0,
        quizCompletionCount: 0,
      };
      dispatchAction({ type: 'add-share-room', room });
      return room;
    },
    [dispatchAction],
  );

  const revokeShareRoom = useCallback(
    (shareRoomId: string) =>
      dispatchAction({
        type: 'revoke-share-room',
        shareRoomId,
        revokedAt: new Date().toISOString(),
      }),
    [dispatchAction],
  );

  const updateShareRoomContent = useCallback(
    (shareRoomId: string, patch: Partial<ShareRoomContent>) => {
      const room = stateRef.current.shareRooms.find(
        (candidate) => candidate.id === shareRoomId,
      );
      if (!room) {
        throw new Error('공유 링크를 찾을 수 없어요.');
      }
      if (room.status !== 'active') {
        throw new Error('끝난 공유 링크는 바꿀 수 없어요.');
      }
      if (room.distribution !== 'local-preview') {
        throw new Error('공개 중인 공유 링크는 PREMIND 웹에서 바꿔 주세요.');
      }
      const content = { ...room.content, ...patch };
      if (!Object.values(content).some(Boolean)) {
        throw new Error('공유할 항목을 하나 이상 선택해 주세요.');
      }
      dispatchAction({
        type: 'update-share-room-content',
        shareRoomId,
        content,
      });
    },
    [dispatchAction],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      dispatchAction({ type: 'settings', patch });
    },
    [dispatchAction],
  );

  const updateStudyNote = useCallback(
    (materialId: string, patch: StudyNotebookPatch) => {
      if (
        !stateRef.current.materials.some(
          (material) => material.id === materialId,
        )
      ) {
        return;
      }
      dispatchAction({
        type: 'study-note',
        materialId,
        patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [dispatchAction],
  );

  const actions = useMemo<AppStoreActions>(
    () => ({
      hydrate,
      login,
      register,
      signInWithProvider,
      loginForDevelopment,
      logout,
      deleteAccount,
      clearError,
      selectProject,
      createProject,
      importMaterial,
      processMaterial,
      syncMaterial,
      toggleSavedMaterial,
      importYouTubeMaterial,
      refreshFromServer,
      requestLens,
      loadLensHistory,
      renameMaterial,
      moveMaterial,
      deleteMaterial,
      submitQuizAnswer,
      reportConfusion,
      resolveConfusion,
      createShareRoom,
      updateShareRoomContent,
      revokeShareRoom,
      updateSettings,
      updateStudyNote,
    }),
    [
      clearError,
      createProject,
      createShareRoom,
      deleteAccount,
      hydrate,
      importMaterial,
      login,
      loginForDevelopment,
      logout,
      processMaterial,
      register,
      reportConfusion,
      resolveConfusion,
      signInWithProvider,
      revokeShareRoom,
      selectProject,
      submitQuizAnswer,
      syncMaterial,
      toggleSavedMaterial,
      importYouTubeMaterial,
      refreshFromServer,
      requestLens,
      loadLensHistory,
      renameMaterial,
      moveMaterial,
      deleteMaterial,
      updateShareRoomContent,
      updateSettings,
      updateStudyNote,
    ],
  );

  const value = useMemo<AppStoreValue>(
    () => ({ ...state, ...actions, state }),
    [actions, state],
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export const AppProvider = AppStoreProvider;

export function useAppStore(): AppStoreValue {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error('useAppStore must be used inside AppStoreProvider.');
  }
  return store;
}

export const useApp = useAppStore;

export function selectActiveProject(state: AppState): Project | null {
  return (
    state.projects.find((project) => project.id === state.activeProjectId) ??
    null
  );
}

export function selectProjectMaterials(
  state: AppState,
  projectId: string,
): StudyMaterial[] {
  return state.materials.filter((material) => material.projectId === projectId);
}

export function selectMaterial(
  state: AppState,
  materialId: string,
): StudyMaterial | null {
  return state.materials.find((material) => material.id === materialId) ?? null;
}

/** The learner's notebook for a material, or an empty one before they write. */
export function selectStudyNote(
  state: AppState,
  materialId: string,
): StudyNotebook {
  return state.studyNotes[materialId] ?? EMPTY_STUDY_NOTE;
}

const EMPTY_STUDY_NOTE: StudyNotebook = Object.freeze({
  checkedPoints: [],
  reviewConcepts: [],
  highlights: [],
  memo: '',
  updatedAt: new Date(0).toISOString(),
}) as StudyNotebook;
