export const GUIDED_INPUT_LIMITS = {
  company: 120,
  jobRole: 120,
  jobDescription: 4_000,
  resumeText: 20_000,
} as const;

export const GUIDED_QUESTION_RECOMMENDED_LENGTH = 45;
export const GUIDED_QUESTION_MAX_LENGTH = 70;
/**
 * 영어 질문(영어 화면, 2026-09-26)은 같은 뜻이라도 글자 수가 한국어의 두 배 남짓이라 따로 센다.
 * 한 문장, 한 가지 의도라는 규칙은 같다.
 */
export const GUIDED_QUESTION_RECOMMENDED_LENGTH_EN = 90;
export const GUIDED_QUESTION_MAX_LENGTH_EN = 150;

/**
 * 생성 질문의 언어. "ko" 는 예전 규칙 그대로(한글 필수, 70자). "en" 은 영어 화면에서 AI 가 영어로 쓴 질문.
 * 값을 주지 않으면 글자로 판단한다 — 한글이 있으면 한국어 규칙, 없으면 영어 규칙(브라우저가 서버 응답을
 * 다시 검사할 때처럼 화면 언어를 모르는 자리).
 */
export type GuidedLang = "ko" | "en";

function guidedLangOf(value: string, lang?: GuidedLang): GuidedLang {
  return lang ?? (/[가-힣]/u.test(value) ? "ko" : "en");
}

export function guidedQuestionMaxLength(lang: GuidedLang): number {
  return lang === "en" ? GUIDED_QUESTION_MAX_LENGTH_EN : GUIDED_QUESTION_MAX_LENGTH;
}
export const GUIDED_EXPANSION_QUESTION_COUNT = 2;

export type GuidedQuestionKind = "common" | "job" | "resume" | "follow_up";

export interface GuidedPrepareRequest {
  company: string;
  jobRole: string;
  jobDescription: string;
  resumeText: string;
}

export interface GuidedClaim {
  id: string;
  text: string;
  sourceQuote: string;
}

export interface GuidedQuestion {
  id: string;
  kind: GuidedQuestionKind;
  question: string;
  claimId: string | null;
  parentQuestionId: string | null;
  sourceQuote: string | null;
}

export interface GuidedPrepareResponse {
  generationMode: "ai" | "fallback";
  claims: GuidedClaim[];
  questions: GuidedQuestion[];
}

export interface GuidedExpandExistingQuestion {
  question: string;
  sourceQuote: string | null;
}

export interface GuidedExpandRequest extends GuidedPrepareRequest {
  existingQuestions: GuidedExpandExistingQuestion[];
}

export interface GuidedExpandAddition {
  kind: "resume" | "follow_up";
  question: string;
  sourceQuote: string;
}

export interface GuidedExpandResponse {
  generationMode: "ai";
  additions: GuidedExpandAddition[];
}

export class GuidedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuidedValidationError";
  }
}

type GuidedContent = Pick<GuidedPrepareResponse, "claims" | "questions">;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/**
 * 생성 질문은 면접실에서 한눈에 읽히도록 한 문장으로 제한한다. 마침표가 숫자나
 * 약어 안에 들어가는 경우는 허용하고, 문장부호 뒤에 새 문장이 이어지는지만 막는다.
 */
export function isConciseGuidedQuestion(value: string, lang?: GuidedLang): boolean {
  const normalized = normalizeLineEndings(value).replace(/[ \t]+/gu, " ");
  return (
    normalized.length >= 5 &&
    normalized.length <= guidedQuestionMaxLength(guidedLangOf(normalized, lang)) &&
    !normalized.includes("\n") &&
    !/[.!?。！？]\s+\S/u.test(normalized)
  );
}

function readInputString(
  record: Record<string, unknown>,
  field: keyof GuidedPrepareRequest,
  options: { required: boolean; minLength?: number },
): string {
  const raw = record[field];
  if (typeof raw !== "string") {
    throw new GuidedValidationError(`${field} must be a string`);
  }

  const value = normalizeLineEndings(raw);
  if (options.required && value.length === 0) {
    throw new GuidedValidationError(`${field} is required`);
  }
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new GuidedValidationError(`${field} is too short`);
  }
  if (value.length > GUIDED_INPUT_LIMITS[field]) {
    throw new GuidedValidationError(`${field} is too long`);
  }
  return value;
}

