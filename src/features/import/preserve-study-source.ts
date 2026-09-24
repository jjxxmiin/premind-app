import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { persistWebMediaSource } from '@/features/files/web-media-store';

import type { PickedStudySource } from './pick-study-source';

export const STUDY_IMPORT_DIRECTORY_NAME = 'premind-imports';

export function safeImportedFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const rawStem = lastDot > 0 ? name.slice(0, lastDot) : name;
  const rawExtension = lastDot > 0 ? name.slice(lastDot).toLowerCase() : '';
  const stem = rawStem
    .normalize('NFKC')
    .replace(/[^0-9A-Za-z가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'study-source';
  const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : '';
  return `${stem}${extension}`;
}

/**
 * DocumentPicker grants a cache URI that the OS may evict. Copy it into the
 * app's document area before creating a material; the cache source is never
 * moved or deleted so interrupted copies remain recoverable.
 */
export async function preservePickedStudySource(
  source: PickedStudySource,
): Promise<PickedStudySource> {
  if (Platform.OS === 'web') {
    const preserved = await persistWebMediaSource({
      mimeType: source.mimeType,
      name: safeImportedFileName(source.name),
      sourceUri: source.uri,
      storageKey: `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    });
    return {
      ...source,
      mimeType: preserved.mimeType,
      name: preserved.name,
      sizeBytes: preserved.sizeBytes,
      uri: preserved.uri,
    };
  }

  const input = new File(source.uri);
  if (!input.exists || input.size <= 0) {
    throw new Error('선택한 원본 파일을 읽을 수 없어요. 다시 선택해 주세요.');
  }

  const directory = new Directory(Paths.document, STUDY_IMPORT_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  const safeName = safeImportedFileName(source.name);
  const dot = safeName.lastIndexOf('.');
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : '';
  const destination = new File(
    directory,
    `${stem}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${extension}`,
  );

  await input.copy(destination);
  if (!destination.exists || destination.size !== input.size) {
    throw new Error('원본 파일을 기기에 안전하게 보관하지 못했어요. 저장 공간을 확인해 주세요.');
  }

  return {
    ...source,
    uri: destination.uri,
    sizeBytes: destination.size,
  };
}
