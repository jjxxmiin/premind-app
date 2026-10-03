import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SocialSignInButtons } from './SocialSignInButtons';
import { SocialSignInCancelled } from '@/features/auth/use-social-sign-in';
import { setLocale } from '@/lib/i18n';

const mockGoogleSignIn = jest.fn();
const mockKakaoSignIn = jest.fn();
let mockProviders: string[] = ['kakao', 'google'];

jest.mock('@/features/auth/use-social-sign-in', () => ({
  useAvailableProviders: () => mockProviders,
  useGoogleSignIn: () => mockGoogleSignIn,
  useKakaoSignIn: () => mockKakaoSignIn,
  SocialSignInCancelled: class extends Error {},
}));

beforeEach(() => {
  mockProviders = ['kakao', 'google'];
  mockGoogleSignIn.mockReset().mockResolvedValue(undefined);
  mockKakaoSignIn.mockReset().mockResolvedValue(undefined);
});

it('renders both providers with real, accessible text and dispatches each login', async () => {
  const onBusyChange = jest.fn();
  const onError = jest.fn();
  await render(<SocialSignInButtons onBusyChange={onBusyChange} onError={onError} />);
  expect(screen.getByText('카카오 로그인')).toBeTruthy();
  expect(screen.getByText('구글 로그인')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));
  await fireEvent.press(screen.getByRole('button', { name: '구글 로그인' }));
  expect(mockKakaoSignIn).toHaveBeenCalledTimes(1);
  expect(mockGoogleSignIn).toHaveBeenCalledTimes(1);
  expect(onBusyChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  expect(onError).not.toHaveBeenCalled();
});

it('localizes the Kakao label instead of displaying Korean text embedded in an image', async () => {
  setLocale('en');
  await render(<SocialSignInButtons onError={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Login with Kakao' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
});

it('does not allow sign-in while required consent is missing', async () => {
  await render(<SocialSignInButtons disabled onError={jest.fn()} />);
  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
    await fireEvent.press(button);
  }
  expect(mockKakaoSignIn).not.toHaveBeenCalled();
  expect(mockGoogleSignIn).not.toHaveBeenCalled();
});

it('prevents repeated taps while Kakao is signing in and restores the button afterwards', async () => {
  let finish!: () => void;
  mockKakaoSignIn.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<SocialSignInButtons onError={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));
  const busyButton = screen.getByRole('button', { name: '카카오 로그인' });
  expect(busyButton).toBeDisabled();
  expect(screen.getByRole('button', { name: '카카오 로그인', busy: true })).toBeTruthy();
  await fireEvent.press(busyButton);
  expect(mockKakaoSignIn).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole('button', { name: '카카오 로그인' })).toBeEnabled();
});

it('reports errors but treats cancelling the provider flow as a normal exit', async () => {
  const onError = jest.fn();
  mockKakaoSignIn.mockRejectedValueOnce(new SocialSignInCancelled());
  mockGoogleSignIn.mockRejectedValueOnce(new Error('로그인을 다시 시도해 주세요.'));
  await render(<SocialSignInButtons onError={onError} />);
  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));
  expect(onError).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '구글 로그인' }));
  expect(onError).toHaveBeenCalledWith('로그인을 다시 시도해 주세요.');
});

it('still hides providers unavailable in this build', async () => {
  mockProviders = [];
  await render(<SocialSignInButtons onError={jest.fn()} />);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