export function normalizeGuidedPrepareRequest(value: unknown): GuidedPrepareRequest {
  const record = asRecord(value);
  if (!record) {
    throw new GuidedValidationError("request body must be an object");
  }

  return {
    company: readInputString(record, "company", { required: false }),
    jobRole: readInputString(record, "jobRole", { required: false }),
    jobDescription: readInputString(record, "jobDescription", { required: false }),
    resumeText: readInputString(record, "resumeText", {
      required: true,
      minLength: 100,
    }),
  };
}

const MAX_EXISTING_QUESTIONS = 20;

export function normalizeGuidedExpandRequest(value: unknown): GuidedExpandRequest {
  const record = asRecord(value);
  if (!record) {
    throw new GuidedValidationError("request body must be an object");
  }

  const prepared = normalizeGuidedPrepareRequest(record);
  if (
    !Array.isArray(record.existingQuestions) ||
    record.existingQuestions.length > MAX_EXISTING_QUESTIONS - GUIDED_EXPANSION_QUESTION_COUNT
  ) {
    throw new GuidedValidationError("existingQuestions must be a bounded array");
  }

  const existingQuestions = record.existingQuestions.map(
    (raw): GuidedExpandExistingQuestion => {
      const existing = asRecord(raw);
      if (!existing || !hasOnlyKeys(existing, ["question", "sourceQuote"])) {
        throw new GuidedValidationError(
          "existing question has an invalid shape",
        );
      }
      const question = normalizeLineEndings(
        readBoundedString(existing, "question", 1, 500),
      );
      const sourceQuote = readNullableQuote(existing, "sourceQuote");
      if (sourceQuote !== null && !prepared.resumeText.includes(sourceQuote)) {
        throw new GuidedValidationError(
          "existing source quote must be copied from resumeText",
        );
      }
      return { question, sourceQuote };
    },
  );

  return { ...prepared, existingQuestions };
}

function collectQuoteCandidates(resumeText: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const quote = candidate.trim();
    if (quote.length < 12 || quote.length > 320 || seen.has(quote)) return;
    if (!resumeText.includes(quote)) return;
    seen.add(quote);
    candidates.push(quote);
  };

  for (const sentence of resumeText.split(/(?<=[.!?。！？])\s+|\n+/u)) add(sentence);
  for (const line of resumeText.split("\n")) add(line);

  if (candidates.length < 2) {
    const midpoint = Math.floor(resumeText.length / 2);
    const leftBreak = resumeText.lastIndexOf(" ", midpoint);
    const rightBreak = resumeText.indexOf(" ", midpoint);
    const splitAt =
      leftBreak >= 12
        ? leftBreak
        : rightBreak > 0 && rightBreak < resumeText.length - 12
          ? rightBreak
          : midpoint;
    add(resumeText.slice(0, splitAt));
    add(resumeText.slice(splitAt));
  }

  if (candidates.length < 2) {
    add(resumeText.slice(0, Math.min(320, resumeText.length)));
    add(resumeText.slice(Math.max(0, resumeText.length - 320)));
  }

  return candidates;
}

function conciseFallbackQuestion(candidate: string, fallback: string, lang: GuidedLang = "ko"): string {
  return isConciseGuidedQuestion(candidate, lang) ? candidate : fallback;
}

/** 대체 질문의 영어판. 한국어 문장은 아래 buildGuidedFallback 안에 그대로 있다. */
function englishFallbackQuestions(request: GuidedPrepareRequest) {
  const intro = "Please introduce yourself briefly as an applicant.";
  const motivation = "Please tell us why you decided to apply this time.";
  return {
    intro: conciseFallbackQuestion(
      request.jobRole
        ? `Please introduce yourself in connection with the ${request.jobRole} role.`
        : "Please introduce yourself as an applicant.",
      intro,
      "en",
    ),
    motivation: conciseFallbackQuestion(
      request.company && request.jobRole
        ? `Please tell us why you applied for the ${request.jobRole} role at ${request.company}.`
        : request.company
          ? `Please tell us why you applied to ${request.company}.`
          : request.jobRole
            ? `Please tell us why you applied for the ${request.jobRole} role.`
            : motivation,
      motivation,
      "en",
    ),
    resume: [
      "Please describe the role you played and the actions you took in this experience.",
      "Please describe the concrete results you achieved through this experience.",
    ],
    followUp: [
      "What was the hardest decision in that process, and what was it based on?",
      "If you faced the same situation again, what would you do differently?",
    ],
  };
}

