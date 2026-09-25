import AsyncStorage from '@react-native-async-storage/async-storage';

import { createQueuedAttemptAnalysis } from './analysis';
import {
  resetAnalysisQueue,
  retryInterviewEvaluation,
  setAnalysisTransport,
  startInterviewAnalysis,
  type AnalysisTransport,
} from './analysis-queue';
import { InterviewApiError } from './interview-api';
import { getSession, putSession, mutateSession } from './interview-storage';
import { derivePreparationState } from './result-preparation';
import { applySaveAttempt, createSessionRecord, saveTranscriptCorrection } from './session-machine';
import type { EvaluationRequest } from './evaluation';
import type { InterviewAttempt, InterviewSession } from './types';

const mockAudio = new Map<string, { size: number }>();
jest.mock('./interview-media', () => ({
  interviewMedia: {
    getPendingAudio: async (key: string) => {
      const item = mockAudio.get(key);
      return item ? { part: { uri: `file:///${key}`, name: 'a.m4a', type: 'audio/m4a' }, size: item.size, mimeType: 'audio/m4a', expiresAt: '2999-01-01T00:00:00Z' } : null;
    },
    deletePendingAudio: async (key: string) => {
      mockAudio.delete(key);
    },
    expiredPendingAudio: async () => [],
    deleteSessionMedia: async () => undefined,
  },
}));

const ANSWERS: Record<string, string> = {
  q1: '저는 동아리에서 회계를 맡아 매달 지출 내역을 정리하고 공개했습니다.',
  q2: '고객의 불편을 먼저 듣고 해결책을 찾는 일을 오래 해 왔기 때문에 지원했습니다.',
};

function evaluationFor(request: EvaluationRequest) {
  return {
    model: 'gemini-3.5-flash',
    usage: { provider: 'google', model: 'gemini-3.5-flash', recordedAt: '2026-09-26T00:00:00Z' },
    answers: request.items.map((item) => ({
      attemptId: item.attemptId,
      questionId: item.questionId,
      fit: 'direct',
      coverage: [{ point: '핵심 경험', status: 'met', evidenceQuote: item.transcript.slice(0, 12) }],
      strengths: [{ point: '경험을 구체적으로 말했어요.', evidenceQuote: item.transcript.slice(0, 12) }],
      missingPoints: [],
      nextFocus: '결과를 숫자로 한 번 더 말해 보세요.',
      suggestedStructure: ['상황', '행동', '결과'],
    })),
    overall: null,
  };
}

const forms: FormData[] = [];

function transport(overrides: Partial<AnalysisTransport> = {}) {
  const calls: string[] = [];
  const value: AnalysisTransport = {
    transcribe: jest.fn(async (sessionId: string, form: FormData) => {
      calls.push(`transcribe ${sessionId}`);
      forms.push(form);
      const next = calls.filter((call) => call.startsWith('transcribe')).length;
      return { transcript: ANSWERS[`q${next}`] ?? ANSWERS.q1, model: 'gemini-3.5-transcribe', usage: { provider: 'google', model: 'gemini-3.5-transcribe', recordedAt: '2026-09-26T00:00:00Z' } };
    }),
    evaluate: jest.fn(async (sessionId: string, request: EvaluationRequest) => {
      calls.push(`evaluate ${sessionId} ${request.items.length}`);
      return evaluationFor(request);
    }),
    online: () => true,
    ...overrides,
  };
  return { value, calls };
}

function answer(sessionId: string, id: string, questionId: string): InterviewAttempt {
  const key = `${sessionId}:${id}:audio`;
  mockAudio.set(key, { size: 20_000 });
  return {
    id,
    questionId,
    attemptNo: 1,
    recordedAt: new Date().toISOString(),
    durationMs: 20_000,
    mediaKey: null,
    status: 'recorded',
    analysis: createQueuedAttemptAnalysis(key),
  };
}

