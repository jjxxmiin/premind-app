import type { QuizAttempt, QuizQuestion } from '../types';

import {
  accuracyTrend,
  conceptResults,
  dayKey,
  joinTerms,
  josa,
  latestAttemptsByQuestion,
  masteryHeadline,
  masteryLine,
  masteryScore,
  masteryVerdict,
  nextSteps,
  overallMastery,
  overviewCopy,
  studyPlan,
  summarizeMastery,
  weekCaption,
  weekdayActivity,
  weeklyOverview,
} from './mastery';

function question(id: string, concept: string, sourceStartMs: number): QuizQuestion {
  return {
    id,
    type: 'multiple-choice',
    concept,
    prompt: `${concept}에 대한 문제`,
    choices: ['하나', '둘', '셋'],
    correctChoiceIndex: 0,
    explanation: '설명',
    sourceStartMs,
  };
}

function attempt(
  questionId: string,
  isCorrect: boolean,
  attemptedAt: string,
  materialId = 'm-1',
): QuizAttempt {
  return {
    id: `${questionId}-${attemptedAt}`,
    materialId,
    questionId,
    selectedChoiceIndex: isCorrect ? 0 : 1,
    isCorrect,
    attemptedAt,
  };
}

const QUESTIONS = [
  question('q1', '지도학습', 402_000),
  question('q2', '분류와 회귀', 751_000),
  question('q3', '과적합', 1_694_000),
  question('q4', '분류와 회귀', 900_000),
];

const NOTE = {
  summary: '요약',
  keyPoints: ['정답이 있는 데이터를 쓴다', '손실을 줄인다', '과적합을 조심한다'],
  concepts: [],
  estimatedReviewMinutes: 5,
  teacherVerified: false,
  updatedAt: '2026-09-01T03:00:00.000Z',
};

describe('latest attempt per question', () => {
  it('keeps the newest attempt for each question', () => {
    const latest = latestAttemptsByQuestion([
      attempt('q1', false, '2026-09-01T03:00:00.000Z'),
      attempt('q1', true, '2026-09-02T03:00:00.000Z'),
      attempt('q2', true, '2026-09-01T03:00:00.000Z'),
    ]);
    expect(latest.get('q1')?.isCorrect).toBe(true);
    expect(latest.get('q2')?.isCorrect).toBe(true);
    expect(latest.size).toBe(2);
  });
});

describe('concept results', () => {
  it('groups questions by concept and flags a concept weak when its latest answer is wrong', () => {
    const latest = latestAttemptsByQuestion([
      attempt('q1', true, '2026-09-01T03:00:00.000Z'),
      attempt('q2', false, '2026-09-01T03:00:00.000Z'),
      attempt('q4', true, '2026-09-01T03:00:00.000Z'),
    ]);
    const results = conceptResults(QUESTIONS, latest);
    expect(results.map((result) => result.concept)).toEqual(['지도학습', '분류와 회귀', '과적합']);
    const regression = results[1];
    if (!regression) throw new Error('missing concept');
    expect(regression.questionCount).toBe(2);
    expect(regression.answeredCount).toBe(2);
    expect(regression.correctCount).toBe(1);
    expect(regression.weak).toBe(true);
    expect(regression.missedQuestion?.id).toBe('q2');
    expect(regression.sourceStartMs).toBe(751_000);
    expect(results[0]?.weak).toBe(false);
    expect(results[2]?.answeredCount).toBe(0);
    expect(results[2]?.weak).toBe(false);
  });
});

