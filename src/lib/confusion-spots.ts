/**
 * The places a learner said they were stuck, gathered across every material.
 *
 * Marking a passage 헷갈려요 asks the AI about it there and then, which is the
 * immediate answer. This is the other half: a week later, the passages that
 * did not land are the shortest list of what to go back to, and it is built
 * from what the learner said rather than from what a score guessed.
 *
 * Pure: the screen decides how to draw a spot, never which spots exist.
 */

import type {
  ConfusionFeedback,
  ConfusionReason,
  ISODateString,
  StudyMaterial,
} from '@/types';

/** What each reason is called on screen. One source for every surface. */
export const CONFUSION_REASON_LABELS: Readonly<Record<ConfusionReason, string>> = {
  terminology: '용어가 어려워요',
  'needs-example': '예시가 더 필요해요',
  'too-fast': '설명이 너무 빨라요',
  unclear: '무슨 말인지 모르겠어요',
};

/** The reasons offered, in the order they are shown. */
export const CONFUSION_REASONS: readonly ConfusionReason[] = [
  'terminology',
  'needs-example',
  'too-fast',
  'unclear',
];

export interface ConfusionSpot {
  /** The feedback's own id, so a row can be dismissed. */
  id: string;
  materialId: string;
  materialTitle: string;
  /** A page number for a document, a timestamp for anything spoken. */
  positionMs: number;
  isDocument: boolean;
  /** The passage that was marked. Empty when the segment has gone. */
  passage: string;
  reason: ConfusionReason;
  reasonLabel: string;
  markedAt: ISODateString;
}

/**
 * Every marked passage, newest first.
 *
 * A mark whose material or segment has gone is dropped: a row that cannot say
 * where it points is worse than no row. When the same passage was marked more
 * than once only the newest survives — tapping twice is a second thought, not
 * a second problem.
 */
export function confusionSpots(
  feedback: readonly ConfusionFeedback[],
  materials: readonly StudyMaterial[],
): ConfusionSpot[] {
  const byId = new Map(materials.map((material) => [material.id, material]));
  const seen = new Set<string>();
  const spots: ConfusionSpot[] = [];

  const ordered = [...feedback].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  for (const item of ordered) {
    const material = byId.get(item.materialId);
    if (!material) continue;
    const segment = material.transcript.find(
      (candidate) => candidate.id === item.segmentId,
    );
    if (!segment) continue;

    const key = `${item.materialId}:${item.segmentId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    spots.push({
      id: item.id,
      materialId: material.id,
      materialTitle: material.title,
      positionMs: segment.startMs,
      isDocument: material.source.kind === 'document',
      passage: segment.text,
      reason: item.reason,
      reasonLabel: CONFUSION_REASON_LABELS[item.reason],
      markedAt: item.createdAt,
    });
  }
  return spots;
}