function selectIndependentQuotes(candidates: string[]): string[] {
  const selected: string[] = [];
  const evidenceTerms =
    /(저는|제가|담당|역할|수행|기획|개선|해결|조율|제안|도입|적용|성과|결과|달성|줄였|높였|프로젝트|활동)/u;
  const score = (value: string) => {
    const sentenceCount = value.match(/[.!?。！？]/gu)?.length ?? 0;
    return (
      (evidenceTerms.test(value) ? 200 : 0) +
      Math.min(value.length, 120) -
      (value.length < 20 ? 80 : 0) -
      Math.max(0, sentenceCount - 1) * 250
    );
  };
  // 역할·행동·결과가 드러난 문장을 먼저 고르되, 전체 문단과 그 일부를 서로 다른
  // 경험으로 중복 선택하지 않는다.
  for (const candidate of [...candidates].sort(
    (a, b) => score(b) - score(a) || a.length - b.length,
  )) {
    const overlaps = selected.some(
      (quote) => quote.includes(candidate) || candidate.includes(quote),
    );
    if (!overlaps) selected.push(candidate);
    if (selected.length === 2) break;
  }
  return selected;
}

export function buildGuidedFallback(
  request: GuidedPrepareRequest,
  lang: GuidedLang = "ko",
): GuidedPrepareResponse {
  const en = lang === "en" ? englishFallbackQuestions(request) : null;
  const candidates = collectQuoteCandidates(request.resumeText);
  const quotes = selectIndependentQuotes(candidates);
  if (quotes.length === 0) {
    quotes.push(request.resumeText.slice(0, Math.min(320, request.resumeText.length)));
  }
  const claims: GuidedClaim[] = quotes.map((sourceQuote, index) => ({
    id: `claim-${index + 1}`,
    text: sourceQuote,
    sourceQuote,
  }));

  const questions: GuidedQuestion[] = [
    {
      id: "common-1",
      kind: "common",
      question: en ? en.intro : conciseFallbackQuestion(
        request.jobRole
          ? `${request.jobRole} 직무와 연결해 자신을 소개해 주세요.`
          : "지원자로서 자신을 소개해 주세요.",
        "지원자로서 자신을 간단히 소개해 주세요.",
      ),
      claimId: null,
      parentQuestionId: null,
      sourceQuote: null,
    },
    {
      id: "job-1",
      kind: "job",
      question: en ? en.motivation : conciseFallbackQuestion(
        request.company && request.jobRole
          ? `${request.company}의 ${request.jobRole} 직무에 지원한 이유를 말씀해 주세요.`
          : request.company
            ? `${request.company}에 지원한 이유를 말씀해 주세요.`
            : request.jobRole
              ? `${request.jobRole} 직무에 지원한 이유를 말씀해 주세요.`
              : "이번 지원을 결심한 이유를 말씀해 주세요.",
        "이번 지원을 결심한 이유를 말씀해 주세요.",
      ),
      claimId: null,
      parentQuestionId: null,
      sourceQuote: null,
    },
    ...claims.flatMap((claim, index): GuidedQuestion[] => {
      const number = index + 1;
      const resumeId = `resume-${number}`;
      return [
        {
          id: resumeId,
          kind: "resume",
          question: en ? en.resume[index === 0 ? 0 : 1]! :
            index === 0
              ? "이 경험에서 본인이 맡은 역할과 행동을 설명해 주세요."
              : "이 경험을 통해 만든 결과를 구체적으로 설명해 주세요.",
          claimId: claim.id,
          parentQuestionId: null,
          sourceQuote: claim.sourceQuote,
        },
        {
          id: `follow-up-${number}`,
          kind: "follow_up",
          question: en ? en.followUp[index === 0 ? 0 : 1]! :
            index === 0
              ? "그 과정에서 가장 어려웠던 판단과 그 판단의 근거는 무엇이었나요?"
              : "같은 상황을 다시 맡는다면 무엇을 다르게 하시겠어요?",
          claimId: claim.id,
          parentQuestionId: resumeId,
          sourceQuote: claim.sourceQuote,
        },
      ];
    }),
  ];

  return { generationMode: "fallback", claims, questions };
}

