import { syncStorePurchase } from './sync-subscription';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { baseUrl: 'https://api.premind.test' },
    hasConfiguredApi: () => true,
  };
});

const mockAuthorize = jest.fn(
  (operation: (token: string) => Promise<unknown>) => operation('access-token'),
);

jest.mock('@/services/api/session-manager', () => ({
  isDemoSession: () => false,
  sessionManager: {
    get session() {
      return { user: { id: 'user-1' } };
    },
    authorize: (operation: (token: string) => Promise<unknown>) => mockAuthorize(operation),
  },
}));

function answer(status: number, body: unknown = null): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe('syncStorePurchase', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockAuthorize.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts the RevenueCat app user id with the bearer token', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { plan: 'standard', plan_renews_at: '2026-10-07T00:00:00Z' }),
    );

    const result = await syncStorePurchase('rc-user-9');

    expect(result).toEqual({
      status: 'synced',
      plan: 'standard',
      planRenewsAt: '2026-10-07T00:00:00Z',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.premind.test/api/billing/revenuecat/sync');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ app_user_id: 'rc-user-9' }));
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-token',
    );
  });

  it('reads 202 as "not visible yet", not as a failure', async () => {
    fetchMock.mockResolvedValue(answer(202));
    await expect(syncStorePurchase('rc-user-9')).resolves.toEqual({ status: 'pending' });
  });

  it('defaults a plan it does not recognise to free rather than guessing', async () => {
    fetchMock.mockResolvedValue(answer(200, { plan: 'enterprise' }));
    await expect(syncStorePurchase('rc-user-9')).resolves.toEqual({
      status: 'synced',
      plan: 'free',
      planRenewsAt: null,
    });
  });

  it('never throws when the server errors, so a paid purchase still reads as paid', async () => {
    fetchMock.mockResolvedValue(answer(500, { detail: 'boom' }));
    await expect(syncStorePurchase('rc-user-9')).resolves.toEqual({ status: 'failed' });
  });

  it('never throws when the network is gone', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(syncStorePurchase('rc-user-9')).resolves.toEqual({ status: 'failed' });
  });

  it('does not call the server without a RevenueCat id', async () => {
    await expect(syncStorePurchase(null)).resolves.toEqual({ status: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
