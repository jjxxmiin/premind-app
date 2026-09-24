import NetInfo from '@react-native-community/netinfo';
import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createEmptySnapshot, createMockSnapshot } from '../data/mock-data';
import { LEGACY_FLUTTER_METADATA_STRATEGY } from '../features/migration/legacy-flutter-recording-migration';
import type { RecordingSessionSnapshot } from '../features/recording/recording-session-repository';
import {
  ApiError,
  type PremindApiClient,
} from '../services/api/client';
import { ensureStudyNotificationPermission } from '../services/notifications';
import type { SessionManager } from '../services/api/session-manager';
import type { StudyMaterialService } from '../services/study-material-service';
import type { AppStorage } from '../services/storage';
import type { AccessSession, PersistedAppSnapshot, StudyMaterial } from '../types';
import {
  AppStoreProvider,
  type AppStoreValue,
  useAppStore,
} from './app-store';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock('../services/notifications', () => ({
  ensureStudyNotificationPermission: jest.fn(async () => ({
    asked: false,
    granted: false,
  })),
  notifyStudyPackReady: jest.fn(async () => undefined),
}));

function session(id: string, accessToken = `token-${id}`): AccessSession {
  return {
    accessToken,
    tokenType: 'bearer',
    issuedAt: '2026-09-03T00:00:00.000Z',
    expiresAt: '2026-09-03T01:00:00.000Z',
    refreshToken: `refresh-${id}`,
    refreshExpiresAt: '2026-10-03T00:00:00.000Z',
    user: {
      id,
      email: `${id}@premind.test`,
      name: id,
      role: 'member',
      mode: 'teacher',
    },
  };
}

function demoSession(): AccessSession {
  return {
    ...session('premind-development-user', 'local-development-only'),
    refreshToken: null,
    refreshExpiresAt: null,
    user: {
      ...session('premind-development-user').user,
      role: 'development',
    },
  };
}

function snapshot(projectId: string): PersistedAppSnapshot {
  const empty = createEmptySnapshot();
  return {
    ...empty,
    projects: [
      {
        id: projectId,
        title: projectId,
        courseName: '테스트',
        description: '',
        ownerName: '테스터',
        status: 'draft',
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
        materialIds: [],
        memberCount: 1,
        accentColor: '#D25417',
      },
    ],
    activeProjectId: projectId,
  };
}

function materialSnapshot(material: StudyMaterial): PersistedAppSnapshot {
  const owned = snapshot(material.projectId);
  return {
    ...owned,
    materials: [material],
    projects: owned.projects.map((project) => ({
      ...project,
      materialIds: [material.id],
    })),
  };
}

function recordingSnapshot(id: string): RecordingSessionSnapshot {
  return {
    schemaVersion: 1,
    id,
    projectId: 'project-owned',
    title: `녹음 ${id}`,
    startedAt: '2026-09-03T00:00:00.000Z',
    endedAt: '2026-09-03T00:01:00.000Z',
    localFileUri: `file:///documents/${id}.m4a`,
    durationMillis: 60_000,
    status: 'interrupted',
    uploadStatus: 'pending',
    markers: [],
    updatedAt: '2026-09-03T00:01:00.000Z',
  };
}

class FakeSessions {
  private listeners = new Set<(value: AccessSession | null) => void>();
  private current: AccessSession | null;
  nextLogin: AccessSession;

  constructor(initial: AccessSession | null, nextLogin = session('user-b')) {
    this.current = initial;
    this.nextLogin = nextLogin;
  }

  restore = jest.fn(async () => this.publish(this.current));

  subscribe = jest.fn((listener: (value: AccessSession | null) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  });

  signIn = jest.fn(async () => this.publish(this.nextLogin) as AccessSession);
  register = jest.fn(async () => this.publish(this.nextLogin) as AccessSession);
  signInWithProvider = jest.fn(
    async () => this.publish(this.nextLogin) as AccessSession,
  );
  startDemo = jest.fn(async () => this.publish(demoSession()) as AccessSession);
  signOut = jest.fn(async () => {
    this.publish(null);
  });
  replace = jest.fn(async (value: AccessSession | null) => {
    this.publish(value);
  });
  authorize = jest.fn(
    async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
      if (!this.current) throw new Error('No active session.');
      return operation(this.current.accessToken);
    },
  );

  private publish(value: AccessSession | null): AccessSession | null {
    this.current = value;
    for (const listener of this.listeners) {
      listener(value);
    }
    return value;
  }
}

