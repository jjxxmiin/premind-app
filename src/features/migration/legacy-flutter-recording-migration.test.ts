import type { MaterialImportInput, StudyMaterial } from '../../types';
import {
  LEGACY_FLUTTER_METADATA_STRATEGY,
  LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY,
  LEGACY_FLUTTER_MIGRATION_PROJECT,
  LegacyFlutterRecordingMigrationService,
  canonicalLocalSourceUri,
  legacyFlutterRecordingDirectoryUris,
  legacyRecordingTitle,
  type LegacyFlutterRecordingFile,
  type LegacyFlutterRecordingScan,
} from './legacy-flutter-recording-migration';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function recording(
  fileName: string,
  overrides: Partial<LegacyFlutterRecordingFile> = {},
): LegacyFlutterRecordingFile {
  return {
    uri: `file:///documents/recordings/${fileName}`,
    fileName,
    sizeBytes: 4_096,
    lastModifiedMs: new Date(2026, 8, 2, 13, 5).getTime(),
    ...overrides,
  };
}

function scanner(result: Partial<LegacyFlutterRecordingScan>) {
  return {
    scan: jest.fn(async () => ({
      recordings: [],
      failures: [],
      ignoredCount: 0,
      ...result,
    })),
  };
}

function existingMaterial(
  uri: string,
): Pick<StudyMaterial, 'source'> {
  return {
    source: {
      uri,
      fileName: 'existing.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
    },
  };
}

describe('legacy Flutter recording paths and fallback metadata', () => {
  it('checks Flutter app_flutter documents as well as Expo documents on Android', () => {
    expect(
      legacyFlutterRecordingDirectoryUris(
        'android',
        'file:///data/user/0/kr.co.premind.premind/files/',
      ),
    ).toEqual([
      'file:///data/user/0/kr.co.premind.premind/files/recordings',
      'file:///data/user/0/kr.co.premind.premind/app_flutter/recordings',
    ]);

    expect(
      legacyFlutterRecordingDirectoryUris(
        'ios',
        'file:///var/mobile/Containers/Data/Application/id/Documents/',
      ),
    ).toEqual([
      'file:///var/mobile/Containers/Data/Application/id/Documents/recordings',
    ]);
  });

  it('normalizes equivalent local URIs and derives a Korean title from mtime', () => {
    expect(
      canonicalLocalSourceUri(
        ' file://localhost/documents/recordings/premind_a%20b.m4a ',
      ),
    ).toBe('file:///documents/recordings/premind_a b.m4a');

    expect(legacyRecordingTitle(recording('premind_123.m4a'))).toBe(
      '이전 PREMIND 녹음, 2026.09.02 13:05',
    );
    expect(
      legacyRecordingTitle(
        recording('premind_abcdef12-3456.m4a', { lastModifiedMs: null }),
      ),
    ).toBe('이전 PREMIND 녹음, abcdef12');
  });
});

