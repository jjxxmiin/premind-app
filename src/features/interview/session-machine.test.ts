import { createQueuedAttemptAnalysis, isEvaluationStale } from './analysis';
import { derivePreparationState } from './result-preparation';
import {
  advanceResultPreparation,
  applySaveAttempt,
  claimEvaluation,
  claimNextTranscription,
  commitEvaluationFailure,
  commitEvaluationSuccess,
  commitTranscriptionClaim,
  createSessionRecord,
  queueEvaluation,
  readyFeedbackBasis,
  recoverExpiredJobs,
  saveReviewNote,
  saveTranscriptCorrection,
  startQuestionRetry,
  textOnly,
} from './session-machine';
import type { InterviewAttempt, InterviewEvaluationResult, InterviewSession } from './types';

const T0 = '2026-09-26T01:00:00.000Z';
const usage = { provider: 'google' as const, model: 'gemini-3.5-flash', recordedAt: T0 };
const ANSWER = '저는 동아리에서 회계를 맡아 매달 지출 내역을 정리하고 공개했습니다.';

function aiSession(): InterviewSession {
  return createSessionRecord(
    's-1',
    {
      companyId: '',
      feedbackMode: 'ai',
      capture: 'off',
      customSet: {
        id: 'set-1',
        title: '내 면접',
        questions: [
          { id: 'q1', question: '자기소개를 해 주세요.', answerDurationSec: 60 },
          { id: 'q2', question: '지원 동기를 말해 주세요.', answerDurationSec: 60 },
        ],
      },
    },
    T0,
  );
}

function answer(id: string, questionId: string, durationMs = 30_000): InterviewAttempt {
  return {
    id,
    questionId,
    attemptNo: 1,
    recordedAt: T0,
    durationMs,
    mediaKey: null,
    status: 'recorded',
    analysis: createQueuedAttemptAnalysis(`s-1:${id}:audio`, T0),
  };
}

function answered(): InterviewSession {
  let session = aiSession();
  session = applySaveAttempt(session, { attempt: answer('a1', 'q1'), nextQuestionIndex: 1, status: 'active' }, T0);
  session = applySaveAttempt(session, { attempt: answer('a2', 'q2'), nextQuestionIndex: 2, status: 'completed' }, T0);
  return session;
}

function transcribeAll(session: InterviewSession): InterviewSession {
  let current = session;
  for (let index = 0; index < 2; index += 1) {
    const claim = claimNextTranscription(current, `c${index}`, T0);
    if (!claim) throw new Error('nothing to claim');
    current = commitTranscriptionClaim(claim.session, {
      attemptId: claim.attempt.id,
      claimId: `c${index}`,
      patch: { status: 'ready', transcript: { original: ANSWER, revision: 0, createdAt: T0 } },
      removePendingAudio: true,
    })!.session;
  }
  return current;
}

function result(attemptId: string, questionId: string): InterviewEvaluationResult {
  return {
    attemptId,
    questionId,
    fit: 'direct',
    coverage: [{ point: '맡은 역할', status: 'met', evidenceQuote: '회계를 맡아' }],
    strengths: [{ point: '역할을 분명히 말했어요.', evidenceQuote: '회계를 맡아' }],
    missingPoints: [],
    nextFocus: '결과를 숫자로 말해 보세요.',
    suggestedStructure: ['역할', '행동'],
  };
}

describe('saving answers', () => {
  it('stamps completion once and numbers repeated answers after the latest', () => {
    const session = answered();
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBe(T0);
    expect(session.currentQuestionIndex).toBe(2);

    const retrying = startQuestionRetry(session, 'q1');
    expect(retrying.retryQuestionId).toBe('q1');
    const again = applySaveAttempt(retrying, { attempt: answer('a3', 'q1'), nextQuestionIndex: 2, status: 'completed' }, '2026-09-26T02:00:00.000Z');
    expect(again.attempts.find((item) => item.id === 'a3')?.attemptNo).toBe(2);
    expect(again.retryQuestionId).toBeUndefined();
    expect(again.completedAt).toBe(T0);
  });

  it('keeps review notes within 500 characters and drops empty ones', () => {
    const noted = saveReviewNote(answered(), 'q1', '숫자 준비');
    expect(noted.reviewNotes).toEqual({ q1: '숫자 준비' });
    expect(saveReviewNote(noted, 'q1', '  ').reviewNotes).toBeUndefined();
    expect(() => saveReviewNote(noted, 'q1', 'x'.repeat(501))).toThrow('500자');
  });
});

