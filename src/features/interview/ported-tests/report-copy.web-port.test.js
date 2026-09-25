// Ported from apps/interview/test (node:test) so the copied logic keeps the web behaviour.
/* global test */
import assert from "node:assert/strict";
import { canRetryReportTask, conciseReportText, hasSharedReportFailure, reportAnalysisMessage, reportQuestionStatus } from "../report-copy";

const error = (code, retryable = true) => ({ code, retryable, occurredAt: "2026-09-05T01:00:00Z" });
const attempt = (code = "upstream") => ({ id: "a1", status: "recorded", analysis: {
  transcription: { status: "ready", transcript: { revision: 0 } },
  evaluation: { status: "failed", error: error(code) },
} });

test("service failures do not blame the user's speech or require re-recording", () => {
  for (const code of ["unknown", "upstream", "upstream_rejected", "invalid_response", "network", "timeout"]) {
    for (const kind of ["answer", "feedback"]) {
      assert.doesNotMatch(reportAnalysisMessage(kind, code), /답해 주세요|고쳐|또렷|발음|인터넷 연결이 원활하지/);
    }
  }
  assert.match(reportAnalysisMessage("feedback", "upstream_auth"), /서비스에 잠시 문제가/);
  assert.match(reportAnalysisMessage("answer", "no_speech"), /말소리를 확인하기 어려웠어요/);
});

test("short speech, missing audio, file size and duration remain distinct", () => {
  assert.match(reportAnalysisMessage("answer", "speech_too_short"), /이유나 경험도 함께/);
  assert.match(reportAnalysisMessage("answer", "expired"), /남아 있지 않아요/);
  assert.doesNotMatch(reportAnalysisMessage("answer", "payload_too_large"), /5분/);
  assert.match(reportAnalysisMessage("answer", "duration_limit"), /5분/);
  assert.match(reportAnalysisMessage("feedback", "daily_limit"), /내일/);
});

test("retry affordance follows existing retry capability, including service restoration", () => {
  assert.equal(canRetryReportTask(error("invalid_response", false)), false);
  assert.equal(canRetryReportTask(error("network")), true);
  assert.equal(canRetryReportTask(error("service_unavailable", false)), false);
  assert.equal(canRetryReportTask(undefined), false);
});

test("advice uses at most two complete sentences without breaking decimal numbers", () => {
  assert.equal(conciseReportText("1.5분 동안 말했어요. 이유도 말해보세요. 세 번째 문장."), "1.5분 동안 말했어요. 이유도 말해보세요.");
  assert.equal(conciseReportText("짧은 조언"), "짧은 조언");
  assert.doesNotMatch(reportAnalysisMessage("feedback", "invalid_response"), /네트워크|연결|받지 못했어요/);
  assert.match(reportAnalysisMessage("feedback", "network"), /연결이 원활하지/);
});

test("question navigation does not repeat batch failure or grades", () => {
  assert.equal(reportQuestionStatus(attempt()), null);
  const success = attempt();
  success.analysis.evaluation = { status: "ready", result: { fit: "off_topic" } };
  assert.equal(reportQuestionStatus(success), null);
  const interrupted = attempt();
  interrupted.status = "failed";
  assert.equal(reportQuestionStatus(interrupted), null);
  const short = attempt();
  short.analysis.transcription = { status: "failed", error: error("answer_too_short", false) };
  assert.deepEqual(reportQuestionStatus(short), { label: "짧은 답변", state: "muted" });
});

test("deduplicate only the same failed batch, revision and attempt", () => {
  const current = attempt();
  const summary = { status: "failed", error: error("upstream"), basis: [{ attemptId: "a1", transcriptRevision: 0 }] };
  assert.equal(hasSharedReportFailure(summary, current), true);
  assert.equal(hasSharedReportFailure(undefined, current), false);
  assert.equal(hasSharedReportFailure(summary, undefined), false);
  assert.equal(hasSharedReportFailure({ ...summary, status: "ready" }, current), false);
  assert.equal(hasSharedReportFailure(summary, { ...current, id: "old-attempt" }), false);
  assert.equal(hasSharedReportFailure({ ...summary, error: { ...summary.error, occurredAt: "2026-09-05T02:00:00Z" } }, current), false);
  current.analysis.transcription.transcript.revision = 1;
  assert.equal(hasSharedReportFailure(summary, current), false);
});
