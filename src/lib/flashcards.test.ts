import {
  MIN_DECK_SIZE,
  SWIPE_THRESHOLD,
  buildDeck,
  conceptCards,
  emptyProgress,
  hideTerm,
  highlightCards,
  highlightCue,
  keyPointCards,
  keyPointCue,
  markCard,
  orderCards,
  pickCards,
  progressLabel,
  progressPercent,
  sessionResult,
  swipeVerdict,
  type Flashcard,
} from './flashcards';
import type { StudyConcept, StudyNote } from '@/types';

function concept(id: string, term: string, description = `${term}의 뜻`): StudyConcept {
  return { id, term, description, sourceStartMs: 1_000, difficulty: 'basic' };
}

function note(overrides: Partial<StudyNote> = {}): StudyNote {
  return {
    summary: '요약',
    keyPoints: [],
    concepts: [],
    estimatedReviewMinutes: 5,
    teacherVerified: false,
    updatedAt: '2026-09-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('deck building', () => {
  it('turns each concept into a term card that keeps its timestamp', () => {
    const cards = conceptCards(note({ concepts: [concept('c1', '과적합')] }));
    expect(cards).toEqual([
      {
        id: 'concept:c1',
        front: '과적합',
        back: '과적합의 뜻',
        origin: 'concept',
        sourceStartMs: 1_000,
        difficulty: 'basic',
      },
    ]);
  });

  it('drops a concept with no term or no meaning rather than showing a blank face', () => {
    const cards = conceptCards(
      note({
        concepts: [concept('c1', '  ', '뜻은 있어요'), concept('c2', '재현율', '   ')],
      }),
    );
    expect(cards).toEqual([]);
  });

  it('fills a thin deck out with 꼭 기억할 내용', () => {
    const deck = buildDeck(
      note({
        concepts: [concept('c1', '지도학습')],
        keyPoints: ['분류는 범주를 예측한다.', '회귀는 연속값을 예측한다.'],
      }),
    );
    expect(deck.map((card) => card.origin)).toEqual(['concept', 'keyPoint', 'keyPoint']);
    expect(deck[1]?.back).toBe('분류는 범주를 예측한다.');
  });

  it('leaves a full deck to its concepts alone', () => {
    const concepts = Array.from({ length: MIN_DECK_SIZE }, (_unused, index) =>
      concept(`c${index}`, `개념${index}`),
    );
    const deck = buildDeck(note({ concepts, keyPoints: ['핵심 내용이 하나 있어요.'] }));
    expect(deck).toHaveLength(MIN_DECK_SIZE);
    expect(deck.every((card) => card.origin === 'concept')).toBe(true);
  });

  it('does not repeat a key point that only restates a concept', () => {
    const deck = buildDeck(
      note({
        concepts: [concept('c1', '과적합', '훈련 데이터에만 잘 맞는 상태')],
        keyPoints: ['훈련 데이터에만 잘 맞는 상태.', '검증 데이터를 따로 둔다.'],
      }),
    );
    expect(deck.map((card) => card.back)).toEqual([
      '훈련 데이터에만 잘 맞는 상태',
      '검증 데이터를 따로 둔다.',
    ]);
  });

  it('is empty when the 마인드팩 has nothing to make a card from', () => {
    expect(buildDeck(undefined)).toEqual([]);
    expect(buildDeck(note())).toEqual([]);
  });
});

describe('key point cues', () => {
  it('hides the second half so the front is not the answer', () => {
    expect(keyPointCue('훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다.')).toBe(
      '훈련 데이터와 검증 데이터를 …',
    );
  });

  it('refuses a line too short to hide anything', () => {
    expect(keyPointCue('과적합')).toBeNull();
    expect(keyPointCue('   ')).toBeNull();
    expect(keyPointCards(note({ keyPoints: ['과적합'] }))).toEqual([]);
  });
});