describe('transcription claims', () => {
  it('claims one queued answer at a time and ignores a superseded claim', () => {
    const claim = claimNextTranscription(answered(), 'claim-a', T0)!;
    expect(claim.attempt.id).toBe('a1');
    expect(claim.attempt.analysis?.transcription.status).toBe('processing');

    expect(commitTranscriptionClaim(claim.session, { attemptId: 'a1', claimId: 'other', patch: { status: 'ready' } })).toBeNull();

    const committed = commitTranscriptionClaim(claim.session, {
      attemptId: 'a1',
      claimId: 'claim-a',
      patch: { status: 'ready', transcript: { original: ANSWER, revision: 0, createdAt: T0 } },
      removePendingAudio: true,
    })!;
    expect(committed.removedAudioKey).toBe('s-1:a1:audio');
    const a1 = committed.session.attempts.find((item) => item.id === 'a1')!;
    expect(a1.analysis?.audioKey).toBeNull();
    expect(a1.analysis?.transcription.claimId).toBeUndefined();
  });

  it('does not claim while a retry must wait', () => {
    const session = answered();
    session.attempts[0]!.analysis!.transcription.retryNotBefore = '2026-09-26T01:00:05.000Z';
    expect(claimNextTranscription(session, 'c', T0)?.attempt.id).toBe('a2');
  });
});

describe('one evaluation for the whole practice', () => {
  it('waits for every transcript, then claims all ready answers in one generation', () => {
    const half = claimNextTranscription(answered(), 'c0', T0)!.session;
    expect(claimEvaluation(half, { generationId: 'g', expectedBasis: readyFeedbackBasis(half), startedAt: T0 })).toBeNull();

    const ready = transcribeAll(answered());
    const basis = readyFeedbackBasis(ready);
    expect(basis).toEqual([
      { attemptId: 'a1', transcriptRevision: 0 },
      { attemptId: 'a2', transcriptRevision: 0 },
    ]);
    const claimed = claimEvaluation(ready, { generationId: 'g1', expectedBasis: basis, startedAt: T0 })!;
    expect(claimed.feedbackSummary?.status).toBe('processing');
    expect(claimed.attempts.every((item) => item.analysis?.evaluation.generationId === 'g1')).toBe(true);

    // A late answer from an older generation cannot land.
    expect(
      commitEvaluationSuccess(claimed, { generationId: 'old', basis, answers: [], summary: null, model: 'm', usage, completedAt: T0 }),
    ).toBeNull();

    const done = commitEvaluationSuccess(claimed, {
      generationId: 'g1',
      basis,
      answers: [result('a1', 'q1')],
      summary: null,
      model: 'm',
      usage,
      completedAt: T0,
    })!;
    const [a1, a2] = done.attempts;
    expect(a1?.analysis?.evaluation.status).toBe('ready');
    expect(a2?.analysis?.evaluation.status).toBe('failed');
    expect(done.feedbackSummary?.status).toBe('unavailable');
  });

  it('records a failed batch on every answer of that generation', () => {
    const ready = transcribeAll(answered());
    const basis = readyFeedbackBasis(ready);
    const claimed = claimEvaluation(ready, { generationId: 'g', expectedBasis: basis, startedAt: T0 })!;
    const failed = commitEvaluationFailure(claimed, {
      generationId: 'g',
      basis,
      error: { code: 'network', message: 'x', retryable: true, occurredAt: T0 },
      failedAt: T0,
    })!;
    expect(failed.attempts.map((item) => item.analysis?.evaluation.status)).toEqual(['failed', 'failed']);
    expect(failed.feedbackSummary?.status).toBe('failed');
  });
});

