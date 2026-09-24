import type {
  QuizAttempt,
  QuizQuestion,
  StudyMaterial,
  StudyNotebook,
} from '../types';

import { formatSourcePosition } from './format';

/**
 * 이해도: how well the learner knows one material, computed on the device
 * from what they actually did. Nothing here talks to a server.
 *
 *   이해도 = 문제 정답률 70% + 핵심 내용 확인 30%
 *
 * The quiz part reads the latest answer per question; the checklist part is
 * the share of key points the learner ticked in their notebook. Whichever
 * side has nothing behind it drops out, so a material with no questions is
 * scored on the checklist alone, and a material nothing has been done with
 * scores `null` ("아직 평가할 게 없어요").
 */

export const QUIZ_WEIGHT = 0.7;
export const CHECKLIST_WEIGHT = 0.3;

export interface ConceptResult {
  concept: string;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  /** The latest answer to at least one of its questions is wrong. */
  weak: boolean;
  /** The first question whose latest answer was wrong; null for a solid concept. */
  missedQuestion: QuizQuestion | null;
  /** Where to re-listen: the missed question's source, else the concept's first question. */
  sourceStartMs: number;
}

export interface TrendPoint {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  attemptCount: number;
  correctCount: number;
  /** 0–1 over every attempt made that day. */
  accuracy: number;
  lastAttemptAt: string;
}

export type NextStepKind = 'relisten' | 'retry' | 'checklist' | 'start';

export interface NextStep {
  kind: NextStepKind;
  title: string;
  detail: string;
  /** For `relisten`: the position to open the material at. */
  sourceStartMs?: number;
  concept?: string;
}

export interface MasterySummary {
  materialId: string;
  /** 0–100, or null when nothing has been done yet. */
  score: number | null;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  /** 0–1 over answered questions; null with none answered. */
  accuracy: number | null;
  keyPointCount: number;
  checkedCount: number;
  /** 0–1 over key points; null when the material has none. */
  checklistRatio: number | null;
  concepts: ConceptResult[];
  weakConcepts: ConceptResult[];
  trend: TrendPoint[];
  nextSteps: NextStep[];
  /** When the learner last answered a question of this material; null if never. */
  lastAttemptAt: string | null;
}

/** The newest attempt for each question, by `attemptedAt` (ties: later in the list wins). */
export function latestAttemptsByQuestion(
  attempts: readonly QuizAttempt[],
): Map<string, QuizAttempt> {
  const latest = new Map<string, QuizAttempt>();
  for (const attempt of attempts) {
    const current = latest.get(attempt.questionId);
    if (!current || attempt.attemptedAt >= current.attemptedAt) {
      latest.set(attempt.questionId, attempt);
    }
  }
  return latest;
}

/** Questions grouped by `concept`, in first-seen order, each judged on its latest answers. */
export function conceptResults(
  questions: readonly QuizQuestion[],
  latest: ReadonlyMap<string, QuizAttempt>,
): ConceptResult[] {
  const groups = new Map<string, QuizQuestion[]>();
  for (const question of questions) {
    const key = question.concept.trim() || '기타';
    const group = groups.get(key);
    if (group) group.push(question);
    else groups.set(key, [question]);
  }
  return Array.from(groups.entries()).map(([concept, group]) => {
    let answeredCount = 0;
    let correctCount = 0;
    let missedQuestion: QuizQuestion | null = null;
    for (const question of group) {
      const attempt = latest.get(question.id);
      if (!attempt) continue;
      answeredCount += 1;
      if (attempt.isCorrect) correctCount += 1;
      else if (!missedQuestion) missedQuestion = question;
    }
    return {
      concept,
      questionCount: group.length,
      answeredCount,
      correctCount,
      weak: missedQuestion !== null,
      missedQuestion,
      sourceStartMs: missedQuestion?.sourceStartMs ?? group[0]?.sourceStartMs ?? 0,
    };
  });
}

