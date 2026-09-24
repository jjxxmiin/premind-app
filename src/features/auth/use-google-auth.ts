import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useCallback } from 'react';

export function isGoogleSignInSupported(): boolean { return true; }

// Web retains its browser flow; Metro selects .native.ts on Android/iOS.
export function useGoogleAuthentication(ids: { web?: string }): () => Promise<string | null> {
  const [, , promptAsync] = Google.useAuthRequest({
    webClientId: ids.web, clientId: ids.web,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
  });
  return useCallback(async () => {
    const result = await promptAsync();
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success') throw new Error('구글 로그인을 완료하지 못했어요.');
    const token = result.params.id_token ?? result.authentication?.idToken;
    if (!token) throw new Error('구글 로그인 정보를 받지 못했어요.');
    return token;
  }, [promptAsync]);
}
