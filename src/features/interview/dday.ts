// 면접 날짜(D-day) 연습 계획. 기기에만 저장한다(개인 일정은 서버로 보내지 않음).
// Ported from apps/interview/lib/interview/dday.ts; storage lives in interview-storage.ts.
export type Dday = { date: string; label: string };

export function parseDday(value: unknown): Dday | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? { date: record.date, label: String(record.label ?? "").slice(0, 40) }
    : null;
}

export function daysUntil(date: string, now = new Date()): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** 남은 날짜에 맞춘 오늘의 목표. 점수가 아니라 "몇 문항 말하기"로 정한다. */
export function planFor(days: number): { stage: string; goal: number; tip: string } {
  if (days < 0) return { stage: "면접이 지났어요", goal: 0, tip: "수고했어요. 다음 면접 날짜를 넣어 두면 다시 계획을 세워 드려요." };
  if (days === 0) return { stage: "오늘이 면접이에요", goal: 1, tip: "자기소개 한 번만 가볍게 말해 보고, 나머지는 쉬어요." };
  if (days <= 2) return { stage: "실전 리허설", goal: 5, tip: "처음부터 끝까지 실제 면접처럼 한 번에 이어서 답해 보세요." };
  if (days <= 7) return { stage: "자주 나올 질문 반복", goal: 4, tip: "자기소개서 질문과 꼬리질문을 다시 답하고, 처음 답변과 비교해 보세요." };
  return { stage: "기본기 쌓기", goal: 3, tip: "기본 질문과 공통 질문 세트로 말하는 습관부터 만들어요." };
}
