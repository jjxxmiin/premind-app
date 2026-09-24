import type { AccessSession, UserProfile } from '../../types';
import { signOutBilling } from '../billing';
import { AppStorage, appStorage } from '../storage';
import {
  ApiError,
  apiClient,
  isSessionRefreshable,
  isSessionUsable,
  type AuthProvider,
  type KakaoCodeProof,
  type PremindApiClient,
} from './client';

export type SessionListener = (session: AccessSession | null) => void;

/** Marks the offline demo session, which has no server behind it. */
export const DEMO_ACCESS_TOKEN = 'local-development-only';

export function isDemoSession(session: AccessSession | null): boolean {
  return session?.accessToken === DEMO_ACCESS_TOKEN;
}

/**
 * Owns the signed-in session: its storage, its rotation, and its end.
 *
 * The server hands out a short-lived access token plus a refresh token that is
 * **one-time-use** — reusing a rotated one is treated as theft and revokes
 * every token the account holds. That single rule shapes this class:
 *
 * - refreshes are single-flight, so two screens waking at once cannot spend the
 *   same refresh token twice and lock the user out of their own account;
 * - the new pair is persisted before it is handed to anyone, so a crash mid-
 *   refresh cannot leave the app holding a token the server has already retired;
 * - a refresh that is genuinely rejected signs the user out immediately rather
 *   than retrying into the theft heuristic.
 */
export class SessionManager {
  constructor(
    private readonly client: PremindApiClient = apiClient,
    private readonly storage: AppStorage = appStorage,
  ) {}

  private current: AccessSession | null = null;
  private refreshInFlight: Promise<AccessSession> | null = null;
  private readonly listeners = new Set<SessionListener>();

  get session(): AccessSession | null {
    return this.current;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Load the persisted session at launch. Returns what survived. */
  async restore(): Promise<AccessSession | null> {
    const stored = await this.storage.loadSession();
    if (!stored) {
      return this.publish(null);
    }
    // Offline-first: a session whose access token expired while the app was
    // closed is kept as long as it can still be refreshed, so a user who opens
    // the app on a plane is not signed out by the clock alone.
    if (
      !isSessionUsable(stored) &&
      !isSessionRefreshable(stored) &&
      !isDemoSession(stored)
    ) {
      await this.storage.clearSession();
      return this.publish(null);
    }
    return this.publish(stored);
  }

  async signIn(
    email: string,
    password: string,
    options: { deviceName?: string; mode?: UserProfile['mode']; kakaoCode?: KakaoCodeProof } = {},
  ): Promise<AccessSession> {
    const session = await this.client.login(email, password, options);
    await this.storage.saveSession(session);
    return this.publish(session) as AccessSession;
  }

  async register(
    email: string,
    name: string,
    password: string,
    mode: UserProfile['mode'] = 'teacher',
  ): Promise<AccessSession> {
    const session = await this.client.register(email, name, password, mode);
    await this.storage.saveSession(session);
    return this.publish(session) as AccessSession;
  }

  async signInWithProvider(
    provider: AuthProvider,
    token: string,
    options: { deviceName?: string; mode?: UserProfile['mode']; kakaoCode?: KakaoCodeProof } = {},
  ): Promise<AccessSession> {
    const session = await this.client.signInWithProvider(provider, token, options);
    await this.storage.saveSession(session);
    return this.publish(session) as AccessSession;
  }

  /** Start the offline demo. Stored like any session, but never sent anywhere. */
  async startDemo(mode: UserProfile['mode']): Promise<AccessSession> {
    const now = new Date();
    const session: AccessSession = {
      accessToken: DEMO_ACCESS_TOKEN,
      tokenType: 'bearer',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000).toISOString(),
      refreshToken: null,
      refreshExpiresAt: null,
      user: {
        id: 'premind-development-user',
        email: 'developer@premind.local',
        name: 'PREMIND 사용자',
        role: 'development',
        mode,
      },
    };
    await this.storage.saveSession(session);
    return this.publish(session) as AccessSession;
  }

  async signOut(): Promise<void> {
    const session = this.current;
    // Retiring the refresh token server-side is courtesy, not correctness: the
    // local session is cleared either way, so a network failure must not leave
    // the user still signed in on the device.
    if (session?.refreshToken) {
      try {
        await this.client.revoke(session.refreshToken);
      } catch {
        // Intentionally ignored — see above.
      }
    }
    // Forget the buyer too. Without this the next person to sign in on this
    // handset inherits the previous account's 스탠다드, because the store SDK
    // keeps its own identity independent of ours.
    await signOutBilling();
    await this.storage.clearSession();
    this.publish(null);
  }

  /** Replace the in-memory session without touching the server. */
  async replace(session: AccessSession | null): Promise<void> {
    if (session) {
      await this.storage.saveSession(session);
    } else {
      await this.storage.clearSession();
    }
    this.publish(session);
  }

  /**
   * An access token that is valid right now, refreshing first if it is not.
   *
   * Throws `ApiError('SESSION_EXPIRED')` when there is nothing left to refresh
   * with — the caller's cue to send the user back to the login screen.
   */
  async accessToken(): Promise<string> {
    const session = this.current;
    if (isDemoSession(session)) {
      throw new ApiError('데모에서는 쓸 수 없는 기능이에요. PREMIND 계정으로 로그인해 주세요.', {
        code: 'SESSION_EXPIRED',
      });
    }
    if (isSessionUsable(session)) {
      return session.accessToken;
    }
    return (await this.refreshOrFail()).accessToken;
  }

  /**
   * Run `operation` with a valid access token, refreshing once if the server
   * rejects it anyway.
   *
   * The retry matters because "valid" here is a clock comparison, and a device
   * clock can be wrong — or a token can be revoked mid-session. One retry, so
   * a server that answers 401 to everything cannot become an infinite loop.
   */
  async authorize<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
    const token = await this.accessToken();
    try {
      return await operation(token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      const refreshed = await this.refreshOrFail();
      return operation(refreshed.accessToken);
    }
  }

  /** Rotate the stored refresh token, or sign out because there is none left. */
  private async refreshOrFail(): Promise<AccessSession> {
    const session = this.current;
    if (!isSessionRefreshable(session)) {
      await this.forgetExpired();
      throw new ApiError('다시 로그인해 주세요.', { code: 'SESSION_EXPIRED' });
    }
    return this.refresh(session.refreshToken);
  }

  private async refresh(refreshToken: string): Promise<AccessSession> {
    // Single-flight: concurrent callers await the same rotation rather than
    // spending the same one-time-use token twice.
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.rotate(refreshToken).finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async rotate(refreshToken: string): Promise<AccessSession> {
    const mode = this.current?.user.mode ?? 'teacher';
    let session: AccessSession;
    try {
      session = await this.client.refresh(refreshToken, mode);
    } catch (error) {
      // A rejected refresh token is gone for good; anything else (no network,
      // a timeout) leaves the session alone so the app can try again later.
      if (error instanceof ApiError && error.status === 401) {
        await this.forgetExpired();
        throw new ApiError('다시 로그인해 주세요.', {
          code: 'SESSION_EXPIRED',
          status: 401,
          cause: error,
        });
      }
      throw error;
    }
    await this.storage.saveSession(session);
    this.publish(session);
    return session;
  }

  private async forgetExpired(): Promise<void> {
    await this.storage.clearSession();
    this.publish(null);
  }

  private publish(session: AccessSession | null): AccessSession | null {
    this.current = session;
    for (const listener of this.listeners) {
      listener(session);
    }
    return session;
  }
}

export const sessionManager = new SessionManager();
