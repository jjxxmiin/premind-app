import type { StudyNotebook, StudyNotebookPatch } from '../types';

/** A fresh notebook: nothing checked, nothing flagged, nothing written. */
export function emptyStudyNotebook(updatedAt = new Date(0).toISOString()): StudyNotebook {
  return {
    checkedPoints: [],
    reviewConcepts: [],
    highlights: [],
    memo: '',
    updatedAt,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Reads one persisted notebook defensively. Snapshots written by older
 * builds have no notebooks at all, and a hand-edited or truncated entry must
 * not take the whole workspace down, so anything malformed becomes null.
 */
export function normalizeStudyNotebook(value: unknown): StudyNotebook | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const checkedPoints = isStringArray(record.checkedPoints) ? record.checkedPoints : [];
  const reviewConcepts = isStringArray(record.reviewConcepts) ? record.reviewConcepts : [];
  // Snapshots written before the 형광펜 shipped carry no highlights at all.
  const highlights = isStringArray(record.highlights) ? record.highlights : [];
  const memo = typeof record.memo === 'string' ? record.memo : '';
  const updatedAt =
    typeof record.updatedAt === 'string' && record.updatedAt
      ? record.updatedAt
      : new Date(0).toISOString();
  return { checkedPoints, reviewConcepts, highlights, memo, updatedAt };
}

/** Every notebook in a snapshot, keyed by material id; junk entries are dropped. */
export function normalizeStudyNotebooks(
  value: unknown,
): Record<string, StudyNotebook> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, StudyNotebook> = {};
  for (const [materialId, entry] of Object.entries(value as Record<string, unknown>)) {
    const notebook = normalizeStudyNotebook(entry);
    if (notebook) result[materialId] = notebook;
  }
  return result;
}

export function applyStudyNotebookPatch(
  current: StudyNotebook | undefined,
  patch: StudyNotebookPatch,
  updatedAt: string,
): StudyNotebook {
  const base = current ?? emptyStudyNotebook(updatedAt);
  return {
    checkedPoints: patch.checkedPoints ?? base.checkedPoints,
    reviewConcepts: patch.reviewConcepts ?? base.reviewConcepts,
    highlights: patch.highlights ?? base.highlights,
    memo: patch.memo ?? base.memo,
    updatedAt,
  };
}

/**
 * The checklist under 꼭 기억할 내용: one tap checks a point, the next tap
 * clears it. Points are stored by their text, so a re-generated summary
 * that rewords a point simply shows it unchecked again.
 */
export function toggleCheckedPoint(
  checkedPoints: readonly string[],
  point: string,
): string[] {
  return checkedPoints.includes(point)
    ? checkedPoints.filter((item) => item !== point)
    : [...checkedPoints, point];
}

/** How many of the summary's current points the learner has checked. */
export function countCheckedPoints(
  keyPoints: readonly string[],
  checkedPoints: readonly string[],
): number {
  return keyPoints.filter((point) => checkedPoints.includes(point)).length;
}
