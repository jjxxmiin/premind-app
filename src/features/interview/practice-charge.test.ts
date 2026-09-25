import type { Reservation } from './interview-api';
import { aiAllowanceProblem, aiPriceLabel, startPaidPractice, type ChargeApi } from './practice-charge';
import type { InterviewSession } from './types';

function session(extra: Partial<InterviewSession> = {}): InterviewSession {
  return { id: 'abc-123456', billingVersion: 1, companyId: 'samsung', status: 'active', createdAt: '2026-09-26T00:00:00Z', currentQuestionIndex: 0, attempts: [], feedbackMode: 'ai', ...extra };
}

function fakeApi(options: { commitFails?: boolean; alreadyPaid?: boolean } = {}) {
  const calls: string[] = [];
  const reservation: Reservation = { id: 'practice:abc-123456', token: 't', kind: 'ai', alreadyPaid: Boolean(options.alreadyPaid) };
  const api: ChargeApi = {
    reserve: jest.fn(async (id, kind) => {
      calls.push(`reserve ${id} ${kind}`);
      return { result: reservation };
    }),
    commit: jest.fn(async () => {
      calls.push('commit');
      if (options.commitFails) throw new Error('offline');
      return undefined;
    }),
    cancel: jest.fn(async () => {
      calls.push('cancel');
      return undefined;
    }),
  };
  return { api, calls };
}

describe('charge protocol', () => {
  it('reserves, commits, then opens the answer window', async () => {
    const { api, calls } = fakeApi();
    const start = jest.fn(() => true);
    await startPaidPractice(session(), start, () => false, api);
    expect(calls).toEqual(['reserve practice:abc-123456 ai', 'commit']);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('charges basic practice as basic (free, counted for institutions)', async () => {
    const { api, calls } = fakeApi();
    await startPaidPractice(session({ feedbackMode: 'basic' }), () => true, () => false, api);
    expect(calls[0]).toBe('reserve practice:abc-123456 basic');
  });

  it('cancels when the recorder could not start', async () => {
    const { api, calls } = fakeApi();
    await startPaidPractice(session(), () => false, () => false, api);
    expect(calls).toEqual(['reserve practice:abc-123456 ai', 'commit', 'cancel']);
  });

  it('cancels when the commit fails, and reports the failure', async () => {
    const { api, calls } = fakeApi({ commitFails: true });
    const start = jest.fn(() => true);
    await expect(startPaidPractice(session(), start, () => false, api)).rejects.toThrow('offline');
    expect(start).not.toHaveBeenCalled();
    expect(calls).toEqual(['reserve practice:abc-123456 ai', 'commit', 'cancel']);
  });

  it('cancels when the learner left during the charge', async () => {
    const { api, calls } = fakeApi();
    let left = false;
    (api.reserve as jest.Mock).mockImplementationOnce(async () => {
      left = true;
      calls.push('reserve');
      return { result: { id: 'x', token: 't', kind: 'ai', alreadyPaid: false } };
    });
    const start = jest.fn(() => true);
    await startPaidPractice(session(), start, () => left, api);
    expect(start).not.toHaveBeenCalled();
    expect(calls).toEqual(['reserve', 'cancel']);
  });

  it('never charges a session from before billing', async () => {
    const { api, calls } = fakeApi();
    const start = jest.fn(() => true);
    await startPaidPractice(session({ billingVersion: undefined }), start, () => false, api);
    expect(calls).toEqual([]);
    expect(start).toHaveBeenCalled();
  });
});

describe('allowance copy', () => {
  const base = { plan: 'free' as const, planRenewsAt: null, questions: { used: 0, limit: 1 }, periodEnd: null };
  it('says what the next AI practice costs', () => {
    expect(aiPriceLabel({ ...base, ai: { used: 0, limit: 0, freeTrial: true } })).toBe('첫 회 무료');
    expect(aiPriceLabel({ ...base, plan: 'standard', ai: { used: 3, limit: 10, freeTrial: false } })).toBe('이번 달 7회 남음');
    expect(aiPriceLabel({ ...base, ai: { used: 0, limit: 0, freeTrial: false } })).toBe('스탠다드');
  });
  it('warns before starting, but leaves the decision to the server', () => {
    expect(aiAllowanceProblem(null)).toBeNull();
    expect(aiAllowanceProblem({ ...base, ai: { used: 0, limit: 0, freeTrial: false } })).toMatch('스탠다드');
    expect(aiAllowanceProblem({ ...base, plan: 'standard', ai: { used: 10, limit: 10, freeTrial: false } })).toMatch('10회를 모두 썼어요');
  });
});