async function harness(options: {
  initialSession: AccessSession | null;
  loadSnapshot: AppStorage['loadSnapshot'];
  materialService?: Partial<StudyMaterialService>;
  nextLogin?: AccessSession;
  client?: Pick<PremindApiClient, 'deleteAccount'>;
  recoverySnapshots?: RecordingSessionSnapshot[];
  deleteLocalSources?: (sourceUris: readonly string[]) => Promise<void>;
}) {
  let latest: AppStoreValue | null = null;
  const sessions = new FakeSessions(options.initialSession, options.nextLogin);
  const storage = {
    claimLegacyWorkspace: jest.fn(async (workspaceId: string | null) =>
      Boolean(workspaceId),
    ),
    loadSnapshot: jest.fn(options.loadSnapshot),
    saveSnapshot: jest.fn(async () => undefined),
    clearSnapshot: jest.fn(async () => undefined),
  } as unknown as AppStorage;
  const recordingRepository = {
    activateWorkspace: jest.fn(async () => undefined),
    clearWorkspace: jest.fn(async () => undefined),
    getAll: jest.fn(async () => options.recoverySnapshots ?? []),
  };
  const client = {
    deleteAccount: jest.fn(async () => undefined),
    ...options.client,
  } as unknown as PremindApiClient;
  const deleteLocalSources = jest.fn(
    options.deleteLocalSources ?? (async () => undefined),
  );
  const legacyMigrationService = {
    migrate: jest.fn(async () => ({
      status: 'completed' as const,
      metadataStrategy: LEGACY_FLUTTER_METADATA_STRATEGY,
      discoveredCount: 0,
      importedCount: 0,
      importedUris: [],
      skippedDuplicateUris: [],
      ignoredCount: 0,
      failures: [],
    })),
  };
  const materialService = {
    canUseServer: jest.fn(() => false),
    ...options.materialService,
  } as unknown as StudyMaterialService;

  function Probe({ children }: { children?: ReactNode }) {
    latest = useAppStore();
    return children ?? null;
  }

  await render(
    <AppStoreProvider
      legacyMigrationService={legacyMigrationService}
      materialService={materialService}
      recordingRepository={recordingRepository}
      sessions={sessions as unknown as SessionManager}
      storage={storage}
      client={client}
      deleteLocalSources={deleteLocalSources}
    >
      <Probe />
    </AppStoreProvider>,
  );

  return {
    get store(): AppStoreValue {
      if (!latest) throw new Error('Store probe has not rendered.');
      return latest;
    },
    materialService,
    recordingRepository,
    sessions,
    storage,
    client,
    deleteLocalSources,
  };
}