describe('ordering across passes', () => {
  const deck: Flashcard[] = [
    { id: 'a', front: 'A', back: 'a', origin: 'concept', sourceStartMs: 0 },
    { id: 'b', front: 'B', back: 'b', origin: 'concept', sourceStartMs: 0 },
    { id: 'c', front: 'C', back: 'c', origin: 'concept', sourceStartMs: 0 },
  ];

  it('gives a fresh session the whole deck in order', () => {
    expect(orderCards(deck, emptyProgress()).map((card) => card.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts what is still unseen ahead of the 다시 볼래요 pile', () => {
    const progress = markCard(emptyProgress(), 'a', 'again');
    expect(orderCards(deck, progress).map((card) => card.id)).toEqual(['b', 'c', 'a']);
  });

  it('leaves only the flagged cards once the pass is done', () => {
    let progress = markCard(emptyProgress(), 'a', 'known');
    progress = markCard(progress, 'b', 'again');
    progress = markCard(progress, 'c', 'again');
    expect(orderCards(deck, progress).map((card) => card.id)).toEqual(['b', 'c']);
  });

  it('keeps a card in one pile only, newest verdict winning', () => {
    let progress = markCard(emptyProgress(), 'a', 'again');
    progress = markCard(progress, 'a', 'known');
    expect(progress).toEqual({ known: ['a'], again: [] });
    expect(orderCards(deck, progress).map((card) => card.id)).toEqual(['b', 'c']);
  });

  it('does not mutate the progress it was handed', () => {
    const progress = emptyProgress();
    markCard(progress, 'a', 'known');
    expect(progress).toEqual({ known: [], again: [] });
  });

  it('picks a pass by id, in the order given, ignoring ids the deck lost', () => {
    expect(pickCards(deck, ['c', 'a', 'gone']).map((card) => card.id)).toEqual(['c', 'a']);
  });
});

describe('swiping a card away', () => {
  it('reads right as 알아요 and left as 다시 볼래요', () => {
    expect(swipeVerdict(120)).toBe('known');
    expect(swipeVerdict(-120)).toBe('again');
  });

  it('ignores a nudge that never cleared the threshold', () => {
    expect(swipeVerdict(SWIPE_THRESHOLD - 1)).toBeNull();
    expect(swipeVerdict(-(SWIPE_THRESHOLD - 1))).toBeNull();
    expect(swipeVerdict(0)).toBeNull();
    expect(swipeVerdict(Number.NaN)).toBeNull();
  });
});

describe('progress maths', () => {
  it('counts from one and stops at the last card', () => {
    expect(progressLabel(0, 12)).toBe('1 / 12');
    expect(progressLabel(2, 12)).toBe('3 / 12');
    expect(progressLabel(20, 12)).toBe('12 / 12');
    expect(progressLabel(0, 0)).toBe('0 / 0');
  });

  it('fills the line by cards left behind, not by the card on screen', () => {
    expect(progressPercent(0, 4)).toBe(0);
    expect(progressPercent(2, 4)).toBe(50);
    expect(progressPercent(4, 4)).toBe(100);
    expect(progressPercent(1, 0)).toBe(0);
  });
});

describe('the end of a pass', () => {
  const deck: Flashcard[] = [
    { id: 'a', front: 'A', back: 'a', origin: 'concept', sourceStartMs: 0 },
    { id: 'b', front: 'B', back: 'b', origin: 'concept', sourceStartMs: 0 },
    { id: 'c', front: 'C', back: 'c', origin: 'concept', sourceStartMs: 0 },
  ];

  it('reports what the learner just did', () => {
    let progress = markCard(emptyProgress(), 'a', 'known');
    progress = markCard(progress, 'b', 'again');
    progress = markCard(progress, 'c', 'known');
    expect(sessionResult(deck, progress)).toEqual({
      total: 3,
      knownCount: 2,
      againCount: 1,
      headline: '3개 중 2개를 알아요',
      reviewIds: ['b'],
    });
  });

  it('counts the review pass, not the deck it came from', () => {
    const review = pickCards(deck, ['b']);
    const progress = markCard(emptyProgress(), 'b', 'known');
    expect(sessionResult(review, progress)).toMatchObject({
      total: 1,
      knownCount: 1,
      headline: '1개 중 1개를 알아요',
      reviewIds: [],
    });
  });

  it('ignores verdicts left over from a card this pass never showed', () => {
    const review = pickCards(deck, ['c']);
    let progress = markCard(emptyProgress(), 'a', 'known');
    progress = markCard(progress, 'c', 'again');
    expect(sessionResult(review, progress)).toEqual({
      total: 1,
      knownCount: 0,
      againCount: 1,
      headline: '1개 중 0개를 알아요',
      reviewIds: ['c'],
    });
  });
});

describe('cards made from the 형광펜', () => {
  const terms = ['지도학습', '학습'];

  it('hides the key term the 마인드팩 knows, longest match first', () => {
    expect(hideTerm('지도학습은 정답을 함께 배워요.', terms)).toBe(
      '____은 정답을 함께 배워요.',
    );
  });

  it('hides every occurrence of the term in the sentence', () => {
    expect(hideTerm('과적합은 과적합대로 문제예요.', ['과적합'])).toBe(
      '____은 ____대로 문제예요.',
    );
  });

  it('refuses to hide a term that would leave nothing to recall from', () => {
    expect(hideTerm('지도학습.', terms)).toBeNull();
    expect(hideTerm('회귀는 수치를 예측해요.', terms)).toBeNull();
    expect(hideTerm('   ', terms)).toBeNull();
  });

  it('falls back to the opening half when no term is in the sentence', () => {
    expect(highlightCue('회귀는 연속된 수치를 예측해요.', terms)).toBe('회귀는 연속된 …');
  });

  it('turns a painted sentence into a card that keeps its moment', () => {
    expect(
      highlightCards([{ sentence: '지도학습은 정답을 함께 배워요.', startMs: 402_000 }], terms),
    ).toEqual([
      {
        id: 'highlight:지도학습은정답을함께배워요',
        front: '____은 정답을 함께 배워요.',
        back: '지도학습은 정답을 함께 배워요.',
        origin: 'highlight',
        sourceStartMs: 402_000,
      },
    ]);
  });

  it('keeps one card for a sentence painted in two places', () => {
    const cards = highlightCards(
      [
        { sentence: '같은 문장이에요.', startMs: null },
        { sentence: '같은  문장이에요.', startMs: 900 },
      ],
      terms,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.sourceStartMs).toBeNull();
  });

  it('drops a painted fragment too short to make a card', () => {
    expect(highlightCards([{ sentence: '네.', startMs: 0 }], terms)).toEqual([]);
  });

  it('adds the strokes to the deck without waiting for it to be thin', () => {
    const concepts = Array.from({ length: MIN_DECK_SIZE }, (_unused, index) =>
      concept(`c${index}`, `개념${index}`),
    );
    const deck = buildDeck(note({ concepts }), [
      { sentence: '내가 칠한 문장이에요.', startMs: 1_000 },
    ]);
    expect(deck).toHaveLength(MIN_DECK_SIZE + 1);
    expect(deck[deck.length - 1]?.origin).toBe('highlight');
  });

  it('does not repeat a stroke that only restates a concept', () => {
    const deck = buildDeck(
      note({ concepts: [concept('c1', '과적합', '훈련 데이터에만 잘 맞는 상태')] }),
      [{ sentence: '훈련 데이터에만 잘 맞는 상태', startMs: 10 }],
    );
    expect(deck.map((card) => card.origin)).toEqual(['concept']);
  });

  it('makes a deck from strokes alone when the 마인드팩 has no concepts', () => {
    const deck = buildDeck(note(), [
      { sentence: '분류는 범주를 예측해요.', startMs: 751_000 },
    ]);
    expect(deck.map((card) => card.back)).toEqual(['분류는 범주를 예측해요.']);
    expect(deck[0]?.sourceStartMs).toBe(751_000);
  });
});
