// Ported from apps/interview/test (node:test) so the copied logic keeps the web behaviour.
/* global test */
import assert from "node:assert/strict";
import { derivePreparationState } from "../result-preparation";
import { canAutomaticallyRetry, retryNotBefore, RESULT_WAIT_LIMIT_MS } from "../result-policy";
import { getResultPreparationCopy, RESULT_SLOW_NOTICE_MS } from "../result-preparation-copy";

const now = "2026-09-05T00:00:00.000Z";
const error = (code, retryable = true) => ({ code, retryable, occurredAt: now });
const attempt = (t = "ready", e = "ready") => ({
  id: "a1", questionId: "q1", attemptNo: 1, status: "recorded", durationMs: 30000,
  analysis: {
    audioKey: null,
    transcription: { status: t, attemptCount: 1, updatedAt: now, transcript: { original: "문제의 원인을 확인하고 친구들과 함께 해결했습니다.", revision: 0 } },
    evaluation: { status: e, attemptCount: 1, updatedAt: now, transcriptRevision: 0, result: e === "ready" ? { fit: "direct" } : undefined },
  },
});
const session = (attempts = [], other = {}) => ({ id: "s1", status: "completed", feedbackMode: "ai", currentQuestionIndex: 1, attempts, ...other });
const state = (s, ids = ["q1"]) => derivePreparationState(s, ids).kind;

test("basic practice bypasses AI; missing source has a single safe exit", () => {
  assert.equal(state(session([], { feedbackMode: "basic" }), null), "open-report");
  assert.equal(state(session(), null), "problem");
  assert.equal(state(session(), []), "problem");
});
test("unfinished practice stays in the room, stale retry IDs do not bounce", () => {
  assert.equal(state(session([], { status: "active", currentQuestionIndex: 0 })), "unfinished");
  assert.equal(state(session([], { retryQuestionId: "q1" })), "unfinished");
  assert.equal(state(session([attempt()], { retryQuestionId: "removed" })), "complete");
  assert.equal(state(session([attempt()], { status: "active", currentQuestionIndex: 1 })), "complete");
});
test("only answer tasks gate completion, never the optional overall summary", () => {
  for (const t of ["queued", "processing"]) assert.equal(state(session([attempt(t)])), "working");
  for (const e of ["idle", "queued", "processing"]) assert.equal(state(session([attempt("ready", e)])), "working");
  for (const status of ["idle", "queued", "processing", "failed", "unavailable"]) {
    assert.equal(state(session([attempt()], { feedbackSummary: { status } })), "complete");
  }
});
test("short, silent, missing and failed answers are terminal, including all-skipped sessions", () => {
  assert.equal(state(session()), "complete");
  for (const code of ["answer_too_short", "speech_too_short", "no_speech", "network", "upstream_auth"]) {
    const a = attempt("failed", "idle"); a.analysis.transcription.error = error(code, false);
    assert.equal(state(session([a])), "complete");
  }
  for (const original of ["네", "...?!"]) {
    const a = attempt("ready", "idle"); a.analysis.transcription.transcript.original = original;
    assert.equal(state(session([a])), "complete");
  }
  const a = attempt(); delete a.analysis;
  assert.equal(state(session([a])), "complete");
});
test("partial success opens automatically and does not discard successful answers", () => {
  const good = attempt(), bad = attempt("failed", "idle");
  bad.id = "a2"; bad.questionId = "q2"; bad.analysis.transcription.error = error("speech_too_short", false);
  const s = session([good, bad]); const before = structuredClone(s);
  assert.equal(state(s, ["q1", "q2"]), "complete");
  assert.deepEqual(s, before);
});
test("only the latest saved answer and current questions matter", () => {
  const old = attempt("processing"), latest = attempt();
  latest.id = "a2"; latest.attemptNo = 2;
  const removed = attempt("processing"); removed.id = "a3"; removed.questionId = "removed";
  assert.equal(state(session([old, latest, removed])), "complete");
});
test("transcript correction never silently starts evaluation or regenerates summary", () => {
  const a = attempt(); a.analysis.transcription.transcript.revision = 3;
  assert.equal(state(session([a], { feedbackSummary: { status: "ready", basis: [] } })), "complete");
});
test("only new recoverable failures receive one persisted automatic retry", () => {
  for (const code of ["network", "timeout", "upstream", "invalid_response", "capacity_limited", "rate_limited", "upstream_rate_limited"]) {
    const failure = { status: "failed", error: error(code), automaticRetryCount: 0 };
    assert.equal(canAutomaticallyRetry(failure), true);
    assert.equal(canAutomaticallyRetry({ ...failure, automaticRetryCount: 1 }), false);
    assert.equal(canAutomaticallyRetry({ ...failure, automaticRetryCount: undefined }), false);
    assert.equal(canAutomaticallyRetry({ ...failure, status: "ready" }), false);
  }
  for (const code of ["answer_too_short", "no_speech", "daily_limit", "upstream_auth", "unknown"]) {
    assert.equal(canAutomaticallyRetry({ status: "failed", error: error(code), automaticRetryCount: 0 }), false);
  }
});
test("a permitted automatic retry is working until its budget is exhausted", () => {
  const a = attempt("ready", "failed");
  a.analysis.evaluation = { ...a.analysis.evaluation, error: error("network"), automaticRetryCount: 0 };
  assert.equal(state(session([a])), "working");
  a.analysis.evaluation.automaticRetryCount = 1;
  assert.equal(state(session([a])), "complete");
  const b = attempt("failed", "idle");
  b.analysis.transcription = { ...b.analysis.transcription, error: error("network"), automaticRetryCount: 0 };
  assert.equal(state(session([b])), "complete", "no retained audio means no retry");
  b.analysis.audioKey = "audio";
  assert.equal(state(session([b])), "working");
});
test("deadline closes unfinished tasks and retry backoff respects Retry-After", () => {
  assert.equal(RESULT_WAIT_LIMIT_MS, 120000);
  assert.equal(state(session([attempt("processing")], { resultPreparation: { startedAt: now, deadlineAt: now, timedOut: true } })), "complete");
  const start = Date.parse(now);
  assert.equal(Date.parse(retryNotBefore(error("network"), start)) - start, 3000);
  assert.equal(Date.parse(retryNotBefore({ ...error("rate_limited"), retryAfterMs: 15000 }, start)) - start, 15000);
});

