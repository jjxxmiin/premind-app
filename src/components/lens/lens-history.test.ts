import type { LensHistoryEntry, LensReport } from '@/types';

import {
  comparisonPair,
  formatEvaluatedAt,
  formatEvaluatedDay,
  historyRows,
  selectedEntry,
} from './lens-history';

const REPORT: LensReport = {
  overall: 4.1,
  rubric: [],
  strengths: [],
  improvements: [],
  priority: null,
};

function entry(id: string, evaluatedAt: string, overall: number): LensHistoryEntry {
  return { id, evaluatedAt, report: { ...REPORT, overall } };
}

const HISTORY = [
  entry('lens-3', '2026-09-07T05:02:00.000Z', 4.1),
  entry('lens-2', '2026-09-01T09:00:00.000Z', 3.4),
  entry('lens-1', '2026-08-24T03:15:00.000Z', 3.6),
];

describe('historyRows', () => {
  it('measures each evaluation against the one before it', () => {
    const rows = historyRows(HISTORY, null);
    expect(rows.map((row) => row.delta)).toEqual([0.7, -0.2, null]);
    expect(rows.map((row) => row.latest)).toEqual([true, false, false]);
  });

  it('marks the newest as viewed until another is picked', () => {
    expect(historyRows(HISTORY, null).map((row) => row.selected)).toEqual([true, false, false]);
    expect(historyRows(HISTORY, 'lens-1').map((row) => row.selected)).toEqual([
      false,
      false,
      true,
    ]);
    // A stale id (an entry that disappeared) falls back to the newest.
    expect(historyRows(HISTORY, 'gone').map((row) => row.selected)).toEqual([true, false, false]);
  });

  it('is empty for no history', () => {
    expect(historyRows([], null)).toEqual([]);
  });
});

describe('selectedEntry', () => {
  it('returns the picked entry, else the newest, else nothing', () => {
    expect(selectedEntry(HISTORY, 'lens-2')?.id).toBe('lens-2');
    expect(selectedEntry(HISTORY, null)?.id).toBe('lens-3');
    expect(selectedEntry(HISTORY, 'gone')?.id).toBe('lens-3');
    expect(selectedEntry([], null)).toBeNull();
  });
});

describe('comparisonPair', () => {
  it('pairs the evaluation on screen with the one before it', () => {
    expect(comparisonPair(HISTORY, null)).toMatchObject({
      current: { id: 'lens-3' },
      previous: { id: 'lens-2' },
    });
    expect(comparisonPair(HISTORY, 'lens-2')).toMatchObject({
      current: { id: 'lens-2' },
      previous: { id: 'lens-1' },
    });
  });

  it('has nothing to compare for the first evaluation ever', () => {
    expect(comparisonPair(HISTORY, 'lens-1')).toBeNull();
    expect(comparisonPair(HISTORY.slice(0, 1), null)).toBeNull();
    expect(comparisonPair([], null)).toBeNull();
  });

  it('falls back to the newest for an id that is gone', () => {
    expect(comparisonPair(HISTORY, 'gone')?.current.id).toBe('lens-3');
  });
});

describe('formatEvaluatedAt', () => {
  it('prints the local day and minute without a middot', () => {
    const local = new Date(2026, 8, 7, 14, 2).toISOString();
    expect(formatEvaluatedDay(local)).toBe('9월 7일');
    expect(formatEvaluatedAt(local)).toBe('9월 7일 14:02');
    expect(formatEvaluatedAt(new Date(2026, 0, 1, 9, 5).toISOString())).toBe('1월 1일 09:05');
  });

  it('prints nothing for a date it cannot read', () => {
    expect(formatEvaluatedAt('')).toBe('');
    expect(formatEvaluatedDay('not-a-date')).toBe('');
  });
});