describe('a corrected transcript', () => {
  function evaluated(): InterviewSession {
    const ready = transcribeAll(answered());
    const basis = readyFeedbackBasis(ready);
    const claimed = claimEvaluation(ready, { generationId: 'g', expectedBasis: basis, startedAt: T0 })!;
    return commitEvaluationSuccess(claimed, {
      generationId: 'g',
      basis,
      answers: [result('a1', 'q1'), result('a2', 'q2')],
      summary: null,
      model: 'm',
      usage,
      completedAt: T0,
    })!;
  }

  it('marks feedback stale and is never re-evaluated until the learner asks', () => {
    const edited = saveTranscriptCorrection(evaluated(), 'a1', `${ANSWER} 덕분에 지출 문의가 절반으로 줄었습니다.`, T0);
    const a1 = edited.attempts[0]!;
    expect(a1.analysis?.transcription.transcript?.revision).toBe(1);
    expect(isEvaluationStale(a1.analysis!)).toBe(true);
    // No automatic (charged) request for the edit.
    expect(claimEvaluation(edited, { generationId: 'g2', expectedBasis: readyFeedbackBasis(edited), startedAt: T0 })).toBeNull();

    const queued = queueEvaluation(edited, { generationId: 'g2', queuedAt: T0, attemptId: 'a1' })!;
    expect(queued.attempts[0]?.analysis?.evaluation.status).toBe('queued');
    expect(queued.attempts[1]?.analysis?.evaluation.status).toBe('ready');
    const basis = [{ attemptId: 'a1', transcriptRevision: 1 }];
    expect(claimEvaluation(queued, { generationId: 'g3', expectedBasis: basis, startedAt: T0 })).not.toBeNull();
  });

  it('restoring the original text is a new revision too, and an unchanged save is a no-op', () => {
    const base = evaluated();
    expect(saveTranscriptCorrection(base, 'a1', ANSWER, T0)).toBe(base);
    const edited = saveTranscriptCorrection(base, 'a1', '고친 문장입니다. 충분히 긴 답변이에요.', T0);
    const restored = saveTranscriptCorrection(edited, 'a1', null, T0);
    expect(restored.attempts[0]?.analysis?.transcription.transcript?.corrected).toBeUndefined();
    expect(restored.attempts[0]?.analysis?.transcription.transcript?.revision).toBe(2);
  });
});

describe('waiting for results', () => {
  it('retries a recoverable failure exactly once, after the backoff', () => {
    const ready = transcribeAll(answered());
    const basis = readyFeedbackBasis(ready);
    const claimed = claimEvaluation(ready, { generationId: 'g', expectedBasis: basis, startedAt: T0 })!;
    const failed = commitEvaluationFailure(claimed, {
      generationId: 'g',
      basis,
      error: { code: 'network', message: 'x', retryable: true, occurredAt: T0 },
      failedAt: T0,
    })!;
    const now = Date.parse(T0);
    const first = advanceResultPreparation(failed, now);
    expect(first.changed).toBe(true);
    const evaluation = first.session.attempts[0]!.analysis!.evaluation;
    expect(evaluation.status).toBe('queued');
    expect(evaluation.automaticRetryCount).toBe(1);
    expect(Date.parse(evaluation.retryNotBefore!) - now).toBe(3_000);
    expect(derivePreparationState(first.session, ['q1', 'q2'])).toEqual({ kind: 'working', phase: 'feedback' });
  });

  it('gives up after two minutes and opens the report', () => {
    const session = answered();
    const now = Date.parse(T0);
    const started = advanceResultPreparation(session, now).session;
    expect(started.resultPreparation?.deadlineAt).toBe(new Date(now + 120_000).toISOString());
    const expired = advanceResultPreparation(started, now + 120_001).session;
    expect(expired.resultPreparation?.timedOut).toBe(true);
    expect(expired.attempts[0]?.analysis?.transcription.status).toBe('failed');
    expect(derivePreparationState(expired, ['q1', 'q2']).kind).toBe('complete');
  });

  it('turns work stuck in processing (app closed) into a retryable failure', () => {
    const claim = claimNextTranscription(answered(), 'c', T0)!.session;
    const recovered = recoverExpiredJobs(claim, Date.parse(T0) + 5 * 60_000 + 1);
    expect(recovered.recovered).toBe(1);
    expect(recovered.session.attempts[0]?.analysis?.transcription).toMatchObject({ status: 'failed', error: { code: 'timeout', retryable: true } });
  });
});

it('textOnly never carries a recording key', () => {
  const session = answered();
  session.attempts[0]!.mediaKey = 'video-key';
  const copy = textOnly(session);
  expect(copy.attempts.every((item) => item.mediaKey === null && (item.analysis?.audioKey ?? null) === null)).toBe(true);
  expect(session.attempts[0]!.mediaKey).toBe('video-key');
});
