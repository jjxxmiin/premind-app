import type { QuizAttempt, QuizQuestion, StudyConcept } from '@/types';

import { difficultyCounts, quizScoreFor } from './StudyStats';

// lucide ships untransformed ESM; the icons are never rendered here.
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const quiz: QuizQuestion[] = ['q1', 'q2', 'q3'].map((id) => ({
  id,
  type: 'true-false',
  concept: '개념',
  prompt: '…',
  choices: ['맞아요', '아니에요'],
  correctChoiceIndex: 0,
  explanation: '…',
  sourceStartMs: 0,
}));

function attempt(
  questionId: string,
  isCorrect: boolean,
  attemptedAt: string,
  materialId = 'm1',
): QuizAttempt {
  return {
    id: `${materialId}-${questionId}-${attemptedAt}`,
    materialId,
    questionId,
    selectedChoiceIndex: isCorrect ? 0 : 1,
    isCorrect,
    attemptedAt,
  };
}

describe('quizScoreFor', () => {
  it('counts only the latest answer to each question of this material', () => {
    const attempts = [
      attempt('q1', true, '2026-09-06T02:00:00.000Z'),
      attempt('q1', false, '2026-09-06T01:00:00.000Z'),
      attempt('q2', false, '2026-09-06T01:30:00.000Z'),
      attempt('q3', true, '2026-09-06T01:30:00.000Z', 'other'),
    ];
    expect(quizScoreFor(quiz, attempts, 'm1')).toEqual({ correct: 1, answered: 2, total: 3 });
  });

  it('reports nothing answered when there are no attempts', () => {
    expect(quizScoreFor(quiz, [], 'm1')).toEqual({ correct: 0, answered: 0, total: 3 });
  });
});

describe('difficultyCounts', () => {
  it('tallies every level, including empty ones', () => {
    const concepts: StudyConcept[] = [
      { id: 'a', term: 'a', description: '', sourceStartMs: 0, difficulty: 'basic' },
      { id: 'b', term: 'b', description: '', sourceStartMs: 0, difficulty: 'intermediate' },
      { id: 'c', term: 'c', description: '', sourceStartMs: 0, difficulty: 'intermediate' },
    ];
    expect(difficultyCounts(concepts)).toEqual({ basic: 1, intermediate: 2, advanced: 0 });
  });
});
