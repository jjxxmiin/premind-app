/**
 * What interview.premind.co.kr stored in `/api/interview/backups`: its
 * `InterviewSession` object as `textOnly` left it (mediaKey and audioKey null),
 * written by that app, not by this one. Fields this app never writes itself
 * (capture "record", visualFeedback, usage) are here on purpose.
 */
const transcript =
  '저는 학생회에서 축제 예산을 맡았습니다. 지출 내역을 매주 공개해서 불만을 줄였고, 남은 예산으로 장학금을 만들었습니다.';
const quote = '지출 내역을 매주 공개해서 불만을 줄였고';
const nextFocus = '결과를 숫자로 한 번 더 말해 보세요. 예를 들어 불만 건수가 얼마나 줄었는지요.';

export const webBackupPayload: unknown = {
  id: '6f1c2a9e-4b7d-4e21-9d3a-1f0b7c2e9a11',
  billingVersion: 1,
  companyId: '',
  customSet: {
    id: 'b3a1c9d2-0000-4000-8000-000000000001',
    title: '한빛전자 영업관리 면접 연습',
    kind: 'guided',
    guided: {
      company: '한빛전자',
      jobRole: '영업관리',
      claims: [{ id: 'c1', text: '축제 예산 담당', sourceQuote: '축제 예산을 맡아 지출을 공개했다' }],
      generationMode: 'ai',
      resumeUsed: true,
    },
    questions: [
      { id: 'basic-introduction', question: '영업관리 직무와 연결해 자신을 소개해 주세요.', answerDurationSec: 90, prepDurationSec: 10, kind: 'common' },
      {
        id: 'r1',
        question: '예산을 맡았을 때 본인이 한 행동을 설명해 주세요.',
        answerDurationSec: 120,
        prepDurationSec: 10,
        kind: 'resume',
        claimId: 'c1',
        parentQuestionId: null,
        sourceQuote: '축제 예산을 맡아 지출을 공개했다',
      },
    ],
  },
  capture: 'record',
  feedbackMode: 'ai',
  status: 'completed',
  createdAt: '2026-09-20T09:00:00.000Z',
  completedAt: '2026-09-20T09:06:00.000Z',
  currentQuestionIndex: 2,
  reviewNotes: { r1: '숫자를 준비해 가기' },
  feedbackSummary: {
    schemaVersion: 1,
    status: 'ready',
    attemptCount: 1,
    updatedAt: '2026-09-20T09:07:00.000Z',
    completedAt: '2026-09-20T09:07:00.000Z',
    basis: [{ attemptId: 'a2', transcriptRevision: 0 }],
    model: 'gemini-3.5-flash',
    result: {
      summary: `“${quote}”라고 답했어요. 결과를 숫자로 한 번 더 말해 보세요.`,
      strengths: [],
      nextPractice: '결과를 숫자로 한 번 더 말해 보세요.',
      grounding: { version: 1, attemptId: 'a2', questionId: 'r1', evidenceQuote: quote },
    },
    usage: { provider: 'google', model: 'gemini-3.5-flash', inputTokens: 1200, outputTokens: 300, recordedAt: '2026-09-20T09:07:00.000Z' },
  },
  resultPreparation: { startedAt: '2026-09-20T09:06:00.000Z', deadlineAt: '2026-09-20T09:08:00.000Z' },
  attempts: [
    {
      id: 'a1',
      questionId: 'basic-introduction',
      attemptNo: 1,
      recordedAt: '2026-09-20T09:02:00.000Z',
      durationMs: 2_000,
      mediaKey: null,
      status: 'recorded',
      visualFeedback: { schemaVersion: 1, modelVersion: 'v1', rulesVersion: 1, status: 'insufficient', reason: 'too_short', observedMs: 2000, faceVisibleMs: 1500, directionAvailable: false, events: [] },
      analysis: {
        schemaVersion: 1,
        audioKey: null,
        transcription: {
          status: 'failed',
          automaticRetryCount: 0,
          attemptCount: 0,
          updatedAt: '2026-09-20T09:02:01.000Z',
          completedAt: '2026-09-20T09:02:01.000Z',
          error: { code: 'answer_too_short', message: '답변 시간이 너무 짧아 내용을 확인하기 어려워요.', retryable: false, occurredAt: '2026-09-20T09:02:01.000Z' },
        },
        evaluation: { status: 'idle', automaticRetryCount: 0, attemptCount: 0, updatedAt: '2026-09-20T09:02:00.000Z' },
      },
    },
    {
      id: 'a2',
      questionId: 'r1',
      attemptNo: 1,
      recordedAt: '2026-09-20T09:05:00.000Z',
      durationMs: 48_000,
      mediaKey: null,
      status: 'recorded',
      analysis: {
        schemaVersion: 1,
        audioKey: null,
        transcription: {
          status: 'ready',
          automaticRetryCount: 0,
          attemptCount: 1,
          updatedAt: '2026-09-20T09:05:20.000Z',
          completedAt: '2026-09-20T09:05:20.000Z',
          transcript: { original: transcript, revision: 0, language: 'ko-KR', createdAt: '2026-09-20T09:05:20.000Z' },
          usage: { provider: 'google', model: 'gemini-3.5-transcribe', audioDurationMs: 48000, recordedAt: '2026-09-20T09:05:20.000Z' },
        },
        evaluation: {
          status: 'ready',
          automaticRetryCount: 0,
          attemptCount: 1,
          updatedAt: '2026-09-20T09:07:00.000Z',
          completedAt: '2026-09-20T09:07:00.000Z',
          transcriptRevision: 0,
          result: {
            attemptId: 'a2',
            questionId: 'r1',
            fit: 'partial',
            coverage: [
              { point: '맡은 역할', status: 'met', evidenceQuote: '저는 학생회에서 축제 예산을 맡았습니다' },
              { point: '행동의 결과', status: 'partial', evidenceQuote: quote },
            ],
            strengths: [{ point: '구체적인 행동을 말했어요.', evidenceQuote: quote }],
            missingPoints: ['결과를 보여 주는 숫자'],
            nextFocus,
            suggestedStructure: ['맡은 일', '한 행동', '숫자로 본 결과'],
          },
        },
      },
    },
  ],
};

export const webBackupQuote = quote;
