import { renderHook, act } from '@testing-library/react-native';
import { useGoogleAuthentication } from './use-google-auth.native';

import { TurboModuleRegistry } from 'react-native';
beforeAll(() => jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({}));
afterAll(() => jest.restoreAllMocks());
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(), hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
  },
  isSuccessResponse: (value: { type: string }) => value.type === 'success',
  isErrorWithCode: (value: unknown) => Boolean(value && typeof value === 'object' && 'code' in value),
  statusCodes: { SIGN_IN_CANCELLED: 'cancel', PLAY_SERVICES_NOT_AVAILABLE: 'services', IN_PROGRESS: 'progress' },
}));
const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin');
afterEach(() => jest.clearAllMocks());

it('requests a token for the server WEB audience', async () => {
  GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'verified-by-server' } });
  const { result } = await renderHook(() => useGoogleAuthentication({ web: 'web-client', android: 'android-client' }));
  let token;
  await act(async () => { token = await result.current(); });
  expect(token).toBe('verified-by-server');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-client', iosClientId: undefined });
});
it('returns no token when the user cancels', async () => {
  GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled' });
  const { result } = await renderHook(() => useGoogleAuthentication({ web: 'web-client' }));
  await act(async () => { expect(await result.current()).toBeNull(); });
});
it('rejects a successful response without an ID token', async () => {
  GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: {} });
  const { result } = await renderHook(() => useGoogleAuthentication({ web: 'web-client' }));
  await act(async () => { await expect(result.current()).rejects.toThrow('정보를 받지'); });
});
