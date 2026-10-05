import { createMockSnapshot } from './mock-data';
import { MOCK_DATA_EN } from './mock-data-en';

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, out));
  return out;
}

describe('English demo data', () => {
  it('has an English line for every Korean string in the demo', () => {
    const missing = strings(createMockSnapshot('ko')).filter((s) => /[가-힣]/.test(s) && !MOCK_DATA_EN[s]);
    expect(missing).toEqual([]);
  });

  it('leaves no Korean in the English demo', () => {
    expect(strings(createMockSnapshot('en')).filter((s) => /[가-힣]/.test(s))).toEqual([]);
  });

  it('keeps ids, timings and answers identical across languages', () => {
    const ko = createMockSnapshot('ko');
    const en = createMockSnapshot('en');
    expect(en.materials.map((m) => m.id)).toEqual(ko.materials.map((m) => m.id));
    expect(en.materials[0]?.quiz.map((q) => q.correctChoiceIndex)).toEqual(
      ko.materials[0]?.quiz.map((q) => q.correctChoiceIndex),
    );
    expect(en.quizAttempts.map((a) => a.questionId)).toEqual(ko.quizAttempts.map((a) => a.questionId));
  });

  it('keeps the Korean demo exactly as written', () => {
    expect(createMockSnapshot().materials[0]?.title).toBe('5주차, 지도학습의 원리');
  });
});
