import { enShortDate, type AppLocale } from '@/lib/i18n/core';
import type { LensHistoryEntry } from '@/types';

/**
 * Rows for the 평가 이력 list on the report screen. Pure: the component draws
 * what this returns, and the deltas are checked here rather than by eye.
 */

export interface LensHistoryRow {
  id: string;
  evaluatedAt: string;
  overall: number;
  /** Change against the evaluation before this one; null for the first ever. */
  delta: number | null;
  /** The entry the screen is showing right now. */
  selected: boolean;
  latest: boolean;
}

/**
 * `entries` newest first, as the server lists them. `selectedId` null means
 * the newest is being viewed.
 */
export function historyRows(
  entries: readonly LensHistoryEntry[],
  selectedId: string | null,
): LensHistoryRow[] {
  const viewing = entries.some((entry) => entry.id === selectedId)
    ? selectedId
    : (entries[0]?.id ?? null);
  return entries.map((entry, index) => {
    const previous = entries[index + 1];
    return {
      id: entry.id,
      evaluatedAt: entry.evaluatedAt,
      overall: entry.report.overall,
      delta: previous
        ? Math.round((entry.report.overall - previous.report.overall) * 10) / 10
        : null,
      selected: entry.id === viewing,
      latest: index === 0,
    };
  });
}

export interface LensComparison {
  /** The evaluation on screen. */
  current: LensHistoryEntry;
  /** The one taken before it. */
  previous: LensHistoryEntry;
}

/**
 * The pair the 이번 vs 지난 chart draws. Null when there is nothing to compare
 * against: a single evaluation, or the oldest one being viewed.
 */
export function comparisonPair(
  entries: readonly LensHistoryEntry[],
  selectedId: string | null,
): LensComparison | null {
  const found = entries.findIndex((entry) => entry.id === selectedId);
  const index = found >= 0 ? found : 0;
  const current = entries[index];
  const previous = entries[index + 1];
  if (!current || !previous) return null;
  return { current, previous };
}

/** The entry the screen should show: the one picked, or else the newest. */
export function selectedEntry(
  entries: readonly LensHistoryEntry[],
  selectedId: string | null,
): LensHistoryEntry | null {
  return entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
}

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** "9월 7일", in the device's own time zone. Empty for a date that will not parse. */
export function formatEvaluatedDay(isoDate: string, locale: AppLocale = 'ko'): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  if (locale === 'en') return enShortDate(date);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** "9월 7일 14:02", for telling two evaluations of the same day apart. */
export function formatEvaluatedAt(isoDate: string, locale: AppLocale = 'ko'): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatEvaluatedDay(isoDate, locale)} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}
