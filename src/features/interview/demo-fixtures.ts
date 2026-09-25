/**
 * The offline demo's interview data (no server): one finished AI practice to
 * show what a report looks like and one basic practice left half way. Written
 * in the same `InterviewSession` shape as real records, marked as examples in
 * their titles, and only ever seeded into the demo account's storage.
 */
import { webBackupPayload } from './__fixtures__/web-backup';
import type { InterviewAllowance, InterviewMember, OrgReport } from './interview-api';
import type { InterviewSession } from './types';

export const DEMO_ALLOWANCE: InterviewAllowance = {
  plan: 'free',
  planRenewsAt: null,
  ai: { used: 0, limit: 0, freeTrial: true },
  questions: { used: 0, limit: 1 },
  periodEnd: null,
};

export function demoMember(name: string, email: string): InterviewMember {
  return { id: 'demo', username: email, email, displayName: name, role: 'member', orgId: null, orgName: null, groupName: null };
}

function daysAgo(days: number, minutes = 0): string {
  return new Date(Date.now() - days * 86_400_000 - minutes * 60_000).toISOString();
}

export function demoSessions(): InterviewSession[] {
  const finished = JSON.parse(JSON.stringify(webBackupPayload)) as InterviewSession;
  finished.id = 'demo-ai-practice';
  finished.customSet = { ...finished.customSet!, title: '예시: 한빛전자 영업관리 면접 연습' };
  finished.createdAt = daysAgo(1, 20);
  finished.completedAt = daysAgo(1, 12);
  finished.attempts = finished.attempts.map((attempt, index) => ({ ...attempt, recordedAt: daysAgo(1, 16 - index * 3) }));

  const basic: InterviewSession = {
    id: 'demo-basic-practice',
    billingVersion: 1,
    companyId: 'public-common',
    capture: 'off',
    feedbackMode: 'basic',
    status: 'active',
    createdAt: daysAgo(0, 30),
    currentQuestionIndex: 2,
    attempts: [
      { id: 'demo-b1', questionId: 'public_intro', attemptNo: 1, recordedAt: daysAgo(0, 28), durationMs: 64_000, mediaKey: null, status: 'recorded' },
      { id: 'demo-b2', questionId: 'public_motivation', attemptNo: 1, recordedAt: daysAgo(0, 25), durationMs: 81_000, mediaKey: null, status: 'recorded' },
    ],
  };
  return [finished, basic];
}

export function demoOrgReport(): OrgReport {
  const now = Date.now();
  const week = 7 * 86_400_000;
  return {
    org: { id: 'demo-org', name: '예시 대학교 취업지원센터', kind: '대학', licenseUntil: now + 120 * 86_400_000 },
    from: now - 30 * 86_400_000,
    to: now,
    totals: { members: 24, activeMembers: 17, practices: 63, aiPractices: 21, questionSets: 9, aiFeedbacks: 21 },
    groups: [
      { name: '4학년 A반', members: 12, activeMembers: 9, practices: 35, aiPractices: 12 },
      { name: '4학년 B반', members: 12, activeMembers: 8, practices: 28, aiPractices: 9 },
    ],
    weeks: [0, 1, 2, 3, 4].map((index) => ({ weekStart: now - (5 - index) * week, practices: [8, 11, 14, 16, 14][index]!, activeMembers: [6, 8, 11, 13, 12][index]! })),
    members: [
      { displayName: '김하늘', username: 'sky@example.com', group: '4학년 A반', joinedAt: now - 20 * 86_400_000, practices: 7, aiPractices: 3, lastActiveAt: now - 86_400_000 },
      { displayName: '이도윤', username: 'doyun@example.com', group: '4학년 A반', joinedAt: now - 19 * 86_400_000, practices: 4, aiPractices: 1, lastActiveAt: now - 3 * 86_400_000 },
      { displayName: '박서연', username: 'seoyeon@example.com', group: '4학년 B반', joinedAt: now - 18 * 86_400_000, practices: 0, aiPractices: 0, lastActiveAt: null },
    ],
    invites: [
      { code: 'DEMO2026', group: '4학년 A반', uses: 12, maxUses: 40, expiresAt: now + 30 * 86_400_000, disabled: false },
    ],
  };
}
