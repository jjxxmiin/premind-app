import {
  applyStudyNotebookPatch,
  countCheckedPoints,
  emptyStudyNotebook,
  normalizeStudyNotebooks,
  toggleCheckedPoint,
} from './study-notebook';

describe('notebook persistence helpers', () => {
  it('starts empty and merges patches while stamping the time', () => {
    const first = applyStudyNotebookPatch(undefined, { memo: '메모' }, '2026-09-06T01:00:00.000Z');
    expect(first).toEqual({
      checkedPoints: [],
      reviewConcepts: [],
      highlights: [],
      memo: '메모',
      updatedAt: '2026-09-06T01:00:00.000Z',
    });
    const second = applyStudyNotebookPatch(first, { checkedPoints: ['a'] }, '2026-09-06T02:00:00.000Z');
    expect(second).toEqual({
      checkedPoints: ['a'],
      reviewConcepts: [],
      highlights: [],
      memo: '메모',
      updatedAt: '2026-09-06T02:00:00.000Z',
    });
    const third = applyStudyNotebookPatch(
      second,
      { highlights: ['칠한 문장.'] },
      '2026-09-06T03:00:00.000Z',
    );
    expect(third).toEqual({
      checkedPoints: ['a'],
      reviewConcepts: [],
      highlights: ['칠한 문장.'],
      memo: '메모',
      updatedAt: '2026-09-06T03:00:00.000Z',
    });
  });

  it('keeps well-formed notebooks and drops junk on hydrate', () => {
    expect(normalizeStudyNotebooks(undefined)).toEqual({});
    expect(normalizeStudyNotebooks(['nope'])).toEqual({});
    expect(
      normalizeStudyNotebooks({
        ok: {
          checkedPoints: ['a'],
          reviewConcepts: [],
          highlights: ['칠한 문장.'],
          memo: 'm',
          updatedAt: '2026-09-06T00:00:00.000Z',
        },
        // Written before the 형광펜 shipped: no highlights key at all.
        legacy: { checkedPoints: ['b'], reviewConcepts: [], memo: '', updatedAt: '2026-09-06T00:00:00.000Z' },
        partial: { memo: 'only memo' },
        broken: 'string',
        nullish: null,
      }),
    ).toEqual({
      ok: {
        checkedPoints: ['a'],
        reviewConcepts: [],
        highlights: ['칠한 문장.'],
        memo: 'm',
        updatedAt: '2026-09-06T00:00:00.000Z',
      },
      legacy: {
        checkedPoints: ['b'],
        reviewConcepts: [],
        highlights: [],
        memo: '',
        updatedAt: '2026-09-06T00:00:00.000Z',
      },
      partial: { ...emptyStudyNotebook(), memo: 'only memo' },
    });
  });
});

describe('key point checklist helpers', () => {
  const keyPoints = ['정답이 있는 데이터를 쓴다', '손실을 줄이는 방향으로 학습한다', '과적합을 조심한다'];

  it('checks a point on the first toggle and clears it on the next', () => {
    const once = toggleCheckedPoint([], keyPoints[1]!);
    expect(once).toEqual([keyPoints[1]]);
    expect(toggleCheckedPoint(once, keyPoints[0]!)).toEqual([keyPoints[1], keyPoints[0]]);
    expect(toggleCheckedPoint(once, keyPoints[1]!)).toEqual([]);
  });

  it('does not mutate the stored list', () => {
    const stored = [keyPoints[0]!];
    toggleCheckedPoint(stored, keyPoints[2]!);
    toggleCheckedPoint(stored, keyPoints[0]!);
    expect(stored).toEqual([keyPoints[0]]);
  });

  it('counts only points the current summary still has', () => {
    expect(countCheckedPoints(keyPoints, [])).toBe(0);
    expect(countCheckedPoints(keyPoints, [keyPoints[0]!, '예전 요약의 문장'])).toBe(1);
    expect(countCheckedPoints(keyPoints, [...keyPoints])).toBe(3);
  });
});
