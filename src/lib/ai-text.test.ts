import { cleanAiLines, cleanAiText } from './ai-text';

describe('cleanAiText', () => {
  it('leaves ordinary text untouched', () => {
    const line = '정확도에서 정밀도, 재현율로 넘어가기 전에 기준을 세워요.';
    expect(cleanAiText(line)).toBe(line);
  });

  it('turns a middot between words into a comma', () => {
    expect(cleanAiText('정밀도·재현율로 넘어가요.')).toBe('정밀도, 재현율로 넘어가요.');
  });

  it('handles the lookalike separators a model may emit', () => {
    expect(cleanAiText('구조・명료성・전달력')).toBe('구조, 명료성, 전달력');
    expect(cleanAiText('구조•명료성')).toBe('구조, 명료성');
  });

  it('does not leave a space before the comma it writes', () => {
    expect(cleanAiText('구조 · 명료성')).toBe('구조, 명료성');
  });

  it('never ends a line with a dangling comma', () => {
    expect(cleanAiText('구조, 명료성·')).toBe('구조, 명료성');
  });

  it('keeps working across repeated calls', () => {
    const value = '가·나';
    expect(cleanAiText(value)).toBe('가, 나');
    expect(cleanAiText(value)).toBe('가, 나');
  });

  it('cleans every line of a list', () => {
    expect(cleanAiLines(['가·나', '다'])).toEqual(['가, 나', '다']);
  });
});
