// Ported from apps/interview/test (node:test) so the copied logic keeps the web behaviour.
import assert from "node:assert/strict";

import {
  buildGuidedFallback,
  GUIDED_QUESTION_MAX_LENGTH,
  GUIDED_QUESTION_RECOMMENDED_LENGTH,
  GuidedValidationError,
  isConciseGuidedQuestion,
  isDuplicateGuidedQuestion,
  normalizeGuidedExpandRequest,
  validateGuidedExpansion,
} from "../guided";

const quote1 = "교내 전기 설비 점검표를 새로 만들어 누락 항목을 줄였습니다.";
const quote2 = "팀 프로젝트에서 작업 순서를 조율하고 기한 안에 결과물을 완성했습니다.";
const quote3 = "실습 중 발생한 오류의 원인을 기록하고 같은 문제가 반복되지 않게 했습니다.";
const resumeText = `${quote1}\n${quote2}\n${quote3}\n${"현장 실습 경험을 꾸준히 정리했습니다. ".repeat(3)}`;

function request() {
  return normalizeGuidedExpandRequest({
    company: "프리마인드",
    jobRole: "설비 운영",
    jobDescription: "설비 점검과 안전 관리",
    resumeText,
    existingQuestions: [
      { question: "지원한 이유를 말씀해 주세요.", sourceQuote: null },
    ],
  });
}

function validOutput() {
  return {
    additions: [
      {
        kind: "resume",
        question: "점검표를 어떻게 만들었나요?",
        sourceQuote: quote1,
      },
      {
        kind: "follow_up",
        question: "점검 항목을 고를 때 가장 중요하게 본 기준은 무엇인가요?",
        sourceQuote: quote1,
      },
    ],
  };
}

test("accepts one short resume question and its pre-generated follow-up", () => {
  const result = validateGuidedExpansion(validOutput(), request());
  assert.equal(result.additions.length, 2);
  assert.deepEqual(result.additions.map((item) => item.kind), ["resume", "follow_up"]);
  assert.equal(result.additions[0].sourceQuote, result.additions[1].sourceQuote);
  assert.ok(
    result.additions.every(
      (item) =>
        item.question.length <= GUIDED_QUESTION_MAX_LENGTH &&
        isConciseGuidedQuestion(item.question),
    ),
  );
  assert.equal(GUIDED_QUESTION_RECOMMENDED_LENGTH, 45);
  assert.equal(GUIDED_QUESTION_MAX_LENGTH, 70);
});

test("rejects broken pairs, invented evidence and assumptions about unspoken answers", () => {
  const mutations = [
    (output) => output.additions.pop(),
    (output) => output.additions.push(structuredClone(output.additions[0])),
    (output) => output.additions.reverse(),
    (output) => { output.additions[1].kind = "resume"; },
    (output) => { output.additions[1].sourceQuote = quote2; },
    (output) => { output.additions[1].sourceQuote = "자소서에는 없는 새로운 경험을 주장합니다."; },
    (output) => { output.additions[1].parentQuestionId = "model-invented-id"; },
    (output) => { output.additions[1].question = "방금 말씀하신 갈등을 어떻게 해결했나요?"; },
    (output) => { output.additions[1].question = "말씀하신 경험에서 무엇을 배웠나요?"; },
    (output) => { output.additions[1].question = "지원한 이유를 말씀해 주세요."; },
    (output) => { output.additions[1].question = "부모님 직업은 무엇인가요?"; },
    (output) => { output.additions[1].question = `${"가".repeat(70)}?`; },
  ];
  for (const mutate of mutations) {
    const output = validOutput(); mutate(output);
    assert.throws(() => validateGuidedExpansion(output, request()), GuidedValidationError);
  }
});

test("reserves two question slots at the API boundary", () => {
  const input = request();
  const existing = Array.from({ length: 19 }, (_, index) => ({ question: `${index + 1}번째 경험을 설명해 주세요.`, sourceQuote: null }));
  assert.equal(normalizeGuidedExpandRequest({ ...input, existingQuestions: existing.slice(0, 18) }).existingQuestions.length, 18);
  assert.throws(() => normalizeGuidedExpandRequest({ ...input, existingQuestions: existing }), GuidedValidationError);
});

test("rejects a generated question over 70 characters instead of truncating it", () => {
  const output = validOutput();
  output.additions[0].question = `${"가".repeat(68)}인가요?`;
  assert.throws(
    () => validateGuidedExpansion(output, request()),
    (error) =>
      error instanceof GuidedValidationError &&
      /invalid length/u.test(error.message),
  );
});

test("rejects multiple sentences and near-duplicate questions", () => {
  const multipleSentences = validOutput();
  multipleSentences.additions[0].question =
    "점검표를 만든 이유는 무엇인가요? 결과도 말씀해 주세요.";
  assert.throws(
    () => validateGuidedExpansion(multipleSentences, request()),
    (error) =>
      error instanceof GuidedValidationError &&
      /one concise sentence/u.test(error.message),
  );

  const duplicate = validOutput();
  duplicate.additions[1].question = duplicate.additions[0].question;
  assert.throws(
    () => validateGuidedExpansion(duplicate, request()),
    (error) =>
      error instanceof GuidedValidationError && /duplicated/u.test(error.message),
  );
  assert.equal(
    isDuplicateGuidedQuestion(
      "작업 순서를 조율하기 위해 어떤 행동을 했나요?",
      "작업 순서를 조율하기 위해 어떤 행동을 했나요",
    ),
    true,
  );
});

test("fallback questions stay readable with very long company fields", () => {
  const longContext = "지원정보".repeat(30);
  const fallback = buildGuidedFallback({
    company: longContext,
    jobRole: longContext,
    jobDescription: "",
    resumeText,
  });
  assert.ok(fallback.questions.every((item) => isConciseGuidedQuestion(item.question)));
});
