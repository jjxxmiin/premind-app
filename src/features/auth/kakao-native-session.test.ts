import * as WebBrowser from 'expo-web-browser';
import { AppState, DeviceEventEmitter, Linking, Platform } from 'react-native';

import { openKakaoAuthSession } from './kakao-native-session';

jest.mock('expo-web-browser/build/ExpoWebBrowser', () => ({
  __esModule: true,
  default: { openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) },
}));

const appStateListeners = new Set<(state: 'active' | 'background') => void>();
const linkListeners = new Set<(event: { url: string }) => void>();
const originalPlatform = Platform.OS;
const callback = 'premind://oauth/kakao?state=pending&code=one-use';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.add(listener);
    return { remove: () => { appStateListeners.delete(listener); } };
  });
  jest.spyOn(Linking, 'addEventListener').mockImplementation((type, listener) => {
    linkListeners.add(listener);
    const subscription = DeviceEventEmitter.addListener(type, listener);
    const remove = subscription.remove.bind(subscription);
    subscription.remove = () => { linkListeners.delete(listener); remove(); };
    return subscription;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  jest.useRealTimers();
  appStateListeners.clear();
  linkListeners.clear();
});

it('accepts the Android callback when app resume arrives before the deep link', async () => {
  const pending = openKakaoAuthSession('https://kauth.kakao.com/oauth/authorize');
  await Promise.resolve();
  for (const listener of appStateListeners) listener('background');
  for (const listener of appStateListeners) listener('active');
  await jest.advanceTimersByTimeAsync(100);
  for (const listener of linkListeners) listener({ url: callback });
  await expect(pending).resolves.toEqual({ type: 'success', url: callback });
  expect(linkListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('preserves a callback delivered before Android resumes', async () => {
  const pending = openKakaoAuthSession('https://kauth.kakao.com/oauth/authorize');
  await Promise.resolve();
  for (const listener of linkListeners) listener({ url: callback });
  for (const listener of appStateListeners) listener('active');
  await expect(pending).resolves.toEqual({ type: 'success', url: callback });
  expect(linkListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('finishes real browser dismissal after the bounded callback grace period', async () => {
  const pending = openKakaoAuthSession('https://kauth.kakao.com/oauth/authorize');
  await Promise.resolve();
  for (const listener of appStateListeners) listener('active');
  await jest.advanceTimersByTimeAsync(100);
  for (const listener of linkListeners) listener({ url: 'premind://quiz/123' });
  await jest.advanceTimersByTimeAsync(1500);
  await expect(pending).resolves.toEqual({ type: 'dismiss' });
  expect(linkListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('removes the extra listener when opening the native browser fails', async () => {
  jest.spyOn(WebBrowser, 'openAuthSessionAsync').mockRejectedValueOnce(new Error('browser unavailable'));
  await expect(openKakaoAuthSession('https://kauth.kakao.com/oauth/authorize'))
    .rejects.toThrow('browser unavailable');
  expect(linkListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps the iOS native auth session without adding Android recovery listeners', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const open = jest.spyOn(WebBrowser, 'openAuthSessionAsync')
    .mockResolvedValueOnce({ type: 'success', url: callback });
  await expect(openKakaoAuthSession('https://kauth.kakao.com/oauth/authorize'))
    .resolves.toEqual({ type: 'success', url: callback });
  expect(open).toHaveBeenCalledWith('https://kauth.kakao.com/oauth/authorize', 'premind://oauth/kakao');
  expect(Linking.addEventListener).not.toHaveBeenCalled();
});