describe('AppStore workspace ownership', () => {
  it('starts a new real account with an empty workspace', async () => {
    const user = session('real-user');
    const app = await harness({
      initialSession: user,
      loadSnapshot: async () => null,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.session?.user.id).toBe('real-user');
    // One default project, so the first recording or link needs no setup.
    expect(app.store.projects).toHaveLength(1);
    expect(app.store.projects[0]?.title).toBe('내 강의');
    expect(app.store.activeProjectId).toBe(app.store.projects[0]?.id);
    expect(app.store.materials).toEqual([]);
    expect(app.storage.loadSnapshot).toHaveBeenCalledWith('real-user', {
      migrateLegacy: true,
    });
    expect(app.storage.claimLegacyWorkspace).toHaveBeenCalledWith('real-user');
  });

  it('seeds mock content only for the demo account', async () => {
    const app = await harness({
      initialSession: demoSession(),
      loadSnapshot: async () => null,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.projects.length).toBeGreaterThan(0);
    expect(app.store.materials.length).toBeGreaterThan(0);
    expect(app.storage.loadSnapshot).toHaveBeenCalledWith(
      'premind-development-user',
      { migrateLegacy: false },
    );
    expect(app.storage.claimLegacyWorkspace).toHaveBeenCalledWith(null);
    expect(app.recordingRepository.activateWorkspace).toHaveBeenCalledWith(
      'premind-development-user',
      { migrateLegacy: false },
    );
  });

  it('does not give a later login data from a signed-out launch', async () => {
    const laterUser = session('later-user');
    const app = await harness({
      initialSession: null,
      nextLogin: laterUser,
      loadSnapshot: async () => null,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.storage.claimLegacyWorkspace).toHaveBeenCalledWith(null);

    await act(async () => {
      await app.store.login('later@premind.test', 'password');
    });
    expect(app.store.session?.user.id).toBe('later-user');
    expect(app.store.projects.map((project) => project.title)).toEqual(['내 강의']);
    expect(app.storage.loadSnapshot).toHaveBeenLastCalledWith('later-user', {
      migrateLegacy: undefined,
    });
    expect(app.recordingRepository.activateWorkspace).toHaveBeenLastCalledWith(
      'later-user',
      { migrateLegacy: undefined },
    );
  });

  it('clears the previous workspace before loading another account', async () => {
    const first = session('user-a');
    const second = session('user-b');
    let releaseSecond: ((value: PersistedAppSnapshot) => void) | undefined;
    const secondSnapshot = new Promise<PersistedAppSnapshot>((resolve) => {
      releaseSecond = resolve;
    });
    const app = await harness({
      initialSession: first,
      nextLogin: second,
      loadSnapshot: async (userId) => {
        if (userId === 'user-a') return snapshot('project-a');
        if (userId === 'user-b') return secondSnapshot;
        return null;
      },
    });

    await waitFor(() => expect(app.store.activeProjectId).toBe('project-a'));

    let loginPromise: Promise<AccessSession> | undefined;
    await act(async () => {
      loginPromise = app.store.login('b@premind.test', 'password');
      await Promise.resolve();
    });
    expect(app.store.session?.user.id).toBe('user-b');
    expect(app.store.isHydrated).toBe(false);
    expect(app.store.projects).toEqual([]);

    releaseSecond?.(snapshot('project-b'));
    await act(async () => {
      await loginPromise;
    });
    expect(app.store.isHydrated).toBe(true);
    expect(app.store.activeProjectId).toBe('project-b');
    expect(app.store.projects.map((project) => project.id)).not.toContain(
      'project-a',
    );

    await act(async () => {
      await app.store.logout();
    });
    expect(app.store.session).toBeNull();
    expect(app.store.projects).toEqual([]);
    expect(app.store.materials).toEqual([]);
  });

  it('keeps routes suspended until credential clearing finishes', async () => {
    const app = await harness({
      initialSession: session('user-a'),
      loadSnapshot: async () => snapshot('project-a'),
    });
    await waitFor(() => expect(app.store.activeProjectId).toBe('project-a'));

    let releaseSignOut!: () => void;
    app.sessions.signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSignOut = resolve;
        }),
    );
    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = app.store.logout();
      await Promise.resolve();
    });

    expect(app.store.session).toBeNull();
    expect(app.store.projects).toEqual([]);
    expect(app.store.isHydrated).toBe(false);

    releaseSignOut();
    await act(async () => {
      await logoutPromise;
    });
    expect(app.store.isHydrated).toBe(true);
    expect(app.store.authStatus).toBe('signed-out');
  });

  it('deletes a real account, its owned local sources, and its local workspace', async () => {
    const source: StudyMaterial = {
      id: 'material-owned',
      projectId: 'project-owned',
      title: '내 강의',
      source: {
        uri: 'premind-web-media:owned-source',
        fileName: 'owned.webm',
        mimeType: 'audio/webm',
        kind: 'audio',
        origin: 'recording',
      },
      status: 'imported',
      progress: 0,
      progressLabel: '기기 저장',
      syncStatus: 'local-only',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      transcript: [],
      quiz: [],
      markers: [],
    };
    const recovery: RecordingSessionSnapshot = {
      ...recordingSnapshot('recovery-owned'),
      localFileUri: 'premind-web-recording-checkpoint:recovery-owned',
    };
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(source),
      recoverySnapshots: [recovery],
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      await app.store.deleteAccount();
    });

    expect(app.sessions.authorize).toHaveBeenCalledTimes(1);
    expect(app.client.deleteAccount).toHaveBeenCalledWith('token-real-user');
    expect(app.deleteLocalSources).toHaveBeenCalledWith([
      'premind-web-media:owned-source',
      'premind-web-recording-checkpoint:recovery-owned',
    ]);
    expect(app.storage.clearSnapshot).toHaveBeenCalledWith('real-user');
    expect(app.recordingRepository.clearWorkspace).toHaveBeenCalledWith(
      'real-user',
    );
    expect(app.sessions.replace).toHaveBeenCalledWith(null);
    expect(app.sessions.signOut).not.toHaveBeenCalled();
    expect(app.store.session).toBeNull();
    expect(app.store.projects).toEqual([]);
    expect(app.store.materials).toEqual([]);
  });

  it('resets the demo workspace without calling the account API', async () => {
    const app = await harness({
      initialSession: demoSession(),
      loadSnapshot: async () => createMockSnapshot(),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      await app.store.deleteAccount();
    });

    expect(app.sessions.authorize).not.toHaveBeenCalled();
    expect(app.client.deleteAccount).not.toHaveBeenCalled();
    expect(app.storage.clearSnapshot).toHaveBeenCalledWith(
      'premind-development-user',
    );
    expect(app.recordingRepository.clearWorkspace).toHaveBeenCalledWith(
      'premind-development-user',
    );
    expect(app.sessions.replace).toHaveBeenCalledWith(null);
    expect(app.store.authStatus).toBe('signed-out');
  });

  it('keeps the account signed in when the server rejects deletion', async () => {
    const deleteAccount = jest.fn(async () => {
      throw new ApiError('탈퇴 요청을 처리하지 못했어요.', { status: 503 });
    });
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => snapshot('project-owned'),
      client: { deleteAccount },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await expect(
      act(async () => {
        await app.store.deleteAccount();
      }),
    ).rejects.toThrow('탈퇴 요청을 처리하지 못했어요.');

    expect(app.store.session?.user.id).toBe('real-user');
    expect(app.store.activeProjectId).toBe('project-owned');
    expect(app.storage.clearSnapshot).not.toHaveBeenCalled();
    expect(app.recordingRepository.clearWorkspace).not.toHaveBeenCalled();
    expect(app.sessions.replace).not.toHaveBeenCalled();
  });
});