function readBoundedString(
  record: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new GuidedValidationError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new GuidedValidationError(`${field} has an invalid length`);
  }
  return normalized;
}

function readNullableId(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new GuidedValidationError(`${field} must be a short string or null`);
  }
  return value;
}

function readNullableQuote(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new GuidedValidationError(`${field} must be a string or null`);
  }
  const normalized = value.trim();
  if (normalized.length < 12 || normalized.length > 500) {
    throw new GuidedValidationError(`${field} has an invalid length`);
  }
  return normalized;
}

export function validateGuidedContent(
  value: unknown,
  request: GuidedPrepareRequest,
  lang: GuidedLang = "ko",
): GuidedContent {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.claims) || !Array.isArray(record.questions)) {
    throw new GuidedValidationError("generated content has an invalid shape");
  }
  if (record.claims.length < 1 || record.claims.length > 2) {
    throw new GuidedValidationError("one or two claims are required");
  }

  const claimIds = new Set<string>();
  const claimQuotes = new Set<string>();
  const claims = record.claims.map((raw): GuidedClaim => {
    const claim = asRecord(raw);
    if (!claim) throw new GuidedValidationError("claim must be an object");
    const id = readBoundedString(claim, "id", 1, 100);
    readBoundedString(claim, "text", 1, 500);
    const sourceQuote = readBoundedString(claim, "sourceQuote", 12, 500);
    if (
      claimIds.has(id) ||
      claimQuotes.has(sourceQuote) ||
      [...claimQuotes].some(
        (quote) => quote.includes(sourceQuote) || sourceQuote.includes(quote),
      ) ||
      !request.resumeText.includes(sourceQuote)
    ) {
      throw new GuidedValidationError("claim id or source quote is invalid");
    }
    claimIds.add(id);
    claimQuotes.add(sourceQuote);
    // 표시용 주장도 원문 그대로 둔다. 모델 요약에 없는 사실이 섞일 여지를 없앤다.
    return { id, text: sourceQuote, sourceQuote };
  });

  if (record.questions.length < 3 || record.questions.length > 6) {
    throw new GuidedValidationError("three to six questions are required");
  }

  const questionIds = new Set<string>();
  const allowedKinds = new Set<GuidedQuestionKind>([
    "common",
    "job",
    "resume",
    "follow_up",
  ]);
  const questions = record.questions.map((raw): GuidedQuestion => {
    const question = asRecord(raw);
    if (!question) throw new GuidedValidationError("question must be an object");
    const id = readBoundedString(question, "id", 1, 100);
    const kind = question.kind;
    if (typeof kind !== "string" || !allowedKinds.has(kind as GuidedQuestionKind)) {
      throw new GuidedValidationError("question kind is invalid");
    }
    const text = readBoundedString(
      question,
      "question",
      5,
      guidedQuestionMaxLength(lang),
    );
    if (!isConciseGuidedQuestion(text, lang)) {
      throw new GuidedValidationError("question must be one concise sentence");
    }
    const claimId = readNullableId(question, "claimId");
    const parentQuestionId = readNullableId(question, "parentQuestionId");
    const sourceQuote = readNullableQuote(question, "sourceQuote");
    if (questionIds.has(id)) throw new GuidedValidationError("question id must be unique");
    questionIds.add(id);
    return {
      id,
      kind: kind as GuidedQuestionKind,
      question: text,
      claimId,
      parentQuestionId,
      sourceQuote,
    };
  });

  const common = questions.filter((question) => question.kind === "common");
  const job = questions.filter((question) => question.kind === "job");
  const resume = questions.filter((question) => question.kind === "resume");
  const followUps = questions.filter((question) => question.kind === "follow_up");
  if (
    common.length !== 1 ||
    job.length !== 1 ||
    resume.length !== claims.length
  ) {
    throw new GuidedValidationError("question composition is invalid");
  }

  for (const question of common.concat(job)) {
    if (question.claimId !== null || question.parentQuestionId !== null || question.sourceQuote !== null) {
      throw new GuidedValidationError("common and job questions cannot cite a claim");
    }
  }

  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const resumeById = new Map(resume.map((question) => [question.id, question]));
  for (const question of resume) {
    const claim = question.claimId ? claimById.get(question.claimId) : undefined;
    if (
      !claim ||
      question.parentQuestionId !== null ||
      question.sourceQuote !== claim.sourceQuote ||
      !request.resumeText.includes(question.sourceQuote)
    ) {
      throw new GuidedValidationError("resume question citation is invalid");
    }
  }
  if (new Set(resume.map((question) => question.claimId)).size !== claims.length) {
    throw new GuidedValidationError(
      "each resume question must cite a different claim",
    );
  }

  const followUpCounts = new Map<string, number>();
  for (const question of followUps) {
    const parent = question.parentQuestionId
      ? resumeById.get(question.parentQuestionId)
      : undefined;
    const claim = question.claimId ? claimById.get(question.claimId) : undefined;
    if (
      !parent ||
      !claim ||
      parent.claimId !== question.claimId ||
      question.sourceQuote !== claim.sourceQuote
    ) {
      throw new GuidedValidationError("follow-up question citation is invalid");
    }
    const count = (followUpCounts.get(parent.id) ?? 0) + 1;
    if (count > 1) throw new GuidedValidationError("only one follow-up is allowed per resume question");
    followUpCounts.set(parent.id, count);
  }

  // 모델이 배열 순서를 섞어도 면접에서는 공통 → 직무 → 경험 → 해당 추가 질문
  // 순서로 진행한다. parent 연결이 검증된 뒤에만 재배열한다.
  const orderedQuestions = [
    common[0]!,
    job[0]!,
    ...resume.flatMap((question) => [
      question,
      ...followUps.filter((item) => item.parentQuestionId === question.id),
    ]),
  ];

  return { claims, questions: orderedQuestions };
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function duplicateSignature(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function characterNgrams(value: string, size = 3): Set<string> {
  if (value.length <= size) return new Set([value]);
  const grams = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) {
    grams.add(value.slice(index, index + size));
  }
  return grams;
}