describe('mastery score', () => {
  it('is 70% quiz accuracy plus 30% checklist when both exist', () => {
    expect(masteryScore(0.8, 2 / 3, 2)).toBe(76);
  });

  it('uses the quiz alone without key points', () => {
    expect(masteryScore(0.75, null, 0)).toBe(75);
  });

  it('uses the checklist alone without questions', () => {
    expect(masteryScore(null, 1 / 3, 1)).toBe(33);
  });

  it('is null when nothing has been done', () => {
    expect(masteryScore(null, null, 0)).toBeNull();
    expect(masteryScore(null, 0, 0)).toBeNull();
  });

  it('counts an unchecked list as zero once questions were answered', () => {
    expect(masteryScore(1, 0, 0)).toBe(70);
  });

  it('names the score in plain words', () => {
    expect(masteryVerdict(95)).toBe('아주 잘 알아요');
    expect(masteryVerdict(76)).toBe('잘 알아요');
    expect(masteryVerdict(50)).toBe('조금 더 봐요');
    expect(masteryVerdict(20)).toBe('다시 봐요');
  });
});

describe('accuracy trend', () => {
  it('groups attempts by local day, oldest first, with accuracy per day', () => {
    const trend = accuracyTrend([
      attempt('q1', true, '2026-09-02T12:00:00.000Z'),
      attempt('q2', false, '2026-09-02T12:30:00.000Z'),
      attempt('q1', true, '2026-09-01T12:00:00.000Z'),
      attempt('q2', true, '2026-09-01T12:10:00.000Z'),
    ]);
    expect(trend.map((point) => point.day)).toEqual([
      dayKey('2026-09-01T12:00:00.000Z'),
      dayKey('2026-09-02T12:00:00.000Z'),
    ]);
    expect(trend[0]?.accuracy).toBe(1);
    expect(trend[1]?.accuracy).toBe(0.5);
    expect(trend[1]?.attemptCount).toBe(2);
    expect(trend[1]?.lastAttemptAt).toBe('2026-09-02T12:30:00.000Z');
  });

  it('is empty with no attempts', () => {
    expect(accuracyTrend([])).toEqual([]);
  });
});

describe('summarizeMastery', () => {
  const material = { id: 'm-1', quiz: QUESTIONS, note: NOTE };

  it('returns null and a start step when nothing was done', () => {
    const summary = summarizeMastery(material, [], null);
    expect(summary.score).toBeNull();
    expect(summary.accuracy).toBeNull();
    expect(summary.checklistRatio).toBe(0);
    expect(summary.nextSteps).toEqual([
      { kind: 'start', title: '문제 풀기', detail: '문제 4개를 풀면 이해도가 생겨요' },
    ]);
    expect(masteryHeadline(summary)).toBe('아직 이해도를 볼 게 없어요.');
    expect(masteryLine(summary)).toBe('문제 4개가 기다려요');
  });

  it('scores the latest answers, the checklist and lists the weak concepts', () => {
    const attempts = [
      attempt('q1', false, '2026-09-01T12:00:00.000Z'),
      attempt('q1', true, '2026-09-02T12:00:00.000Z'),
      attempt('q2', false, '2026-09-02T12:05:00.000Z'),
      attempt('q3', true, '2026-09-02T12:10:00.000Z'),
      attempt('q4', true, '2026-09-02T12:15:00.000Z'),
      attempt('q9', true, '2026-09-02T12:20:00.000Z', 'm-2'),
    ];
    const summary = summarizeMastery(material, attempts, {
      checkedPoints: ['정답이 있는 데이터를 쓴다', '과적합을 조심한다', '없는 항목'],
    });
    expect(summary.answeredCount).toBe(4);
    expect(summary.correctCount).toBe(3);
    expect(summary.accuracy).toBe(0.75);
    expect(summary.checkedCount).toBe(2);
    expect(summary.checklistRatio).toBeCloseTo(2 / 3);
    // 0.75 * 70 + (2/3) * 30 = 52.5 + 20 = 72.5 -> 73
    expect(summary.score).toBe(73);
    expect(summary.weakConcepts.map((concept) => concept.concept)).toEqual(['분류와 회귀']);
    expect(summary.trend).toHaveLength(2);
    expect(summary.lastAttemptAt).toBe('2026-09-02T12:15:00.000Z');
    expect(masteryHeadline(summary)).toBe('이 자료는 73% 이해했어요. 분류와 회귀를 헷갈렸어요.');
    expect(masteryLine(summary)).toBe('문제 4개 중 3개 맞힘, 취약 개념 1개');
    expect(summary.nextSteps).toEqual([
      {
        kind: 'relisten',
        title: '12:31부터 다시 듣기',
        detail: '분류와 회귀를 헷갈렸어요',
        sourceStartMs: 751_000,
        concept: '분류와 회귀',
      },
      { kind: 'retry', title: '문제 다시 풀기', detail: '틀린 문제 1개' },
      { kind: 'checklist', title: '핵심 내용 확인', detail: '아직 확인하지 않은 내용 1개' },
    ]);
  });

  it('scores the checklist alone when the material has no questions', () => {
    const summary = summarizeMastery(
      { id: 'm-1', quiz: [], note: NOTE },
      [],
      { checkedPoints: ['손실을 줄인다'] },
    );
    expect(summary.score).toBe(33);
    expect(masteryLine(summary)).toBe('핵심 내용 3개 중 1개 확인');
    expect(masteryHeadline(summary)).toBe('이 자료는 33% 이해했어요. 문제를 풀면 더 정확해져요.');
    expect(summary.nextSteps).toEqual([
      { kind: 'checklist', title: '핵심 내용 확인', detail: '아직 확인하지 않은 내용 2개' },
    ]);
  });

  it('reports a clean run without weak concepts', () => {
    const summary = summarizeMastery(
      { id: 'm-1', quiz: QUESTIONS.slice(0, 1), note: undefined },
      [attempt('q1', true, '2026-09-02T12:00:00.000Z')],
      null,
    );
    expect(summary.score).toBe(100);
    expect(masteryHeadline(summary)).toBe('이 자료는 100% 이해했어요. 헷갈린 개념이 없어요.');
    expect(masteryLine(summary)).toBe('문제 1개 중 1개 맞힘, 취약 개념 없음');
    expect(summary.nextSteps).toEqual([]);
  });
});

