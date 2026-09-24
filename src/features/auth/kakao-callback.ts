export const KAKAO_APP_REDIRECT = 'premind://oauth/kakao';

export function parseKakaoCallback(
  callbackUrl: string, expectedState: string,
): { cancelled: true } | { cancelled: false; code: string } {
  const url = new URL(callbackUrl);
  if (url.protocol !== 'premind:' || url.hostname !== 'oauth' || url.pathname !== '/kakao'
    || url.username || url.password || url.port
    || !expectedState || url.searchParams.getAll('state').length !== 1
    || url.searchParams.get('state') !== expectedState) {
    throw new Error('로그인 요청이 일치하지 않아요. 다시 시도해 주세요.');
  }
  const error = url.searchParams.get('error');
  if (error === 'access_denied') return { cancelled: true };
  if (error) throw new Error('카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.');
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.getAll('code').length !== 1) {
    throw new Error('카카오 로그인 정보를 받지 못했어요.');
  }
  return { cancelled: false, code };
}