describe('AppStore upload policy', () => {
  const source: StudyMaterial = {
    id: 'material-1',
    projectId: 'project-1',
    title: '강의',
    source: {
      uri: 'file:///lecture.m4a',
      fileName: 'lecture.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
    },
    status: 'imported',
    progress: 0,
    progressLabel: '기기 저장',
    syncStatus: 'local-only',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    transcript: [],
    quiz: [],
    markers: [],
  };

  it('no longer blocks an upload on cellular: the warning moved to the picker', async () => {
    const processOnServer = jest.fn(async () => source);
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(source),
      materialService: {
        canUseServer: jest.fn(() => true),
        processOnServer,
      },
    });
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      type: 'cellular',
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    // The store used to refuse this when a switch in MY said Wi-Fi only. The
    // decision now belongs to the file picker, which asks at the moment of
    // the upload with the file's size in hand, so the store just uploads.
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    await app.store.processMaterial(source.id);
    expect(processOnServer).toHaveBeenCalled();
  });

  it('still refuses to send bytes without a real account', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(source),
      materialService: {
        canUseServer: jest.fn(() => false),
        processOnServer: jest.fn(async () => source),
      },
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    await expect(app.store.syncMaterial(source.id)).rejects.toThrow(
      'PREMIND 계정으로 로그인해 주세요',
    );
  });
});

