import { safeImportedFileName } from './preserve-study-source';

describe('safeImportedFileName', () => {
  it('keeps a supported extension and removes path characters', () => {
    expect(safeImportedFileName('../../인공지능 개론 5주차.M4A')).toBe(
      '인공지능-개론-5주차.m4a',
    );
  });

  it('falls back when the source name is not usable', () => {
    expect(safeImportedFileName('...')).toBe('study-source');
  });
});