export function isDuplicateGuidedQuestion(left: string, right: string): boolean {
  const a = duplicateSignature(left);
  const b = duplicateSignature(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.72) {
    return true;
  }
  if (shorter.length < 12) return false;

  const aGrams = characterNgrams(a);
  const bGrams = characterNgrams(b);
  let overlap = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) overlap += 1;
  }
  const union = aGrams.size + bGrams.size - overlap;
  return union > 0 && overlap / union >= 0.72;
}

// 질문에 단어가 등장한다는 이유만으로 거절하지 않는다. 예를 들어 설비
// "장애" 대응이나 역량을 "키운" 경험은 정상적인 직무 질문이다. 대신
// 지원자의 사적인 특성을 직접 묻는 표현을 범주별로 좁혀 검사한다.
const SENSITIVE_QUESTION_PATTERNS = [
  /부모(?:님)?\s*(?:직업|학력|소득|재산|출신|나이|연령)/iu,
  /(?:건강(?:\s*상태)?(?:가|는|은|에)\s*(?:(?:문제|이상)(?:가|는)?\s*(?:있|없)|괜찮|좋|나쁘|어떠|어떻)|현재\s*(?:앓(?:고\s*있는|는)|치료\s*중인)\s*(?:질환|질병)|(?:질환|질병|병력|수술\s*이력)(?:이|가|은|는)?\s*(?:있|없)|복용\s*중인\s*(?:약|약물)(?:이|가|은|는)?\s*(?:있|없|무엇|어떤)|아픈\s*(?:곳|데)(?:이|가)?\s*(?:있|없))/iu,
  /(?:^\s*(?:(?:지원자(?:님)?|본인|귀하)(?:께서는|은|는|이|가)?\s*)?(?:(?:현재|혹시)\s*)?(?:(?:신체|정신|발달|시각|청각)(?:적)?\s*)?장애(?:가|는)\s*(?:있|없)|^\s*(?:(?:지원자(?:님)?|본인|귀하)(?:께서는|은|는)?\s*)?장애를\s*(?:가지고|보유하고)\s*(?:있|없)|(?:지원자(?:님)?의|본인의|귀하의)\s*장애\s*(?:여부|유무|등급|등록|진단)|^\s*장애\s*(?:여부|유무|등급)(?:를|은|는)?\s*(?:알려|말씀)|^\s*장애인(?:이신가요|인가요|입니까)$)/iu,
  /(?:^\s*(?:(?:지원자(?:님)?|본인|귀하)(?:께서는|은|는)?\s*)?(?:현재|혹시)?\s*임신(?:하셨|했|중이신|중인가|중입니까)|임신(?:할|하실)\s*(?:계획|생각)|(?:아기|아이)(?:를)?\s*낳(?:을|으실)\s*(?:계획|생각)|출산(?:할|하실)\s*(?:계획|생각)|출산\s*경험(?:이|은|을)?\s*(?:있|없|말씀|알려))/iu,
  /(?:^\s*(?:(?:지원자(?:님)?|본인|귀하)(?:께서는|은|는)?\s*)?(?:현재|혹시)?\s*결혼(?:하셨|했나요|했습니까|할\s*(?:계획|생각)|예정)|(?:결혼|혼인)\s*(?:여부|상태|계획)(?:가|는|을|를)?\s*(?:어떻|있|없|알려|말씀)|(?:기혼|미혼)(?:이신가요|인가요|입니까)$)/iu,
  /(?:형제(?:자매)?(?:가|는|은)\s*(?:몇\s*명|누구|어떤\s*일|무슨\s*일|직업)|부모(?:님)?(?:과|와)\s*함께\s*(?:살|거주)|부모(?:님)?(?:의|은|는)\s*(?:직업|학력|소득|재산|출신|나이|연령)|부양\s*가족(?:이|은|는|을)?\s*(?:있|없|몇|누구)|가족\s*(?:관계|구성|사항|배경)(?:이|은|을|를)?\s*(?:어떻|말씀|알려|설명)|자녀(?:가|는)?\s*(?:있|없)|자녀\s*(?:계획|유무))/iu,
  /(?:(?:종교|신앙)(?:가|는|이|은|을|를)?\s*(?:무엇|어떤|있|없|어떻|믿)|(?:교회|성당|절|사찰)(?:에|를)?\s*(?:다니(?:나요|십니까|세요)|나가(?:나요|십니까|세요))|(?:예배|미사)(?:에)?\s*참석(?:하나요|합니까|하세요)|(?:어느|어떤)\s*(?:정당|후보)(?:을|를)?\s*지지(?:하나요|합니까|하세요)|(?:정치(?:적)?\s*)?(?:성향|견해|관점|입장|정치관)(?:이|은|을|를)?\s*(?:무엇|어떻|어떤\s*편|말씀|밝혀))/iu,
  /(?:^\s*(?:(?:지원자(?:님)?|본인|귀하)(?:의|은|는)?\s*)?키(?:가|는)\s*(?:몇|어떻|얼마)|(?:키|신장)(?:이|은)?\s*몇\s*(?:cm|센티)|(?:몸무게|체중)(?:이|은)?\s*(?:몇|얼마)|몇\s*년생(?:이신가요|인가요|입니까)|생년월일(?:이|은)?\s*(?:어떻|언제|몇|알려|말씀)|(?:나이|연령)(?:가|는|이|은)?\s*(?:몇|어떻|얼마)|몇\s*살|(?:남성|여성)(?:이신가요|인가요|입니까)$|성별(?:이|은|을)?\s*(?:무엇|어떻|남성|여성|알려|말씀)|어디\s*출신(?:이신가요|인가요|입니까)|(?:출신지|고향)(?:가|은|이|을)?\s*(?:어디|어느|말씀|알려))/iu,
  /(?:(?:재산|소득)(?:이|은|을|도)?\s*(?:얼마|규모|수준|어떻)|국적(?:이|은|을)?\s*(?:어디|무엇|어느\s*나라|알려|말씀)|(?:한국인|외국인)(?:이신가요|인가요|입니까)$|군필(?:이신가요|인가요|입니까)$|병역\s*(?:여부|필|미필|면제)(?:가|는|을|를)?\s*(?:어떻|알려|말씀|인가|입니까)|병역(?:을|은)?\s*(?:마쳤|이행했|복무했)|군대(?:를|는)?\s*(?:다녀오셨|다녀왔|복무하셨|전역하셨|면제)|군\s*복무\s*경험(?:이|은)?\s*(?:있|없))/iu,
  /(?:your\s+(?:health|medical\s+history|age|gender|religion|nationality|marital\s+status)|are\s+you\s+(?:pregnant|married|disabled)|do\s+you\s+have\s+(?:a\s+)?(?:disability|children))/iu,
] as const;

