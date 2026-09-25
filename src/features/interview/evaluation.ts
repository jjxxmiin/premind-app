import type {
  GuidedQuestionKind,
} from "./guided";
import type {
  InterviewAnalysisUsage,
  InterviewAnswerFit,
  InterviewEvaluationResult,
  InterviewFeedbackSummary,
  InterviewIntentCoverage,
} from "./types";

export const EVALUATION_LIMITS = {
  company: 120,
  jobRole: 120,
  items: 20,
  question: 500,
  transcript: 20_000,
  totalTranscript: 120_000,
  sourceQuote: 500,
} as const;

export type EvaluationRequestItem = {
  attemptId: string;
  questionId: string;
  question: string;
  transcript: string;
  durationMs: number;
  kind: GuidedQuestionKind | null;
  parentQuestionId?: string | null;
  sourceQuote: string | null;
};

export type EvaluationRequest = {
  company: string;
  jobRole: string;
  items: EvaluationRequestItem[];
};

export type EvaluationResponse = {
  answers: InterviewEvaluationResult[];
  overall: InterviewFeedbackSummary | null;
  failedAttemptIds: string[];
  model: "gemini-3.5-flash";
  usage: InterviewAnalysisUsage;
};

/** AI 피드백을 쓰는 언어(영어 화면이면 "en"). 인용(evidenceQuote)은 언어와 상관없이 전사문 원문 그대로다. */
export type EvaluationLang = "ko" | "en";

/**
 * 총평 문장 = 발언 인용 + 첫 개선점. 한국어는 예전 그대로이고, 영어 화면에서 만든 총평은 영어 틀을 쓴다.
 * 저장된 총평을 다시 검사할 때는 두 틀을 모두 받아 준다(만든 때의 화면 언어를 따로 저장하지 않는다).
 */
function groundedSummaryText(lang: EvaluationLang, evidenceQuote: string, advice: string): string {
  return lang === "en"
    ? `You said, “${evidenceQuote}”. ${advice}`
    : `“${evidenceQuote}”라고 답했어요. ${advice}`;
}

