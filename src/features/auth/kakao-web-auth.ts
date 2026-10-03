/** Metro selects the browser implementation only for web builds. */
export async function authenticateKakaoWeb(
  _start: (challenge: string) => Promise<{ authorizationUrl: string; state: string }>,
): Promise<{ code: string; state: string; codeVerifier: string } | null> {
  throw new Error('웹에서만 사용할 수 있는 로그인 방식이에요.');
}
