import { DEFAULT_FILTERS, isNarrowed, materialCountLabel } from './library';

describe('materialCountLabel', () => {
  it('counts the subject by default', () => {
    expect(materialCountLabel(4, 4, DEFAULT_FILTERS)).toBe('자료 4개');
  });

  it('says how many remain while a status filter is on', () => {
    expect(
      materialCountLabel(4, 2, { ...DEFAULT_FILTERS, status: 'ready' }),
    ).toBe('자료 4개 중 2개');
  });

  it('names the saved switch', () => {
    expect(
      materialCountLabel(3, 3, { ...DEFAULT_FILTERS, savedOnly: true }),
    ).toBe('저장한 자료 3개');
    expect(
      materialCountLabel(3, 1, { ...DEFAULT_FILTERS, savedOnly: true, status: 'failed' }),
    ).toBe('저장한 자료 3개 중 1개');
  });

  it('reads "없음" for an empty subject', () => {
    expect(materialCountLabel(0, 0, DEFAULT_FILTERS)).toBe('자료 없음');
    expect(
      materialCountLabel(0, 0, { ...DEFAULT_FILTERS, savedOnly: true }),
    ).toBe('저장한 자료 없음');
  });

  it('never uses a middot', () => {
    expect(
      materialCountLabel(4, 2, { ...DEFAULT_FILTERS, status: 'processing' }),
    ).not.toContain('·');
  });
});

describe('isNarrowed', () => {
  it('ignores sort and view', () => {
    expect(isNarrowed(DEFAULT_FILTERS)).toBe(false);
    expect(isNarrowed({ ...DEFAULT_FILTERS, sort: 'title', view: 'card' })).toBe(false);
  });

  it('flags a status filter or the saved switch', () => {
    expect(isNarrowed({ ...DEFAULT_FILTERS, status: 'ready' })).toBe(true);
    expect(isNarrowed({ ...DEFAULT_FILTERS, savedOnly: true })).toBe(true);
  });
});
