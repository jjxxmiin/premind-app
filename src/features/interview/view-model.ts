/**
 * Small, pure helpers the interview screens share: labels, times, routes.
 * Copy comes from the interview web app (interview-home, practice-history,
 * session-report) and keeps its rules: describe the practice, never judge
 * the person — no score, no pass chance, no personality.
 */
import { enShortDate } from '@/lib/i18n/core';

import { type AppLocale, enDuration } from './locale';
import { derivePreparationState } from './result-preparation';
import { resolveSessionSource } from './session-source';
import type {
  InterviewAnswerFit,
  InterviewAttempt,
  InterviewIntentCoverage,
  InterviewSession,
} from './types';

/** "1분 04초", or "42초" under a minute (interview web media.ts). English: "1 min 4 s". */
export function formatAnswerDuration(ms: number, locale: AppLocale = 'ko'): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (locale === 'en') return enDuration(total);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`;
}

/** A countdown clock, "1:05"; negative values read as overtime "+0:12". */
export function formatClock(ms: number): string {
  const over = ms < 0;
  const total = Math.ceil(Math.abs(ms) / 1000);
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return over ? `+${text}` : text;
}

export function relativeDay(value: string, now = new Date(), locale: AppLocale = 'ko'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (locale === 'en') {
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return enShortDate(date);
  }
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function lastActivity(session: InterviewSession): string {
  return session.attempts.reduce(
    (latest, attempt) => (attempt.recordedAt > latest ? attempt.recordedAt : latest),
    session.completedAt ?? session.createdAt,
  );
}

export function answeredQuestionCount(session: InterviewSession): number {
  return new Set(session.attempts.filter((attempt) => attempt.status !== 'failed').map((attempt) => attempt.questionId)).size;
}

export function totalSpeakingMs(session: InterviewSession): number {
  return session.attempts.filter((attempt) => attempt.status !== 'failed').reduce((sum, attempt) => sum + Math.max(0, attempt.durationMs), 0);
}

export type SessionDestination = { pathname: '/interview/room/[id]' | '/interview/preparing/[id]' | '/interview/report/[id]'; params: { id: string } };

/** Where a practice opens: the room if unfinished, the waiting screen while AI works, else the report. */
export function sessionDestination(session: InterviewSession): SessionDestination {
  const source = resolveSessionSource(session);
  if (session.status !== 'completed') return { pathname: '/interview/room/[id]', params: { id: session.id } };
  const working = derivePreparationState(session, source?.questions.map((question) => question.id)).kind === 'working';
  return { pathname: working ? '/interview/preparing/[id]' : '/interview/report/[id]', params: { id: session.id } };
}

export function modeLabel(session: InterviewSession): string {
  return session.feedbackMode === 'ai' ? 'AI 피드백 연습' : '기본 연습';
}

export function sessionStatusLabel(session: InterviewSession): { label: string; tone: 'brand' | 'neutral' | 'positive' } {
  if (session.status !== 'completed') return { label: '진행 중', tone: 'brand' };
  return { label: '연습 완료', tone: 'positive' };
}

/** 질문에 얼마나 맞게 답했는지. 사람이 아니라 답변 내용을 말한다. */
export const FIT_COPY: Record<InterviewAnswerFit, string> = {
  direct: '질문에 맞게 답했어요',
  partial: '질문의 일부에 답했어요',
  off_topic: '질문과 다른 이야기를 했어요',
  insufficient: '답변 내용이 부족했어요',
};

export const COVERAGE_COPY: Record<InterviewIntentCoverage, string> = {
  met: '말했어요',
  partial: '조금 말했어요',
  missing: '빠졌어요',
};

/** 질문별 최신 답변(실패한 녹음 제외), 질문 순서대로. */
export function attemptsByQuestion(session: InterviewSession): Map<string, InterviewAttempt[]> {
  const map = new Map<string, InterviewAttempt[]>();
  for (const attempt of [...session.attempts].sort((a, b) => a.attemptNo - b.attemptNo)) {
    const list = map.get(attempt.questionId) ?? [];
    list.push(attempt);
    map.set(attempt.questionId, list);
  }
  return map;
}

export function latestAttempt(attempts: InterviewAttempt[] | undefined): InterviewAttempt | undefined {
  const done = (attempts ?? []).filter((attempt) => attempt.status !== 'failed');
  return done.at(-1) ?? attempts?.at(-1);
}

/** 처음 답변과 최근 답변. 점수 없이 말한 시간, 빠진 내용 수, 한 말만 비교한다. */
export function comparison(attempts: InterviewAttempt[] | undefined) {
  const done = (attempts ?? []).filter((attempt) => attempt.status !== 'failed');
  if (done.length < 2) return null;
  const side = (attempt: InterviewAttempt) => {
    const transcript = attempt.analysis?.transcription.transcript;
    const result = attempt.analysis?.evaluation.status === 'ready' ? attempt.analysis.evaluation.result : undefined;
    return {
      attempt,
      transcript: transcript ? transcript.corrected ?? transcript.original : '',
      missing: result ? result.missingPoints.length : null,
      nextFocus: result?.nextFocus ?? null,
    };
  };
  const first = side(done[0]!);
  const last = side(done.at(-1)!);
  const missingDelta = first.missing !== null && last.missing !== null ? first.missing - last.missing : null;
  return { first, last, missingDelta };
}

/** 가운뎃점이 섞여 오면 쉼표로(브랜드 규칙). */
export function clean(text: string): string {
  return text.replace(/\s*·\s*/g, ', ');
}

export type TranscriptPart = { text: string; mark: boolean };

/** 피드백이 근거로 든 말을 전사문에서 표시한다(session-report.tsx 와 같은 규칙). */
export function highlightTranscript(text: string, quotes: (string | null | undefined)[]): TranscriptPart[] {
  const ranges: [number, number][] = [];
  for (const quote of [...new Set(quotes.filter((item): item is string => Boolean(item)))].sort((a, b) => b.length - a.length)) {
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(quote, from);
      if (index === -1) break;
      const end = index + quote.length;
      if (!ranges.some(([start, stop]) => index < stop && end > start)) ranges.push([index, end]);
      from = end;
    }
  }
  if (ranges.length === 0) return [{ text, mark: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: TranscriptPart[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), mark: false });
    parts.push({ text: text.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), mark: false });
  return parts;
}
