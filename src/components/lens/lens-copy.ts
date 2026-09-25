import type { AppLocale } from '@/lib/i18n/core';
import { josa } from '@/lib/mastery';
import type { LensMoment, LensReport, LensRubricScore } from '@/types';

import {
  densityHalves,
  densitySide,
  formatDelta,
  rubricMovers,
  verdictFor,
  type DensitySide,
  type MomentDensity,
  verdictWord,
  type RubricComparisonRow,
} from './lens-charts';

/**
 * Plain-language copy for a 발표 연습 report: what each rubric measures, a
 * word for every number, and the one-paragraph conclusion at the top.
 */

const RUBRIC_EXPLANATIONS: Record<string, string> = {
  structure: '시작, 본론, 마무리가 순서대로 이어졌는지',
  clarity: '문장이 짧고 한 번에 알아듣게 말했는지',
  evidence: '주장마다 예시나 수치가 따라왔는지',
  delivery: '속도와 강조가 듣기 편했는지',
};

const RUBRIC_EXPLANATIONS_EN: Record<string, string> = {
  structure: 'Whether the opening, body, and close came in order',
  clarity: 'Whether sentences were short and easy to follow the first time',
  evidence: 'Whether each claim came with an example or a number',
  delivery: 'Whether the pace and emphasis were easy to listen to',
};

/**
 * The rubric names in English, by key. The server sends the Korean label
 * (구조, 명료성, 근거 활용, 전달력); an unknown key keeps what the server sent.
 */
const RUBRIC_LABELS_EN: Record<string, string> = {
  structure: 'Structure',
  clarity: 'Clarity',
  evidence: 'Evidence',
  delivery: 'Delivery',
};

/** A rubric item's name in the screen language. Korean is the server's label as is. */
export function rubricLabel(
  metric: { key: string; label: string },
  locale: AppLocale = 'ko',
): string {
  return locale === 'en' ? (RUBRIC_LABELS_EN[metric.key] ?? metric.label) : metric.label;
}

/** One line on what a rubric measures. Unknown keys get a generic line. */
export function rubricExplanation(key: string, locale: AppLocale = 'ko'): string {
  if (locale === 'en') {
    return RUBRIC_EXPLANATIONS_EN[key] ?? 'How well you did on this item';
  }
  return RUBRIC_EXPLANATIONS[key] ?? '이 항목에서 얼마나 잘했는지';
}

/** "아주 좋아요", "좋아요", "보통이에요", "아쉬워요" for a 0–5 score. */
export function scoreWord(score: number, locale: AppLocale = 'ko'): string {
  return locale === 'en' ? verdictWord(score, 'en') : verdictFor(score);
}

export interface ReportConclusion {
  /** "4.1점, 좋아요. 구조가 가장 좋았고, 근거 활용은 아쉬웠어요." */
  sentence: string;
  best: LensRubricScore | null;
  weakest: LensRubricScore | null;
  /** The strongest moment, for the "가장 잘한 것" line. */
  highlight: LensMoment | null;
  /** The priority, else the first improvement, for the "먼저 고칠 것" line. */
  fix: LensMoment | null;
}

/** Highest score wins; on a tie the earlier rubric keeps its place. */
export function bestRubric(rubric: readonly LensRubricScore[]): LensRubricScore | null {
  return rubric.reduce<LensRubricScore | null>(
    (best, metric) => (best === null || metric.score > best.score ? metric : best),
    null,
  );
}

export function weakestRubric(rubric: readonly LensRubricScore[]): LensRubricScore | null {
  return rubric.reduce<LensRubricScore | null>(
    (weakest, metric) => (weakest === null || metric.score < weakest.score ? metric : weakest),
    null,
  );
}

/**
 * One line under the 이번 vs 지난 chart: what moved up the most and what
 * slipped. Says plainly when nothing moved rather than dressing it up.
 */