describe('LegacyFlutterRecordingMigrationService', () => {
  it('imports a legacy source by reference into one local project and marks completion', async () => {
    const storage = memoryStorage();
    const source = recording('premind_one.m4a');
    const sourceScanner = scanner({ recordings: [source], ignoredCount: 2 });
    const importedInputs: MaterialImportInput[] = [];
    const ensureProject = jest.fn(async () => 'legacy-project');
    const importMaterial = jest.fn(async (input: MaterialImportInput) => {
      importedInputs.push(input);
    });
    const service = new LegacyFlutterRecordingMigrationService({
      storage,
      scanner: sourceScanner,
      getPlatform: () => 'ios',
    });

    const result = await service.migrate({
      existingMaterials: [],
      ensureProject,
      importMaterial,
    });

    expect(ensureProject).toHaveBeenCalledWith(
      LEGACY_FLUTTER_MIGRATION_PROJECT,
    );
    expect(importedInputs).toEqual([
      expect.objectContaining({
        projectId: 'legacy-project',
        uri: source.uri,
        fileName: source.fileName,
        sizeBytes: source.sizeBytes,
        mimeType: 'audio/mp4',
        kind: 'audio',
        origin: 'recording',
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        metadataStrategy: LEGACY_FLUTTER_METADATA_STRATEGY,
        discoveredCount: 1,
        importedCount: 1,
        importedUris: [source.uri],
        ignoredCount: 2,
        failures: [],
      }),
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY,
      '1',
    );
  });

  it('deduplicates existing and repeated source URIs before importing', async () => {
    const storage = memoryStorage();
    const alreadyImported = recording('premind_a.m4a', {
      uri: 'file:///documents/recordings/premind_a%20copy.m4a',
    });
    const newSource = recording('premind_b.m4a');
    const service = new LegacyFlutterRecordingMigrationService({
      storage,
      scanner: scanner({
        recordings: [alreadyImported, newSource, { ...newSource }],
      }),
      getPlatform: () => 'android',
    });
    const importMaterial = jest.fn(async (_input: MaterialImportInput) => {});

    const result = await service.migrate({
      existingMaterials: [
        existingMaterial(
          'file://localhost/documents/recordings/premind_a copy.m4a',
        ),
      ],
      ensureProject: async () => 'legacy-project',
      importMaterial,
    });

    expect(importMaterial).toHaveBeenCalledTimes(1);
    expect(importMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ uri: newSource.uri }),
    );
    expect(result.skippedDuplicateUris).toEqual([
      alreadyImported.uri,
      newSource.uri,
    ]);
    expect(result.status).toBe('completed');
  });

  it('is a true web no-op without touching storage or the filesystem scanner', async () => {
    const storage = memoryStorage();
    const sourceScanner = scanner({ recordings: [recording('unused.m4a')] });
    const service = new LegacyFlutterRecordingMigrationService({
      storage,
      scanner: sourceScanner,
      getPlatform: () => 'web',
    });
    const ensureProject = jest.fn(async () => 'unused');
    const importMaterial = jest.fn(async (_input: MaterialImportInput) => {});

    const result = await service.migrate({
      existingMaterials: [],
      ensureProject,
      importMaterial,
    });

    expect(result.status).toBe('web-noop');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(sourceScanner.scan).not.toHaveBeenCalled();
    expect(ensureProject).not.toHaveBeenCalled();
    expect(importMaterial).not.toHaveBeenCalled();
  });

  it('does not mark a partial import complete and safely retries only the missing URI', async () => {
    const storage = memoryStorage();
    const first = recording('premind_first.m4a');
    const second = recording('premind_second.m4a');
    const sourceScanner = scanner({ recordings: [first, second] });
    const service = new LegacyFlutterRecordingMigrationService({
      storage,
      scanner: sourceScanner,
      getPlatform: () => 'ios',
    });
    const firstImport = jest.fn(async (input: MaterialImportInput) => {
      if (input.uri === second.uri) {
        throw new Error('temporary import failure');
      }
    });

    const partial = await service.migrate({
      existingMaterials: [],
      ensureProject: async () => 'legacy-project',
      importMaterial: firstImport,
    });

    expect(partial.status).toBe('partial');
    expect(partial.importedUris).toEqual([first.uri]);
    expect(partial.failures).toEqual([
      expect.objectContaining({ stage: 'import', uri: second.uri }),
    ]);
    expect(storage.setItem).not.toHaveBeenCalled();

    const retryImport = jest.fn(async (_input: MaterialImportInput) => {});
    const retried = await service.migrate({
      existingMaterials: [existingMaterial(first.uri)],
      ensureProject: async () => 'legacy-project',
      importMaterial: retryImport,
    });

    expect(retryImport).toHaveBeenCalledTimes(1);
    expect(retryImport).toHaveBeenCalledWith(
      expect.objectContaining({ uri: second.uri }),
    );
    expect(retried.status).toBe('completed');
    expect(storage.setItem).toHaveBeenCalledWith(
      LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY,
      '1',
    );
  });

  it('keeps scan failures retryable and skips work after a prior completion', async () => {
    const storage = memoryStorage();
    const sourceScanner = scanner({
      failures: [
        {
          uri: 'file:///documents/recordings',
          message: 'temporarily unreadable',
        },
      ],
    });
    const ensureProject = jest.fn(async () => 'unused');
    const importMaterial = jest.fn(async (_input: MaterialImportInput) => {});
    const service = new LegacyFlutterRecordingMigrationService({
      storage,
      scanner: sourceScanner,
      getPlatform: () => 'ios',
    });

    const partial = await service.migrate({
      existingMaterials: [],
      ensureProject,
      importMaterial,
    });

    expect(partial.status).toBe('partial');
    expect(partial.failures[0]).toEqual(
      expect.objectContaining({ stage: 'scan' }),
    );
    expect(ensureProject).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    storage.values.set(LEGACY_FLUTTER_MIGRATION_COMPLETE_KEY, '1');
    sourceScanner.scan.mockClear();
    const completed = await service.migrate({
      existingMaterials: [],
      ensureProject,
      importMaterial,
    });

    expect(completed.status).toBe('already-completed');
    expect(sourceScanner.scan).not.toHaveBeenCalled();
  });
});
