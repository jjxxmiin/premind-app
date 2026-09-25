/**
 * 면접 모듈 1차 프로토타입의 데이터 계약.
 *
 * 이 타입들은 나중에 실제 API 응답으로 교체된다. 지금은 로컬 상수와 IndexedDB가
 * 채우지만 필드명과 모양은 서버 계약을 미리 잡아 둔 것이므로 임의로 바꾸지 않는다.
 * (스네이크 케이스로 내려오는 기존 /api/interviews 응답과는 다른 계약이다.)
 */

import type {
  GuidedClaim,
  GuidedPrepareResponse,
  GuidedQuestionKind,
} from "./guided";
/**
 * On-device camera observations the interview web app keeps on a video answer.
 * The app records no camera in v1, but a backup made on the web can carry one,
 * so the shape is kept (opaque) rather than dropped on a round trip.
 */
export type VisualFeedback = {
  schemaVersion: 1;
  status: "ready" | "insufficient" | "unavailable";
  [key: string]: unknown;
};

export type CompanyTrait = {
  id: string;
  /** 짧은 표시용 이름. 원문 문구는 description 에 그대로 둔다. */
  label: string;
  /** 각 사가 채용 페이지에 공개한 설명 문구. 요약하거나 지어내지 않는다. */
  description: string;
};

export type InterviewQuestion = {
  id: string;
  order: number;
  text: string;
  /**
   * 이 질문과 연결된 인재상. 빈 배열이면 대조 대상이 없다.
   * 2차 리포트의 인재상 대조 피드백은 이 배열이 비어 있지 않은 질문만 받는다.
   */
  traitIds: string[];
  /** 강제 제한이 아닌 권장 답변시간. 0이 지나도 사용자가 완료할 때까지 이어진다. */
  maxDurationMs: number;
  prepDurationMs: number;
  /** 자소서 맞춤 면접에서만 채워지는 질문 분류와 원문 근거. */
  kind?: GuidedQuestionKind;
  claimId?: string | null;
  parentQuestionId?: string | null;
  sourceQuote?: string | null;
};

export type CompanyPack = {
  id: string;
  name: string;
  /** "common": 특정 회사가 아닌 PREMIND 공통 질문 세트(공기업 공통, 고졸 채용 등). */
  track?: "company" | "common";
  /** 공통 세트의 대상, 예: "특성화고와 마이스터고 3학년" */
  audience?: string;
  /** 전형 단계 표기. 공고와 시점에 따라 달라지므로 면책 고지와 함께 보여준다. */
  stage: string;
  sourceUrl: string;
  /** 정보 확인일 (YYYY-MM-DD). */
  verifiedAt: string;
  traits: CompanyTrait[];
  questions: InterviewQuestion[];
};

/**
 * 답변 한 건. 1차에서는 항상 "recorded" 로 저장한다.
 *
 * "unavailable" 은 전사 도구를 아예 쓸 수 없는 환경을 뜻한다. 다시 시도하면 될
 * 수도 있는 "failed" 와는 다르게 다뤄야 한다(재시도 버튼을 붙이지 않는다).
 */
export type InterviewAttemptStatus =
  | "recorded"
  | "transcribing"
  | "ready"
  | "failed"
  | "unavailable";

/**
 * 사용자가 고른 답변 피드백 방식. 로컬 영상 녹화 여부인 `capture`와는
 * 독립된 축이므로 AI 피드백을 받으면서 영상을 남기거나, AI 없이 영상만
 * 남길 수도 있다.
 *
 * 이 값이 없는 세션은 `capture` 만 사용하던 예전 기록이다. 따라서 기본값을
 * 임의로 ai/basic 중 하나로 채우지 말고 기존 녹화 흐름으로 해석해야 한다.
 */
export type InterviewFeedbackMode = "ai" | "basic";

/**
 * 전사와 평가는 서로 독립적으로 재시도할 수 있어야 하므로 각각 이 상태를 가진다.
 * 기존 InterviewAttempt.status 는 녹화본 저장 상태로 계속 보존한다.
 */
export type InterviewAnalysisTaskStatus =
  | "idle"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

export type InterviewAnalysisErrorCode =
  | "permission_denied"
  | "no_audio"
  | "answer_too_short"
  | "no_speech"
  | "speech_too_short"
  | "unsupported_format"
  | "payload_too_large"
  | "duration_limit"
  | "rate_limited"
  | "daily_limit"
  | "capacity_limited"
  | "service_unavailable"
  | "upstream_rate_limited"
  | "upstream_auth"
  | "upstream_rejected"
  | "timeout"
  | "network"
  | "upstream"
  | "invalid_response"
  | "expired"
  | "unknown";

/** 브라우저 예외나 공급자 응답 원문을 저장하지 않는 사용자 안전 오류 계약. */
export type InterviewAnalysisError = {
  code: InterviewAnalysisErrorCode;
  message: string;
  retryable: boolean;
  occurredAt: string;
  retryAfterMs?: number;
};