function containsSensitiveQuestion(value: string): boolean {
  const normalized = value.normalize("NFKC").replace(/[\p{Cf}]/gu, "");
  const variants = [
    normalized,
    normalized.replace(/[\p{P}\p{S}\s]+/gu, ""),
  ];
  return variants.some((candidate) =>
    SENSITIVE_QUESTION_PATTERNS.some((pattern) => pattern.test(candidate)),
  );
}

export function validateGuidedExpansion(
  value: unknown,
  request: Pick<GuidedExpandRequest, "resumeText" | "existingQuestions">,
  options: { lang?: GuidedLang } = {},
): Pick<GuidedExpandResponse, "additions"> {
  const record = asRecord(value);
  if (
    !record ||
    !hasOnlyKeys(record, ["additions"]) ||
    !Array.isArray(record.additions) ||
    record.additions.length !== GUIDED_EXPANSION_QUESTION_COUNT
  ) {
    throw new GuidedValidationError(
      "generated expansion must contain one resume question and one follow-up",
    );
  }

  const acceptedQuestions = request.existingQuestions.map(
    (existing) => existing.question,
  );
  const additions = record.additions.map((raw, index): GuidedExpandAddition => {
    const addition = asRecord(raw);
    if (!addition || !hasOnlyKeys(addition, ["kind", "question", "sourceQuote"]) ||
      addition.kind !== (index === 0 ? "resume" : "follow_up")) {
      throw new GuidedValidationError("addition has an invalid shape");
    }

    const rawQuestion = typeof addition.question === "string" ? addition.question : "";
    const lang = guidedLangOf(rawQuestion, options.lang);
    const question = readBoundedString(
      addition,
      "question",
      5,
      guidedQuestionMaxLength(lang),
    );
    const sourceQuote = readBoundedString(
      addition,
      "sourceQuote",
      12,
      500,
    );
    if (lang === "ko" && !/[가-힣]/u.test(question)) {
      throw new GuidedValidationError("addition question must be Korean");
    }
    if (lang === "en" && !/\p{L}/u.test(question)) {
      throw new GuidedValidationError("addition question must contain words");
    }
    if (!isConciseGuidedQuestion(question, lang)) {
      throw new GuidedValidationError(
        "addition question must be one concise sentence",
      );
    }
    if (
      /(?:방금|앞서|아까|지금)\s*(?:말씀|말한|답변|설명)|말씀하신|답변하신/u.test(question) ||
      /\b(?:you\s+(?:just\s+)?(?:said|mentioned|told\s+us|described)|as\s+you\s+(?:said|mentioned)|your\s+(?:previous|last|earlier)\s+answer)\b/iu.test(question)
    ) {
      throw new GuidedValidationError("pre-generated questions cannot assume an answer was given");
    }
    if (!request.resumeText.includes(sourceQuote)) {
      throw new GuidedValidationError(
        "addition source quote must be copied from resumeText",
      );
    }
    if (containsSensitiveQuestion(question)) {
      throw new GuidedValidationError("addition contains a sensitive question");
    }
    if (
      acceptedQuestions.some((existing) =>
        isDuplicateGuidedQuestion(existing, question),
      )
    ) {
      throw new GuidedValidationError("addition question is duplicated");
    }

    acceptedQuestions.push(question);
    return { kind: index === 0 ? "resume" : "follow_up", question, sourceQuote };
  });

  if (additions[0]!.sourceQuote !== additions[1]!.sourceQuote) {
    throw new GuidedValidationError("a question pair must share the same resume evidence");
  }

  return { additions };
}
