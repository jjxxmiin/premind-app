import type { OutlineSection, TranscriptSegment } from '@/types';

import { withSectionMarkers } from './TranscriptSections';

/**
 * 요약 and 대본 as cards turned by hand (2026-10-04, CEO "스크롤보단 손으로
 * 넘기기"): one unit of the 자료 per card instead of one long column.
 *
 * What a unit is depends on what the 자료 has:
 *   - a document: one page per card — the same pages the strip above shows;
 *   - a lecture with an outline: one 구간 per card, the 구간 heading on top;
 *   - a lecture without one: one card per few minutes of the clock.
 * A filtered list (search, 중요만, 형광펜만) is sparse by design, so it stays one
 * column: paging three hits across forty cards would hide them.
 */

/** A lecture with no outline is cut every this many minutes of audio. */
export const TIME_PAGE_MS = 5 * 60_000;

export interface TranscriptPage {
  key: string;
  /** The 구간 this card is, when the lecture has an outline. */
  section?: OutlineSection;
  segments: TranscriptSegment[];
}

export function transcriptPagesFor(
  segments: readonly TranscriptSegment[],
  {
    outline,
    document,
    filtered,
  }: {
    outline: readonly OutlineSection[];
    document: boolean;
    filtered: boolean;
  },
): TranscriptPage[] {
  if (!segments.length) return [];
  if (filtered) return [{ key: 'all', segments: [...segments] }];

  if (document) {
    return segments.map((segment) => ({ key: segment.id, segments: [segment] }));
  }

  if (outline.length) {
    const pages: TranscriptPage[] = [];
    for (const row of withSectionMarkers(segments, outline)) {
      if (row.kind === 'section') {
        pages.push({ key: row.key, section: row.section, segments: [] });
        continue;
      }
      // Lines before the first 구간 heading still need a card of their own.
      if (!pages.length) pages.push({ key: 'intro', segments: [] });
      pages[pages.length - 1]!.segments.push(row.segment);
    }
    return pages.filter((page) => page.segments.length > 0);
  }

  const pages: TranscriptPage[] = [];
  for (const segment of segments) {
    const bucket = Math.floor(segment.startMs / TIME_PAGE_MS);
    const last = pages[pages.length - 1];
    if (last && last.key === `time-${bucket}`) {
      last.segments.push(segment);
    } else {
      pages.push({ key: `time-${bucket}`, segments: [segment] });
    }
  }
  return pages;
}

/** The card holding a line, or -1 when no card does (it was filtered out). */
export function pageIndexOfSegment(pages: readonly TranscriptPage[], segmentId: string): number {
  return pages.findIndex((page) => page.segments.some((segment) => segment.id === segmentId));
}

/**
 * The card a sideways swipe lands on: leftward is forward. Null at either end,
 * so the swipe falls through to the neighbouring tab instead of doing nothing.
 */
export function cardForSwipe(index: number, count: number, translationX: number, threshold: number): number | null {
  if (Math.abs(translationX) < threshold || count <= 1) return null;
  const next = translationX < 0 ? index + 1 : index - 1;
  return next >= 0 && next < count ? next : null;
}
