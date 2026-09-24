import type { StudyConcept, TranscriptSegment } from '../../types';
import {
  generateLocalHighlightCandidates,
  generateLocalHighlightsForMaterial,
  LOCAL_HIGHLIGHT_HEURISTIC_VERSION,
} from './local-highlight-heuristics';

function segment(
  id: string,
  startMs: number,
  text: string,
  overrides: Partial<TranscriptSegment> = {},
): TranscriptSegment {
  return {
    endMs: startMs + 10_000,
    id,
    speaker: '교수자',
    startMs,
    text,
    ...overrides,
  };
}

describe('generateLocalHighlightCandidates', () => {
  it.each([
    ['중요', '여기가 중요한 부분입니다.'],
    ['시험', '이 정의는 시험에 나옵니다.'],
    ['기억', '이 순서는 꼭 기억해 두세요.'],
    ['핵심', '핵심은 입력과 출력의 관계입니다.'],
    ['다시 말하면', '다시 말하면 일반화 성능을 보는 것입니다.'],
    ['정리하면', '정리하면 두 조건이 모두 필요합니다.'],
  ])('finds the explicit instructor cue %s', (cue, text) => {
    const [candidate] = generateLocalHighlightCandidates({
      transcript: [segment(`segment-${cue}`, 12_000, text)],
    });

    expect(candidate).toMatchObject({
      evidenceSentence: text,
      heuristicVersion: LOCAL_HIGHLIGHT_HEURISTIC_VERSION,
      segmentId: `segment-${cue}`,
      source: 'local-heuristic',
      timestampMs: 12_000,
    });
    expect(candidate?.matchedCues.join(' ')).toContain(cue);
    expect(candidate?.signals).toContain('explicit-language-cue');
    expect(candidate?.reasons.join(' ')).toContain('강사 발화');
    expect(candidate?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('uses the sentence containing the cue as exact transcript evidence', () => {
    const [candidate] = generateLocalHighlightCandidates({
      transcript: [
        segment(
          'multi-sentence',
          30_000,
          '먼저 예시를 보겠습니다. 시험에는 이 정의가 나옵니다. 다음으로 넘어갑니다.',
        ),
      ],
    });

    expect(candidate?.evidenceSentence).toBe('시험에는 이 정의가 나옵니다.');
  });

  it('respects an existing importance flag without presenting it as model output', () => {
    const [candidate] = generateLocalHighlightCandidates({
      transcript: [
        segment('flagged', 55_000, '두 값을 순서대로 비교합니다.', {
          isImportant: true,
          speaker: '학생',
        }),
      ],
    });

    expect(candidate).toMatchObject({
      confidence: 0.72,
      source: 'local-heuristic',
    });
    expect(candidate?.signals).toEqual(['existing-importance-flag']);
    expect(candidate?.reasons).toEqual([
      '대본에 중요 구간으로 표시되어 있어요.',
    ]);
  });

  it('finds supplied concepts by text and by their source timestamp', () => {
    const concepts: Pick<StudyConcept, 'term' | 'sourceStartMs'>[] = [
      { sourceStartMs: 10_000, term: '역전파' },
      { sourceStartMs: 45_000, term: '손실 함수' },
    ];
    const candidates = generateLocalHighlightCandidates({
      concepts,
      transcript: [
        segment('concept-text', 10_000, '역전파는 오차를 뒤로 전달합니다.'),
        segment('concept-time', 40_000, '값이 작아지는 방향을 찾습니다.'),
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      label: '역전파 핵심 설명',
      matchedConcepts: ['역전파'],
      timestampMs: 10_000,
    });
    expect(candidates[0]?.signals).toContain('concept-reference');
    expect(candidates[0]?.reasons.join(' ')).toContain('직접 등장');
    expect(candidates[1]).toMatchObject({
      label: '손실 함수 핵심 설명',
      matchedConcepts: ['손실 함수'],
      timestampMs: 40_000,
    });
    expect(candidates[1]?.reasons.join(' ')).toContain('근거 시점');
  });

  it('uses repeated meaningful terms as a weaker local clue', () => {
    const candidates = generateLocalHighlightCandidates({
      transcript: [
        segment('repeat-1', 5_000, '역전파는 출력 오차를 전달합니다.'),
        segment('repeat-2', 35_000, '역전파를 적용해 가중치를 갱신합니다.'),
        segment('noise', 65_000, '다음 예시로 넘어가겠습니다.'),
      ],
    });

    expect(candidates.map((candidate) => candidate.segmentId)).toEqual([
      'repeat-1',
      'repeat-2',
    ]);
    candidates.forEach((candidate) => {
      expect(candidate.signals).toContain('repetition');
      expect(candidate.repeatedTerms).toContain('역전파');
      expect(candidate.reasons.join(' ')).toContain('여러 대본 구간');
      expect(candidate.confidence).toBe(0.4);
    });
  });

  it('detects definition language and leaves ordinary filler unmarked', () => {
    const candidates = generateLocalHighlightCandidates({
      transcript: [
        segment('definition', 10_000, '분류의 의미는 범주를 예측하는 것입니다.'),
        segment('ordinary', 30_000, '잠시 뒤에 다음 화면을 보겠습니다.'),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      label: '개념 정의',
      segmentId: 'definition',
    });
    expect(candidates[0]?.signals).toContain('definition-language');
  });

  it('selects top scores before returning the requested number in time order', () => {
    const transcript = [
      segment('early-low', 1_000, '다시 말하면 같은 조건입니다.'),
      segment('middle-high', 20_000, '시험에 나오는 중요한 핵심입니다.', {
        isImportant: true,
      }),
      segment('late-high', 40_000, '이것은 시험에 나옵니다.'),
    ];

    const candidates = generateLocalHighlightCandidates({
      maxCandidates: 2,
      transcript,
    });

    expect(candidates.map((candidate) => candidate.segmentId)).toEqual([
      'middle-high',
      'late-high',
    ]);
    expect(transcript.map((item) => item.id)).toEqual([
      'early-low',
      'middle-high',
      'late-high',
    ]);
  });

  it('supports threshold and material-shaped convenience input', () => {
    const transcript = [segment('core', 10_000, '핵심은 분류 기준입니다.')];
    const strict = generateLocalHighlightCandidates({
      minimumConfidence: 0.95,
      transcript,
    });
    const fromMaterial = generateLocalHighlightsForMaterial({
      note: undefined,
      transcript,
    });

    expect(strict).toEqual([]);
    expect(fromMaterial).toHaveLength(1);
    expect(
      generateLocalHighlightCandidates({ maxCandidates: 0, transcript }),
    ).toEqual([]);
  });
});
