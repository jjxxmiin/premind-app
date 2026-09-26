import { studyStreak } from './streak';

/** Noon local time, `offset` days before 2026-09-26. */
function at(offset: number): string {
  const date = new Date(2026, 8, 26, 12, 0, 0);
  date.setDate(date.getDate() - offset);
  return date.toISOString();
}

const NOW = new Date(2026, 8, 26, 20, 0, 0).getTime();

describe('studyStreak', () => {
  it('is zero with nothing answered', () => {
    expect(studyStreak([], NOW)).toBe(0);
  });

  it('counts days in a row ending today', () => {
    expect(studyStreak([{ attemptedAt: at(0) }, { attemptedAt: at(1) }, { attemptedAt: at(2) }], NOW)).toBe(3);
  });

  it('keeps yesterday’s run alive before today’s first question', () => {
    expect(studyStreak([{ attemptedAt: at(1) }, { attemptedAt: at(2) }], NOW)).toBe(2);
  });

  it('stops at the first day missed', () => {
    expect(studyStreak([{ attemptedAt: at(0) }, { attemptedAt: at(2) }], NOW)).toBe(1);
    expect(studyStreak([{ attemptedAt: at(3) }], NOW)).toBe(0);
  });
});
