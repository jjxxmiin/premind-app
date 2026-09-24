// AuthSession consumes this callback. Keep the login/signup screen mounted
// while the awaiting hook validates state and exchanges the PKCE code.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'premind://');
    if (url.hostname === 'oauth' && url.pathname === '/kakao') {
      return initial ? '/login' : null;
    }
  } catch { /* Let Router handle other links. */ }
  return path;
}
