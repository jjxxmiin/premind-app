import type { PersistedAppSnapshot } from '../types';

import { AppStorage } from './storage';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

function snapshot(projectId: string): PersistedAppSnapshot {
  return {
    schemaVersion: 1,
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
    materials: [],
    shareRooms: [],
    activeProjectId: projectId,
    savedMaterialIds: [],
    confusionFeedback: [],
    quizAttempts: [],
    settings: {
      mode: 'teacher',
      notificationsEnabled: false,
      recordingQuality: 'high',
    },
  };
}

describe('AppStorage workspace snapshots', () => {
  it('keeps account snapshots under distinct encoded keys', async () => {
    const backend = memoryStorage();
    const storage = new AppStorage(backend);

    await storage.saveSnapshot(snapshot('project-a'), 'user/a');
    await storage.saveSnapshot(snapshot('project-b'), 'user/b');

    await expect(storage.loadSnapshot('user/a')).resolves.toMatchObject({
      activeProjectId: 'project-a',
    });
    await expect(storage.loadSnapshot('user/b')).resolves.toMatchObject({
      activeProjectId: 'project-b',
    });
    expect([...backend.data.keys()]).toEqual(
      expect.arrayContaining([
        'premind.rn.snapshot.v1.workspace.user%2Fa',
        'premind.rn.snapshot.v1.workspace.user%2Fb',
      ]),
    );
  });

  it('claims an unscoped snapshot only when a restored owner opts in', async () => {
    const backend = memoryStorage();
    const storage = new AppStorage(backend);
    await storage.saveSnapshot(snapshot('legacy-project'));

    await expect(
      storage.loadSnapshot('restored-user', { migrateLegacy: true }),
    ).resolves.toMatchObject({ activeProjectId: 'legacy-project' });
    expect(backend.data.has('premind.rn.snapshot.v1')).toBe(false);
    expect(
      backend.data.has('premind.rn.snapshot.v1.workspace.restored-user'),
    ).toBe(true);
  });

  it('leaves ownerless legacy data isolated from a later login', async () => {
    const backend = memoryStorage();
    const storage = new AppStorage(backend);
    await storage.saveSnapshot(snapshot('owner-unknown'));
    await expect(storage.claimLegacyWorkspace(null)).resolves.toBe(false);

    await expect(
      storage.loadSnapshot('new-login', { migrateLegacy: true }),
    ).resolves.toBeNull();
    await expect(storage.loadSnapshot()).resolves.toMatchObject({
      activeProjectId: 'owner-unknown',
    });
  });

  it('keeps the first restored owner claim across later cold starts', async () => {
    const backend = memoryStorage();
    const firstLaunch = new AppStorage(backend);
    const laterLaunch = new AppStorage(backend);

    await expect(
      firstLaunch.claimLegacyWorkspace('restored-a'),
    ).resolves.toBe(true);
    await expect(
      laterLaunch.claimLegacyWorkspace('restored-b'),
    ).resolves.toBe(false);
    await expect(
      laterLaunch.claimLegacyWorkspace('restored-a'),
    ).resolves.toBe(true);
  });
});
