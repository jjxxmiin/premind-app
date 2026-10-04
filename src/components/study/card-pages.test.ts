import type { OutlineSection, TranscriptSegment } from '@/types';

import { TIME_PAGE_MS, cardForSwipe, pageIndexOfSegment, transcriptPagesFor } from './card-pages';

// lucide ships untransformed ESM; the icons are never rendered here.
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const line = (id: string, startMs: number, endMs = startMs + 9_000): TranscriptSegment => ({
  id,
  startMs,
  endMs,
  text: id,
});

const section = (heading: string, startMs: number): OutlineSection => ({ heading, startMs, body: heading });

describe('transcriptPagesFor', () => {
  it('gives a document one card per page', () => {
    const pages = transcriptPagesFor([line('p1', 0), line('p2', 1_000), line('p5', 4_000)], {
      outline: [],
      document: true,
      filtered: false,
    });
    expect(pages.map((page) => page.segments.map((segment) => segment.id))).toEqual([['p1'], ['p2'], ['p5']]);
  });

  it('gives a lecture with an outline one card per 구간, lines before it in their own card', () => {
    const pages = transcriptPagesFor(
      [line('a', 0), line('b', 60_000), line('c', 120_000), line('d', 180_000)],
      { outline: [section('둘째', 60_000), section('셋째', 170_000)], document: false, filtered: false },
    );
    expect(pages.map((page) => [page.section?.heading, page.segments.map((s) => s.id)])).toEqual([
      [undefined, ['a']],
      ['둘째', ['b', 'c']],
      ['셋째', ['d']],
    ]);
  });

  it('cuts a lecture without an outline by the clock', () => {
    const pages = transcriptPagesFor(
      [line('a', 0), line('b', TIME_PAGE_MS - 1), line('c', TIME_PAGE_MS), line('d', TIME_PAGE_MS * 3)],
      { outline: [], document: false, filtered: false },
    );
    expect(pages.map((page) => page.segments.map((s) => s.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('keeps a filtered list in one column', () => {
    const pages = transcriptPagesFor([line('a', 0), line('b', TIME_PAGE_MS * 4)], {
      outline: [section('x', 0)],
      document: true,
      filtered: true,
    });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.segments.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('finds the card a line is on', () => {
    const pages = transcriptPagesFor([line('a', 0), line('b', TIME_PAGE_MS)], {
      outline: [],
      document: false,
      filtered: false,
    });
    expect(pageIndexOfSegment(pages, 'b')).toBe(1);
    expect(pageIndexOfSegment(pages, 'gone')).toBe(-1);
  });
});

describe('cardForSwipe', () => {
  it('moves forward on a leftward swipe and back on a rightward one', () => {
    expect(cardForSwipe(1, 3, -80, 40)).toBe(2);
    expect(cardForSwipe(1, 3, 80, 40)).toBe(0);
  });

  it('lets the swipe fall through to the tab at either end or under the threshold', () => {
    expect(cardForSwipe(2, 3, -80, 40)).toBeNull();
    expect(cardForSwipe(0, 3, 80, 40)).toBeNull();
    expect(cardForSwipe(1, 3, -20, 40)).toBeNull();
    expect(cardForSwipe(0, 1, -80, 40)).toBeNull();
  });
});
