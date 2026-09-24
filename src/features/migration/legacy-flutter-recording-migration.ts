import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { MaterialImportInput, StudyMaterial } from '../../types';

export const LEGACY_FLUTTER_RECORDINGS_DIRECTORY_NAME = 'recordings';
export const LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY =
  'premind.rn.legacy-flutter-recordings.v1.complete';

const MIGRATION_COMPLETE_VALUE = '1';

export const LEGACY_FLUTTER_MIGRATION_PROJECT = {
  title: '이전 PREMIND 녹음',
  courseName: '기존 녹음 복구',
  description:
    'Flutter 앱에서 녹음한 원본을 그대로 보존하며 가져온 학습 자료예요.',
  accentColor: '#D25417',
} as const;

export const LEGACY_FLUTTER_METADATA_STRATEGY =
  'file-mtime-best-effort' as const;

export interface LegacyFlutterRecordingFile {
  uri: string;
  fileName: string;
  sizeBytes: number;
  lastModifiedMs: number | null;
}

export interface LegacyFlutterScanFailure {
  uri: string;
  message: string;
}

export interface LegacyFlutterRecordingScan {
  recordings: LegacyFlutterRecordingFile[];
  failures: LegacyFlutterScanFailure[];
  ignoredCount: number;
}

export interface LegacyFlutterRecordingScanner {
  scan(platform: string): Promise<LegacyFlutterRecordingScan>;
}

export interface LegacyMigrationProjectSuggestion {
  title: string;
  courseName: string;
  description: string;
  accentColor: string;
}

export interface LegacyFlutterRecordingMigrationInput {
  existingMaterials: readonly Pick<StudyMaterial, 'source'>[];
  ensureProject: (
    suggestion: LegacyMigrationProjectSuggestion,
  ) => string | Promise<string>;
  importMaterial: (input: MaterialImportInput) => Promise<unknown>;
}

export interface LegacyFlutterMigrationFailure {
  stage: 'scan' | 'import';
  uri: string;
  message: string;
}

export type LegacyFlutterMigrationStatus =
  | 'web-noop'
  | 'already-completed'
  | 'completed'
  | 'partial';

export interface LegacyFlutterRecordingMigrationResult {
  status: LegacyFlutterMigrationStatus;
  metadataStrategy: typeof LEGACY_FLUTTER_METADATA_STRATEGY;
  discoveredCount: number;
  importedCount: number;
  importedUris: string[];
  skippedDuplicateUris: string[];
  ignoredCount: number;
  failures: LegacyFlutterMigrationFailure[];
}

type MigrationStorage = Pick<AsyncStorageStatic, 'getItem' | 'setItem'>;

export interface LegacyFlutterRecordingMigrationDependencies {
  storage?: MigrationStorage;
  scanner?: LegacyFlutterRecordingScanner;
  getPlatform?: () => string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : '파일을 확인하지 못했어요.';
}

/**
 * Android's Flutter path_provider stores application documents in the
 * app_flutter sibling of the normal Android files directory. iOS uses the
 * same Documents directory exposed by Expo. The normal Expo location is also
 * checked on Android to cover path_provider/runtime variations.
 */
export function legacyFlutterRecordingDirectoryUris(
  platform: string,
  expoDocumentUri: string,
): string[] {
  const directoryUris = [
    Paths.join(
      expoDocumentUri,
      LEGACY_FLUTTER_RECORDINGS_DIRECTORY_NAME,
    ),
  ];

  if (platform === 'android') {
    directoryUris.push(
      Paths.join(
        Paths.dirname(expoDocumentUri),
        'app_flutter',
        LEGACY_FLUTTER_RECORDINGS_DIRECTORY_NAME,
      ),
    );
  }

  return [...new Set(directoryUris)];
}

/** Normalizes equivalent local URI spellings without changing path case. */
export function canonicalLocalSourceUri(uri: string): string {
  const normalized = uri
    .trim()
    .replace(/^file:\/\/localhost\//i, 'file:///');
  try {
    return decodeURI(normalized);
  } catch {
    return normalized;
  }
}

export function legacyRecordingTitle(
  recording: Pick<LegacyFlutterRecordingFile, 'fileName' | 'lastModifiedMs'>,
): string {
  const timestamp = recording.lastModifiedMs;
  if (timestamp !== null && Number.isFinite(timestamp) && timestamp > 0) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      const pad = (value: number) => value.toString().padStart(2, '0');
      return `이전 PREMIND 녹음, ${date.getFullYear()}.${pad(
        date.getMonth() + 1,
      )}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(
        date.getMinutes(),
      )}`;
    }
  }

  const stem = recording.fileName.replace(/\.m4a$/i, '');
  const identifier = stem.match(/^premind_([0-9a-z-]+)/i)?.[1]?.slice(0, 8);
  return identifier
    ? `이전 PREMIND 녹음, ${identifier}`
    : '이전 PREMIND 녹음';
}

function emptyScan(): LegacyFlutterRecordingScan {
  return { recordings: [], failures: [], ignoredCount: 0 };
}

/**
 * Read-only Expo FileSystem scanner for Flutter's Documents/recordings/*.m4a.
 * It never creates, copies, moves, writes, or deletes a source file.
 */