describe('AppStore study-pack notifications', () => {
  function pending(): StudyMaterial {
    return {
      id: 'material-1',
      projectId: 'project-1',
      title: '강의',
      source: {
        uri: 'file:///lecture.m4a',
        fileName: 'lecture.m4a',
        mimeType: 'audio/mp4',
        kind: 'audio',
        origin: 'recording',
      },
      status: 'imported',
      progress: 0,
      progressLabel: '기기 저장',
      syncStatus: 'local-only',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      transcript: [],
      quiz: [],
      markers: [],
    };
  }

  async function processOnce(permission: {
    asked: boolean;
    granted: boolean;
  }) {
    jest
      .mocked(ensureStudyNotificationPermission)
      .mockResolvedValue(permission);
    const source = pending();
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(source),
      materialService: {
        canUseServer: jest.fn(() => false),
        processLocalMaterial: jest.fn(async () => ({
          ...source,
          status: 'ready' as const,
        })),
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    await act(async () => {
      await app.store.processMaterial(source.id);
    });
    return app;
  }

  afterEach(() => {
    jest
      .mocked(ensureStudyNotificationPermission)
      .mockResolvedValue({ asked: false, granted: false });
  });

  // Android 13+ never shows a notification to an app that has not asked, so
  // making a 마인드팩 is where the app asks.
  it('asks for permission as soon as a 마인드팩 starts being made', async () => {
    await processOnce({ asked: false, granted: false });
    expect(ensureStudyNotificationPermission).toHaveBeenCalled();
  });

  it('turns the switch on when the learner says yes to the system dialog', async () => {
    const app = await processOnce({ asked: true, granted: true });
    await waitFor(() =>
      expect(app.store.settings.notificationsEnabled).toBe(true),
    );
  });

  it('leaves a switch the learner turned off alone', async () => {
    // Permission already decided, so no dialog was shown: the off switch is
    // the learner's own answer and stays that way.
    const app = await processOnce({ asked: false, granted: true });
    expect(app.store.settings.notificationsEnabled).toBe(false);
  });
});

describe('AppStore local share preview', () => {
  it('updates the visible content without inventing a published link', async () => {
    const app = await harness({
      initialSession: session('teacher-user'),
      loadSnapshot: async () => createMockSnapshot(),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    const room = app.store.shareRooms.find((candidate) => candidate.status === 'active');
    expect(room?.distribution).toBe('local-preview');

    await act(async () => {
      app.store.updateShareRoomContent(room!.id, { transcript: true });
      await Promise.resolve();
    });

    expect(
      app.store.shareRooms.find((candidate) => candidate.id === room!.id)?.content
        .transcript,
    ).toBe(true);
    expect(app.store.shareRooms.find((candidate) => candidate.id === room!.id)?.url)
      .toBe(room?.url);

    await act(async () => {
      app.store.updateShareRoomContent(room!.id, {
        audio: false,
        keyPoints: false,
        quiz: false,
        summary: false,
      });
      await Promise.resolve();
    });
    expect(() =>
      app.store.updateShareRoomContent(room!.id, { transcript: false }),
    ).toThrow('하나 이상 선택');
    expect(
      app.store.shareRooms.find((candidate) => candidate.id === room!.id)?.content
        .transcript,
    ).toBe(true);
  });
});

describe('AppStore material lifecycle', () => {
  function ownedMaterial(overrides: Partial<StudyMaterial> = {}): StudyMaterial {
    return {
      id: 'material-owned',
      projectId: 'project-owned',
      title: '내 강의',
      source: {
        uri: 'premind-web-media:owned-source',
        fileName: 'owned.webm',
        mimeType: 'audio/webm',
        kind: 'audio',
        origin: 'recording',
      },
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      syncStatus: 'synced',
      serverRecordingId: 'recording-1',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      transcript: [],
      quiz: [],
      markers: [],
      ...overrides,
    };
  }

  it('renames a material and persists the new title', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(ownedMaterial()),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      await app.store.renameMaterial('material-owned', '  2주차 강의  ');
    });

    expect(app.store.materials[0]?.title).toBe('2주차 강의');
    expect(app.storage.saveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        materials: [expect.objectContaining({ title: '2주차 강의' })],
      }),
      'real-user',
    );
    await expect(app.store.renameMaterial('material-owned', '   ')).rejects.toThrow(
      '제목을 입력해 주세요.',
    );
  });

  it('deletes a material locally, on the server, and its owned file', async () => {
    const deleteServerRecording = jest.fn(async () => undefined);
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(ownedMaterial()),
      materialService: {
        canUseServer: jest.fn(() => true),
        deleteServerRecording,
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      await app.store.deleteMaterial('material-owned');
    });

    expect(app.store.materials).toEqual([]);
    expect(app.store.projects[0]?.materialIds).toEqual([]);
    expect(deleteServerRecording).toHaveBeenCalledWith('recording-1');
    expect(app.deleteLocalSources).toHaveBeenCalledWith([
      'premind-web-media:owned-source',
    ]);
    expect(app.storage.saveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ materials: [] }),
      'real-user',
    );
  });

  it('never touches local files for a YouTube link material', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () =>
        materialSnapshot(
          ownedMaterial({
            source: {
              uri: 'https://www.youtube.com/watch?v=kvAa-76IWHc',
              fileName: 'kvAa-76IWHc.youtube',
              mimeType: 'video/youtube',
              kind: 'video',
              origin: 'link',
              youtubeId: 'kvAa-76IWHc',
            },
          }),
        ),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      await app.store.deleteMaterial('material-owned');
    });

    expect(app.store.materials).toEqual([]);
    expect(app.deleteLocalSources).not.toHaveBeenCalled();
  });

  it('marks a material as evaluating while the Lens report is rebuilt', async () => {
    type Report = NonNullable<StudyMaterial['lensReport']>;
    type Evaluation = Awaited<ReturnType<StudyMaterialService['requestLens']>>;
    let resolveReport: (evaluation: Evaluation) => void = () => undefined;
    const requestLens = jest.fn(
      () =>
        new Promise<Evaluation>((resolve) => {
          resolveReport = resolve;
        }),
    );
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(ownedMaterial()),
      materialService: { canUseServer: jest.fn(() => true), requestLens },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    let pending: Promise<StudyMaterial> | undefined;
    await act(async () => {
      pending = app.store.requestLens('material-owned');
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(app.store.evaluatingMaterialIds).toEqual(['material-owned']),
    );
    await expect(app.store.requestLens('material-owned')).rejects.toThrow(
      '이미 평가를 만들고 있어요.',
    );

    const report: Report = {
      overall: 4.2,
      rubric: [],
      strengths: [],
      improvements: [],
      priority: null,
    };
    const history = [
      { id: 'lens-2', evaluatedAt: '2026-09-07T05:02:00.000Z', report },
      {
        id: 'lens-1',
        evaluatedAt: '2026-09-01T09:00:00.000Z',
        report: { ...report, overall: 3.4 },
      },
    ];
    await act(async () => {
      resolveReport({
        report,
        evaluatedAt: '2026-09-07T05:02:00.000Z',
        count: 2,
        history,
      });
      await pending;
    });

    expect(app.store.evaluatingMaterialIds).toEqual([]);
    expect(app.store.materials[0]).toMatchObject({
      lensReport: report,
      lensEvaluatedAt: '2026-09-07T05:02:00.000Z',
      lensCount: 2,
      lensHistory: history,
    });
    await expect(pending).resolves.toMatchObject({ lensCount: 2, lensHistory: history });
  });

  it('loads the Lens history into the material', async () => {
    type Report = NonNullable<StudyMaterial['lensReport']>;
    const report: Report = {
      overall: 3.9,
      rubric: [],
      strengths: [],
      improvements: [],
      priority: null,
    };
    const history = [
      { id: 'lens-2', evaluatedAt: '2026-09-07T05:02:00.000Z', report },
      { id: 'lens-1', evaluatedAt: '2026-09-01T09:00:00.000Z', report },
    ];
    const loadLensHistory = jest.fn(async () => history);
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () =>
        materialSnapshot(ownedMaterial({ lensReport: report, lensCount: 1 })),
      materialService: { canUseServer: jest.fn(() => true), loadLensHistory },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = app.store.loadLensHistory('material-owned');
      await Promise.resolve();
    });
    await act(async () => {
      await pending;
    });

    expect(loadLensHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'material-owned' }),
    );
    expect(app.store.materials[0]).toMatchObject({
      lensHistory: history,
      lensCount: 2,
      lensEvaluatedAt: '2026-09-07T05:02:00.000Z',
    });
    await expect(app.store.loadLensHistory('missing')).rejects.toThrow(
      '자료를 찾을 수 없어요.',
    );
  });

  it('surfaces the demo refusal from the service without changing state', async () => {
    const app = await harness({
      initialSession: demoSession(),
      loadSnapshot: async () => materialSnapshot(ownedMaterial()),
      materialService: {
        canUseServer: jest.fn(() => false),
        requestLens: jest.fn(async () => {
          throw new Error('데모 계정에서는 예시 리포트만 볼 수 있어요.');
        }),
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await expect(app.store.requestLens('material-owned')).rejects.toThrow('데모 계정');
    expect(app.store.evaluatingMaterialIds).toEqual([]);
  });

  it('adds a YouTube material and starts polling it', async () => {
    const linked = ownedMaterial({
      id: 'material-link',
      status: 'transcribing',
      progress: 0.55,
      progressLabel: '유튜브 영상을 읽고 대본을 만들고 있어요',
      source: {
        uri: 'https://www.youtube.com/watch?v=kvAa-76IWHc',
        fileName: 'kvAa-76IWHc.youtube',
        mimeType: 'video/youtube',
        kind: 'video',
        origin: 'link',
        youtubeId: 'kvAa-76IWHc',
      },
      serverRecordingId: 'recording-yt',
    });
    const processOnServer = jest.fn(async () => ({ ...linked, status: 'ready' as const }));
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => snapshot('project-owned'),
      materialService: {
        canUseServer: jest.fn(() => true),
        importYouTubeMaterial: jest.fn(async () => linked),
        processOnServer,
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    let created: StudyMaterial | undefined;
    await act(async () => {
      created = await app.store.importYouTubeMaterial({
        projectId: 'project-owned',
        url: 'https://youtu.be/kvAa-76IWHc',
      });
    });

    expect(created?.id).toBe('material-link');
    expect(app.store.materials.map((material) => material.id)).toEqual(['material-link']);
    await waitFor(() => expect(processOnServer).toHaveBeenCalled());
    await waitFor(() => expect(app.store.materials[0]?.status).toBe('ready'));
  });
});

describe('AppStore server pull', () => {
  it('adds server recordings this device has never seen and fills them in', async () => {
    const listServerRecordings = jest.fn(async () => [
      {
        id: 'recording-remote',
        title: '다른 기기에서 올린 강의',
        durationMs: 120_000,
        status: 'ready' as const,
        byteSize: 1024,
        createdAt: '2026-09-04T00:00:00.000Z',
        youtubeId: null,
      },
      {
        id: 'recording-known',
        title: '이미 있는 강의',
        durationMs: 60_000,
        status: 'ready' as const,
        byteSize: 512,
        createdAt: '2026-09-03T00:00:00.000Z',
        youtubeId: null,
      },
    ]);
    const known: StudyMaterial = {
      id: 'material-known',
      projectId: 'project-owned',
      title: '이미 있는 강의',
      source: {
        uri: 'file:///documents/known.m4a',
        fileName: 'known.m4a',
        mimeType: 'audio/mp4',
        kind: 'audio',
        origin: 'recording',
      },
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      syncStatus: 'synced',
      serverRecordingId: 'recording-known',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
      transcript: [],
      quiz: [],
      markers: [],
    };
    const realService = new (jest.requireActual('../services/study-material-service') as {
      StudyMaterialService: new () => StudyMaterialService;
    }).StudyMaterialService();
    const processOnServer = jest.fn(async (material: StudyMaterial) => ({
      ...material,
      status: 'ready' as const,
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
    }));
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(known),
      materialService: {
        canUseServer: jest.fn(() => true),
        listServerRecordings,
        createRemoteMaterial: realService.createRemoteMaterial.bind(realService),
        processOnServer,
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await waitFor(() => expect(app.store.materials).toHaveLength(2));
    const pulled = app.store.materials.find(
      (material) => material.serverRecordingId === 'recording-remote',
    );
    expect(pulled?.title).toBe('다른 기기에서 올린 강의');
    expect(pulled?.source.uri).toBe('');
    expect(pulled?.syncStatus).toBe('synced');
    await waitFor(() => expect(pulled && app.store.materials.find((m) => m.id === pulled.id)?.status).toBe('ready'));
    expect(processOnServer).toHaveBeenCalledTimes(1);
    expect(listServerRecordings).toHaveBeenCalledTimes(1);
  });
});

describe('AppStore study notes', () => {
  function notedMaterial(id = 'material-noted'): StudyMaterial {
    return {
      id,
      projectId: 'project-owned',
      title: '노트 테스트',
      source: {
        uri: `premind-web-media:${id}`,
        fileName: `${id}.webm`,
        mimeType: 'audio/webm',
        kind: 'audio',
        origin: 'recording',
      },
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      syncStatus: 'synced',
      serverRecordingId: `recording-${id}`,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
      transcript: [],
      quiz: [],
      markers: [],
    };
  }

  it('hydrates with no notebooks when the snapshot predates them', async () => {
    const legacy = materialSnapshot(notedMaterial());
    delete legacy.studyNotes;
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => legacy,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.studyNotes).toEqual({});
  });

  it('restores well-formed notebooks and drops damaged entries', async () => {
    const stored = {
      ...materialSnapshot(notedMaterial()),
      studyNotes: {
        'material-noted': {
          checkedPoints: ['핵심 1'],
          reviewConcepts: ['c-1'],
          highlights: ['정답이 있는 데이터를 써요.'],
          memo: '[12:34] 다시 듣기',
          updatedAt: '2026-09-06T01:00:00.000Z',
        },
        'material-broken': 'not a notebook',
      },
    } as unknown as PersistedAppSnapshot;
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => stored,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.studyNotes).toEqual({
      'material-noted': {
        checkedPoints: ['핵심 1'],
        reviewConcepts: ['c-1'],
        highlights: ['정답이 있는 데이터를 써요.'],
        memo: '[12:34] 다시 듣기',
        updatedAt: '2026-09-06T01:00:00.000Z',
      },
    });
  });

  it('creates a notebook on first write, merges later patches, and persists it', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(notedMaterial()),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      app.store.updateStudyNote('material-noted', { checkedPoints: ['핵심 1'] });
      await Promise.resolve();
    });
    expect(app.store.studyNotes['material-noted']).toMatchObject({
      checkedPoints: ['핵심 1'],
      reviewConcepts: [],
      highlights: [],
      memo: '',
    });
    const firstStamp = app.store.studyNotes['material-noted']?.updatedAt;
    expect(typeof firstStamp).toBe('string');

    await act(async () => {
      app.store.updateStudyNote('material-noted', { memo: '[12:34] 여기 다시' });
      await Promise.resolve();
    });
    expect(app.store.studyNotes['material-noted']).toMatchObject({
      checkedPoints: ['핵심 1'],
      reviewConcepts: [],
      memo: '[12:34] 여기 다시',
    });
    expect(app.storage.saveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        studyNotes: {
          'material-noted': expect.objectContaining({ memo: '[12:34] 여기 다시' }),
        },
      }),
      'real-user',
    );
  });

  it('gives a notebook written before the 형광펜 an empty stroke list', async () => {
    const stored = {
      ...materialSnapshot(notedMaterial()),
      studyNotes: {
        'material-noted': {
          checkedPoints: ['핵심 1'],
          reviewConcepts: [],
          memo: '',
          updatedAt: '2026-09-06T01:00:00.000Z',
        },
      },
    } as unknown as PersistedAppSnapshot;
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => stored,
    });

    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.studyNotes['material-noted']?.highlights).toEqual([]);
  });

  it('keeps 형광펜 strokes next to the checked points and persists them', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(notedMaterial()),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      app.store.updateStudyNote('material-noted', { checkedPoints: ['핵심 1'] });
      await Promise.resolve();
    });
    await act(async () => {
      app.store.updateStudyNote('material-noted', {
        highlights: ['분류는 범주를 예측해요.'],
      });
      await Promise.resolve();
    });

    expect(app.store.studyNotes['material-noted']).toMatchObject({
      checkedPoints: ['핵심 1'],
      highlights: ['분류는 범주를 예측해요.'],
    });

    await act(async () => {
      app.store.updateStudyNote('material-noted', {
        highlights: ['분류는 범주를 예측해요.', '회귀는 수치를 예측해요.'],
      });
      await Promise.resolve();
    });

    expect(app.store.studyNotes['material-noted']?.highlights).toEqual([
      '분류는 범주를 예측해요.',
      '회귀는 수치를 예측해요.',
    ]);
    expect(app.storage.saveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        studyNotes: {
          'material-noted': expect.objectContaining({
            checkedPoints: ['핵심 1'],
            highlights: ['분류는 범주를 예측해요.', '회귀는 수치를 예측해요.'],
          }),
        },
      }),
      'real-user',
    );
  });

  it('ignores a write for a material that is not in the library', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(notedMaterial()),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await act(async () => {
      app.store.updateStudyNote('material-missing', { memo: '어디에도 없는 자료' });
      await Promise.resolve();
    });
    expect(app.store.studyNotes).toEqual({});
  });

  it('forgets the notebook when its material is deleted', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => ({
        ...materialSnapshot(notedMaterial()),
        studyNotes: {
          'material-noted': {
            checkedPoints: ['핵심 1'],
            reviewConcepts: [],
            highlights: [],
            memo: '메모',
            updatedAt: '2026-09-06T01:00:00.000Z',
          },
        },
      }),
      materialService: {
        canUseServer: jest.fn(() => true),
        deleteServerRecording: jest.fn(async () => undefined),
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    expect(app.store.studyNotes['material-noted']?.memo).toBe('메모');

    await act(async () => {
      await app.store.deleteMaterial('material-noted');
    });
    expect(app.store.materials).toEqual([]);
    expect(app.store.studyNotes).toEqual({});
    expect(app.storage.saveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ studyNotes: {} }),
      'real-user',
    );
  });
});

