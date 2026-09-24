import type { LensReport } from '@/types';

import { momentDensity, rubricComparison } from './lens-charts';
import {
  bestRubric,
  comparisonSentence,
  densitySentence,
  reportConclusion,
  rubricExplanation,
  scoreWord,
  weakestRubric,
} from './lens-copy';

const REPORT: LensReport = {
  overall: 4.1,
  rubric: [
    { key: 'structure', label: '구조', score: 4.3, evidence: '순서대로 설명했어요.' },
    { key: 'clarity', label: '명료성', score: 4.1, evidence: '예시로 구분했어요.' },
    { key: 'evidence', label: '근거 활용', score: 3.8, evidence: '기준이 더 필요해요.' },
    { key: 'delivery', label: '전달력', score: 4, evidence: '강조가 분명했어요.' },
  ],
  strengths: [{ text: '정의 뒤에 과정을 바로 연결했어요.', sourceStartMs: 402_000 }],
  improvements: [
    { text: '지표 조건을 질문으로 환기해요.', sourceStartMs: 2_238_000, action: '질문으로 시작해요' },
  ],
  priority: { text: '지표 조건을 먼저 물어요.', sourceStartMs: 2_238_000, action: '질문 하나로 시작해요' },
};

describe('rubric copy', () => {
  it('explains each known rubric and falls back for unknown keys', () => {
    expect(rubricExplanation('structure')).toBe('시작, 본론, 마무리가 순서대로 이어졌는지');
    expect(rubricExplanation('clarity')).toBe('문장이 짧고 한 번에 알아듣게 말했는지');
    expect(rubricExplanation('evidence')).toBe('주장마다 예시나 수치가 따라왔는지');
    expect(rubricExplanation('delivery')).toBe('속도와 강조가 듣기 편했는지');
    expect(rubricExplanation('humour')).toBe('이 항목에서 얼마나 잘했는지');
  });

  it('puts a word next to every number', () => {
    expect(scoreWord(4.5)).toBe('아주 좋아요');
    expect(scoreWord(3.5)).toBe('좋아요');
    expect(scoreWord(2.5)).toBe('보통이에요');
    expect(scoreWord(2.4)).toBe('아쉬워요');
  });
});

describe('report conclusion', () => {
  it('finds the best and weakest rubric', () => {
    expect(bestRubric(REPORT.rubric)?.key).toBe('structure');
    expect(weakestRubric(REPORT.rubric)?.key).toBe('evidence');
    expect(bestRubric([])).toBeNull();
  });

  it('writes the 총평 sentence with particles that fit the labels', () => {
    const conclusion = reportConclusion(REPORT);
    expect(conclusion.sentence).toBe(
      '4.1점, 좋아요. 구조가 가장 좋았고, 근거 활용은 아쉬웠어요.',
    );
    expect(conclusion.highlight?.sourceStartMs).toBe(402_000);
    expect(conclusion.fix).toBe(REPORT.priority);
  });

  it('falls back to the first improvement without a priority and notes an even spread', () => {
    const conclusion = reportConclusion({
      ...REPORT,
      overall: 4,
      priority: null,
      rubric: REPORT.rubric.map((metric) => ({ ...metric, score: 4 })),
    });
    expect(conclusion.sentence).toBe('4.0점, 좋아요. 네 항목이 고르게 나왔어요.');
    expect(conclusion.fix).toBe(REPORT.improvements[0]);
  });
});

describe('comparison sentence', () => {
  const previous = [
    { key: 'structure', label: '구조', score: 3.4 },
    { key: 'clarity', label: '명료성', score: 4.3 },
    { key: 'evidence', label: '근거 활용', score: 3.8 },
    { key: 'delivery', label: '전달력', score: 4 },
  ];

  it('names what rose most and what slipped, with fitting particles', () => {
    expect(comparisonSentence(rubricComparison(REPORT.rubric, previous))).toBe(
      '구조가 +0.9로 가장 많이 올랐고, 명료성은 -0.2로 내려갔어요.',
    );
  });

  it('says plainly when only one direction happened', () => {
    const onlyUp = previous.map((metric) =>
      metric.key === 'clarity' ? { ...metric, score: 4.1 } : metric,
    );
    expect(comparisonSentence(rubricComparison(REPORT.rubric, onlyUp))).toBe(
      '구조가 +0.9로 가장 많이 올랐고, 내려간 항목은 없어요.',
    );
    const onlyDown = previous.map((metric) =>
      metric.key === 'structure' ? { ...metric, score: 4.3 } : metric,
    );
    expect(comparisonSentence(rubricComparison(REPORT.rubric, onlyDown))).toBe(
      '올라간 항목은 없고, 명료성은 -0.2로 내려갔어요.',
    );
  });

  it('does not dress up a flat result, and says nothing without a pair', () => {
    expect(comparisonSentence(rubricComparison(REPORT.rubric, REPORT.rubric))).toBe(
      '4개 항목이 지난번과 같아요.',
    );
    expect(comparisonSentence([])).toBe('');
  });
});

describe('density sentence', () => {
  const duration = 3_134_000;

  it('says which half each kind of evidence sits in', () => {
    const density = momentDensity(REPORT.strengths, REPORT.improvements, duration, 6);
    expect(density).not.toBeNull();
    expect(densitySentence(density!)).toBe(
      '잘한 점은 앞쪽에 몰려 있고, 더 좋아질 점은 뒤쪽에 몰려 있어요.',
    );
  });

  it('leaves out a kind that has nothing, and calls a mix a mix', () => {
    const onlyStrengths = momentDensity(REPORT.strengths, [], duration, 6);
    expect(densitySentence(onlyStrengths!)).toBe('잘한 점은 앞쪽에 몰려 있어요.');
    const spread = momentDensity(
      [],
      [
        { text: '앞쪽', sourceStartMs: 100_000 },
        { text: '뒤쪽', sourceStartMs: 3_000_000 },
      ],
      duration,
      6,
    );
    expect(densitySentence(spread!)).toBe('더 좋아질 점은 앞뒤에 고루 있어요.');
  });
});
