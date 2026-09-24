import { useCallback } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

type ClientIds = { web?: string; ios?: string; android?: string };
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

// Old builds and Expo Go must remain usable without the newly added module.
export function isGoogleSignInSupported(): boolean {
  return TurboModuleRegistry.get('RNGoogleSignin') !== null;
}

export function useGoogleAuthentication(ids: ClientIds): () => Promise<string | null> {
  return useCallback(async () => {
    if (!isGoogleSignInSupported() || !ids.web) {
      throw new Error('구글 로그인이 지원되는 최신 앱으로 업데이트해 주세요.');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@react-native-google-signin/google-signin') as GoogleModule;
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = sdk;
    GoogleSignin.configure({ webClientId: ids.web, iosClientId: ids.ios });
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return null;
      if (!result.data.idToken) throw new Error('구글 로그인 정보를 받지 못했어요.');
      return result.data.idToken;
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new Error('Google Play 서비스를 업데이트한 뒤 다시 시도해 주세요.');
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          throw new Error('구글 로그인이 진행 중이에요. 잠시 기다려 주세요.');
        }
      }
      throw error;
    }
  }, [ids.web, ids.ios]);
}
