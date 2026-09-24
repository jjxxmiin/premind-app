import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';

import { useGoogleAuthentication, isGoogleSignInSupported } from './use-google-auth';
import { parseKakaoCallback, KAKAO_APP_REDIRECT } from './kakao-callback';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { apiClient, type AuthProvider } from '@/services/api/client';
import { useAppStore } from '@/state/app-store';

WebBrowser.maybeCompleteAuthSession();

/**
 * Keys live in the build, never in the source.
 *
 * Google issues one client id per platform and a token is only valid for the
 * one that produced it, which is why there are three. Kakao's REST key is the
 * client id for its OAuth flow.
 */
const googleClientIds = {
  web: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB?.trim() || undefined,
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS?.trim() || undefined,
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID?.trim() || undefined,
};
const kakaoRestKey = process.env.EXPO_PUBLIC_KAKAO_REST_KEY?.trim() || undefined;
// Kakao remains opt-in until the published terms/privacy notice explicitly
// covers Kakao account creation and its requested profile fields.
const kakaoLegalNoticeEnabled =
  process.env.EXPO_PUBLIC_ENABLE_KAKAO_AUTH === 'true';

/**
 * Google needs the client id for the platform actually running, not any of
 * them: `useAuthRequest` throws outright when the one it needs is missing,
 * which is why this is checked before that hook is ever reached.
 */
const googleClientIdForPlatform = Platform.select({
  ios: googleClientIds.ios,
  android: googleClientIds.android,
  default: googleClientIds.web,
});

/** Providers this build carries a usable key for. A build constant. */
export const localProviders: AuthProvider[] = [
  ...(googleClientIdForPlatform && googleClientIds.web && isGoogleSignInSupported()
    ? (['google'] as const) : []),
  ...(Platform.OS !== 'web' && kakaoRestKey && kakaoLegalNoticeEnabled
    ? (['kakao'] as const) : []),
];

export class SocialSignInCancelled extends Error {
  constructor() {
    super('로그인을 취소했어요.');
    this.name = 'SocialSignInCancelled';
  }
}

/**
 * Providers that can actually complete a sign-in: this build has the key and
 * the server it talks to has one too. Both halves have to exist, so a build
 * shipped with a key its server does not honour still shows no button.
 */
export function useAvailableProviders(): AuthProvider[] {
  const [serverProviders, setServerProviders] = useState<AuthProvider[] | null>(null);

  useEffect(() => {
    if (localProviders.length === 0) {
      return;
    }
    let cancelled = false;
    apiClient
      .getAuthProviders()
      .then((providers) => {
        if (!cancelled) {
          setServerProviders(providers);
        }
      })
      // A server that cannot be asked is treated as offering nothing, so a
      // button never appears that would fail the moment it is pressed.
      .catch(() => {
        if (!cancelled) {
          setServerProviders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (localProviders.length === 0) {
    return localProviders;
  }
  return (serverProviders ?? []).filter((provider) =>
    localProviders.includes(provider),
  );
}

/** Google returns an ID token whose audience is the configured WEB client ID. */
export function useGoogleSignIn(): () => Promise<void> {
  const { signInWithProvider } = useAppStore();
  const authenticate = useGoogleAuthentication(googleClientIds);
  return useCallback(async () => {
    const token = await authenticate();
    if (!token) throw new SocialSignInCancelled();
    await signInWithProvider('google', token);
  }, [authenticate, signInWithProvider]);
}

/** The secret and token exchange stay on the server; only a PKCE code returns. */
export function useKakaoSignIn(): () => Promise<void> {
  const { signInWithProvider } = useAppStore();
  return useCallback(async () => {
    const request = new AuthSession.AuthRequest({
      clientId: kakaoRestKey ?? '',
      redirectUri: KAKAO_APP_REDIRECT,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });
    // AuthRequest generates a cryptographically random verifier and S256 challenge.
    await request.makeAuthUrlAsync({
      authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
    });
    if (!request.codeVerifier) throw new Error('로그인을 준비하지 못했어요.');
    const challenge = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256, request.codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    );
    const start = await apiClient.startKakaoSignIn(
      challenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    );
    const result = await WebBrowser.openAuthSessionAsync(
      start.authorizationUrl, KAKAO_APP_REDIRECT,
    );
    if (result.type !== 'success') throw new SocialSignInCancelled();
    const callback = parseKakaoCallback(result.url, start.state);
    if (callback.cancelled) throw new SocialSignInCancelled();
    await signInWithProvider('kakao', callback.code, {
      state: start.state, codeVerifier: request.codeVerifier,
    });
  }, [signInWithProvider]);
}
