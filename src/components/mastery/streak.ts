import { dayKey } from '@/lib/mastery';
import type { QuizAttempt } from '@/types';

/** Local `YYYY-MM-DD`, the same key `dayKey` gives an attempt. */
function localKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Days in a row with at least one answered question (Duolingo's streak).
 *
 * Counted back from today; a day that has not been studied yet does not break
 * the run, so at breakfast a learner who studied yesterday still sees it and
 * has the day to keep it going.
 */
export function studyStreak(
  attempts: readonly Pick<QuizAttempt, 'attemptedAt'>[],
  now: number = Date.now(),
): number {
  const days = new Set(attempts.map((attempt) => dayKey(attempt.attemptedAt)));
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(localKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
