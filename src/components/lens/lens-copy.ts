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

/** One line on what a rubric measures. Unknown keys get a generic line. */
export function rubricExplanation(key: string): string {
  return RUBRIC_EXPLANATIONS[key] ?? '이 항목에서 얼마나 잘했는지';
}

/** "아주 좋아요", "좋아요", "보통이에요", "아쉬워요" for a 0–5 score. */
export function scoreWord(score: number): string {
  return verdictFor(score);
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
export function comparisonSentence(rows: readonly RubricComparisonRow[]): string {
  if (rows.length === 0) return '';
  const { improved, slipped } = rubricMovers(rows);
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
export function densitySentence(density: MomentDensity): string {
  const halves = densityHalves(density);
  const strength = densitySide(halves.first.strengths, halves.second.strengths);
  const improvement = densitySide(halves.first.improvements, halves.second.improvements);
  const good = strength === 'none' ? null : `잘한 점은 ${SIDE_PHRASE[strength]}`;
  const fix = improvement === 'none' ? null : `더 좋아질 점은 ${SIDE_PHRASE[improvement]}`;
  if (good && fix) return `${good}고, ${fix}어요.`;
  if (good) return `${good}어요.`;
  if (fix) return `${fix}어요.`;
  return '';
}

export function reportConclusion(report: LensReport): ReportConclusion {
  const best = bestRubric(report.rubric);
  const weakest = weakestRubric(report.rubric);
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