describe('next steps', () => {
  it('mentions unanswered questions and caps re-listen steps at three', () => {
    const weak = ['a', 'b', 'c', 'd'].map((concept, index) => ({
      concept,
      questionCount: 1,
      answeredCount: 1,
      correctCount: 0,
      weak: true,
      missedQuestion: null,
      sourceStartMs: (index + 1) * 60_000,
    }));
    const steps = nextSteps({
      questionCount: 6,
      answeredCount: 4,
      correctCount: 0,
      keyPointCount: 0,
      checkedCount: 0,
      weakConcepts: weak,
    });
    expect(steps.filter((step) => step.kind === 'relisten')).toHaveLength(3);
    expect(steps[3]).toEqual({
      kind: 'retry',
      title: '문제 다시 풀기',
      detail: '틀린 문제 4개, 안 푼 문제 2개',
    });
  });
});

describe('weekly overview', () => {
  const now = Date.parse('2026-09-06T12:00:00.000Z');

  it('counts only the last seven days and materials whose accuracy rose', () => {
    const overview = weeklyOverview(
      [
        attempt('q1', false, '2026-08-20T12:00:00.000Z'),
        attempt('q1', false, '2026-09-03T12:00:00.000Z'),
        attempt('q2', true, '2026-09-05T12:00:00.000Z'),
        attempt('q9', true, '2026-09-04T12:00:00.000Z', 'm-2'),
        attempt('q9', false, '2026-09-05T12:00:00.000Z', 'm-2'),
      ],
      now,
    );
    expect(overview.attemptCount).toBe(4);
    expect(overview.correctCount).toBe(2);
    expect(overview.accuracy).toBe(0.5);
    expect(overview.improvedCount).toBe(1);
    expect(overview.trend).toHaveLength(4);
  });

  it('is empty without attempts', () => {
    expect(weeklyOverview([], now)).toEqual({
      attemptCount: 0,
      correctCount: 0,
      accuracy: null,
      improvedCount: 0,
      trend: [],
    });
  });
});