test("waiting copy follows actual tasks, prioritizing remaining speech before feedback", () => {
  for (const status of ["queued", "processing"]) {
    assert.deepEqual(derivePreparationState(session([attempt(status)]), ["q1"]), { kind: "working", phase: "transcription" });
  }
  for (const status of ["idle", "queued", "processing"]) {
    assert.deepEqual(derivePreparationState(session([attempt("ready", status)]), ["q1"]), { kind: "working", phase: "feedback" });
  }
  const speech = attempt("processing"); speech.id = "a2"; speech.questionId = "q2";
  assert.deepEqual(derivePreparationState(session([attempt("ready", "processing"), speech]), ["q1", "q2"]), { kind: "working", phase: "transcription" });
  assert.equal(derivePreparationState(session([attempt("ready", "processing"), speech]), ["q1"]).phase, "feedback");
  const retry = attempt("failed", "idle");
  retry.analysis.audioKey = "audio";
  retry.analysis.transcription.error = error("network");
  retry.analysis.transcription.automaticRetryCount = 0;
  assert.equal(derivePreparationState(session([retry]), ["q1"]).phase, "transcription");
});

test("friendly copy stays honest while loading, waiting longer, or offline", () => {
  const speech = { kind: "working", phase: "transcription" };
  const feedback = { kind: "working", phase: "feedback" };
  assert.equal(RESULT_SLOW_NOTICE_MS, 30000);
  assert.deepEqual(getResultPreparationCopy(speech, true, false).texts, ["내가 한 말을 정리하고 있어요"]);
  assert.deepEqual(getResultPreparationCopy(feedback, true, false).texts, [
    "답변에서 잘한 점을 살펴보고 있어요", "다음엔 어떻게 말하면 좋을지 정리하고 있어요",
  ]);
  assert.equal(getResultPreparationCopy(feedback, true, false).note, "");
  assert.equal(getResultPreparationCopy(feedback, true, true).note, "평소보다 시간이 조금 더 걸리고 있어요.");
  for (const state of [speech, feedback, null]) {
    const copy = getResultPreparationCopy(state, false, true);
    assert.equal(copy.animated, false);
    assert.deepEqual(copy.texts, ["인터넷 연결이 끊겼어요."]);
    assert.equal(copy.description, "연결 상태를 확인해 주세요.");
  }
  assert.deepEqual(getResultPreparationCopy(null, true, false).texts, ["연습 기록을 확인하고 있어요"]);
  assert.equal(getResultPreparationCopy({ kind: "complete" }, true, true).note, "");
});
