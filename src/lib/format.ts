import { enShortDate } from '@/lib/i18n/core';
import { getLocale } from '@/lib/i18n/locale-store';
import type { MaterialKind } from '@/types';

/**
 * Where a piece of a material came from, written the way that material is
 * read: a time for something recorded, a page for something uploaded.
 *
 * The server numbers a document's pages into the same millisecond field a
 * recording uses (page 1 is 0, page 2 is 1000), so one number covers both and
 * only the label differs.
 */
export function formatSourcePosition(
  positionMs: number,
  isDocument: boolean,
): string {
  if (isDocument) {
    if (getLocale() === 'en') return `p. ${pageNumberOf(positionMs)}`;
    return `${pageNumberOf(positionMs)}쪽`;
  }
  return formatDuration(positionMs / 1000);
}

/** The page a document position points at, counting from 1. */
export function pageNumberOf(positionMs: number): number {
  return Math.max(1, Math.round(Math.max(0, positionMs) / 1000) + 1);
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Avoid presenting an unknown media duration as the factual value `00:00`. */
export function formatMediaDuration(durationMs?: number): string {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return getLocale() === 'en' ? 'Checking length' : '길이 확인 중';
  }
  return formatDuration(durationMs / 1_000);
}

/**
 * How long a material is, said the way that material has length.
 *
 * A document has no length in time and never will, so answering
 * "길이 확인 중" for one was a promise that could not resolve: the row said
 * the app was still working something out when there was nothing to work out.
 * Pages are what a document has, so pages are what it says.
 */
export function formatMaterialLength(
  kind: MaterialKind,
  durationMs: number | undefined,
  pageCount = 0,
): string {
  if (kind === 'document') {
    if (getLocale() === 'en') {
      return pageCount > 0
        ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
        : 'Document';
    }
    return pageCount > 0 ? `${pageCount}쪽` : '문서';
  }
  return formatMediaDuration(durationMs);
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return getLocale() === 'en' ? 'Checking size' : '크기 확인 중';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatRelativeDate(isoDate: string): string {
  const target = new Date(isoDate);
  const diff = Date.now() - target.getTime();
  const days = Math.floor(diff / 86_400_000);

  if (getLocale() === 'en') {
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return enShortDate(target);
  }
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(target);
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
