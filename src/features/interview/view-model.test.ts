import { webBackupPayload } from './__fixtures__/web-backup';
import type { InterviewSession } from './types';
import {
  answeredQuestionCount,
  clean,
  comparison,
  COVERAGE_COPY,
  FIT_COPY,
  formatAnswerDuration,
  formatClock,
  relativeDay,
  sessionDestination,
  totalSpeakingMs,
} from './view-model';

const session = webBackupPayload as InterviewSession;

it('formats times the way the interview web does', () => {
  expect(formatAnswerDuration(7_000)).toBe('7초');
  expect(formatAnswerDuration(64_000)).toBe('1분 04초');
  expect(formatClock(65_000)).toBe('1:05');
  expect(formatClock(-12_000)).toBe('+0:12');
  const now = new Date(2026, 8, 26, 12);
  expect(relativeDay(new Date(2026, 8, 26, 1).toISOString(), now)).toBe('오늘');
  expect(relativeDay(new Date(2026, 8, 25, 23).toISOString(), now)).toBe('어제');
  expect(relativeDay(new Date(2026, 8, 1).toISOString(), now)).toBe('9월 1일');
});

it('counts what was practised, not how well', () => {
  expect(answeredQuestionCount(session)).toBe(2);
  expect(totalSpeakingMs(session)).toBe(50_000);
  expect(sessionDestination(session)).toEqual({ pathname: '/interview/report/[id]', params: { id: session.id } });
  expect(sessionDestination({ ...session, status: 'active' }).pathname).toBe('/interview/room/[id]');
});

it('compares the first and latest answers only when there are two', () => {
  expect(comparison(session.attempts.filter((item) => item.questionId === 'r1'))).toBeNull();
  const second = { ...session.attempts[1]!, id: 'a3', attemptNo: 2 };
  const result = comparison([session.attempts[1]!, second]);
  expect(result?.first.attempt.id).toBe('a2');
  expect(result?.last.attempt.id).toBe('a3');
  expect(result?.missingDelta).toBe(0);
});

it('never words feedback as a score or a verdict on the person', () => {
  const text = [...Object.values(FIT_COPY), ...Object.values(COVERAGE_COPY)].join(' ');
  expect(text).not.toMatch(/점수|합격|불합격|성격|자신감|점$/);
  expect(clean('대본·요약')).toBe('대본, 요약');
});

it('marks the quoted words in a transcript without overlapping marks', () => {
  const { highlightTranscript } = jest.requireActual('./view-model') as typeof import('./view-model');
  expect(highlightTranscript('가나다라마바', ['나다', '다라', null])).toEqual([
    { text: '가', mark: false },
    { text: '나다', mark: true },
    { text: '라마바', mark: false },
  ]);
  expect(highlightTranscript('abc', [])).toEqual([{ text: 'abc', mark: false }]);
});
