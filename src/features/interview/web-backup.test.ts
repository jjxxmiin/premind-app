import { webBackupPayload, webBackupQuote } from './__fixtures__/web-backup';
import { isEvaluationStale } from './analysis';
import { signature, isSettled } from './backup-sync';
import { validateGroundedSummary, normalizeEvaluationRequest } from './evaluation';
import { isInterviewSession } from './interview-storage';
import { reportQuestionStatus } from './report-copy';
import { derivePreparationState } from './result-preparation';
import { textOnly } from './session-machine';
import { resolveSessionSource } from './session-source';

jest.mock('./interview-media', () => ({ interviewMedia: {} }));

describe('a backup written by interview.premind.co.kr', () => {
  it('is read as a session without any conversion', () => {
    expect(isInterviewSession(webBackupPayload)).toBe(true);
    if (!isInterviewSession(webBackupPayload)) return;
    const source = resolveSessionSource(webBackupPayload)!;
    expect(source.kind).toBe('guided');
    expect(source.kindLabel).toBe('자소서 기반 면접');
    expect(source.subtitle).toBe('한빛전자 / 영업관리');
    expect(source.questions.map((question) => question.id)).toEqual(['basic-introduction', 'r1']);
  });

  it('opens straight to the report, with its feedback intact', () => {
    if (!isInterviewSession(webBackupPayload)) throw new Error('fixture');
    const session = webBackupPayload;
    expect(derivePreparationState(session, ['basic-introduction', 'r1'])).toEqual({ kind: 'complete' });
    const [short, answered] = session.attempts;
    expect(reportQuestionStatus(short)).toEqual({ label: '짧은 답변', state: 'muted' });
    expect(answered?.analysis?.evaluation.result?.nextFocus).toMatch('숫자');
    expect(isEvaluationStale(answered!.analysis!)).toBe(false);
    expect(isSettled(session)).toBe(true);
  });

  it('keeps the grounded summary valid under the web validator', () => {
    if (!isInterviewSession(webBackupPayload)) throw new Error('fixture');
    const session = webBackupPayload;
    const answered = session.attempts[1]!;
    const request = normalizeEvaluationRequest({
      company: '한빛전자',
      jobRole: '영업관리',
      items: [{
        attemptId: 'a2',
        questionId: 'r1',
        question: '예산을 맡았을 때 본인이 한 행동을 설명해 주세요.',
        transcript: answered.analysis!.transcription.transcript!.original,
      }],
    });
    const summary = validateGroundedSummary(session.feedbackSummary!.result, request, [answered.analysis!.evaluation.result!]);
    expect(summary.grounding?.evidenceQuote).toBe(webBackupQuote);
  });

  it('round-trips unchanged through the text-only copy this app uploads', () => {
    if (!isInterviewSession(webBackupPayload)) throw new Error('fixture');
    const copy = JSON.parse(JSON.stringify(textOnly(webBackupPayload)));
    expect(copy).toEqual(webBackupPayload);
    expect(signature(copy)).toBe(signature(webBackupPayload));
  });

  it('rejects what is not a session', () => {
    expect(isInterviewSession(null)).toBe(false);
    expect(isInterviewSession({ id: 'x', attempts: [] })).toBe(false);
  });
});
