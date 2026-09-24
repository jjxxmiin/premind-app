import { formatSourcePosition, pageNumberOf } from './format';

describe('formatSourcePosition', () => {
  it('writes a time for a recording', () => {
    expect(formatSourcePosition(65_000, false)).toBe('01:05');
    expect(formatSourcePosition(0, false)).toBe('00:00');
  });

  it('writes a page for a document', () => {
    expect(formatSourcePosition(0, true)).toBe('1쪽');
    expect(formatSourcePosition(1_000, true)).toBe('2쪽');
    expect(formatSourcePosition(12_000, true)).toBe('13쪽');
  });

  it('never points at a page before the first', () => {
    expect(pageNumberOf(-5_000)).toBe(1);
    expect(formatSourcePosition(-1, true)).toBe('1쪽');
  });
});