/**
 * 실제 과금 확인에 필요한 최소 사용량. 응답 내용이나 API 키는 절대 넣지 않는다.
 * 공급자가 특정 값을 주지 않는 경우를 위해 토큰 필드는 선택값이다.
 */
export type InterviewAnalysisUsage = {
  provider: "google" | "browser";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  thinkingTokens?: number;
  audioDurationMs?: number;
  requestId?: string;
  recordedAt: string;
};

/**
 * original 은 모델이 처음 들은 원문이며 덮어쓰지 않는다. 사용자가 고친 문장은
 * corrected 에 따로 두고, 수정할 때마다 revision 을 올려 평가의 낡음 여부를 안다.
 */
export type InterviewTranscript = {
  original: string;
  corrected?: string;
  revision: number;
  language?: string;
  createdAt: string;
  correctedAt?: string;
};

export type InterviewTranscriptionState = {
  status: InterviewAnalysisTaskStatus;
  /** Absent on old records: never automatically re-charge legacy failures. */
  automaticRetryCount?: number;
  retryNotBefore?: string;
  attemptCount: number;
  updatedAt: string;
  queuedAt?: string;
  processingStartedAt?: string;
  /**
   * IndexedDB 에서 이 작업을 원자적으로 선점한 요청의 id. 탭이 닫혀 lease 가
   * 만료되거나 다른 탭이 다시 선점하면 값이 바뀌므로, 늦게 도착한 이전 응답은
   * 현재 상태를 덮어쓸 수 없다.
   */
  claimId?: string;
  completedAt?: string;
  transcript?: InterviewTranscript;
  error?: InterviewAnalysisError;
  usage?: InterviewAnalysisUsage;
};

export type InterviewAnswerFit =
  | "direct"
  | "partial"
  | "off_topic"
  | "insufficient";

export type InterviewIntentCoverage = "met" | "partial" | "missing";

export type InterviewIntentEvaluation = {
  point: string;
  status: InterviewIntentCoverage;
  /** null 이 아니면 전사문에서 그대로 찾을 수 있는 짧은 인용이어야 한다. */
  evidenceQuote: string | null;
};

export type InterviewEvaluationPoint = {
  point: string;
  /** API 경계에서 전사문에 실제로 들어 있는지 검증한 인용. */
  evidenceQuote: string;
};

/** 점수나 합격 확률 대신 질문 부응 여부와 다음 답변 행동을 돌려준다. */
export type InterviewEvaluationResult = {
  attemptId: string;
  questionId: string;
  fit: InterviewAnswerFit;
  coverage: InterviewIntentEvaluation[];
  strengths: InterviewEvaluationPoint[];
  missingPoints: string[];
  nextFocus: string;
  suggestedStructure: string[];
};

/** 면접 전체를 한눈에 복기하기 위한 배치 평가의 짧은 요약. */
export type InterviewFeedbackSummary = {
  summary: string;
  strengths: string[];
  nextPractice: string;
  /** 자유 생성 총평과 구분한다. 실제 발언과 질문별 개선점으로만 만든 요약이다. */
  grounding?: { version: 1; attemptId: string; questionId: string; evidenceQuote: string };
};

export type InterviewFeedbackBasis = {
  attemptId: string;
  transcriptRevision: number;
};

export type InterviewEvaluationState = {
  status: InterviewAnalysisTaskStatus;
  automaticRetryCount?: number;
  retryNotBefore?: string;
  attemptCount: number;
  updatedAt: string;
  queuedAt?: string;
  processingStartedAt?: string;
  /** 이 배치 평가를 식별한다. 최신 generation 의 응답만 저장한다. */
  generationId?: string;
  completedAt?: string;
  /** 어떤 전사 수정본으로 만든 결과인지 표시한다. */
  transcriptRevision?: number;
  result?: InterviewEvaluationResult;
  error?: InterviewAnalysisError;
  usage?: InterviewAnalysisUsage;
};

export type InterviewAttemptAnalysis = {
  schemaVersion: 1;
  /** 임시 오디오 스토어의 키. 전사가 끝나 음성을 지우면 null 로 바꾼다. */
  audioKey: string | null;
  transcription: InterviewTranscriptionState;
  evaluation: InterviewEvaluationState;
};

export type InterviewSessionFeedbackState = {
  schemaVersion: 1;
  status: InterviewAnalysisTaskStatus;
  attemptCount: number;
  updatedAt: string;
  queuedAt?: string;
  processingStartedAt?: string;
  /** 답변별 평가와 총평을 하나의 원자적인 배치로 묶는 id. */
  generationId?: string;
  completedAt?: string;
  /** 전체 평가에 실제로 사용한 답변과 전사 수정본. */
  basis?: InterviewFeedbackBasis[];
  model?: string;
  result?: InterviewFeedbackSummary;
  error?: InterviewAnalysisError;
  usage?: InterviewAnalysisUsage;
};

