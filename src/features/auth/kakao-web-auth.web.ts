import { KAKAO_WEB_CALLBACK_PATH, parseKakaoCallback } from './kakao-callback';

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** The verifier stays in the opener's memory; no tokens are stored in URLs. */
export function authenticateKakaoWeb(
  start: (challenge: string) => Promise<{ authorizationUrl: string; state: string }>,
): Promise<{ code: string; state: string; codeVerifier: string } | null> {
  // Open synchronously within the click, BEFORE crypto/network awaits, so
  // mobile Safari and Chrome do not treat it as an unsolicited popup.
  const popup = window.open('about:blank', '_blank', 'popup,width=480,height=720');
  if (!popup) return Promise.reject(new Error('팝업이 차단됐어요. 팝업을 허용하고 다시 시도해 주세요.'));
  const origin = window.location.origin;
  const redirect = new URL(KAKAO_WEB_CALLBACK_PATH, origin).href;
  return new Promise((resolve, reject) => {
    let settled = false;
    let state = '';
    let codeVerifier = '';
    const finish = (result: { code: string; state: string; codeVerifier: string } | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      popup.close();
      if (error) reject(error); else resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== popup || !state
        || event.data?.type !== 'premind:kakao:callback' || typeof event.data.url !== 'string') return;
      try {
        const callback = parseKakaoCallback(event.data.url, state, redirect);
        finish(callback.cancelled ? null : { code: callback.code, state, codeVerifier });
      } catch (error) {
        finish(null, error instanceof Error ? error : new Error('로그인을 완료하지 못했어요.'));
      }
    };
    window.addEventListener('message', receive);
    const poll = setInterval(() => { if (popup.closed) finish(null); }, 300);
    const timeout = setTimeout(() => finish(null, new Error('로그인 시간이 초과됐어요. 다시 시도해 주세요.')), 600_000);
    void (async () => {
      codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const result = await start(toBase64Url(new Uint8Array(digest)));
      if (settled || popup.closed) return;
      const destination = new URL(result.authorizationUrl);
      if (destination.origin !== 'https://kauth.kakao.com' || destination.pathname !== '/oauth/authorize') {
        throw new Error('로그인 주소를 확인하지 못했어요.');
      }
      state = result.state;
      popup.location.replace(destination.href);
    })().catch((error) => finish(null, error instanceof Error ? error : new Error('로그인을 준비하지 못했어요.')));
  });
}
