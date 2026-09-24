import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { STUDY_IMPORT_DIRECTORY_NAME } from '@/features/import/preserve-study-source';
import { RECORDING_DIRECTORY_NAME } from '@/features/recording/recording-session-repository';

import {
  deleteWebMediaSource,
  isPersistedWebMediaUri,
  isWebRecordingCheckpointUri,
} from './web-media-store';

function directoryPrefix(directory: Directory): string {
  return directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
}

function isOwnedNativeSource(uri: string): boolean {
  if (!uri.startsWith('file://')) return false;
  const ownedPrefixes = [
    directoryPrefix(new Directory(Paths.document, STUDY_IMPORT_DIRECTORY_NAME)),
    directoryPrefix(new Directory(Paths.document, RECORDING_DIRECTORY_NAME)),
    directoryPrefix(Paths.cache),
  ];
  return ownedPrefixes.some((prefix) => uri.startsWith(prefix));
}

async function deleteOne(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (isPersistedWebMediaUri(uri) || isWebRecordingCheckpointUri(uri)) {
      await deleteWebMediaSource(uri);
    }
    return;
  }

  if (!isOwnedNativeSource(uri)) return;
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

/** Delete only the app-owned local sources referenced by the retiring account. */
export async function deleteLocalStudySources(
  sourceUris: readonly string[],
): Promise<void> {
  const uniqueUris = [...new Set(sourceUris.filter(Boolean))];
  const results = await Promise.allSettled(uniqueUris.map(deleteOne));
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) {
    throw failure.reason;
  }
}