describe('korean helpers', () => {
  it('picks particles by the final syllable', () => {
    expect(josa('과적합', '을')).toBe('을');
    expect(josa('회귀', '을')).toBe('를');
    expect(josa('구조', '이')).toBe('가');
    expect(josa('전달력', '이')).toBe('이');
    expect(josa('명료성', '은')).toBe('은');
    expect(josa('근거', '은')).toBe('는');
    expect(josa('과적합', '와')).toBe('과');
    expect(josa('회귀', '와')).toBe('와');
    expect(josa('SVM', '을')).toBe('을(를)');
  });

  it('joins up to two terms and counts the rest', () => {
    expect(joinTerms(['회귀'])).toBe('회귀');
    expect(joinTerms(['회귀', '분류'])).toBe('회귀와 분류');
    expect(joinTerms(['과적합', '분류'])).toBe('과적합과 분류');
    expect(joinTerms(['회귀', '분류', '과적합'])).toBe('회귀와 분류 등 3개');
    expect(joinTerms([])).toBe('');
  });
});

describe('weekday activity', () => {
  // A Sunday at noon local time, so the strip reads 월 to 일.
  const sunday = new Date(2026, 8, 6, 12, 0, 0).getTime();
  const local = (year: number, month: number, day: number, hour: number) =>
    new Date(year, month - 1, day, hour).toISOString();

  it('lists the last seven local days, Monday first when today is Sunday, today last', () => {
    const days = weekdayActivity([], sunday);
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.label)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    expect(days[6]?.today).toBe(true);
    expect(days[6]?.day).toBe('2026-09-06');
    expect(days[0]?.day).toBe('2026-08-31');
    expect(days.filter((day) => day.today)).toHaveLength(1);
  });

  it('ends on today whatever the weekday', () => {
    const wednesday = new Date(2026, 8, 9, 8, 0, 0).getTime();
    const days = weekdayActivity([], wednesday);
    expect(days.map((day) => day.label)).toEqual(['목', '금', '토', '일', '월', '화', '수']);
    expect(days[6]?.day).toBe('2026-09-09');
  });

  it('counts attempts by local day and ignores older ones', () => {
    const days = weekdayActivity(
      [
        attempt('q1', true, local(2026, 9, 6, 9)),
        attempt('q2', false, local(2026, 9, 6, 23)),
        attempt('q3', true, local(2026, 9, 1, 0)),
        attempt('q4', true, local(2026, 8, 30, 23)),
      ],
      sunday,
    );
    expect(days[6]?.attemptCount).toBe(2);
    expect(days[6]?.correctCount).toBe(1);
    expect(days[1]?.attemptCount).toBe(1);
    expect(days.reduce((sum, day) => sum + day.attemptCount, 0)).toBe(3);
    expect(weekCaption(days)).toBe('이번 주 문제 3개, 정답률 67%');
  });

  it('says so when nothing was solved this week', () => {
    expect(weekCaption(weekdayActivity([], sunday))).toBe('이번 주는 아직 안 풀었어요');
  });
});

describe('overall mastery', () => {
  it('averages the scored materials and rounds', () => {
    expect(overallMastery([{ score: 80 }, { score: null }, { score: 71 }])).toBe(76);
  });

  it('is null until something is scored', () => {
    expect(overallMastery([{ score: null }, { score: null }])).toBeNull();
    expect(overallMastery([])).toBeNull();
  });
});

