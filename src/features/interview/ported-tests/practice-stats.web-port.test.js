// Ported from apps/interview/test (node:test) so the copied logic keeps the web behaviour.
/* global test */
import assert from "node:assert/strict";
import { computePracticeStats, latestNextPractice } from "../practice-stats";

import { daysUntil, planFor } from "../dday";

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();
const session = (id, attempts, extra = {}) => ({ id, attempts, createdAt: attempts[0]?.recordedAt ?? at(2026, 9, 1), status: "completed", companyId: "", currentQuestionIndex: 0, ...extra });
const attempt = (recordedAt, durationMs = 60_000, status = "saved") => ({ id: recordedAt, questionId: "q", recordedAt, durationMs, status });

test("weekly counts, speaking time and failed attempts", () => {
  const now = new Date(2026, 8, 24, 15);
  const stats = computePracticeStats([
    session("a", [attempt(at(2026, 9, 24)), attempt(at(2026, 9, 24), 30_000), attempt(at(2026, 9, 24), 10_000, "failed")]),
    session("b", [attempt(at(2026, 9, 20))]),
    session("old", [attempt(at(2026, 9, 1))]),
  ], now);
  assert.equal(stats.weekPractices, 2);
  assert.equal(stats.weekAnswers, 3);
  assert.equal(stats.weekSpeakingMs, 150_000);
  assert.equal(stats.totalPractices, 3);
  assert.equal(stats.week.length, 7);
  assert.equal(stats.week.at(-1).answers, 2);
});

test("streak counts back from today, or from yesterday when today is still empty", () => {
  const sessions = [session("s", [attempt(at(2026, 9, 21)), attempt(at(2026, 9, 22)), attempt(at(2026, 9, 23))])];
  assert.equal(computePracticeStats(sessions, new Date(2026, 8, 24, 9)).streakDays, 3);
  assert.equal(computePracticeStats(sessions, new Date(2026, 8, 23, 20)).streakDays, 3);
  assert.equal(computePracticeStats(sessions, new Date(2026, 8, 26, 9)).streakDays, 0);
  assert.equal(computePracticeStats([], new Date()).streakDays, 0);
});

test("next practice comes from the most recent AI summary only", () => {
  const withSummary = (id, completedAt, nextPractice) => session(id, [], { feedbackSummary: { completedAt, result: { summary: "", strengths: [], nextPractice } } });
  assert.equal(latestNextPractice([]), null);
  assert.deepEqual(latestNextPractice([
    withSummary("old", at(2026, 9, 1), "결론을 먼저 말해 보세요."),
    withSummary("new", at(2026, 9, 20), "결과를 숫자로 덧붙여 보세요."),
    withSummary("blank", at(2026, 9, 22), "  "),
  ]), { text: "결과를 숫자로 덧붙여 보세요.", sessionId: "new" });
});
test("d-day plan scales the daily goal and never scores", () => {
  const now = new Date(2026, 8, 25, 10);
  assert.equal(daysUntil("2026-10-02", now), 7);
  assert.equal(daysUntil("2026-09-25", now), 0);
  assert.equal(planFor(20).goal, 3);
  assert.equal(planFor(5).goal, 4);
  assert.equal(planFor(1).goal, 5);
  assert.equal(planFor(0).goal, 1);
  assert.equal(planFor(-1).goal, 0);
});