export type InterviewAttempt = {
  id: string;
  questionId: string;
  /** 같은 질문을 다시 답할 때마다 1씩 증가한다. 이전 회차는 함께 보존한다. */
  attemptNo: number;
  recordedAt: string;
  durationMs: number;
  /**
   * IndexedDB media 스토어의 blob 키. null 이면 로컬 영상 녹화본이 없는
   * 답변이다. 세션 단위 capture 만으로는 부족하다 — 도중에 영상 녹화 선택이
   * 바뀐 세션에서 어떤 답변에 영상이 있는지 여기서만 알 수 있다.
   */
  mediaKey: string | null;
  status: InterviewAttemptStatus;
  /** 생략된 기록은 전사/평가 기능 도입 전의 레거시 답변이다. */
  analysis?: InterviewAttemptAnalysis;
  /** Browser-local geometry observations; never part of the Gemini request. */
  visualFeedback?: VisualFeedback;
};

/** 자유 면접에서 사용자가 직접 적는 질문 한 줄. */
export type CustomInterviewQuestion = {
  id: string;
  question: string;
  /** 질문마다 따로 정한다 — 자기소개와 경험 설명에 같은 시간을 줄 이유가 없다. */
  answerDurationSec: number;
  /** 생략된 예전 질문은 기본 생각시간 10초를 사용한다. */
  prepDurationSec?: number;
  /** 자소서 맞춤 질문은 자유 질문과 같은 면접실 계약에 근거 메타데이터만 더한다. */
  kind?: GuidedQuestionKind;
  claimId?: string | null;
  parentQuestionId?: string | null;
  sourceQuote?: string | null;
};

export type GuidedInterviewContext = {
  company: string;
  jobRole: string;
  claims: GuidedClaim[];
  generationMode: GuidedPrepareResponse["generationMode"];
  /** 생략된 예전 기록은 자소서를 사용한 기존 맞춤 면접으로 해석한다. */
  resumeUsed?: boolean;
};

/** 저장해 두고 여러 번 다시 보는 자유 면접 시나리오. */
export type CustomInterviewSet = {
  id: string;
  title: string;
  questions: CustomInterviewQuestion[];
  /** 생략된 예전 기록은 사용자가 직접 만든 자유 질문 묶음이다. */
  kind?: "custom" | "guided";
  guided?: GuidedInterviewContext;
  createdAt: string;
  updatedAt: string;
};

export type InterviewSessionStatus = "active" | "completed" | "abandoned";

/**
 * 이 면접의 카메라 영상과 마이크 음성을 로컬 영상으로 녹화하는지.
 *
 * 이 값은 `feedbackMode`와 독립적이다. "off"는 영상 녹화를 하지 않는다는
 * 뜻이며, feedbackMode가 "ai"이면 전사와 내용 피드백을 위해 마이크는 사용할
 * 수 있다. "record"의 영상은 브라우저 IndexedDB에만 저장한다.
 */
export type InterviewCaptureMode = "record" | "off";

export type InterviewSession = {
  id: string;
  /** New whole cycles are billable; absent on old, grandfathered records. */
  billingVersion?: 1;
  /** 실전 면접의 회사 팩 id. 자유 면접에서는 빈 문자열이다. */
  companyId: string;
  /**
   * 자유 면접일 때 시작 시점의 묶음 사본. 이 값이 있으면 자유 면접이다.
   *
   * 묶음을 참조만 하지 않고 질문을 통째로 복사해 둔다 — 나중에 묶음을 고치거나
   * 지워도 지난 기록에 남은 질문은 그때 실제로 받았던 질문이어야 한다.
   */
  customSet?: Omit<CustomInterviewSet, "createdAt" | "updatedAt">;
  /** 로컬 영상 녹화 여부. 생략되면 "record"인 기존 세션으로 해석한다. */
  capture?: InterviewCaptureMode;
  /** 답변 피드백 방식. 생략되면 AI 도입 전 흐름(내용 피드백 없음)으로 해석한다. */
  feedbackMode?: InterviewFeedbackMode;
  status: InterviewSessionStatus;
  createdAt: string;
  /** 최초로 모든 질문을 마친 시각. 생략된 예전 기록과 호환한다. */
  completedAt?: string;
  /** 다음에 답변할 질문의 인덱스. 새로고침 복구의 기준점이다. */
  currentQuestionIndex: number;
  /** 리포트에서 질문 하나만 다시 답할 때의 질문 id. 기존 세션과 호환되도록 선택값이다. */
  retryQuestionId?: string;
  /**
   * 리포트에서 질문별로 남긴 짧은 복기 메모. 질문 id 를 키로 사용한다.
   * 생략된 예전 기록은 메모가 없는 세션으로 해석한다.
   */
  reviewNotes?: Record<string, string>;
  /** 면접 전체 배치 평가 상태. 생략된 예전 기록에는 AI 피드백이 없다. */
  feedbackSummary?: InterviewSessionFeedbackState;
  resultPreparation?: { startedAt: string; deadlineAt: string; timedOut?: boolean; attemptIds?: string[] };
  attempts: InterviewAttempt[];
};
