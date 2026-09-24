import type { AccessSession } from '../../types';
import { ApiError, type PremindApiClient } from './client';
import { SessionManager } from './session-manager';

function sessionAt(
  issuedAt: number,
  overrides: Partial<AccessSession> = {},
): AccessSession {
  return {
    accessToken: `access-${issuedAt}`,
    tokenType: 'bearer',
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(issuedAt + 3_600_000).toISOString(),
    refreshToken: `refresh-${issuedAt}`,
    refreshExpiresAt: new Date(issuedAt + 2_592_000_000).toISOString(),
    user: {
      id: 'user-1',
      email: 'teacher@premind.io',
      name: '김프리마인드',
      role: 'member',
      mode: 'teacher',
    },
    ...overrides,
  };
}

function memoryStorage() {
  let stored: AccessSession | null = null;
  return {
    loadSession: jest.fn(async () => stored),
    saveSession: jest.fn(async (session: AccessSession) => {
      stored = session;
    }),
    clearSession: jest.fn(async () => {
      stored = null;
    }),
    seed(session: AccessSession | null) {
      stored = session;
    },
    get current() {
      return stored;
    },
  };
}

type Storage = ReturnType<typeof memoryStorage>;

function managerWith(
  client: Partial<PremindApiClient>,
  storage: Storage = memoryStorage(),
): { manager: SessionManager; storage: Storage } {
  return {
    manager: new SessionManager(
      client as PremindApiClient,
      storage as unknown as ConstructorParameters<typeof SessionManager>[1],
    ),
    storage,
  };
}

const NOW = Date.parse('2026-09-02T00:00:00.000Z');

describe('SessionManager restore', () => {
  it('keeps a session whose access token expired but can still be refreshed', async () => {
    const storage = memoryStorage();
    // Issued long enough ago that the access token is dead and the refresh is not.
    storage.seed(sessionAt(NOW - 2 * 3_600_000));
    const { manager } = managerWith({}, storage);

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await expect(manager.restore()).resolves.not.toBeNull();
    expect(storage.clearSession).not.toHaveBeenCalled();
  });

  it('drops a session whose refresh token has expired too', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW - 40 * 24 * 3_600_000));
    const { manager } = managerWith({}, storage);

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await expect(manager.restore()).resolves.toBeNull();
    expect(storage.clearSession).toHaveBeenCalled();
  });
});

describe('SessionManager token rotation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes an expired session exactly once for concurrent callers', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW - 2 * 3_600_000));
    let resolveRefresh: (session: AccessSession) => void = () => {};
    const refresh = jest.fn(
      () =>
        new Promise<AccessSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { manager } = managerWith({ refresh }, storage);

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    const first = manager.accessToken();
    const second = manager.accessToken();
    resolveRefresh(sessionAt(NOW));

    await expect(first).resolves.toBe(`access-${NOW}`);
    await expect(second).resolves.toBe(`access-${NOW}`);
    // The refresh token is one-time-use: spending it twice would be read as
    // theft and revoke every token the account holds.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(`refresh-${NOW - 2 * 3_600_000}`, 'teacher');
  });

  it('persists the rotated pair and tells subscribers about it', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW - 2 * 3_600_000));
    const { manager } = managerWith(
      { refresh: jest.fn(async () => sessionAt(NOW)) },
      storage,
    );
    const seen: (AccessSession | null)[] = [];

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();
    manager.subscribe((session) => seen.push(session));
    await manager.accessToken();

    expect(storage.current?.accessToken).toBe(`access-${NOW}`);
    expect(seen.at(-1)?.accessToken).toBe(`access-${NOW}`);
  });

  it('signs the user out when the refresh token is rejected', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW - 2 * 3_600_000));
    const { manager } = managerWith(
      {
        refresh: jest.fn(async () => {
          throw new ApiError('invalid_refresh_token', { status: 401 });
        }),
      },
      storage,
    );

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    await expect(manager.accessToken()).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
    expect(manager.session).toBeNull();
    expect(storage.current).toBeNull();
  });

  it('keeps the session when a refresh fails for a reason that is not rejection', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW - 2 * 3_600_000));
    const { manager } = managerWith(
      {
        refresh: jest.fn(async () => {
          throw new ApiError('서버에 연결하지 못했어요.', { code: 'NETWORK' });
        }),
      },
      storage,
    );

    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    await expect(manager.accessToken()).rejects.toMatchObject({ code: 'NETWORK' });
    // Losing the network must not lose the account.
    expect(manager.session).not.toBeNull();
    expect(storage.current).not.toBeNull();
  });
});

describe('SessionManager authorize', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries once with a fresh token when the server rejects a valid-looking one', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW));
    const { manager } = managerWith(
      { refresh: jest.fn(async () => sessionAt(NOW + 1)) },
      storage,
    );
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    const operation = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new ApiError('만료', { status: 401 }))
      .mockResolvedValueOnce('done');

    await expect(manager.authorize(operation)).resolves.toBe('done');
    expect(operation.mock.calls.map(([token]) => token)).toEqual([
      `access-${NOW}`,
      `access-${NOW + 1}`,
    ]);
  });

  it('does not retry a failure that is not an expired token', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW));
    const { manager } = managerWith({}, storage);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    const operation = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValue(new ApiError('용량 초과', { status: 413 }));

    await expect(manager.authorize(operation)).rejects.toMatchObject({ status: 413 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('refuses to reach the server at all in the demo session', async () => {
    const { manager } = managerWith({});
    await manager.startDemo('teacher');

    const operation = jest.fn();
    await expect(manager.authorize(operation)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
    expect(operation).not.toHaveBeenCalled();
  });
});

describe('SessionManager sign-out', () => {
  it('clears the local session even when revoking fails', async () => {
    const storage = memoryStorage();
    storage.seed(sessionAt(NOW));
    const revoke = jest.fn(async () => {
      throw new ApiError('서버에 연결하지 못했어요.', { code: 'NETWORK' });
    });
    const { manager } = managerWith({ revoke }, storage);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await manager.restore();

    await manager.signOut();

    expect(revoke).toHaveBeenCalledWith(`refresh-${NOW}`);
    expect(manager.session).toBeNull();
    expect(storage.current).toBeNull();
    jest.restoreAllMocks();
  });

  it('does not call revoke for a demo session', async () => {
    const revoke = jest.fn();
    const { manager } = managerWith({ revoke });
    await manager.startDemo('student');

    await manager.signOut();

    expect(revoke).not.toHaveBeenCalled();
    expect(manager.session).toBeNull();
  });
});