export class EvaluationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationValidationError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function hasOnlyAllowedKeys(
  record: Record<string, unknown>,
  required: string[],
  optional: string[],
): boolean {
  const allowed = new Set(required.concat(optional));
  return (
    required.every((key) => Object.hasOwn(record, key)) &&
    Object.keys(record).every((key) => allowed.has(key))
  );
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

// `analysis.ts`의 전사 판정과 같은 Unicode 문자/숫자 10자 경계다. 이 파일은
// Node 순수 검증 테스트에서도 직접 로드되므로 런타임 순환 import 없이 유지한다.
function hasEnoughMeaningfulTranscriptCharacters(value: string): boolean {
  return (value.normalize("NFKC").match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 10;
}

function readString(
  record: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const raw = record[field];
  if (typeof raw !== "string") {
    throw new EvaluationValidationError(`${field} must be a string`);
  }
  const value = normalizeText(raw);
  if (value.length < min || value.length > max) {
    throw new EvaluationValidationError(`${field} has an invalid length`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string,
  max: number,
): string {
  if (!Object.hasOwn(record, field) || record[field] === undefined) return "";
  return readString(record, field, 0, max);
}

function readNullableString(
  record: Record<string, unknown>,
  field: string,
  max: number,
): string | null {
  if (!Object.hasOwn(record, field) || record[field] == null) return null;
  return readString(record, field, 1, max);
}

function readDurationMs(record: Record<string, unknown>): number {
  const raw = record.durationMs;
  if (raw === undefined) return 0;
  if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > 300_000) {
    throw new EvaluationValidationError("durationMs is invalid");
  }
  return raw as number;
}

const QUESTION_KINDS = new Set<GuidedQuestionKind>([
  "common",
  "job",
  "resume",
  "follow_up",
]);

function readQuestionKind(record: Record<string, unknown>): GuidedQuestionKind | null {
  const raw = record.kind;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || !QUESTION_KINDS.has(raw as GuidedQuestionKind)) {
    throw new EvaluationValidationError("kind is invalid");
  }
  return raw as GuidedQuestionKind;
}

/** API에 전달할 전체 면접 답변을 크기 제한과 함께 정규화한다. */
export function normalizeEvaluationRequest(value: unknown): EvaluationRequest {
  const record = asRecord(value);
  if (
    !record ||
    !hasOnlyAllowedKeys(record, ["items"], ["company", "jobRole"]) ||
    !Array.isArray(record.items) ||
    record.items.length < 1 ||
    record.items.length > EVALUATION_LIMITS.items
  ) {
    throw new EvaluationValidationError("request has an invalid shape");
  }

  const seenAttempts = new Set<string>();
  let totalTranscriptLength = 0;
  const items = record.items.map((raw): EvaluationRequestItem => {
    const item = asRecord(raw);
    if (
      !item ||
      !hasOnlyAllowedKeys(
        item,
        ["attemptId", "questionId", "question", "transcript"],
        ["durationMs", "kind", "sourceQuote", "parentQuestionId"],
      )
    ) {
      throw new EvaluationValidationError("evaluation item has an invalid shape");
    }

    const attemptId = readString(item, "attemptId", 1, 120);
    const questionId = readString(item, "questionId", 1, 120);
    const question = readString(item, "question", 1, EVALUATION_LIMITS.question);
    const transcript = readString(
      item,
      "transcript",
      0,
      EVALUATION_LIMITS.transcript,
    );
    if (!hasEnoughMeaningfulTranscriptCharacters(transcript)) {
      throw new EvaluationValidationError(
        "transcript does not contain enough meaningful characters",
      );
    }
    if (seenAttempts.has(attemptId)) {
      throw new EvaluationValidationError("attemptId must be unique");
    }
    seenAttempts.add(attemptId);
    totalTranscriptLength += transcript.length;
    if (totalTranscriptLength > EVALUATION_LIMITS.totalTranscript) {
      throw new EvaluationValidationError("transcripts are too long");
    }

    const kind = readQuestionKind(item);
    const parentQuestionId = readNullableString(item, "parentQuestionId", 120);
    if (parentQuestionId && (kind !== "follow_up" || parentQuestionId === questionId)) {
      throw new EvaluationValidationError("invalid parent question relation");
    }
    return {
      attemptId,
      questionId,
      question,
      transcript,
      durationMs: readDurationMs(item),
      kind,
      parentQuestionId,
      sourceQuote: readNullableString(
        item,
        "sourceQuote",
        EVALUATION_LIMITS.sourceQuote,
      ),
    };
  });

  return {
    company: readOptionalString(record, "company", EVALUATION_LIMITS.company),
    jobRole: readOptionalString(record, "jobRole", EVALUATION_LIMITS.jobRole),
    items,
  };
}

const FIT_VALUES = new Set<InterviewAnswerFit>([
  "direct",
  "partial",
  "off_topic",
  "insufficient",
]);
const COVERAGE_VALUES = new Set<InterviewIntentCoverage>([
  "met",
  "partial",
  "missing",
]);

// 결과 문장만 검사한다. evidenceQuote는 지원자가 실제로 말한 원문이므로 금지어가
// 들어 있다는 이유로 버리지 않고 아래에서 전사문 포함 여부만 검증한다.
const PROHIBITED_JUDGMENT_PATTERNS = [
  /(?:불합격|합격(?:률|\s*가능성|\s*확률|\s*여부)?|채용(?:해야|하지|할\s*만|\s*가능성|\s*적합)|적합한\s*지원자)/iu,
  /(?:직무|업무|조직)\s*(?:부?적합(?:도|성)?|에\s*부?적합)/iu,
  /(?:거짓말|거짓(?:으로|이다|처럼)|허위|진실성|진위|사실\s*(?:여부|이다|로\s*보)|과장(?:했|한\s*것|으로\s*보)|정직(?:하|하지)|부정직|꾸며낸|신뢰성(?:이|은)\s*(?:높|낮))/iu,
  /(?:MBTI|내향적|외향적|성격(?:이|은|상|으로)\s*(?:좋|나쁘|소극|적극|내향|외향)|인성(?:이|은)\s*(?:좋|나쁘)|(?:소극적|적극적|성실한|무책임한)\s*사람)/iu,
  /(?:점수|평점|별점|등급|백점|\d{1,3}\s*\/\s*100|\d{1,3}\s*점\s*(?:입니다|이에요|수준|짜리|으로\s*평가))/iu,
  /(?:자신감|말투|목소리|어조|감정|불안(?:해|감|한)|긴장(?:감|했|한|해)|유창(?:성|하|하지)|발음|말(?:하기)?\s*속도|표정|제스처|시선\s*처리)/iu,
  /(?:막힘\s*없이|막히지\s*않|망설임\s*없이|머뭇거|술술|침착(?:하게|히)|또렷(?:하게|한)|더듬지\s*않|즉답|즉시\s*답변|주저\s*없이)/iu,
  /(?:성별|여성|남성|여자|남자|임신|출산|장애|질병|건강\s*상태|종교|정치\s*성향|나이|연령|외모|국적|인종|민족|혼인|결혼\s*여부|가족\s*관계|재산|경제적\s*배경)/iu,
  /\b(?:pass|fail|hire|honest|dishonest|deceptive|truthful|personality|introvert|extrovert|score|rating|confidence|tone|voice|emotion|fluency|fluent|pronunciation|gender|female|male|race|ethnicity|religion|disability|pregnancy|nationality)\b/iu,
] as const;

function assertSafeGeneratedText(value: string): void {
  if (PROHIBITED_JUDGMENT_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new EvaluationValidationError("generated text contains a prohibited judgment");
  }
}

function readGeneratedString(
  record: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const value = readString(record, field, min, max);
  assertSafeGeneratedText(value);
  return value;
}

function readEvidenceQuote(
  record: Record<string, unknown>,
  field: string,
  transcript: string,
  nullable: boolean,
): string | null {
  const raw = record[field];
  if (nullable && raw === null) return null;
  if (typeof raw !== "string") {
    throw new EvaluationValidationError(`${field} must be a string`);
  }
  const quote = normalizeText(raw);
  if (quote.length < 1 || quote.length > 500 || !transcript.includes(quote)) {
    throw new EvaluationValidationError("evidenceQuote is not in the transcript");
  }
  return quote;
}

function readGeneratedStringArray(
  record: Record<string, unknown>,
  field: string,
  minItems: number,
  maxItems: number,
  maxLength = 300,
): string[] {
  const raw = record[field];
  if (!Array.isArray(raw) || raw.length < minItems || raw.length > maxItems) {
    throw new EvaluationValidationError(`${field} has an invalid shape`);
  }
  return raw.map((value) => {
    if (typeof value !== "string") {
      throw new EvaluationValidationError(`${field} must contain strings`);
    }
    const normalized = normalizeText(value);
    if (normalized.length < 1 || normalized.length > maxLength) {
      throw new EvaluationValidationError(`${field} has an invalid item`);
    }
    assertSafeGeneratedText(normalized);
    return normalized;
  });
}

/**
 * 모델 JSON을 화면/저장 계약으로 변환한다. ID 1:1 대응과 모든 근거 인용의
 * exact-substring 조건을 통과한 결과만 반환한다.
 */
function validateEvaluationAnswers(
  value: unknown,
  request: EvaluationRequest,
  contextRequest = request,
): InterviewEvaluationResult[] {
  const root = asRecord(value);
  if (
    !root ||
    !hasOnlyKeys(root, ["answers", "overall"]) ||
    !Array.isArray(root.answers) ||
    root.answers.length !== request.items.length
  ) {
    throw new EvaluationValidationError("model output has an invalid shape");
  }

  const inputByAttempt = new Map(request.items.map((item) => [item.attemptId, item]));
  const seenAttempts = new Set<string>();
  const parsed = root.answers.map((raw): InterviewEvaluationResult => {
    const answer = asRecord(raw);
    if (
      !answer ||
      !hasOnlyKeys(answer, [
        "attemptId",
        "questionId",
        "fit",
        "coverage",
        "strengths",
        "missingPoints",
        "nextFocus",
        "suggestedStructure",
      ])
    ) {
      throw new EvaluationValidationError("answer has an invalid shape");
    }

    const attemptId = readString(answer, "attemptId", 1, 120);
    const questionId = readString(answer, "questionId", 1, 120);
    const input = inputByAttempt.get(attemptId);
    if (!input || seenAttempts.has(attemptId) || input.questionId !== questionId) {
      throw new EvaluationValidationError("answer ids do not match the request");
    }
    seenAttempts.add(attemptId);

    const fit = answer.fit;
    if (typeof fit !== "string" || !FIT_VALUES.has(fit as InterviewAnswerFit)) {
      throw new EvaluationValidationError("fit is invalid");
    }

    if (!Array.isArray(answer.coverage) || answer.coverage.length < 1 || answer.coverage.length > 4) {
      throw new EvaluationValidationError("coverage has an invalid shape");
    }
    const coverage = answer.coverage.map((rawCoverage) => {
      const item = asRecord(rawCoverage);
      if (!item || !hasOnlyKeys(item, ["point", "status", "evidenceQuote"])) {
        throw new EvaluationValidationError("coverage item has an invalid shape");
      }
      const point = readGeneratedString(item, "point", 1, 300);
      const status = item.status;
      if (
        typeof status !== "string" ||
        !COVERAGE_VALUES.has(status as InterviewIntentCoverage)
      ) {
        throw new EvaluationValidationError("coverage status is invalid");
      }
      const evidenceQuote = readEvidenceQuote(
        item,
        "evidenceQuote",
        input.transcript,
        true,
      );
      if (status === "met" && evidenceQuote === null) {
        throw new EvaluationValidationError("met coverage requires evidence");
      }
      if (status === "missing" && evidenceQuote !== null) {
        throw new EvaluationValidationError("missing coverage cannot cite evidence");
      }
      return {
        point,
        status: status as InterviewIntentCoverage,
        evidenceQuote,
      };
    });

    if (!Array.isArray(answer.strengths) || answer.strengths.length > 3) {
      throw new EvaluationValidationError("strengths has an invalid shape");
    }
    const strengths = answer.strengths.map((rawStrength) => {
      const item = asRecord(rawStrength);
      if (!item || !hasOnlyKeys(item, ["point", "evidenceQuote"])) {
        throw new EvaluationValidationError("strength has an invalid shape");
      }
      const evidenceQuote = readEvidenceQuote(
        item,
        "evidenceQuote",
        input.transcript,
        false,
      );
      if (evidenceQuote === null) {
        throw new EvaluationValidationError("strength evidence is required");
      }
      return {
        point: readGeneratedString(item, "point", 1, 300),
        evidenceQuote,
      };
    });

    const metCount = coverage.filter((item) => item.status === "met").length;
    const partialCount = coverage.filter((item) => item.status === "partial").length;
    const missingCount = coverage.filter((item) => item.status === "missing").length;
    const missingPoints = readGeneratedStringArray(answer, "missingPoints", 0, 4);
    if (
      (fit === "direct" &&
        (metCount !== coverage.length || missingPoints.length > 0)) ||
      (fit === "partial" &&
        (metCount + partialCount === 0 || partialCount + missingCount === 0)) ||
      ((fit === "off_topic" || fit === "insufficient") &&
        missingCount !== coverage.length)
    ) {
      throw new EvaluationValidationError("fit conflicts with coverage");
    }
    if (
      (fit === "off_topic" || fit === "insufficient") &&
      strengths.length > 0
    ) {
      throw new EvaluationValidationError("fit conflicts with strengths");
    }
    if (
      input.transcript.length === 0 &&
      (fit !== "insufficient" ||
        strengths.length > 0 ||
        coverage.some((item) => item.status !== "missing"))
    ) {
      throw new EvaluationValidationError("empty transcript evaluation is invalid");
    }

    const nextFocus = readGeneratedString(answer, "nextFocus", 1, 300);
    const suggestedStructure = readGeneratedStringArray(answer, "suggestedStructure", 2, 4);
    const prose = [nextFocus, ...suggestedStructure, ...missingPoints,
      ...coverage.map((item) => item.point), ...strengths.map((item) => item.point)].join(" ");
    assertQuestionContext(prose, input, contextRequest);
    return {
      attemptId,
      questionId,
      fit: fit as InterviewAnswerFit,
      coverage,
      strengths,
      missingPoints,
      nextFocus,
      suggestedStructure,
    };
  });

  // 모델이 배열 순서를 바꿔도 저장과 화면에서는 요청 순서를 유지한다.
  const byAttempt = new Map(parsed.map((answer) => [answer.attemptId, answer]));
  const answers = request.items.map((item) => {
    const answer = byAttempt.get(item.attemptId);
    if (!answer) {
      throw new EvaluationValidationError("an answer is missing");
    }
    return answer;
  });

  return answers;
}

function assertQuestionContext(prose: string, input: EvaluationRequestItem, request: EvaluationRequest): void {
  const normalized = prose.normalize("NFKC").replace(/[\p{P}\p{S}\p{Cf}\s]+/gu, "");
  if (/(?:꼬리질문|꼬꼬무|꼬리를무는|추가질문|후속질문|followup)/iu.test(normalized)) {
    const parent = request.items.find((item) => item.questionId === input.parentQuestionId && item.kind === "resume");
    if (input.kind !== "follow_up" || !parent) throw new EvaluationValidationError("unsubstantiated follow-up claim");
  }
  if (/(?:압박면접|압박질문|실시간(?:으로)?(?:질문|대응)|즉석(?:에서)?(?:질문|대응))/u.test(normalized)) {
    throw new EvaluationValidationError("unobserved interview dynamics");
  }
}

/** 모델은 근거 위치만 고른다. 총평 문장 자체는 발언 인용 + 기존 개선점으로 조립한다. */
export function validateGroundedSummary(
  value: unknown,
  request: EvaluationRequest,
  answers: InterviewEvaluationResult[],
  lang: EvaluationLang = "ko",
): InterviewFeedbackSummary {
  const root = asRecord(value);
  if (!root) throw new EvaluationValidationError("summary evidence is missing");
  const stored = Object.hasOwn(root, "grounding");
  const reference = stored ? asRecord(root.grounding) : root;
  if (!reference || (stored
    ? (!hasOnlyKeys(root, ["summary", "strengths", "nextPractice", "grounding"]) ||
      !hasOnlyKeys(reference, ["version", "attemptId", "questionId", "evidenceQuote"]) || reference.version !== 1)
    : !hasOnlyKeys(reference, ["focusAttemptId", "focusQuestionId", "evidenceQuote"]))) {
    throw new EvaluationValidationError("summary must select one grounded answer");
  }
  const attemptId = readString(reference, stored ? "attemptId" : "focusAttemptId", 1, 120);
  const questionId = readString(reference, stored ? "questionId" : "focusQuestionId", 1, 120);
  const input = request.items.find((item) => item.attemptId === attemptId && item.questionId === questionId);
  const answer = answers.find((item) => item.attemptId === attemptId && item.questionId === questionId);
  if (!input || !answer) throw new EvaluationValidationError("summary answer is not in the evaluated input");
  const evidenceQuote = readEvidenceQuote(reference, "evidenceQuote", input.transcript, false)!;
  const quotes = [...answer.strengths.map((item) => item.evidenceQuote), ...answer.coverage.map((item) => item.evidenceQuote)];
  if (evidenceQuote.length > 140 || !hasEnoughMeaningfulTranscriptCharacters(evidenceQuote) ||
      /\n|[.!?。！？]\s+\S/u.test(evidenceQuote) || !quotes.some((quote) => quote?.includes(evidenceQuote))) {
    throw new EvaluationValidationError("summary quote must be a short, evaluated passage");
  }
  const advice = readGeneratedString(answer as unknown as Record<string, unknown>, "nextFocus", 1, 300)
    .split(/(?<=[.!?。！？])\s+|\n+/u)[0] ?? "";
  assertQuestionContext(advice, input, request);
  const storedLang: EvaluationLang =
    stored && root.summary === groundedSummaryText("en", evidenceQuote, advice) ? "en" : stored ? "ko" : lang;
  const result: InterviewFeedbackSummary = {
    summary: groundedSummaryText(storedLang, evidenceQuote, advice),
    strengths: [], nextPractice: advice,
    grounding: { version: 1, attemptId, questionId, evidenceQuote },
  };
  if (stored && (root.summary !== result.summary || root.nextPractice !== result.nextPractice ||
    !Array.isArray(root.strengths) || root.strengths.length !== 0)) {
    throw new EvaluationValidationError("stored summary does not match its answer evidence");
  }
  return result;
}

export function validateEvaluationOutput(value: unknown, request: EvaluationRequest): {
  answers: InterviewEvaluationResult[]; overall: InterviewFeedbackSummary;
} {
  const answers = validateEvaluationAnswers(value, request);
  return { answers, overall: validateGroundedSummary(asRecord(value)?.overall, request, answers) };
}

/** Preserve independently valid answers, but never guess ambiguous identities.
 * The strict validator above is also used here, including quote/safety checks. */
export function validatePartialEvaluationOutput(
  value: unknown,
  request: EvaluationRequest,
  lang: EvaluationLang = "ko",
): Pick<EvaluationResponse, "answers" | "overall" | "failedAttemptIds"> {
  const root = asRecord(value);
  if (!root || !hasOnlyKeys(root, ["answers", "overall"]) || !Array.isArray(root.answers) ||
    root.answers.length > request.items.length) {
    throw new EvaluationValidationError("model output has an invalid shape");
  }
  const inputs = new Map(request.items.map((item) => [item.attemptId, item]));
  const seen = new Set<string>();
  const answers: InterviewEvaluationResult[] = [];
  for (const raw of root.answers) {
    const item = asRecord(raw);
    const id = item && typeof item.attemptId === "string" ? item.attemptId : "";
    const input = inputs.get(id);
    if (!input || seen.has(id) || item?.questionId !== input.questionId) {
      throw new EvaluationValidationError("answer identities are ambiguous");
    }
    seen.add(id);
    try {
      const parsed = validateEvaluationAnswers({ answers: [raw], overall: null }, { ...request, items: [input] }, request);
      answers.push(parsed[0]!);
    } catch (error) {
      if (!(error instanceof EvaluationValidationError)) throw error;
    }
  }
  const validIds = new Set(answers.map((item) => item.attemptId));
  const failedAttemptIds = request.items.filter((item) => !validIds.has(item.attemptId)).map((item) => item.attemptId);
  let overall: InterviewFeedbackSummary | null = null;
  if (failedAttemptIds.length === 0 && root.overall !== null) {
    try {
      overall = validateGroundedSummary(root.overall, request, answers, lang);
    } catch (error) {
      if (!(error instanceof EvaluationValidationError)) throw error;
    }
  }
  const byId = new Map(answers.map((item) => [item.attemptId, item]));
  return { answers: request.items.flatMap((item) => byId.has(item.attemptId) ? [byId.get(item.attemptId)!] : []), overall, failedAttemptIds };
}
