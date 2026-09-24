import type { ConfusionFeedback, StudyMaterial } from '@/types';

import { CONFUSION_REASON_LABELS, confusionSpots } from './confusion-spots';

function material(
  id: string,
  segments: { id: string; startMs: number; text: string }[],
  extra: Partial<StudyMaterial> = {},
): StudyMaterial {
  return {
    id,
    projectId: 'project-1',
    title: `${id} 자료`,
    source: {
      uri: `file:///${id}.m4a`,
      fileName: `${id}.m4a`,
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
    },
    status: 'ready',
    progress: 1,
    progressLabel: '',
    syncStatus: 'synced',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    transcript: segments.map((segment) => ({
      ...segment,
      endMs: segment.startMs + 1_000,
    })),
    quiz: [],
    markers: [],
    ...extra,
  } as StudyMaterial;
}

function mark(
  id: string,
  materialId: string,
  segmentId: string | undefined,
  createdAt: string,
  reason: ConfusionFeedback['reason'] = 'terminology',
): ConfusionFeedback {
  return { id, materialId, segmentId, reason, createdAt };
}

const LECTURE = material('m1', [
  { id: 'm1-segment-1', startMs: 0, text: '과적합은 훈련 데이터를 외운 상태예요.' },
  { id: 'm1-segment-2', startMs: 60_000, text: '검증 데이터로 성능을 재요.' },
]);

describe('confusionSpots', () => {
  it('lists the newest mark first', () => {
    const spots = confusionSpots(
      [
        mark('c1', 'm1', 'm1-segment-1', '2026-09-01T00:00:00.000Z'),
        mark('c2', 'm1', 'm1-segment-2', '2026-09-05T00:00:00.000Z'),
      ],
      [LECTURE],
    );
    expect(spots.map((spot) => spot.id)).toEqual(['c2', 'c1']);
  });

  it('carries the passage and where it sits, so the row can say both', () => {
    const [spot] = confusionSpots(
      [mark('c1', 'm1', 'm1-segment-2', '2026-09-05T00:00:00.000Z')],
      [LECTURE],
    );
    expect(spot).toBeDefined();
    if (!spot) return;
    expect(spot.passage).toBe('검증 데이터로 성능을 재요.');
    expect(spot.positionMs).toBe(60_000);
    expect(spot.materialTitle).toBe('m1 자료');
    expect(spot.isDocument).toBe(false);
  });

  it('flags a document so its position reads as a page', () => {
    const pdf = material(
      'm2',
      [{ id: 'm2-segment-1', startMs: 2_000, text: '3쪽의 본문이에요.' }],
      {
        source: {
          uri: 'file:///m2.pdf',
          fileName: 'm2.pdf',
          mimeType: 'application/pdf',
          kind: 'document',
          origin: 'import',
        } as StudyMaterial['source'],
      },
    );
    const [spot] = confusionSpots(
      [mark('c1', 'm2', 'm2-segment-1', '2026-09-05T00:00:00.000Z')],
      [pdf],
    );
    expect(spot).toBeDefined();
    if (!spot) return;
    expect(spot.isDocument).toBe(true);
    expect(spot.positionMs).toBe(2_000);
  });

  it('keeps only the newest mark on the same passage', () => {
    const spots = confusionSpots(
      [
        mark('c1', 'm1', 'm1-segment-1', '2026-09-01T00:00:00.000Z', 'terminology'),
        mark('c2', 'm1', 'm1-segment-1', '2026-09-05T00:00:00.000Z', 'needs-example'),
      ],
      [LECTURE],
    );
    expect(spots).toHaveLength(1);
    expect(spots[0]?.id).toBe('c2');
    expect(spots[0]?.reason).toBe('needs-example');
  });

  it('still separates the same passage number in different materials', () => {
    const other = material('m3', [
      { id: 'm3-segment-1', startMs: 0, text: '다른 자료의 첫 줄이에요.' },
    ]);
    const spots = confusionSpots(
      [
        mark('c1', 'm1', 'm1-segment-1', '2026-09-01T00:00:00.000Z'),
        mark('c2', 'm3', 'm3-segment-1', '2026-09-02T00:00:00.000Z'),
      ],
      [LECTURE, other],
    );
    expect(spots).toHaveLength(2);
  });

  it('drops a mark whose material is gone', () => {
    expect(
      confusionSpots([mark('c1', 'deleted', 'x', '2026-09-01T00:00:00.000Z')], [LECTURE]),
    ).toEqual([]);
  });

  it('drops a mark whose passage is gone rather than showing a row with no place', () => {
    expect(
      confusionSpots(
        [mark('c1', 'm1', 'm1-segment-9', '2026-09-01T00:00:00.000Z')],
        [LECTURE],
      ),
    ).toEqual([]);
    // An old mark that never recorded which segment cannot be placed either.
    expect(
      confusionSpots([mark('c1', 'm1', undefined, '2026-09-01T00:00:00.000Z')], [LECTURE]),
    ).toEqual([]);
  });

  it('labels every reason, using the same words the picker used', () => {
    const spots = confusionSpots(
      [mark('c1', 'm1', 'm1-segment-1', '2026-09-01T00:00:00.000Z', 'too-fast')],
      [LECTURE],
    );
    expect(spots[0]?.reasonLabel).toBe(CONFUSION_REASON_LABELS['too-fast']);
    expect(spots[0]?.reasonLabel).toBe('설명이 너무 빨라요');
  });

  it('answers nothing marked with an empty list, not an error', () => {
    expect(confusionSpots([], [LECTURE])).toEqual([]);
  });
});