export class ExpoLegacyFlutterRecordingScanner
  implements LegacyFlutterRecordingScanner
{
  async scan(platform: string): Promise<LegacyFlutterRecordingScan> {
    if (platform === 'web') {
      return emptyScan();
    }

    const result = emptyScan();
    const directoryUris = legacyFlutterRecordingDirectoryUris(
      platform,
      Paths.document.uri,
    );

    for (const directoryUri of directoryUris) {
      const directory = new Directory(directoryUri);
      if (!directory.exists) {
        continue;
      }

      let entries: (Directory | File)[];
      try {
        entries = directory.list();
      } catch (error) {
        result.failures.push({
          uri: directoryUri,
          message: errorMessage(error),
        });
        continue;
      }

      for (const entry of entries) {
        if (!(entry instanceof File) || !/\.m4a$/i.test(entry.name)) {
          result.ignoredCount += 1;
          continue;
        }

        try {
          if (!entry.exists || entry.size <= 0) {
            result.ignoredCount += 1;
            continue;
          }
          result.recordings.push({
            uri: entry.uri,
            fileName: entry.name,
            sizeBytes: entry.size,
            lastModifiedMs: entry.lastModified ?? entry.creationTime ?? null,
          });
        } catch (error) {
          result.failures.push({
            uri: entry.uri,
            message: errorMessage(error),
          });
        }
      }
    }

    result.recordings.sort(
      (left, right) =>
        (right.lastModifiedMs ?? 0) - (left.lastModifiedMs ?? 0) ||
        left.uri.localeCompare(right.uri),
    );
    return result;
  }
}

function baseResult(
  status: LegacyFlutterMigrationStatus,
): LegacyFlutterRecordingMigrationResult {
  return {
    status,
    metadataStrategy: LEGACY_FLUTTER_METADATA_STRATEGY,
    discoveredCount: 0,
    importedCount: 0,
    importedUris: [],
    skippedDuplicateUris: [],
    ignoredCount: 0,
    failures: [],
  };
}

/**
 * Imports legacy recordings by reference into the RN local-first store.
 *
 * Flutter session metadata lives in platform SharedPreferences under
 * `premind.recording_sessions.v1`. React Native has no safe cross-platform JS
 * bridge to that store, so titles are reconstructed from file modification
 * time (and the filename as a fallback). Duration, markers, and lecture links
 * are intentionally not guessed.
 *
 * Completion is persisted only after a clean scan and successful imports. A
 * partial run remains retryable; callers should pass their latest materials so
 * already-imported source URIs are skipped on the next launch.
 */
export class LegacyFlutterRecordingMigrationService {
  private readonly storage: MigrationStorage;
  private readonly scanner: LegacyFlutterRecordingScanner;
  private readonly getPlatform: () => string;
  private inFlight: Promise<LegacyFlutterRecordingMigrationResult> | null = null;

  constructor(
    dependencies: LegacyFlutterRecordingMigrationDependencies = {},
  ) {
    this.storage = dependencies.storage ?? AsyncStorage;
    this.scanner =
      dependencies.scanner ?? new ExpoLegacyFlutterRecordingScanner();
    this.getPlatform = dependencies.getPlatform ?? (() => Platform.OS);
  }

  migrate(
    input: LegacyFlutterRecordingMigrationInput,
  ): Promise<LegacyFlutterRecordingMigrationResult> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const operation = this.migrateOnce(input).finally(() => {
      if (this.inFlight === operation) {
        this.inFlight = null;
      }
    });
    this.inFlight = operation;
    return operation;
  }

  private async migrateOnce(
    input: LegacyFlutterRecordingMigrationInput,
  ): Promise<LegacyFlutterRecordingMigrationResult> {
    const platform = this.getPlatform();
    if (platform === 'web') {
      return baseResult('web-noop');
    }

    const completion = await this.storage.getItem(
      LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY,
    );
    if (completion === MIGRATION_COMPLETE_VALUE) {
      return baseResult('already-completed');
    }

    const scan = await this.scanner.scan(platform);
    const result = baseResult('completed');
    result.discoveredCount = scan.recordings.length;
    result.ignoredCount = scan.ignoredCount;
    result.failures.push(
      ...scan.failures.map((failure) => ({
        stage: 'scan' as const,
        ...failure,
      })),
    );

    const seenUris = new Set(
      input.existingMaterials.map((material) =>
        canonicalLocalSourceUri(material.source.uri),
      ),
    );
    const candidates: LegacyFlutterRecordingFile[] = [];

    for (const recording of scan.recordings) {
      const canonicalUri = canonicalLocalSourceUri(recording.uri);
      if (!canonicalUri || seenUris.has(canonicalUri)) {
        result.skippedDuplicateUris.push(recording.uri);
        continue;
      }
      seenUris.add(canonicalUri);
      candidates.push(recording);
    }

    if (candidates.length > 0) {
      const projectId = (
        await input.ensureProject(LEGACY_FLUTTER_MIGRATION_PROJECT)
      ).trim();
      if (!projectId) {
        throw new Error('이전 녹음을 담을 프로젝트를 만들지 못했어요.');
      }

      for (const recording of candidates) {
        try {
          await input.importMaterial({
            projectId,
            uri: recording.uri,
            fileName: recording.fileName,
            mimeType: 'audio/mp4',
            title: legacyRecordingTitle(recording),
            kind: 'audio',
            sizeBytes: recording.sizeBytes,
            origin: 'recording',
          });
          result.importedUris.push(recording.uri);
        } catch (error) {
          result.failures.push({
            stage: 'import',
            uri: recording.uri,
            message: errorMessage(error),
          });
        }
      }
    }

    result.importedCount = result.importedUris.length;
    if (result.failures.length > 0) {
      result.status = 'partial';
      return result;
    }

    await this.storage.setItem(
      LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY,
      MIGRATION_COMPLETE_VALUE,
    );
    return result;
  }
}

export const legacyFlutterRecordingMigrationService =
  new LegacyFlutterRecordingMigrationService();