export function comparisonSentence(
  rows: readonly RubricComparisonRow[],
  locale: AppLocale = 'ko',
): string {
  if (rows.length === 0) return '';
  const { improved, slipped } = rubricMovers(rows);
  if (locale === 'en') {
    const up = improved
      ? `${rubricLabel(improved, 'en')} rose the most (${formatDelta(improved.delta)})`
      : null;
    const down = slipped
      ? `${rubricLabel(slipped, 'en')} went down (${formatDelta(slipped.delta)})`
      : null;
    if (up && down) return `${up}, and ${down}.`;
    if (up) return `${up}, and nothing went down.`;
    if (down) return `Nothing went up, and ${down}.`;
    return rows.length === 1
      ? 'The 1 item is the same as last time.'
      : `All ${rows.length} items are the same as last time.`;
  }
  const rose = improved
    ? `${improved.label}${josa(improved.label, '이')} ${formatDelta(improved.delta)}로 가장 많이 올랐`
    : null;
  const fell = slipped
    ? `${slipped.label}${josa(slipped.label, '은')} ${formatDelta(slipped.delta)}로 내려갔어요.`
    : null;
  if (rose && fell) return `${rose}고, ${fell}`;
  if (rose) return `${rose}고, 내려간 항목은 없어요.`;
  if (fell) return `올라간 항목은 없고, ${fell}`;
  return `${rows.length}개 항목이 지난번과 같아요.`;
}

const SIDE_PHRASE: Record<Exclude<DensitySide, 'none'>, string> = {
  front: '앞쪽에 몰려 있',
  back: '뒤쪽에 몰려 있',
  spread: '앞뒤에 고루 있',
};

/**
 * One line under the density strip: which half of the recording each kind of
 * evidence sits in.
 */
const SIDE_PHRASE_EN: Record<Exclude<DensitySide, 'none'>, string> = {
  front: 'bunched in the first half',
  back: 'bunched in the second half',
  spread: 'spread across both halves',
};

export function densitySentence(density: MomentDensity, locale: AppLocale = 'ko'): string {
  const halves = densityHalves(density);
  const strength = densitySide(halves.first.strengths, halves.second.strengths);
  const improvement = densitySide(halves.first.improvements, halves.second.improvements);
  if (locale === 'en') {
    const goodEn = strength === 'none' ? null : `What went well is ${SIDE_PHRASE_EN[strength]}`;
    const fixEn =
      improvement === 'none' ? null : `what to improve is ${SIDE_PHRASE_EN[improvement]}`;
    if (goodEn && fixEn) return `${goodEn}, and ${fixEn}.`;
    if (goodEn) return `${goodEn}.`;
    if (fixEn) return `${fixEn.charAt(0).toUpperCase()}${fixEn.slice(1)}.`;
    return '';
  }
  const good = strength === 'none' ? null : `잘한 점은 ${SIDE_PHRASE[strength]}`;
  const fix = improvement === 'none' ? null : `더 좋아질 점은 ${SIDE_PHRASE[improvement]}`;
  if (good && fix) return `${good}고, ${fix}어요.`;
  if (good) return `${good}어요.`;
  if (fix) return `${fix}어요.`;
  return '';
}

export function reportConclusion(report: LensReport, locale: AppLocale = 'ko'): ReportConclusion {
  const best = bestRubric(report.rubric);
  const weakest = weakestRubric(report.rubric);
  if (locale === 'en') {
    const leadEn = `${report.overall.toFixed(1)} points, ${scoreWord(report.overall, 'en')}.`;
    let sentenceEn = leadEn;
    if (best && weakest && best.key !== weakest.key) {
      sentenceEn = `${leadEn} ${rubricLabel(best, 'en')} was your strongest, and ${rubricLabel(weakest, 'en')} needs work.`;
    } else if (best) {
      sentenceEn = `${leadEn} All items scored about the same.`;
    }
    return {
      sentence: sentenceEn,
      best,
      weakest,
      highlight: report.strengths[0] ?? null,
      fix: report.priority ?? report.improvements[0] ?? null,
    };
  }
  const lead = `${report.overall.toFixed(1)}점, ${scoreWord(report.overall)}.`;
  let sentence = lead;
  if (best && weakest && best.key !== weakest.key) {
    sentence = `${lead} ${best.label}${josa(best.label, '이')} 가장 좋았고, ${weakest.label}${josa(weakest.label, '은')} 아쉬웠어요.`;
  } else if (best) {
    sentence = `${lead} 네 항목이 고르게 나왔어요.`;
  }
  return {
    sentence,
    best,
    weakest,
    highlight: report.strengths[0] ?? null,
    fix: report.priority ?? report.improvements[0] ?? null,
  };
}
