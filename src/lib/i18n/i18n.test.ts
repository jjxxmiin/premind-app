import { makeT, translate } from './core';

describe('app i18n core', () => {
  const dict = { 저장: 'Save', '자료 {n}개': { one: '{n} item', other: '{n} items' }, 'quiz|열기': 'Start', 열기: 'Open' };

  it('keeps Korean exactly as written', () => {
    expect(translate('ko', [dict], '저장')).toBe('저장');
    expect(translate('ko', [dict], '자료 {n}개', { n: 3 })).toBe('자료 3개');
  });

  it('translates, fills and picks plurals in English', () => {
    const t = makeT('en', [dict]);
    expect(t('저장')).toBe('Save');
    expect(t('자료 {n}개', { n: 1 })).toBe('1 item');
    expect(t('자료 {n}개', { n: 4 })).toBe('4 items');
    expect(t.ctx('quiz', '열기')).toBe('Start');
    expect(t('열기')).toBe('Open');
  });

  it('falls back to the Korean sentence when a translation is missing', () => {
    expect(translate('en', [dict], '없는 문장')).toBe('없는 문장');
  });
});