describe('overview copy', () => {
  it('invites the first question before anything is done', () => {
    expect(
      overviewCopy({ materialCount: 3, studiedCount: 0, weakConcept: null, unansweredCount: 9 }),
    ).toEqual({ title: '첫 문제를 풀면 이해도가 시작돼요', detail: '' });
  });

  it('names the weakest concept once studying started', () => {
    expect(
      overviewCopy({
        materialCount: 3,
        studiedCount: 2,
        weakConcept: '분류와 회귀',
        unansweredCount: 4,
      }),
    ).toEqual({
      title: '자료 3개 중 2개를 공부했어요',
      detail: '분류와 회귀를 다시 볼 차례예요',
    });
  });

  it('points at the remaining questions, then celebrates', () => {
    expect(
      overviewCopy({ materialCount: 2, studiedCount: 1, weakConcept: null, unansweredCount: 4 })
        .detail,
    ).toBe('남은 문제 4개를 풀어 봐요');
    expect(
      overviewCopy({ materialCount: 2, studiedCount: 2, weakConcept: null, unansweredCount: 0 })
        .detail,
    ).toBe('푼 문제를 모두 맞혔어요');
  });
});

describe('study plan', () => {
  /** A recording: its positions are times. */
  const audioSource = {
    uri: 'file:///a.m4a',
    fileName: 'a.m4a',
    mimeType: 'audio/mp4',
    kind: 'audio' as const,
    origin: 'recording' as const,
  };
  const first = {
    id: 'm-1',
    title: '5주차, 지도학습의 원리',
    quiz: QUESTIONS,
    source: audioSource,
  };
  const second = {
    id: 'm-2',
    title: '시각화 실습',
    quiz: [question('q9', '차트 선택', 86_000)],
    source: audioSource,
  };

  it('is empty until a material is scored', () => {
    const rows = [
      { material: first, summary: summarizeMastery(first, [], null) },
      { material: second, summary: summarizeMastery(second, [], null) },
    ];
    expect(studyPlan(rows)).toEqual([]);
  });

  it('orders weak concepts, then retries, then untouched questions, and caps at three', () => {
    const attempts = [
      attempt('q1', true, '2026-09-02T12:00:00.000Z'),
      attempt('q2', false, '2026-09-02T12:05:00.000Z'),
      attempt('q3', true, '2026-09-02T12:10:00.000Z'),
    ];
    const rows = [
      { material: first, summary: summarizeMastery(first, attempts, null) },
      { material: second, summary: summarizeMastery(second, attempts, null) },
    ];
    const plan = studyPlan(rows);
    expect(plan).toEqual([
      {
        kind: 'relisten',
        materialId: 'm-1',
        title: '분류와 회귀',
        detail: '5주차, 지도학습의 원리 / 12:31부터',
        sourceStartMs: 751_000,
        concept: '분류와 회귀',
      },
      {
        kind: 'retry',
        materialId: 'm-1',
        title: '문제 다시 풀기',
        detail: '5주차, 지도학습의 원리 / 틀린 문제 1개',
      },
      {
        kind: 'start',
        materialId: 'm-1',
        title: '안 푼 문제 풀기',
        detail: '5주차, 지도학습의 원리 / 문제 1개',
      },
    ]);
    expect(studyPlan(rows, 4)[3]).toEqual({
      kind: 'start',
      materialId: 'm-2',
      title: '안 푼 문제 풀기',
      detail: '시각화 실습 / 문제 1개',
    });
  });

  it('puts the material with more wrong answers first among retries', () => {
    const attempts = [
      attempt('q1', true, '2026-09-02T12:00:00.000Z'),
      attempt('q9', false, '2026-09-01T12:00:00.000Z', 'm-2'),
    ];
    const rows = [
      { material: first, summary: summarizeMastery(first, attempts, null) },
      { material: second, summary: summarizeMastery(second, attempts, null) },
    ];
    const plan = studyPlan(rows);
    expect(plan[0]?.kind).toBe('relisten');
    expect(plan[0]?.materialId).toBe('m-2');
    expect(plan[1]).toMatchObject({ kind: 'retry', materialId: 'm-2' });
    expect(plan[2]).toMatchObject({ kind: 'start', materialId: 'm-1' });
  });
});
