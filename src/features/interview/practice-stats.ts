import type { InterviewSession } from "./types";

/** 홈 대시보드 숫자. 점수나 합격 가능성이 아니라 "얼마나 연습했는지"만 센다. */
export type PracticeStats = {
  /** 최근 7일(오늘 포함) 동안 답변이 하나라도 있었던 연습 수 */
  weekPractices: number;
  /** 최근 7일 동안 남긴 답변 수(실패한 녹음 제외) */
  weekAnswers: number;
  /** 최근 7일 동안 실제로 말한 시간(ms) */
  weekSpeakingMs: number;
  /** 오늘(또는 어제)까지 이어진 연속 연습일 */
  streakDays: number;
  /** 최근 7일 각 날짜의 답변 수, 오래된 날부터 */
  week: { date: string; answers: number }[];
  totalPractices: number;
};

const DAY_MS = 86_400_000;

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computePracticeStats(sessions: InterviewSession[], now = new Date()): PracticeStats {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekStart = today.getTime() - 6 * DAY_MS;
  const answersByDay = new Map<string, number>();
  const practicedDays = new Set<string>();
  let weekAnswers = 0;
  let weekSpeakingMs = 0;
  const weekSessions = new Set<string>();

  for (const session of sessions) {
    for (const attempt of session.attempts) {
      if (attempt.status === "failed") continue;
      const at = new Date(attempt.recordedAt);
      if (Number.isNaN(at.getTime())) continue;
      const key = localDayKey(at);
      practicedDays.add(key);
      if (at.getTime() >= weekStart && at.getTime() < today.getTime() + DAY_MS) {
        weekAnswers += 1;
        weekSpeakingMs += Math.max(0, attempt.durationMs);
        weekSessions.add(session.id);
        answersByDay.set(key, (answersByDay.get(key) ?? 0) + 1);
      }
    }
  }

  // 오늘 아직 연습하지 않았어도 어제까지 이어졌다면 연속 기록은 유지한다.
  let streakDays = 0;
  const cursor = new Date(today);
  if (!practicedDays.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (practicedDays.has(localDayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart + index * DAY_MS);
    const key = localDayKey(day);
    return { date: key, answers: answersByDay.get(key) ?? 0 };
  });

  return {
    weekPractices: weekSessions.size,
    weekAnswers,
    weekSpeakingMs,
    streakDays,
    week,
    totalPractices: sessions.filter((session) => session.attempts.some((attempt) => attempt.status !== "failed")).length,
  };
}

/** 가장 최근 AI 총평의 "다음 연습" 한 줄. 다음 연습을 이어 주는 고리다. */
export function latestNextPractice(sessions: InterviewSession[]): { text: string; sessionId: string } | null {
  const withSummary = sessions
    .filter((session) => session.feedbackSummary?.result?.nextPractice?.trim())
    .sort((a, b) => (b.feedbackSummary?.completedAt ?? b.createdAt).localeCompare(a.feedbackSummary?.completedAt ?? a.createdAt));
  const latest = withSummary[0];
  return latest ? { text: latest.feedbackSummary!.result!.nextPractice.trim(), sessionId: latest.id } : null;
}
