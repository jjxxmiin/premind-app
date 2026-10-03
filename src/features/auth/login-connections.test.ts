import { loginConnections } from './login-connections';
import { apiClient } from '@/services/api/client';
import { sessionManager } from '@/services/api/session-manager';

jest.mock('@/services/api/client', () => ({ apiClient: {
  getLoginConnections: jest.fn(), linkLoginConnection: jest.fn(), addEmailLogin: jest.fn(), unlinkLoginConnection: jest.fn(),
} }));
jest.mock('@/services/api/session-manager', () => ({ sessionManager: {
  session: { user: { id: 'owner' } }, authorize: jest.fn((operation) => operation('existing-session-token')),
} }));

beforeEach(() => jest.clearAllMocks());

it('uses the existing session to link instead of signing in as the social identity', async () => {
  const proof = { state: 'signed', codeVerifier: 'verifier' };
  await loginConnections.link('owner', 'kakao', 'code', proof);
  expect(apiClient.linkLoginConnection).toHaveBeenCalledWith('existing-session-token', 'kakao', 'code', proof);
  expect(sessionManager.session?.user.id).toBe('owner');
});

it('never links a popup result to a different account that signed in meanwhile', async () => {
  expect(() => loginConnections.link('previous-owner', 'google', 'token')).toThrow('계정이 바뀌었어요');
  expect(apiClient.linkLoginConnection).not.toHaveBeenCalled();
});

it('uses authenticated requests for list, email setup and unlink', async () => {
  await loginConnections.list('owner');
  await loginConnections.addEmail('owner', 'newPassword123');
  await loginConnections.unlink('owner', 'google');
  expect(apiClient.getLoginConnections).toHaveBeenCalledWith('existing-session-token');
  expect(apiClient.addEmailLogin).toHaveBeenCalledWith('existing-session-token', 'newPassword123');
  expect(apiClient.unlinkLoginConnection).toHaveBeenCalledWith('existing-session-token', 'google');
});