describe('AppStore moveMaterial', () => {
  const moving: StudyMaterial = {
    id: 'material-move-1',
    projectId: 'project-owned',
    title: '옮길 자료',
    source: {
      uri: 'file:///move.m4a',
      fileName: 'move.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
    },
    status: 'ready',
    progress: 1,
    progressLabel: '',
    syncStatus: 'synced',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    transcript: [],
    quiz: [],
    markers: [],
  };

  /** One material in 'project-owned', plus an empty second folder to move to. */
  function twoFolders(): PersistedAppSnapshot {
    const base = materialSnapshot(moving);
    const [first] = base.projects;
    if (!first) throw new Error('fixture needs a folder');
    return {
      ...base,
      projects: [first, { ...first, id: 'project-other', title: '다른 폴더', materialIds: [] }],
    };
  }

  it('moves the material and corrects both folders at once', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => twoFolders(),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    const material = app.store.materials[0];
    expect(material).toBeDefined();
    if (!material) return;
    const from = material.projectId;
    const to = app.store.projects.find((project) => project.id !== from);
    expect(to).toBeDefined();
    if (!to) return;

    await app.store.moveMaterial(material.id, to.id);

    await waitFor(() =>
      expect(
        app.store.materials.find((item) => item.id === material.id)?.projectId,
      ).toBe(to.id),
    );
    // The folder's own membership list is what a folder row counts, so a move
    // that fixed only one end would make two counts wrong at once.
    expect(
      app.store.projects.find((p) => p.id === to.id)?.materialIds,
    ).toContain(material.id);
    expect(
      app.store.projects.find((p) => p.id === from)?.materialIds,
    ).not.toContain(material.id);
  });

  it('refuses a folder that does not exist', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => twoFolders(),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    const material = app.store.materials[0];
    expect(material).toBeDefined();
    if (!material) return;
    await expect(
      app.store.moveMaterial(material.id, 'no-such-folder'),
    ).rejects.toThrow('폴더를 찾을 수 없어요.');
    expect(
      app.store.materials.find((item) => item.id === material.id)?.projectId,
    ).toBe(material.projectId);
  });

  it('moving a material to the folder it is already in changes nothing', async () => {
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => twoFolders(),
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));
    const material = app.store.materials[0];
    expect(material).toBeDefined();
    if (!material) return;
    const before = app.store.materials.map((item) => item.updatedAt);
    await app.store.moveMaterial(material.id, material.projectId);
    expect(app.store.materials.map((item) => item.updatedAt)).toEqual(before);
  });
});

