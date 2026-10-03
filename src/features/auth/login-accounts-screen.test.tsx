import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LoginAccountsScreen from '@/app/login-accounts';
import { loginConnections } from './login-connections';
import { SocialSignInCancelled } from './use-social-sign-in';

const mockGoogle = jest.fn();
const mockKakao = jest.fn();
jest.mock('./login-connections', () => ({ loginConnections: { list: jest.fn(), link: jest.fn(), unlink: jest.fn(), addEmail: jest.fn() } }));
jest.mock('./use-social-sign-in', () => ({
  useAvailableProviders: () => ['google', 'kakao'], useGoogleIdentity: () => mockGoogle, useKakaoIdentity: () => mockKakao,
  SocialSignInCancelled: class extends Error {},
}));
jest.mock('@/state/app-store', () => ({ useAppStore: () => ({ session: { accessToken: 'real-session', user: { id: 'owner', email: 'owner@example.test' } } }) }));
jest.mock('@/services/api/session-manager', () => ({ isDemoSession: () => false }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('lucide-react-native', () => ({ ChevronRight: () => null, X: () => null }));
jest.mock('@/components/ui', () => {
  const real = jest.requireActual('@/components/ui');
  const { View: MockView } = jest.requireActual('react-native');
  const { Button: MockButton } = jest.requireActual('@/components/ui/Button');
  const { AppText: MockText } = jest.requireActual('@/components/ui/AppText');
  return { ...real, Screen: ({ children }: { children: ReactNode }) => <MockView>{children}</MockView>,
    Dialog: ({ visible, children, title, confirm, cancel }: { visible: boolean; children: ReactNode; title: string; confirm: { label: string; onPress: () => void; disabled?: boolean }; cancel: { label: string; onPress: () => void } }) => visible ?
      <MockView><MockText>{title}</MockText>{children}<MockButton {...confirm}>{confirm.label}</MockButton><MockButton {...cancel}>{cancel.label}</MockButton></MockView> : null,
  };
});

const emailOnly = [
  { provider: 'email' as const, connected: true, email: 'owner@example.test', canUnlink: false },
  { provider: 'google' as const, connected: false, email: null, canUnlink: false },
  { provider: 'kakao' as const, connected: false, email: null, canUnlink: false },
];
const withGoogle = emailOnly.map((x) => x.provider === 'kakao' ? x : { ...x, connected: true, canUnlink: true });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loginConnections.list).mockResolvedValue(emailOnly);
  jest.mocked(loginConnections.link).mockResolvedValue(withGoogle);
  jest.mocked(loginConnections.unlink).mockResolvedValue(emailOnly);
  mockGoogle.mockReset().mockResolvedValue('google-proof');
  mockKakao.mockReset().mockResolvedValue({ code: 'kakao-code', state: 'state', codeVerifier: 'verifier' });
});

it('shows all methods and disables unlinking the last login method', async () => {
  await render(<LoginAccountsScreen />);
  expect(await screen.findByRole('button', { name: '이메일 연결 해제' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Google 연결하기' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '카카오 연결하기' })).toBeEnabled();
});

it('authenticates Google before explicitly linking to the current account', async () => {
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Google 연결하기' }));
  expect(mockGoogle).toHaveBeenCalledTimes(1);
  expect(loginConnections.link).toHaveBeenCalledWith('owner', 'google', 'google-proof');
  expect(screen.getByRole('button', { name: 'Google 연결 해제' })).toBeEnabled();
});

it('shows conflicts without changing the displayed connection', async () => {
  jest.mocked(loginConnections.link).mockRejectedValueOnce(new Error('다른 회원 계정에 이미 연결된 소셜 계정이에요.'));
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Google 연결하기' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/다른 회원/);
  expect(screen.getByRole('button', { name: 'Google 연결하기' })).toBeEnabled();
});

it('does not link when provider authentication is cancelled', async () => {
  mockKakao.mockRejectedValueOnce(new SocialSignInCancelled());
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: '카카오 연결하기' }));
  expect(loginConnections.link).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('requires confirmation before unlinking and updates last-method protection', async () => {
  jest.mocked(loginConnections.list).mockResolvedValue(withGoogle);
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Google 연결 해제' }));
  expect(loginConnections.unlink).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '연결 해제' }));
  expect(loginConnections.unlink).toHaveBeenCalledWith('owner', 'google');
  expect(screen.getByRole('button', { name: '이메일 연결 해제' })).toBeDisabled();
});

it('prevents repeat authentication while the first popup is pending', async () => {
  let finish!: (token: string) => void;
  mockGoogle.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Google 연결하기' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Google 연결하기' }));
  expect(mockGoogle).toHaveBeenCalledTimes(1);
  await act(async () => finish('google-proof'));
});

it('requires a strong matching password before adding email login', async () => {
  const googleOnly = withGoogle.map((method) => ({ ...method, connected: method.provider === 'google', canUnlink: false }));
  jest.mocked(loginConnections.list).mockResolvedValue(googleOnly);
  jest.mocked(loginConnections.addEmail).mockResolvedValue(withGoogle);
  await render(<LoginAccountsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: '이메일 연결하기' }));
  expect(screen.getByRole('button', { name: '연결하기' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('새 비밀번호'), 'secure1234');
  await fireEvent.changeText(screen.getByLabelText('비밀번호 확인'), 'different1234');
  expect(screen.getByRole('button', { name: '연결하기' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('비밀번호 확인'), 'secure1234');
  await fireEvent.press(screen.getByRole('button', { name: '연결하기' }));
  expect(loginConnections.addEmail).toHaveBeenCalledWith('owner', 'secure1234');
  expect(screen.getByRole('button', { name: '이메일 연결 해제' })).toBeEnabled();
});