/** Local calendar day of an ISO timestamp. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Accuracy per day across every attempt given, oldest day first. */
export function accuracyTrend(attempts: readonly QuizAttempt[]): TrendPoint[] {
  const days = new Map<string, TrendPoint>();
  for (const attempt of attempts) {
    const day = dayKey(attempt.attemptedAt);
    const point = days.get(day) ?? {
      day,
      attemptCount: 0,
      correctCount: 0,
      accuracy: 0,
      lastAttemptAt: attempt.attemptedAt,
    };
    point.attemptCount += 1;
    if (attempt.isCorrect) point.correctCount += 1;
    if (attempt.attemptedAt > point.lastAttemptAt) point.lastAttemptAt = attempt.attemptedAt;
    days.set(day, point);
  }
  return Array.from(days.values())
    .map((point) => ({ ...point, accuracy: point.correctCount / point.attemptCount }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

/**
 * The 0–100 이해도, or null when there is nothing to score.
 *
 * Both parts present: 70/30. Only one part present (no questions, or no key
 * points): that part alone. Nothing answered and nothing checked: null.
 */
export function masteryScore(
  accuracy: number | null,
  checklistRatio: number | null,
  checkedCount: number,
): number | null {
  const hasQuiz = accuracy !== null;
  const hasChecklist = checklistRatio !== null;
  if (!hasQuiz && (!hasChecklist || checkedCount === 0)) return null;
  if (hasQuiz && hasChecklist) {
    // A tiny epsilon so 72.5 rounds up instead of falling to 72.499999.
    return Math.round(
      (accuracy * QUIZ_WEIGHT + checklistRatio * CHECKLIST_WEIGHT) * 100 + 1e-9,
    );
  }
  if (hasQuiz) return Math.round(accuracy * 100);
  return Math.round((checklistRatio ?? 0) * 100);
}

/** One plain word for a 0–100 이해도. */
export function masteryVerdict(score: number): string {
  if (score >= 90) return '아주 잘 알아요';
  if (score >= 70) return '잘 알아요';
  if (score >= 40) return '조금 더 봐요';
  return '다시 봐요';
}

/**
 * Korean object and subject particles for a word, by its final syllable.
 * Non-Hangul endings get both forms so the sentence still reads.
 */
export function josa(word: string, kind: '을' | '이' | '은' | '와'): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  if (!hangul) {
    return kind === '을' ? '을(를)' : kind === '이' ? '이(가)' : kind === '은' ? '은(는)' : '와(과)';
  }
  const hasBatchim = (code - 0xac00) % 28 !== 0;
  if (kind === '을') return hasBatchim ? '을' : '를';
  if (kind === '이') return hasBatchim ? '이' : '가';
  if (kind === '은') return hasBatchim ? '은' : '는';
  return hasBatchim ? '과' : '와';
}

/** "회귀와 분류", "과적합" — up to `limit` items, the rest counted. */
export function joinTerms(terms: readonly string[], limit = 2): string {
  if (terms.length === 0) return '';
  const shown = terms.slice(0, limit);
  const rest = terms.length - shown.length;
  const joined = shown
    .map((term, index) => (index < shown.length - 1 ? `${term}${josa(term, '와')}` : term))
    .join(' ');
  return rest > 0 ? `${joined} 등 ${terms.length}개` : joined;
}

export function nextSteps(summary: {
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  keyPointCount: number;
  checkedCount: number;
  weakConcepts: readonly ConceptResult[];
  /**
   * Whether the material is an uploaded document. A document numbers its pages
   * into the same position field a recording uses, so without this a PDF's
   * page 3 read as "00:02부터 다시 듣기" — a time for something with no sound.
   */
  isDocument?: boolean;
}): NextStep[] {
  const steps: NextStep[] = [];
  const nothingDone = summary.answeredCount === 0 && summary.checkedCount === 0;
  if (nothingDone) {
    if (summary.questionCount > 0) {
      steps.push({
        kind: 'start',
        title: '문제 풀기',
        detail: `문제 ${summary.questionCount}개를 풀면 이해도가 생겨요`,
      });
    } else if (summary.keyPointCount > 0) {
      steps.push({
        kind: 'checklist',
        title: '핵심 내용 확인',
        detail: `핵심 내용 ${summary.keyPointCount}개를 확인하면 이해도가 생겨요`,
      });
    }
    return steps;
  }
  for (const concept of summary.weakConcepts.slice(0, 3)) {
    steps.push({
      kind: 'relisten',
      title: summary.isDocument
        ? `${formatSourcePosition(concept.sourceStartMs, true)} 다시 보기`
        : `${formatSourcePosition(concept.sourceStartMs, false)}부터 다시 듣기`,
      detail: `${concept.concept}${josa(concept.concept, '을')} 헷갈렸어요`,
      sourceStartMs: concept.sourceStartMs,
      concept: concept.concept,
    });
  }
  const wrong = summary.answeredCount - summary.correctCount;
  const unanswered = summary.questionCount - summary.answeredCount;
  if (wrong > 0 || unanswered > 0) {
    const parts: string[] = [];
    if (wrong > 0) parts.push(`틀린 문제 ${wrong}개`);
    if (unanswered > 0) parts.push(`안 푼 문제 ${unanswered}개`);
    steps.push({
      kind: 'retry',
      title: summary.answeredCount > 0 ? '문제 다시 풀기' : '문제 풀기',
      detail: parts.join(', '),
    });
  }
  const unchecked = summary.keyPointCount - summary.checkedCount;
  if (unchecked > 0) {
    steps.push({
      kind: 'checklist',
      title: '핵심 내용 확인',
      detail: `아직 확인하지 않은 내용 ${unchecked}개`,
    });
  }
  return steps;
}

/** Everything the 이해도 screens show for one material. */
export function summarizeMastery(
  material: Pick<StudyMaterial, 'id' | 'quiz' | 'note'>,
  attempts: readonly QuizAttempt[],
  notebook?: Pick<StudyNotebook, 'checkedPoints'> | null,
): MasterySummary {
  const own = attempts.filter((attempt) => attempt.materialId === material.id);
  const latest = latestAttemptsByQuestion(own);
  const questions = material.quiz;
  const questionIds = new Set(questions.map((question) => question.id));
  let answeredCount = 0;
  let correctCount = 0;
  for (const [questionId, attempt] of latest) {
    if (!questionIds.has(questionId)) continue;
    answeredCount += 1;
    if (attempt.isCorrect) correctCount += 1;
  }
  const accuracy = answeredCount > 0 ? correctCount / answeredCount : null;

  const keyPoints = material.note?.keyPoints ?? [];
  const checked = new Set(notebook?.checkedPoints ?? []);
  const checkedCount = keyPoints.filter((point) => checked.has(point)).length;
  const checklistRatio = keyPoints.length > 0 ? checkedCount / keyPoints.length : null;

  const concepts = conceptResults(questions, latest);
  const weakConcepts = concepts.filter((concept) => concept.weak);
  const lastAttemptAt = own.reduce<string | null>(
    (latestAt, attempt) =>
      latestAt === null || attempt.attemptedAt > latestAt ? attempt.attemptedAt : latestAt,
    null,
  );
  const base = {
    questionCount: questions.length,
    answeredCount,
    correctCount,
    keyPointCount: keyPoints.length,
    checkedCount,
    weakConcepts,
  };
  return {
    materialId: material.id,
    score: masteryScore(accuracy, checklistRatio, checkedCount),
    ...base,
    accuracy,
    checklistRatio,
    concepts,
    trend: accuracyTrend(own),
    nextSteps: nextSteps(base),
    lastAttemptAt,
  };
}

/** "이 자료는 76% 이해했어요. 회귀와 분류를 헷갈렸어요." */
export function masteryHeadline(summary: MasterySummary): string {
  if (summary.score === null) return '아직 평가할 게 없어요.';
  const first = `이 자료는 ${summary.score}% 이해했어요.`;
  if (summary.weakConcepts.length > 0) {
    const terms = joinTerms(summary.weakConcepts.map((concept) => concept.concept));
    return `${first} ${terms}${josa(terms, '을')} 헷갈렸어요.`;
  }
  if (summary.answeredCount > 0) return `${first} 헷갈린 개념이 없어요.`;
  return `${first} 문제를 풀면 더 정확해져요.`;
}

/** "문제 5개 중 4개 맞힘, 취약 개념 1개" — the one line under a material's name. */
export function masteryLine(summary: MasterySummary): string {
  if (summary.score === null) {
    return summary.questionCount > 0
      ? `문제 ${summary.questionCount}개가 기다려요`
      : summary.keyPointCount > 0
        ? `핵심 내용 ${summary.keyPointCount}개를 확인해요`
        : '아직 평가할 게 없어요';
  }
  const parts: string[] = [];
  if (summary.answeredCount > 0) {
    parts.push(`문제 ${summary.answeredCount}개 중 ${summary.correctCount}개 맞힘`);
    parts.push(
      summary.weakConcepts.length > 0
        ? `취약 개념 ${summary.weakConcepts.length}개`
        : '취약 개념 없음',
    );
  } else {
    parts.push(`핵심 내용 ${summary.keyPointCount}개 중 ${summary.checkedCount}개 확인`);
  }
  return parts.join(', ');
}

export interface WeeklyOverview {
  /** Attempts made in the last 7 days. */
  attemptCount: number;
  correctCount: number;
  /** 0–1 over this week's attempts; null with none. */
  accuracy: number | null;
  /** Materials whose daily accuracy rose from the first to the latest day this week. */
  improvedCount: number;
  /** Accuracy per day across every material, oldest first (all time). */
  trend: TrendPoint[];
}

export const WEEK_MS = 7 * 86_400_000;

export function weeklyOverview(
  attempts: readonly QuizAttempt[],
  now: number = Date.now(),
): WeeklyOverview {
  const since = new Date(now - WEEK_MS).toISOString();
  const recent = attempts.filter((attempt) => attempt.attemptedAt >= since);
  const correctCount = recent.filter((attempt) => attempt.isCorrect).length;
  const byMaterial = new Map<string, QuizAttempt[]>();
  for (const attempt of recent) {
    const list = byMaterial.get(attempt.materialId);
    if (list) list.push(attempt);
    else byMaterial.set(attempt.materialId, [attempt]);
  }
  let improvedCount = 0;
  for (const list of byMaterial.values()) {
    const trend = accuracyTrend(list);
    const firstDay = trend[0];
    const lastDay = trend[trend.length - 1];
    if (trend.length >= 2 && firstDay && lastDay && lastDay.accuracy > firstDay.accuracy) {
      improvedCount += 1;
    }
  }
  return {
    attemptCount: recent.length,
    correctCount,
    accuracy: recent.length > 0 ? correctCount / recent.length : null,
    improvedCount,
    trend: accuracyTrend(attempts),
  };
}

/** Whole percent from a 0–1 ratio. */
export function toPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

// ---- The 이해도 tab: everything across materials ---------------------------

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface WeekdayActivity {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  /** 월 to 일, from the day's local weekday. */
  label: string;
  attemptCount: number;
  correctCount: number;
  today: boolean;
}

/** Local `YYYY-MM-DD` of a Date, without going through an ISO string. */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The last seven local days, oldest first and today last, with how many
 * questions were answered on each. Labels are the weekday (월 to 일), so a
 * strip that ends on a Sunday reads 월 화 수 목 금 토 일.
 */
export function weekdayActivity(
  attempts: readonly QuizAttempt[],
  now: number = Date.now(),
): WeekdayActivity[] {
  const counts = new Map<string, { attemptCount: number; correctCount: number }>();
  for (const attempt of attempts) {
    const key = dayKey(attempt.attemptedAt);
    const count = counts.get(key) ?? { attemptCount: 0, correctCount: 0 };
    count.attemptCount += 1;
    if (attempt.isCorrect) count.correctCount += 1;
    counts.set(key, count);
  }
  const days: WeekdayActivity[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = localDayKey(date);
    const count = counts.get(key);
    days.push({
      day: key,
      label: WEEKDAY_LABELS[(date.getDay() + 6) % 7] ?? '',
      attemptCount: count?.attemptCount ?? 0,
      correctCount: count?.correctCount ?? 0,
      today: offset === 0,
    });
  }
  return days;
}

/** "이번 주 문제 12개, 정답률 80%" or "이번 주는 아직 안 풀었어요". */
export function weekCaption(days: readonly WeekdayActivity[]): string {
  const attemptCount = days.reduce((sum, day) => sum + day.attemptCount, 0);
  if (attemptCount === 0) return '이번 주는 아직 안 풀었어요';
  const correctCount = days.reduce((sum, day) => sum + day.correctCount, 0);
  return `이번 주 문제 ${attemptCount}개, 정답률 ${toPercent(correctCount / attemptCount)}%`;
}

/** Mean 이해도 over the materials that have one; null when none is scored. */
export function overallMastery(
  summaries: readonly Pick<MasterySummary, 'score'>[],
): number | null {
  const scored = summaries.filter(
    (summary): summary is { score: number } => summary.score !== null,
  );
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((sum, summary) => sum + summary.score, 0) / scored.length);
}

export interface OverviewCopy {
  /** "자료 3개 중 2개를 공부했어요" or the first-run line. */
  title: string;
  /** The one thing to do next; empty before anything is done. */
  detail: string;
}

/** The two lines beside the big ring. */
export function overviewCopy(input: {
  materialCount: number;
  studiedCount: number;
  weakConcept: string | null;
  unansweredCount: number;
}): OverviewCopy {
  if (input.studiedCount === 0) {
    return { title: '첫 문제를 풀면 이해도가 시작돼요', detail: '' };
  }
  const title = `자료 ${input.materialCount}개 중 ${input.studiedCount}개를 공부했어요`;
  if (input.weakConcept) {
    return {
      title,
      detail: `${input.weakConcept}${josa(input.weakConcept, '을')} 다시 볼 차례예요`,
    };
  }
  if (input.unansweredCount > 0) {
    return { title, detail: `남은 문제 ${input.unansweredCount}개를 풀어 봐요` };
  }
  return { title, detail: '푼 문제를 모두 맞혔어요' };
}

export type PlanKind = 'relisten' | 'retry' | 'start';

export interface PlanItem {
  kind: PlanKind;
  materialId: string;
  /** The concept term for `relisten`; the action for the others. */
  title: string;
  /** "5주차, 지도학습의 원리 / 12:31부터" — the material and the specifics. */
  detail: string;
  sourceStartMs?: number;
  concept?: string;
}

export interface PlanInput {
  material: Pick<StudyMaterial, 'id' | 'title' | 'quiz' | 'source'>;
  summary: MasterySummary;
}

/**
 * What to do next across every material, most valuable first: weak concepts
 * to re-listen to, then questions to retry, then questions never answered.
 * Empty until at least one material is scored, because before that the
 * hero's single button is the whole plan.
 */
export function studyPlan(rows: readonly PlanInput[], limit = 3): PlanItem[] {
  if (!rows.some((row) => row.summary.score !== null)) return [];
  const byRecent = [...rows].sort((left, right) =>
    (right.summary.lastAttemptAt ?? '').localeCompare(left.summary.lastAttemptAt ?? ''),
  );
  const relisten: PlanItem[] = [];
  const retry: { item: PlanItem; wrong: number }[] = [];
  const start: PlanItem[] = [];
  for (const { material, summary } of byRecent) {
    for (const concept of summary.weakConcepts) {
      relisten.push({
        kind: 'relisten',
        materialId: material.id,
        title: concept.concept,
        detail: `${material.title} / ${formatSourcePosition(
          concept.sourceStartMs,
          material.source.kind === 'document',
        )}부터`,
        sourceStartMs: concept.sourceStartMs,
        concept: concept.concept,
      });
    }
    const wrong = summary.answeredCount - summary.correctCount;
    if (wrong > 0) {
      retry.push({
        wrong,
        item: {
          kind: 'retry',
          materialId: material.id,
          title: '문제 다시 풀기',
          detail: `${material.title} / 틀린 문제 ${wrong}개`,
        },
      });
    }
    const unanswered = summary.questionCount - summary.answeredCount;
    if (unanswered > 0) {
      start.push({
        kind: 'start',
        materialId: material.id,
        title: '안 푼 문제 풀기',
        detail: `${material.title} / 문제 ${unanswered}개`,
      });
    }
  }
  retry.sort((left, right) => right.wrong - left.wrong);
  return [...relisten, ...retry.map((entry) => entry.item), ...start].slice(0, limit);
}