async function practice(id: string): Promise<InterviewSession> {
  let session = createSessionRecord(id, {
    companyId: '',
    feedbackMode: 'ai',
    capture: 'off',
    customSet: {
      id: `${id}-set`,
      title: '연습',
      questions: [
        { id: 'q1', question: '자기소개를 해 주세요.', answerDurationSec: 60 },
        { id: 'q2', question: '지원 동기를 말해 주세요.', answerDurationSec: 60 },
      ],
    },
  });
  session = applySaveAttempt(session, { attempt: answer(id, 'a1', 'q1'), nextQuestionIndex: 1, status: 'active' });
  session = applySaveAttempt(session, { attempt: answer(id, 'a2', 'q2'), nextQuestionIndex: 2, status: 'completed' });
  await putSession(session);
  return session;
}

beforeEach(async () => {
  mockAudio.clear();
  await AsyncStorage.clear();
});
afterEach(() => {
  setAnalysisTransport(null);
  resetAnalysisQueue();
});

it('transcribes every answer, then evaluates the practice once', async () => {
  const { value, calls } = transport();
  setAnalysisTransport(value);
  await practice('session-one');
  await startInterviewAnalysis('session-one');

  expect(calls).toEqual(['transcribe session-one', 'transcribe session-one', 'evaluate session-one 2']);
  const parts = (forms[0] as unknown as { getAll?: (name: string) => unknown[]; _parts?: [string, unknown][] });
  const durations = parts.getAll ? parts.getAll('durationMs') : (parts._parts ?? []).filter(([name]) => name === 'durationMs').map(([, value]) => value);
  expect(durations).toEqual(['20000']);
  const session = (await getSession('session-one'))!;
  expect(session.attempts.map((item) => item.analysis?.evaluation.status)).toEqual(['ready', 'ready']);
  expect(session.attempts.every((item) => item.analysis?.audioKey === null)).toBe(true);
  expect(mockAudio.size).toBe(0);
  expect(derivePreparationState(session, ['q1', 'q2'])).toEqual({ kind: 'complete' });
});

it('does not send the edit of a transcript until the learner asks, then sends only that answer', async () => {
  const { value, calls } = transport();
  setAnalysisTransport(value);
  await practice('session-two');
  await startInterviewAnalysis('session-two');
  calls.length = 0;

  await mutateSession('session-two', (current) => ({
    session: saveTranscriptCorrection(current, 'a1', `${ANSWERS.q1} 문의가 절반으로 줄었습니다.`),
  }));
  await startInterviewAnalysis('session-two');
  expect(calls).toEqual([]);

  expect(await retryInterviewEvaluation('session-two', 'a1')).toBe(true);
  await startInterviewAnalysis('session-two');
  expect(calls).toEqual(['evaluate session-two 1']);
});

it('keeps a non-retryable failure and still evaluates the answers that worked', async () => {
  let count = 0;
  const { value, calls } = transport({
    transcribe: jest.fn(async () => {
      count += 1;
      calls.push('transcribe');
      if (count === 1) throw new InterviewApiError('이 음성을 전사할 수 없어요.', { status: 502, errorCode: 'upstream_rejected' });
      return { transcript: ANSWERS.q2, model: 'm', usage: null };
    }),
  });
  setAnalysisTransport(value);
  await practice('session-three');
  await startInterviewAnalysis('session-three');

  const session = (await getSession('session-three'))!;
  expect(session.attempts[0]?.analysis?.transcription).toMatchObject({ status: 'failed', error: { code: 'upstream_rejected', retryable: false } });
  expect(session.attempts[1]?.analysis?.evaluation.status).toBe('ready');
  expect(calls).toEqual(['transcribe', 'transcribe', 'evaluate session-three 1']);
});

it('refuses feedback that judges the person and retries that answer once', async () => {
  const { value } = transport({
    evaluate: jest.fn(async (_id: string, request: EvaluationRequest) => {
      const body = evaluationFor(request);
      body.answers[0]!.nextFocus = '합격 가능성이 높아요.';
      return body;
    }),
  });
  setAnalysisTransport(value);
  await practice('session-four');
  await startInterviewAnalysis('session-four');
  const session = (await getSession('session-four'))!;
  // The judging answer is dropped by the validator, stored as a retryable
  // failure, and queued for the one automatic retry after the backoff.
  expect(session.attempts[0]?.analysis?.evaluation).toMatchObject({ status: 'queued', automaticRetryCount: 1 });
  expect(session.attempts[0]?.analysis?.evaluation.result).toBeUndefined();
  expect(session.attempts[1]?.analysis?.evaluation.status).toBe('ready');
});
