import { act, renderHook } from '@testing-library/react-native';

import { usePlanStatus } from './use-plan-status';

const mockGetCurrentUser = jest.fn();
let mockUserId = 'buyer';

jest.mock('@/services/api/client', () => ({
  hasConfiguredApi: () => true,
  apiClient: { getCurrentUser: () => mockGetCurrentUser() },
}));
jest.mock('@/services/api/session-manager', () => ({
  isDemoSession: () => false,
  sessionManager: {
    get session() { return { user: { id: mockUserId } }; },
    authorize: (operation: (token: string) => Promise<unknown>) => operation('token'),
  },
}));
jest.mock('@/state/app-store', () => ({
  useAppStore: () => ({ session: { user: { id: mockUserId } } }),
}));

beforeEach(() => {
  mockUserId = 'buyer';
  mockGetCurrentUser.mockReset();
});

it('marks an unavailable plan as unverified instead of confirmed free', async () => {
  mockGetCurrentUser.mockRejectedValue(new TypeError('Network unavailable'));

  const { result } = await renderHook(() => usePlanStatus());

  expect(result.current.error).toBe(true);
  expect(result.current.loading).toBe(false);
});

it('preserves the last verified paid plan when a refresh fails', async () => {
  mockGetCurrentUser.mockResolvedValue({ id: 'buyer', plan: 'standard', plan_renews_at: '2026-11-03' });
  const { result } = await renderHook(() => usePlanStatus());
  mockGetCurrentUser.mockRejectedValue(new TypeError('Network unavailable'));

  await act(async () => result.current.refresh());

  expect(result.current.plan).toBe('standard');
  expect(result.current.error).toBe(true);
});

it('clears the verification error after a successful retry', async () => {
  mockGetCurrentUser.mockRejectedValue(new TypeError('Network unavailable'));
  const { result } = await renderHook(() => usePlanStatus());
  mockGetCurrentUser.mockResolvedValue({ id: 'buyer', plan: 'standard' });

  await act(async () => result.current.refresh());

  expect(result.current.plan).toBe('standard');
  expect(result.current.error).toBe(false);
});

it('ignores an old account refresh that finishes after the new account has loaded', async () => {
  mockGetCurrentUser.mockResolvedValue({ id: 'buyer', plan: 'standard' });
  const view = await renderHook(() => usePlanStatus());
  let resolveOld = (_value: { readonly id: string; readonly plan: string }) => {};
  const oldAnswer = new Promise<{ readonly id: string; readonly plan: string }>((resolve) => {
    resolveOld = resolve;
  });
  mockGetCurrentUser.mockReturnValueOnce(oldAnswer);
  const oldRefresh = view.result.current.refresh();

  mockUserId = 'another-buyer';
  mockGetCurrentUser.mockResolvedValue({ id: 'another-buyer', plan: 'free' });
  await view.rerender({});
  await act(async () => {
    resolveOld({ id: 'buyer', plan: 'standard' });
    await oldRefresh;
  });

  expect(view.result.current.plan).toBe('free');
  expect(view.result.current.loading).toBe(false);
  expect(view.result.current.error).toBe(false);
});

it('ignores an older refresh when a newer answer already arrived', async () => {
  mockGetCurrentUser.mockResolvedValue({ id: 'buyer', plan: 'free' });
  const { result } = await renderHook(() => usePlanStatus());
  let resolveOld = (_value: { readonly id: string; readonly plan: string }) => {};
  mockGetCurrentUser.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const oldRefresh = result.current.refresh();
  mockGetCurrentUser.mockResolvedValue({ id: 'buyer', plan: 'standard' });

  await act(async () => result.current.refresh());
  await act(async () => {
    resolveOld({ id: 'buyer', plan: 'free' });
    await oldRefresh;
  });

  expect(result.current.plan).toBe('standard');
});
