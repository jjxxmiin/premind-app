import { makeT } from './core';
import { EN } from './en';
import { EN_RELEASE } from './en/release';

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('release translations', () => {
  it.each(Object.entries(EN_RELEASE))('registers %s and preserves its placeholders', (key, value) => {
    expect(EN[key]).toEqual(value);
    const variants = typeof value === 'string' ? [value] : [value.one, value.other];
    for (const variant of variants) {
      expect(placeholders(variant)).toEqual(placeholders(key));
      expect(variant).not.toMatch(/[가-힣]/);
    }
  });

  it('fills release values through the app dictionary in both locales', () => {
    const key = '질문 {current} / {total}';
    const vars = { current: 2, total: 5 };
    expect(makeT('en', [EN])(key, vars)).toBe('Question 2 / 5');
    expect(makeT('ko', [EN])(key, vars)).toBe('질문 2 / 5');
  });
});
