import {
  countHighlighted,
  filterHighlighted,
  highlightKey,
  highlightedSentences,
  isHighlighted,
  paintableParts,
  sourceSentences,
  splitSentences,
  toggleHighlight,
} from './highlights';
import type { StudyMaterial } from '@/types';

describe('sentence splitting', () => {
  it('splits Korean prose on its terminators and trims every piece', () => {
    expect(
      splitSentences(
        '지도학습은 정답이 있는 데이터를 씁니다. 분류는 범주를 예측해요!  회귀는 수치를 예측할까요?',
      ),
    ).toEqual([
      '지도학습은 정답이 있는 데이터를 씁니다.',
      '분류는 범주를 예측해요!',
      '회귀는 수치를 예측할까요?',
    ]);
  });

  it('keeps a decimal and an abbreviation inside one sentence', () => {
    expect(splitSentences('정확도는 0.95 였어요. F1.score도 같이 봐요.')).toEqual([
      '정확도는 0.95 였어요.',
      'F1.score도 같이 봐요.',
    ]);
  });

  it('keeps a run of punctuation and a closing quote with its sentence', () => {
    expect(splitSentences('정말요?! 네, "맞아요." 그다음으로 갈게요.')).toEqual([
      '정말요?!',
      '네, "맞아요."',
      '그다음으로 갈게요.',
    ]);
  });

  it('returns the tail of prose that never ends in a terminator', () => {
    expect(splitSentences('마무리 없이 끝나는 문장')).toEqual(['마무리 없이 끝나는 문장']);
    expect(splitSentences('   ')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
  });
});

describe('highlight toggling', () => {
  const sentence = '과적합은 훈련 데이터에만 맞춘 상태예요.';

  it('paints on the first toggle and wipes on the next', () => {
    const once = toggleHighlight([], sentence);
    expect(once).toEqual([sentence]);
    expect(toggleHighlight(once, sentence)).toEqual([]);
  });

  it('keeps earlier highlights and appends the newest', () => {
    expect(toggleHighlight(['첫 문장.'], sentence)).toEqual(['첫 문장.', sentence]);
  });

  it('does not mutate the stored list', () => {
    const stored = [sentence];
    toggleHighlight(stored, '다른 문장.');
    toggleHighlight(stored, sentence);
    expect(stored).toEqual([sentence]);
  });

  it('ignores a blank sentence', () => {
    expect(toggleHighlight([sentence], '   ')).toEqual([sentence]);
    expect(toggleHighlight([], '')).toEqual([]);
  });

  it('matches a sentence whose whitespace was re-wrapped', () => {
    const stored = toggleHighlight([], '분류는  범주를\n예측해요.');
    expect(stored).toEqual(['분류는 범주를 예측해요.']);
    expect(isHighlighted(stored, '분류는 범주를   예측해요.')).toBe(true);
    expect(toggleHighlight(stored, '분류는 범주를 예측해요.')).toEqual([]);
  });

  it('reports a sentence that was never painted as clean', () => {
    expect(isHighlighted([], sentence)).toBe(false);
    expect(isHighlighted([sentence], '다른 문장.')).toBe(false);
    expect(isHighlighted([sentence], '  ')).toBe(false);
  });

  it('stores the collapsed form of a sentence', () => {
    expect(highlightKey('  두 칸  띄운   문장. ')).toBe('두 칸 띄운 문장.');
  });
});

describe('filtering to the highlighted sentences', () => {
  const sentences = ['첫 문장.', '둘째 문장.', '셋째 문장.', '둘째 문장.'];

  it('returns the painted sentences in reading order, not in tap order', () => {
    expect(filterHighlighted(sentences, ['셋째 문장.', '첫 문장.'])).toEqual([
      '첫 문장.',
      '셋째 문장.',
    ]);
  });

  it('collapses a sentence that appears twice in the source', () => {
    expect(filterHighlighted(sentences, ['둘째 문장.'])).toEqual(['둘째 문장.']);
  });

  it('drops a highlight whose sentence the summary no longer has', () => {
    expect(filterHighlighted(sentences, ['예전 요약의 문장.'])).toEqual([]);
    expect(countHighlighted(sentences, ['예전 요약의 문장.', '첫 문장.'])).toBe(1);
  });

  it('counts nothing when the learner has painted nothing', () => {
    expect(countHighlighted(sentences, [])).toBe(0);
    expect(filterHighlighted([], ['첫 문장.'])).toEqual([]);
  });
});

describe('sentences with their source', () => {
  const parts = [
    { text: '요약 첫 문장. 요약 둘째 문장.', startMs: null },
    { text: '대본 문장.', startMs: 12_000 },
    { text: '시간을 모르는 문장.' },
  ];

  it('keeps each sentence with the moment its block started at', () => {
    expect(sourceSentences(parts)).toEqual([
      { sentence: '요약 첫 문장.', startMs: null },
      { sentence: '요약 둘째 문장.', startMs: null },
      { sentence: '대본 문장.', startMs: 12_000 },
      { sentence: '시간을 모르는 문장.', startMs: null },
    ]);
  });

  it('returns the painted ones in reading order, not in tap order', () => {
    expect(highlightedSentences(parts, ['대본 문장.', '요약 첫 문장.'])).toEqual([
      { sentence: '요약 첫 문장.', startMs: null },
      { sentence: '대본 문장.', startMs: 12_000 },
    ]);
  });

  it('keeps a sentence the 요약 and the 대본 both hold only once', () => {
    const repeated = [
      { text: '같은 문장이에요.', startMs: null },
      { text: '같은 문장이에요.', startMs: 30_000 },
    ];
    expect(highlightedSentences(repeated, ['같은 문장이에요.'])).toEqual([
      { sentence: '같은 문장이에요.', startMs: null },
    ]);
  });

  it('drops a highlight the material no longer holds', () => {
    expect(highlightedSentences(parts, ['예전 요약의 문장.'])).toEqual([]);
    expect(highlightedSentences([], ['요약 첫 문장.'])).toEqual([]);
  });
});

describe('the blocks the 형광펜 can reach', () => {
  const material = {
    note: { summary: '요약 문장.' },
    outline: [{ heading: '첫 절', startMs: 5_000, body: '자세히 문장.' }],
    transcript: [{ id: 's1', startMs: 9_000, endMs: 10_000, text: '대본 문장.' }],
  } as unknown as StudyMaterial;

  it('reads 요약, then 자세히, then 대본', () => {
    expect(paintableParts(material)).toEqual([
      { text: '요약 문장.', startMs: null },
      { text: '자세히 문장.', startMs: 5_000 },
      { text: '대본 문장.', startMs: 9_000 },
    ]);
  });

  it('survives a 마인드팩 with no 요약 and no 자세히', () => {
    const bare = { transcript: [] } as unknown as StudyMaterial;
    expect(paintableParts(bare)).toEqual([{ text: '', startMs: null }]);
    expect(highlightedSentences(paintableParts(bare), ['무엇이든.'])).toEqual([]);
  });
});
