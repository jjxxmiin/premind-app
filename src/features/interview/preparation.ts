import type { AppLocale } from "./locale";
import { DEFAULT_PREP_DURATION_SEC } from "./custom";
import {
  isConciseGuidedQuestion,
  type GuidedPrepareResponse,
  type GuidedQuestionKind,
} from "./guided";
import type { CustomInterviewQuestion } from "./types";

type SupportContext = {
  company: string;
  jobRole: string;
};

const DURATION_BY_KIND: Record<
  GuidedQuestionKind,
  number
> = {
  common: 90,
  job: 120,
  resume: 120,
  follow_up: 90,
};

function introductionQuestion(jobRole: string, locale: AppLocale): string {
  if (locale === "en") {
    const english = jobRole
      ? `Introduce yourself and connect it to the ${jobRole} role.`
      : "Introduce yourself as a candidate.";
    return isConciseGuidedQuestion(english) ? english : "Briefly introduce yourself as a candidate.";
  }
  const contextual = jobRole
    ? `${jobRole} 직무와 연결해 자신을 소개해 주세요.`
    : "지원자로서 자신을 소개해 주세요.";
  return isConciseGuidedQuestion(contextual)
    ? contextual
    : "지원자로서 자신을 간단히 소개해 주세요.";
}

function motivationQuestion(company: string, jobRole: string, locale: AppLocale): string {
  if (locale === "en") {
    let english: string;
    if (company && jobRole) english = `Tell us why you applied for the ${jobRole} role at ${company}.`;
    else if (company) english = `Tell us why you applied to ${company}.`;
    else if (jobRole) english = `Tell us why you applied for the ${jobRole} role.`;
    else english = "Tell us what made you decide to apply.";
    return isConciseGuidedQuestion(english) ? english : "Tell us what made you decide to apply.";
  }
  let contextual: string;
  if (company && jobRole) {
    contextual = `${company}의 ${jobRole} 직무에 지원한 이유를 말씀해 주세요.`;
  } else if (company) {
    contextual = `${company}에 지원한 이유를 말씀해 주세요.`;
  } else if (jobRole) {
    contextual = `${jobRole} 직무에 지원한 이유를 말씀해 주세요.`;
  } else {
    contextual = "이번 지원을 결심한 이유를 말씀해 주세요.";
  }
  return isConciseGuidedQuestion(contextual)
    ? contextual
    : "이번 지원을 결심한 이유를 말씀해 주세요.";
}

/** 자소서가 없을 때도 질문 검토 단계를 건너뛰지 않도록 제공하는 기본 초안. */
export function buildDefaultInterviewQuestions(
  { company, jobRole }: SupportContext,
  locale: AppLocale = "ko",
): CustomInterviewQuestion[] {
  const en = locale === "en";
  const normalizedCompany = company.trim();
  const normalizedJobRole = jobRole.trim();
  return [
    {
      id: "basic-introduction",
      question: introductionQuestion(normalizedJobRole, locale),
      answerDurationSec: 90,
      prepDurationSec: DEFAULT_PREP_DURATION_SEC,
      kind: "common",
    },
    {
      id: "basic-motivation",
      question: motivationQuestion(normalizedCompany, normalizedJobRole, locale),
      answerDurationSec: 120,
      prepDurationSec: DEFAULT_PREP_DURATION_SEC,
      kind: "job",
    },
    {
      id: "basic-challenge",
      question: en
        ? "Pick your most challenging experience and describe the situation, what you did, and the result."
        : "가장 도전적이었던 경험을 하나 골라, 당시 상황과 본인의 행동, 결과를 구체적으로 설명해 주세요.",
      answerDurationSec: 120,
      prepDurationSec: DEFAULT_PREP_DURATION_SEC,
      kind: "common",
    },
    {
      id: "basic-collaboration",
      question: en
        ? "Tell us about a real time you disagreed with someone and how you worked it out."
        : "다른 사람과 의견이 달랐던 상황에서 어떻게 조율했는지 실제 경험을 바탕으로 말씀해 주세요.",
      answerDurationSec: 120,
      prepDurationSec: DEFAULT_PREP_DURATION_SEC,
      kind: "common",
    },
  ];
}

/** 서버가 만든 근거 메타데이터를 질문별 연습 계약으로 손실 없이 옮긴다. */
export function guidedQuestionsToPractice(
  prepared: GuidedPrepareResponse,
): CustomInterviewQuestion[] {
  return prepared.questions.map((question) => ({
    id: question.id,
    question: question.question,
    answerDurationSec: DURATION_BY_KIND[question.kind],
    prepDurationSec: DEFAULT_PREP_DURATION_SEC,
    kind: question.kind,
    claimId: question.claimId,
    parentQuestionId: question.parentQuestionId,
    sourceQuote: question.sourceQuote,
  }));
}

export function interviewDraftTitle(
  { company, jobRole }: SupportContext,
  locale: AppLocale = "ko",
): string {
  const context = [company.trim(), jobRole.trim()].filter(Boolean).join(" ");
  if (locale === "en") return context ? `${context} interview practice` : "My interview practice";
  return context ? `${context} 면접 연습` : "나의 면접 연습";
}
