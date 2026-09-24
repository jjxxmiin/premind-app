import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';

export const MAX_MEDIA_SOURCE_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_DOCUMENT_SOURCE_BYTES = 40 * 1024 * 1024;

export const STUDY_SOURCE_MIME_TYPES = [
  'audio/*',
  'video/*',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export type StudySourceKind = 'audio' | 'video' | 'pdf' | 'pptx';

export interface PickStudySourceOptions {
  allowedKinds?: readonly StudySourceKind[];
}

export interface PickedStudySource {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: StudySourceKind;
  lastModified: number;
}

export type PickStudySourceResult =
  | { canceled: true; source: null }
  | { canceled: false; source: PickedStudySource };

export type StudySourceErrorCode =
  | 'unsupported-type'
  | 'selection-empty'
  | 'size-unavailable'
  | 'file-too-large';

export class StudySourcePickerError extends Error {
  constructor(
    public readonly code: StudySourceErrorCode,
    message: string,
    public readonly details?: {
      actualBytes?: number;
      maximumBytes?: number;
      name?: string;
    },
  ) {
    super(message);
    this.name = 'StudySourcePickerError';
  }
}

const AUDIO_EXTENSIONS = new Set([
  'aac',
  'caf',
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'opus',
  'wav',
  'weba',
]);

const VIDEO_EXTENSIONS = new Set([
  '3gp',
  'avi',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'webm',
]);

function extensionOf(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * MIME is preferred, while the extension fallback handles providers that
 * return `application/octet-stream` or omit MIME metadata entirely.
 */
export function studySourceKindOf(
  name: string,
  mimeType?: string | null,
): StudySourceKind | null {
  const normalizedMimeType = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  const extension = extensionOf(name);

  if (normalizedMimeType?.startsWith('audio/')) {
    return 'audio';
  }
  if (normalizedMimeType?.startsWith('video/')) {
    return 'video';
  }
  if (normalizedMimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    normalizedMimeType ===
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'pptx';
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (extension === 'pptx') {
    return 'pptx';
  }
  return null;
}

function normalizedStudySourceMimeType(
  kind: StudySourceKind,
  name: string,
  providerMimeType?: string,
): string {
  const providerType = providerMimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (
    (kind === 'audio' && providerType?.startsWith('audio/')) ||
    (kind === 'video' && providerType?.startsWith('video/')) ||
    (kind === 'pdf' && providerType === 'application/pdf') ||
    (kind === 'pptx' &&
      providerType ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  ) {
    return providerType;
  }

  const extension = extensionOf(name);
  if (kind === 'audio') {
    if (extension === 'mp3') return 'audio/mpeg';
    if (extension === 'wav') return 'audio/wav';
    if (extension === 'ogg' || extension === 'opus') return 'audio/ogg';
    if (extension === 'flac') return 'audio/flac';
    if (extension === 'weba') return 'audio/webm';
    return 'audio/mp4';
  }
  if (kind === 'video') {
    if (extension === 'webm') return 'video/webm';
    if (extension === 'mov') return 'video/quicktime';
    if (extension === 'avi') return 'video/x-msvideo';
    if (extension === 'mkv') return 'video/x-matroska';
    return 'video/mp4';
  }
  if (kind === 'pdf') {
    return 'application/pdf';
  }
  return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

export function maximumStudySourceBytes(kind: StudySourceKind): number {
  return kind === 'audio' || kind === 'video'
    ? MAX_MEDIA_SOURCE_BYTES
    : MAX_DOCUMENT_SOURCE_BYTES;
}

export function assertStudySourceSize(
  kind: StudySourceKind,
  sizeBytes: number,
  name?: string,
): void {
  const maximumBytes = maximumStudySourceBytes(kind);
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new StudySourcePickerError(
      'size-unavailable',
      '파일 크기를 확인할 수 없어요. 다른 위치에서 다시 선택해 주세요.',
      { name },
    );
  }
  if (sizeBytes > maximumBytes) {
    const limitLabel = kind === 'audio' || kind === 'video' ? '4GB' : '40MB';
    throw new StudySourcePickerError(
      'file-too-large',
      `${limitLabel} 이하의 파일을 선택해 주세요.`,
      { actualBytes: sizeBytes, maximumBytes, name },
    );
  }
}

function assetSize(asset: DocumentPicker.DocumentPickerAsset): number | null {
  if (typeof asset.size === 'number') {
    return asset.size;
  }
  if (typeof asset.file?.size === 'number') {
    return asset.file.size;
  }

  try {
    const file = new ExpoFile(asset.uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

function mimeTypesForKinds(
  kinds: readonly StudySourceKind[],
): (typeof STUDY_SOURCE_MIME_TYPES)[number][] {
  const selected = new Set(kinds);
  return STUDY_SOURCE_MIME_TYPES.filter((mimeType) => {
    if (mimeType === 'audio/*') return selected.has('audio');
    if (mimeType === 'video/*') return selected.has('video');
    if (mimeType === 'application/pdf') return selected.has('pdf');
    return selected.has('pptx');
  });
}

export async function pickStudySource(
  options: PickStudySourceOptions = {},
): Promise<PickStudySourceResult> {
  const allowedKinds = options.allowedKinds ?? [
    'audio',
    'video',
    'pdf',
    'pptx',
  ];
  const result = await DocumentPicker.getDocumentAsync({
    type: mimeTypesForKinds(allowedKinds),
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });

  if (result.canceled) {
    return { canceled: true, source: null };
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new StudySourcePickerError(
      'selection-empty',
      '선택한 파일 정보를 가져오지 못했어요. 다시 선택해 주세요.',
    );
  }
  const kind = studySourceKindOf(asset.name, asset.mimeType);
  if (!kind || !allowedKinds.includes(kind)) {
    throw new StudySourcePickerError(
      'unsupported-type',
      '음성, 영상, PDF 또는 PPTX 파일을 선택해 주세요.',
      { name: asset.name },
    );
  }

  const sizeBytes = assetSize(asset);
  if (sizeBytes === null) {
    throw new StudySourcePickerError(
      'size-unavailable',
      '파일 크기를 확인할 수 없어요. 다른 위치에서 다시 선택해 주세요.',
      { name: asset.name },
    );
  }
  assertStudySourceSize(kind, sizeBytes, asset.name);

  return {
    canceled: false,
    source: {
      uri: asset.uri,
      name: asset.name,
      mimeType: normalizedStudySourceMimeType(kind, asset.name, asset.mimeType),
      sizeBytes,
      kind,
      lastModified: asset.lastModified,
    },
  };
}
