import { Platform } from 'react-native';

/**
 * Where a signed-out visitor was headed (web only).
 *
 * The protected stack sends anyone without a session to /login, so the address
 * they opened — premind.co.kr/app/interview from the interview landing, a
 * report link — was lost and sign-in always ended on 홈. The address is read
 * once at start-up, before the router rewrites it, and handed back after
 * sign-in or sign-up.
 */
const ENTRY_PATHS = new Set(['', '/', '/login', '/signup', '/index']);
// Expo serves the web build under experiments.baseUrl (/app) in production.
const BASE_PREFIX = '/app';

let pending: string | null = null;

export function normalizeReturnTo(pathname: string, search = ''): string | null {
  let path = pathname;
  if (path === BASE_PREFIX || path.startsWith(`${BASE_PREFIX}/`)) path = path.slice(BASE_PREFIX.length);
  path = path.replace(/\/+$/, '');
  if (ENTRY_PATHS.has(path) || !path.startsWith('/') || path.startsWith('//')) return null;
  return `${path}${search}`;
}

export function captureInitialReturnTo(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  pending = normalizeReturnTo(window.location.pathname, window.location.search);
}

/** Without consuming it — the login screen words itself for where you are going. */
export function peekReturnTo(): string | null {
  return pending;
}

export function takeReturnTo(): string | null {
  const value = pending;
  pending = null;
  return value;
}

/** A visitor sent from the interview landing (or an interview link). */
export function returnsToInterview(): boolean {
  return Boolean(pending && /^\/(interview|speak\?mode=interview)/.test(pending));
}
