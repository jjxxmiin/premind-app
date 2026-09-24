import { pageNumberOf } from '@/lib/format';
import type { TranscriptSegment } from '@/types';

/**
 * A page number is not a position in the list.
 *
 * The server drops pages with almost no text — a cover, a 목차, a divider
 * (`app/recordings/document.py`, `_MIN_PAGE_CHARS`) — so the segments that
 * reach the app are a *subset* of the document's pages, still carrying their
 * true page numbers. Code that treated the number as an index opened the wrong
 * slide and sent "대본에서 보기" to a position no segment has.
 *
 * These pin the conversion both ways. The viewer holds the same two lines
 * (`DocumentPageViewer.tsx`); this is the arithmetic they must agree on.
 */

/** A six-page PDF whose cover and divider carried no text. */
const PAGES_WITH_GAPS: TranscriptSegment[] = [
  { id: 's2', startMs: 1_000, endMs: 1_999, text: '2쪽' },
  { id: 's3', startMs: 2_000, endMs: 2_999, text: '3쪽' },
  { id: 's5', startMs: 4_000, endMs: 4_999, text: '5쪽' },
  { id: 's6', startMs: 5_000, endMs: 5_999, text: '6쪽' },
];

const pageNumbersOf = (segments: readonly TranscriptSegment[]) =>
  segments.map((segment) => pageNumberOf(segment.startMs));

const indexOfPage = (numbers: readonly number[], page: number) => {
  const found = numbers.indexOf(page);
  return found >= 0 ? found : 0;
};

describe('document page numbering', () => {
  it('reads the true page number out of the position field', () => {
    // The server writes page N as (N - 1) * 1000.
    expect(pageNumbersOf(PAGES_WITH_GAPS)).toEqual([2, 3, 5, 6]);
  });

  it('finds the slide for a page that is not at that position', () => {
    const numbers = pageNumbersOf(PAGES_WITH_GAPS);
    // Page 5 is the third slide, not the fifth. Using the number as an index
    // is the bug this file exists for.
    expect(indexOfPage(numbers, 5)).toBe(2);
    expect(indexOfPage(numbers, 2)).toBe(0);
    expect(indexOfPage(numbers, 6)).toBe(3);
  });

  it('turns a slide position back into the page number it shows', () => {
    const numbers = pageNumbersOf(PAGES_WITH_GAPS);
    // Swiping to the third slide must report page 5, not page 3 — that number
    // is what "대본에서 보기" seeks with.
    expect(numbers[2]).toBe(5);
    expect(numbers[0]).toBe(2);
  });

  it('round-trips every page through both conversions', () => {
    const numbers = pageNumbersOf(PAGES_WITH_GAPS);
    for (const page of numbers) {
      expect(numbers[indexOfPage(numbers, page)]).toBe(page);
    }
  });

  it('falls back to the first slide for a page that is not there', () => {
    const numbers = pageNumbersOf(PAGES_WITH_GAPS);
    // Page 4 was dropped for having no text; opening it must not scroll to a
    // negative offset.
    expect(indexOfPage(numbers, 4)).toBe(0);
    expect(indexOfPage(numbers, 99)).toBe(0);
  });

  it('is an identity mapping when no page was dropped', () => {
    const contiguous: TranscriptSegment[] = [
      { id: 'a', startMs: 0, endMs: 999, text: '1쪽' },
      { id: 'b', startMs: 1_000, endMs: 1_999, text: '2쪽' },
      { id: 'c', startMs: 2_000, endMs: 2_999, text: '3쪽' },
    ];
    const numbers = pageNumbersOf(contiguous);
    expect(numbers).toEqual([1, 2, 3]);
    for (const [index, page] of numbers.entries()) {
      expect(indexOfPage(numbers, page)).toBe(index);
    }
  });

  it('seeks 대본 to the position the segment actually has', () => {
    // material/[id].tsx converts the page back with (page - 1) * 1000.
    for (const segment of PAGES_WITH_GAPS) {
      const page = pageNumberOf(segment.startMs);
      expect((page - 1) * 1000).toBe(segment.startMs);
    }
  });
});