describe('AppStore refreshFromServer recovery', () => {
  /** A material this device uploaded, whose result it never collected. */
  const stranded: StudyMaterial = {
    id: 'material-stranded',
    projectId: 'project-owned',
    title: '2주차 이론영상',
    source: {
      uri: 'file:///lecture.mp4',
      fileName: 'lecture.mp4',
      mimeType: 'video/mp4',
      kind: 'video',
      origin: 'import',
    },
    status: 'transcribing',
    progress: 0.4,
    progressLabel: '대본 만드는 중',
    syncStatus: 'synced',
    serverRecordingId: 'recording-9',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    transcript: [],
    quiz: [],
    markers: [],
  };

  it('goes back for a material the server finished while the app was dead', async () => {
    const processOnServer = jest.fn(async () => ({
      ...stranded,
      status: 'ready' as const,
      note: {
        summary: '요약이에요.',
        keyPoints: [],
        concepts: [],
        estimatedReviewMinutes: 5,
        teacherVerified: false,
        updatedAt: '2026-09-08T01:00:00.000Z',
      },
    }));
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(stranded),
      materialService: {
        canUseServer: jest.fn(() => true),
        listServerRecordings: jest.fn(async () => []),
        processOnServer,
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await app.store.refreshFromServer();

    // The list held nothing new, and the old code returned before ever looking
    // at what it already had.
    await waitFor(() => expect(processOnServer).toHaveBeenCalled());
  });

  it('leaves a finished material alone rather than re-polling it', async () => {
    const ready: StudyMaterial = {
      ...stranded,
      status: 'ready',
      note: {
        summary: '이미 있어요.',
        keyPoints: [],
        concepts: [],
        estimatedReviewMinutes: 5,
        teacherVerified: false,
        updatedAt: '2026-09-08T01:00:00.000Z',
      },
    };
    const processOnServer = jest.fn(async () => ready);
    const app = await harness({
      initialSession: session('real-user'),
      loadSnapshot: async () => materialSnapshot(ready),
      materialService: {
        canUseServer: jest.fn(() => true),
        listServerRecordings: jest.fn(async () => []),
        processOnServer,
      },
    });
    await waitFor(() => expect(app.store.isHydrated).toBe(true));

    await app.store.refreshFromServer();
    expect(processOnServer).not.toHaveBeenCalled();
  });
});
