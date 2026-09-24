import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AccessSession, PersistedAppSnapshot } from '../types';

const LEGACY_SNAPSHOT_KEY = 'premind.rn.snapshot.v1';
const SNAPSHOT_KEY_PREFIX = 'premind.rn.snapshot.v1.workspace.';
const LEGACY_WORKSPACE_CLAIM_KEY = 'premind.rn.legacy-workspace-claim.v1';
const QUARANTINED_LEGACY_WORKSPACE = 'quarantined';
const LEGACY_WORKSPACE_OWNER_PREFIX = 'owner:';
const SESSION_KEY = 'premind.rn.access-session.v1';

type AppAsyncStorage = Pick<
  AsyncStorageStatic,
  'getItem' | 'setItem' | 'removeItem'
>;

export interface SnapshotLoadOptions {
  /**
   * Claims the pre-namespace snapshot for this workspace.
   *
   * Only use this while restoring a session that already existed before the
   * migration. A user who signs in after a signed-out launch must never inherit
   * data whose owner cannot be proven.
   */
  migrateLegacy?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is PersistedAppSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  return (
    Array.isArray(value.projects) &&
    Array.isArray(value.materials) &&
    Array.isArray(value.shareRooms) &&
    Array.isArray(value.savedMaterialIds) &&
    Array.isArray(value.confusionFeedback) &&
    Array.isArray(value.quizAttempts) &&
    isRecord(value.settings)
  );
}

function isAccessSession(value: unknown): value is AccessSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    value.tokenType === 'bearer' &&
    typeof value.issuedAt === 'string' &&
    typeof value.expiresAt === 'string' &&
    (value.refreshToken === null || typeof value.refreshToken === 'string') &&
    (value.refreshExpiresAt === null ||
      typeof value.refreshExpiresAt === 'string') &&
    typeof value.user.id === 'string' &&
    value.user.id.trim().length > 0 &&
    typeof value.user.email === 'string' &&
    typeof value.user.name === 'string' &&
    typeof value.user.role === 'string' &&
    (value.user.mode === 'teacher' || value.user.mode === 'student')
  );
}

function snapshotKey(workspaceId?: string): string {
  return workspaceId
    ? `${SNAPSHOT_KEY_PREFIX}${encodeURIComponent(workspaceId)}`
    : LEGACY_SNAPSHOT_KEY;
}

function legacyWorkspaceClaim(workspaceId: string | null): string {
  return workspaceId
    ? `${LEGACY_WORKSPACE_OWNER_PREFIX}${encodeURIComponent(workspaceId)}`
    : QUARANTINED_LEGACY_WORKSPACE;
}

function decodeSnapshot(encoded: string | null): PersistedAppSnapshot | null {
  if (!encoded) {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(encoded);
    return isSnapshot(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Durable storage boundary for the app.
 *
 * Content metadata is non-secret and lives in AsyncStorage. The access token
 * is stored as one atomic SecureStore document so a partial write cannot pair
 * a new token with stale expiry metadata. Web development falls back to
 * AsyncStorage because SecureStore has no web implementation.
 */
export class AppStorage {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(private readonly asyncStorage: AppAsyncStorage = AsyncStorage) {}

  async loadSnapshot(
    workspaceId?: string,
    options: SnapshotLoadOptions = {},
  ): Promise<PersistedAppSnapshot | null> {
    const key = snapshotKey(workspaceId);
    const scoped = decodeSnapshot(await this.asyncStorage.getItem(key));
    if (scoped || !workspaceId || !options.migrateLegacy) {
      return scoped;
    }

    if (!(await this.claimLegacyWorkspace(workspaceId))) {
      return null;
    }
    return this.migrateLegacySnapshot(workspaceId);
  }

  /**
   * Makes the first post-upgrade ownership decision durable.
   *
   * A real session restored on that first launch may claim old unscoped data.
   * A signed-out or demo launch writes a quarantine decision instead, so a
   * newly signed-in account cannot claim ownerless data on a later cold start.
   */
  claimLegacyWorkspace(workspaceId: string | null): Promise<boolean> {
    const requestedClaim = legacyWorkspaceClaim(workspaceId);
    const hasOwner = Boolean(workspaceId);
    let granted = false;
    return this.enqueueWrite(async () => {
      const existing = await this.asyncStorage.getItem(
        LEGACY_WORKSPACE_CLAIM_KEY,
      );
      if (existing === null) {
        await this.asyncStorage.setItem(
          LEGACY_WORKSPACE_CLAIM_KEY,
          requestedClaim,
        );
        granted = hasOwner;
        return;
      }
      granted = hasOwner && existing === requestedClaim;
    }).then(() => granted);
  }

  saveSnapshot(
    snapshot: PersistedAppSnapshot,
    workspaceId?: string,
  ): Promise<void> {
    const key = snapshotKey(workspaceId);
    return this.enqueueWrite(() =>
      this.asyncStorage.setItem(key, JSON.stringify(snapshot)),
    );
  }

  clearSnapshot(workspaceId?: string): Promise<void> {
    const key = snapshotKey(workspaceId);
    return this.enqueueWrite(() => this.asyncStorage.removeItem(key));
  }

  async loadSession(): Promise<AccessSession | null> {
    const encoded = (await canUseSecureStore())
      ? await SecureStore.getItemAsync(SESSION_KEY)
      : await this.asyncStorage.getItem(SESSION_KEY);

    if (!encoded) {
      return null;
    }

    try {
      const decoded: unknown = JSON.parse(encoded);
      if (isAccessSession(decoded)) {
        return decoded;
      }
    } catch {
      // Invalid state is removed below so it cannot break every app launch.
    }

    await this.clearSession();
    return null;
  }

  async saveSession(session: AccessSession): Promise<void> {
    const encoded = JSON.stringify(session);
    if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(SESSION_KEY, encoded, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      await this.asyncStorage.removeItem(SESSION_KEY);
      return;
    }

    await this.asyncStorage.setItem(SESSION_KEY, encoded);
  }

  async clearSession(): Promise<void> {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    await this.asyncStorage.removeItem(SESSION_KEY);
  }

  async clearAll(workspaceId?: string): Promise<void> {
    await Promise.all([this.clearSnapshot(workspaceId), this.clearSession()]);
  }

  private async migrateLegacySnapshot(
    workspaceId: string,
  ): Promise<PersistedAppSnapshot | null> {
    const scopedKey = snapshotKey(workspaceId);
    let migrated: PersistedAppSnapshot | null = null;

    await this.enqueueWrite(async () => {
      // Another launch or write may have completed the migration while this
      // request waited behind the serialized write queue.
      const scoped = decodeSnapshot(
        await this.asyncStorage.getItem(scopedKey),
      );
      if (scoped) {
        migrated = scoped;
        return;
      }

      const legacy = decodeSnapshot(
        await this.asyncStorage.getItem(LEGACY_SNAPSHOT_KEY),
      );
      if (!legacy) {
        return;
      }

      // Write the owned copy first. If the process is interrupted before the
      // remove, the next launch prefers the scoped copy and no data is lost.
      await this.asyncStorage.setItem(scopedKey, JSON.stringify(legacy));
      await this.asyncStorage.removeItem(LEGACY_SNAPSHOT_KEY);
      migrated = legacy;
    });

    return migrated;
  }

  private enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.writeTail.catch(() => undefined).then(operation);
    this.writeTail = next;
    return next;
  }
}

export const appStorage = new AppStorage();
