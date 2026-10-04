import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { KAKAO_APP_REDIRECT } from './kakao-callback';

export async function openKakaoAuthSession(
  authorizationUrl: string,
): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  if (Platform.OS !== 'android') {
    return WebBrowser.openAuthSessionAsync(authorizationUrl, KAKAO_APP_REDIRECT);
  }

  let subscription: ReturnType<typeof Linking.addEventListener> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const callback = new Promise<WebBrowser.WebBrowserAuthSessionResult>((resolve) => {
    subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(`${KAKAO_APP_REDIRECT}?`)) resolve({ type: 'success', url });
    });
  });
  try {
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, KAKAO_APP_REDIRECT);
    if (result.type !== 'dismiss') return result;
    // Android can deliver AppState.active before its URL event. Expo removes
    // its listener on dismiss; keep ours briefly so that return is not lost.
    return await Promise.race([
      callback,
      new Promise<WebBrowser.WebBrowserAuthSessionResult>((resolve) => {
        timeout = setTimeout(() => resolve(result), 1500);
      }),
    ]);
  } finally {
    subscription?.remove();
    if (timeout) clearTimeout(timeout);
  }
}
