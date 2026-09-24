import type { ConfusionReason } from '@/types';

import { confusionQuestion, quotePassage } from './confusion-question';

const REASONS: ConfusionReason[] = [
  'terminology',
  'needs-example',
  'too-fast',
  'unclear',
];

describe('quotePassage', () => {
  it('leaves a short passage alone', () => {
    expect(quotePassage('지도학습은 정답을 보고 배워요.')).toBe(
      '지도학습은 정답을 보고 배워요.',
    );
  });

  it('collapses the line breaks a page of text arrives with', () => {
    expect(quotePassage('지도학습은\n  정답을\n보고 배워요.')).toBe(
      '지도학습은 정답을 보고 배워요.',
    );
  });

  it('cuts at a sentence end rather than mid-clause', () => {
    const passage = '지도학습은 정답을 보고 배워요. 분류와 회귀로 나뉘어요. 그리고 또 다른 이야기가 이어져요.';
    const quote = quotePassage(passage, 60);
    expect(quote.endsWith('요.')).toBe(true);
    expect(quote).not.toContain('...');
  });

  it('falls back to an ellipsis when no sentence ends in the back half', () => {
    const quote = quotePassage('가'.repeat(200), 60);
    expect(quote.endsWith('...')).toBe(true);
    expect(quote.length).toBeLessThanOrEqual(63);
  });

  it('answers an empty passage with an empty quote', () => {
    expect(quotePassage('')).toBe('');
    expect(quotePassage('   \n  ')).toBe('');
  });
});

describe('confusionQuestion', () => {
  const passage = '과적합은 훈련 데이터를 외운 상태예요.';

  it('quotes the passage so the answer is about that passage', () => {
    for (const reason of REASONS) {
      expect(confusionQuestion(reason, passage)).toContain(passage);
    }
  });

  it('asks a different thing for each reason', () => {
    const asked = REASONS.map((reason) => confusionQuestion(reason, passage));
    expect(new Set(asked).size).toBe(REASONS.length);
  });

  it('asks for plain words when the terms were the problem', () => {
    expect(confusionQuestion('terminology', passage)).toContain('쉬운 말로');
  });

  it('asks for an example when that is what was missing', () => {
    expect(confusionQuestion('needs-example', passage)).toContain('예를 들어');
  });

  it('asks for steps when it went too fast', () => {
    expect(confusionQuestion('too-fast', passage)).toContain('단계별로');
  });

  it('still asks something usable when the passage is empty', () => {
    for (const reason of REASONS) {
      const question = confusionQuestion(reason, '');
      expect(question.trim().length).toBeGreaterThan(10);
      expect(question).not.toContain('""');
    }
  });

  it('reads as something a person would type, ending in a request', () => {
    for (const reason of REASONS) {
      expect(confusionQuestion(reason, passage).trim().endsWith('설명해줘.')).toBe(true);
    }
  });
});
