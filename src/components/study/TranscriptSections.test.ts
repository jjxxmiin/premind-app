import { withSectionMarkers } from './TranscriptSections';

import type { OutlineSection, TranscriptSegment } from '@/types';

// lucide ships untransformed ESM; the icons are never rendered here.
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

function segment(id: string, startMs: number, endMs: number): TranscriptSegment {
  return { id, startMs, endMs, text: id };
}

function section(heading: string, startMs: number): OutlineSection {
  return { heading, startMs, body: `${heading} 본문` };
}

const segments = [
  segment('a', 0, 60_000),
  segment('b', 60_000, 120_000),
  segment('c', 120_000, 180_000),
];

/** `section:도입` / `segment:a`, so a placement reads as one line. */
function shape(segs: readonly TranscriptSegment[], secs: readonly OutlineSection[]) {
  return withSectionMarkers(segs, secs).map((row) =>
    row.kind === 'section' ? `section:${row.section.heading}` : `segment:${row.segment.id}`,
  );
}

describe('withSectionMarkers', () => {
  it('puts a heading above the line the section starts in', () => {
    expect(shape(segments, [section('도입', 0), section('본론', 70_000)])).toEqual([
      'section:도입',
      'segment:a',
      'section:본론',
      'segment:b',
      'segment:c',
    ]);
  });

  it('leaves the transcript untouched without sections', () => {
    expect(shape(segments, [])).toEqual(['segment:a', 'segment:b', 'segment:c']);
  });

  it('orders sections by time even if they arrive shuffled', () => {
    expect(shape(segments, [section('본론', 70_000), section('도입', 0)])).toEqual([
      'section:도입',
      'segment:a',
      'section:본론',
      'segment:b',
      'segment:c',
    ]);
  });

  it('keeps only the last section when several land on one line', () => {
    // A filter has hidden every line of 도입 and 전개: the line on screen is
    // in 정리, so that is the only heading it can carry.
    expect(
      shape(
        [segment('c', 120_000, 180_000)],
        [section('도입', 0), section('전개', 70_000), section('정리', 130_000)],
      ),
    ).toEqual(['section:정리', 'segment:c']);
  });

  it('drops sections that begin after the last line on screen', () => {
    expect(
      shape([segment('a', 0, 60_000)], [section('도입', 0), section('정리', 130_000)]),
    ).toEqual(['section:도입', 'segment:a']);
  });

  it('returns nothing when the transcript is empty', () => {
    expect(withSectionMarkers([], [section('도입', 0)])).toEqual([]);
  });
});
