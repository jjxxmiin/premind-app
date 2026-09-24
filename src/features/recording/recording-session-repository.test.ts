import {
  RecordingSessionRepository,
  type RecordingSessionSnapshot,
} from './recording-session-repository';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

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

function snapshot(
  id: string,
  status: RecordingSessionSnapshot['status'] = 'recording',
  uploadStatus: RecordingSessionSnapshot['uploadStatus'] = 'pending',
): RecordingSessionSnapshot {
  return {
    schemaVersion: 1,
    id,
    projectId: 'project-ai-intro',
    title: `녹음 ${id}`,
    startedAt: '2026-09-02T00:00:00.000Z',
    endedAt: status === 'recording' ? null : '2026-09-02T00:10:00.000Z',
    localFileUri: `file:///documents/${id}.m4a`,
    durationMillis: 600_000,
    status,
    uploadStatus,
    markers: [],
    updatedAt: '2026-09-02T00:10:00.000Z',
  };
}

describe('RecordingSessionRepository metadata', () => {
  it('upserts snapshots and returns defensive copies', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage);
    await repository.save(snapshot('one'));
    await repository.save({ ...snapshot('one'), durationMillis: 42_000 });

    const loaded = await repository.get('one');
    const loadedAgain = await repository.get('one');
    expect(loaded?.durationMillis).toBe(42_000);
    expect(loaded).not.toBe(loadedAgain);
    expect(loaded?.markers).not.toBe(loadedAgain?.markers);
  });

  it('returns only sessions that still need recovery or upload handling', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage);
    await repository.save(snapshot('active'));
    await repository.save(snapshot('preserved', 'interrupted'));
    await repository.save(snapshot('done', 'completed', 'completed'));

    await expect(repository.getRecoverable()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'active' }),
        expect.objectContaining({ id: 'preserved' }),
      ]),
    );
    expect((await repository.getRecoverable()).map((item) => item.id)).not.toContain('done');
  });

  it('removes recovery metadata without any file deletion API', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage);
    await repository.save(snapshot('keep-file', 'interrupted'));
    await repository.remove('keep-file');

    await expect(repository.get('keep-file')).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });
});

describe('RecordingSessionRepository workspace isolation', () => {
  it('keeps recovery metadata separate for each account', async () => {
    const storage = memoryStorage();
    const first = new RecordingSessionRepository(storage, 'user/a');
    const second = new RecordingSessionRepository(storage, 'user/b');

    await first.save(snapshot('only-a'));
    await second.save(snapshot('only-b'));

    await expect(first.getAll()).resolves.toEqual([
      expect.objectContaining({ id: 'only-a' }),
    ]);
    await expect(second.getAll()).resolves.toEqual([
      expect.objectContaining({ id: 'only-b' }),
    ]);
    expect([...storage.data.keys()]).toEqual(
      expect.arrayContaining([
        'premind.rn.recording-sessions.v1.workspace.user%2Fa',
        'premind.rn.recording-sessions.v1.workspace.user%2Fb',
      ]),
    );
  });

  it('clears only the deleted account recovery namespace', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage, 'user-a');
    await repository.save(snapshot('only-a'));
    await repository.activateWorkspace('user-b');
    await repository.save(snapshot('only-b'));

    await repository.clearWorkspace('user-a');

    await repository.activateWorkspace('user-a');
    await expect(repository.getAll()).resolves.toEqual([]);
    await repository.activateWorkspace('user-b');
    await expect(repository.getAll()).resolves.toEqual([
      expect.objectContaining({ id: 'only-b' }),
    ]);
  });

  it('migrates unscoped recovery metadata only for a restored workspace', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'premind.rn.recording-sessions.v1',
      JSON.stringify([snapshot('legacy')]),
    );
    const repository = new RecordingSessionRepository(storage);

    await repository.activateWorkspace('restored-user', {
      migrateLegacy: true,
    });

    await expect(repository.getAll()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy' }),
    ]);
    expect(storage.data.has('premind.rn.recording-sessions.v1')).toBe(false);
  });

  it('does not assign ownerless legacy metadata on an ordinary login', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'premind.rn.recording-sessions.v1',
      JSON.stringify([snapshot('owner-unknown')]),
    );
    const repository = new RecordingSessionRepository(storage);

    await repository.activateWorkspace('new-login');

    await expect(repository.getAll()).resolves.toEqual([]);
    expect(storage.data.has('premind.rn.recording-sessions.v1')).toBe(true);
  });

  it('keeps an active persistence handle bound to its starting account', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage, 'user-a');
    let current = snapshot('started-by-a');
    const handle = repository.startSnapshotPersistence(() => current, {
      intervalMillis: 60_000,
    });

    await handle.flush();
    await repository.activateWorkspace('user-b');
    current = snapshot('finished-after-switch', 'interrupted');
    await handle.flush();
    await handle.stop({ flush: false });

    await expect(repository.getAll()).resolves.toEqual([]);
    await repository.activateWorkspace('user-a');
    await expect(repository.getAll()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'started-by-a' }),
        expect.objectContaining({ id: 'finished-after-switch' }),
      ]),
    );
  });

  it('keeps later callbacks for a known recording in its original account', async () => {
    const storage = memoryStorage();
    const repository = new RecordingSessionRepository(storage, 'user-a');
    await repository.save(snapshot('owned-by-a'));

    await repository.activateWorkspace('user-b');
    await repository.save({
      ...snapshot('owned-by-a', 'interrupted'),
      durationMillis: 42_000,
    });

    await expect(repository.getAll()).resolves.toEqual([]);
    await repository.activateWorkspace('user-a');
    await expect(repository.get('owned-by-a')).resolves.toMatchObject({
      durationMillis: 42_000,
      status: 'interrupted',
    });
  });
});
