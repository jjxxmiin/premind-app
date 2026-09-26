import type { StatusTone } from '@/components/ui';
import type { AppLocale } from '@/lib/i18n/core';
import type { StudyMaterial } from '@/types';

import type { ScoreTrendEntry } from './ScoreTrend';

/**
 * What the 평가 tab shows, worked out from the material list. Pure, so the
 * screen only decides how to draw each block, never which blocks exist.
 */

/** Tint for the verdict badge next to a 0–5 score. */
export function verdictTone(overall: number): StatusTone {
  if (overall >= 4.5) return 'positive';
  if (overall >= 3.5) return 'info';
  if (overall >= 2.5) return 'neutral';
  return 'warning';
}

export interface LensHome {
  /** The newest finished report; the featured card. */
  latest: StudyMaterial | null;
  /** Every finished report, oldest first, for the 추이 card. */
  history: ScoreTrendEntry[];
  /**
   * The 지난 평가 list: reports in progress first, then every finished one
   * newest first. The featured report is in here too, marked by the screen.
   */
  rows: StudyMaterial[];
  /**
   * Whether that list is worth drawing. With a single report the list would
   * repeat the featured card word for word, and a section that says nothing
   * new reads as filler.
   */
  showRows: boolean;
  /** Ready materials the picker can offer, newest first. */
  candidates: StudyMaterial[];
  /** How many reports are finished. */
  reportCount: number;
}

/** When a material was last evaluated: the report's own date, or the material's. */
export function lensEvaluatedAt(material: StudyMaterial): string {
  return material.lensEvaluatedAt ?? material.updatedAt;
}

/**
 * "인공지능 개론 / 9월 7일 / 평가 2회": the meta line under a 지난 평가 row.
 * The count is only worth a word once there is more than one.
 */
export function lensRowMeta(
  projectTitle: string,
  dateLabel: string,
  lensCount: number | undefined,
  locale: AppLocale = 'ko',
): string {
  const parts = [projectTitle, dateLabel];
  if ((lensCount ?? 0) > 1) {
    parts.push(locale === 'en' ? `${lensCount} reviews` : `평가 ${lensCount}회`);
  }
  return parts.join(' / ');
}

export interface LensFailure {
  title: string;
  message: string;
}

/**
 * What the error dialog says when an evaluation could not start. The server's
 * own refusal (too little real speech to score) is not a failure of the app,
 * so it gets a calmer title and the server's reason verbatim.
 */
export function lensFailure(error: unknown): LensFailure {
  const message =
    error instanceof Error && error.message
      ? error.message
      : '평가를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'LENS_INSUFFICIENT') {
    return { title: '아직 평가할 수 없어요', message };
  }
  return { title: '평가를 시작하지 못했어요', message };
}

const byNewest = (left: StudyMaterial, right: StudyMaterial) =>
  right.updatedAt.localeCompare(left.updatedAt);

const byNewestEvaluation = (left: StudyMaterial, right: StudyMaterial) =>
  lensEvaluatedAt(right).localeCompare(lensEvaluatedAt(left));

export function lensHome(
  materials: readonly StudyMaterial[],
  evaluatingIds: readonly string[],
): LensHome {
  const isEvaluating = (id: string) => evaluatingIds.includes(id);
  const finished = materials
    .filter((material) => material.lensReport)
    .sort(byNewestEvaluation);
  const latest = finished[0] ?? null;
  const running = materials
    .filter((material) => isEvaluating(material.id))
    .sort(byNewest);
  const rows = [
    ...running,
    ...finished.filter((material) => !isEvaluating(material.id)),
  ];
  const history = [...finished].reverse().map((material) => ({
    id: material.id,
    overall: material.lensReport?.overall ?? 0,
    updatedAt: lensEvaluatedAt(material),
  }));
  // A document has nothing to evaluate. Lens scores how something was said —
  // pace, pauses, filler words — and a PDF was never said out loud. Worse, a
  // document's segment timestamps carry page numbers rather than time, so a
  // long enough deck would sail past the server's "at least 45 seconds of
  // speech" gate and come back with a spoken-delivery score for a file nobody
  // spoke. It is excluded here so it is never offered in the first place.
  const candidates = materials
    .filter(
      (material) =>
        material.status === 'ready' &&
        material.source.kind !== 'document' &&
        !isEvaluating(material.id),
    )
    .sort(byNewest);
  const showRows =
    rows.length > 1 || (rows.length === 1 && rows[0]?.id !== latest?.id);
  return {
    latest,
    history,
    rows,
    showRows,
    candidates,
    reportCount: finished.length,
  };
}
