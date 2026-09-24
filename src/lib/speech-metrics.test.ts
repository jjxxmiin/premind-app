import {
  FILLER_BANDS,
  PACE_BANDS,
  PAUSE_BANDS,
  countCharacters,
  countFillers,
  countLongPauses,
  fillerBand,
  paceBand,
  pauseBand,
  speechMetrics,
  speechScale,
  tokenize,
  type SpeechMetricKey,
} from './speech-metrics';

describe('character counting', () => {
  it('counts letters and digits, never spaces or punctuation', () => {
    expect(countCharacters('안녕하세요, 오늘은 3가지를 다뤄요.')).toBe(15);
    expect(countCharacters('   ')).toBe(0);
    expect(countCharacters('')).toBe(0);
  });
});

describe('filler words', () => {
  it('splits on whitespace and strips punctuation', () => {
    expect(tokenize('음... 그, 저기요 (이제) 시작해요!')).toEqual([
      '음',
      '그',
      '저기요',
      '이제',
      '시작해요',
    ]);
  });

  it('counts only standalone filler tokens', () => {
    expect(countFillers('음, 어 그러니까 그 방법은 약간 달라요. 저기 이제 시작할게요')).toBe(6);
    // "그러니까" and "어제" are words, not fillers.
    expect(countFillers('그러니까 어제 그런 얘기를 했어요')).toBe(0);
  });
});

describe('long pauses', () => {
  it('counts gaps over two seconds between consecutive segments', () => {
    expect(
      countLongPauses([
        { startMs: 0, endMs: 5_000 },
        { startMs: 5_500, endMs: 9_000 },
        { startMs: 12_000, endMs: 15_000 },
        { startMs: 17_001, endMs: 20_000 },
      ]),
    ).toBe(2);
  });

  it('sorts by start time before measuring and ignores a lone segment', () => {
    expect(
      countLongPauses([
        { startMs: 12_000, endMs: 15_000 },
        { startMs: 0, endMs: 5_000 },
      ]),
    ).toBe(1);
    expect(countLongPauses([{ startMs: 0, endMs: 5_000 }])).toBe(0);
    expect(countLongPauses([])).toBe(0);
  });
});

describe('bands', () => {
  it('names pace by characters per minute', () => {
    expect(paceBand(219).band).toBe('느려요');
    expect(paceBand(220).band).toBe('알맞아요');
    expect(paceBand(360).band).toBe('알맞아요');
    expect(paceBand(361).band).toBe('빨라요');
  });

  it('names fillers per minute', () => {
    expect(fillerBand(1.9).band).toBe('적어요');
    expect(fillerBand(2).band).toBe('보통이에요');
    expect(fillerBand(5).band).toBe('보통이에요');
    expect(fillerBand(5.1).band).toBe('많아요');
  });

  it('names long pause counts', () => {
    expect(pauseBand(0).band).toBe('없어요');
    expect(pauseBand(2).band).toBe('괜찮아요');
    expect(pauseBand(3).band).toBe('많아요');
  });
});

describe('gauge scales', () => {
  const keys: SpeechMetricKey[] = ['pace', 'fillers', 'pauses'];

  it('shades exactly the range the bands call fine', () => {
    // The gauge may not flatter a number: the shaded stretch is the band
    // constants themselves.
    expect(speechScale('pace').healthyMin).toBe(PACE_BANDS.slow);
    expect(speechScale('pace').healthyMax).toBe(PACE_BANDS.fast);
    expect(paceBand(speechScale('pace').healthyMin).level).toBe('mid');
    expect(paceBand(speechScale('pace').healthyMax).level).toBe('mid');

    expect(speechScale('fillers').healthyMax).toBe(FILLER_BANDS.many);
    expect(fillerBand(speechScale('fillers').healthyMax).level).not.toBe('high');
    expect(fillerBand(speechScale('fillers').healthyMax + 0.1).level).toBe('high');

    expect(speechScale('pauses').healthyMax).toBe(PAUSE_BANDS.many);
    expect(pauseBand(speechScale('pauses').healthyMax).level).not.toBe('high');
    expect(pauseBand(speechScale('pauses').healthyMax + 1).level).toBe('high');
  });

  it('keeps every window around its bands, with ticks that say the range', () => {
    for (const key of keys) {
      const scale = speechScale(key);
      expect(scale.min).toBeLessThan(scale.max);
      expect(scale.min).toBeLessThanOrEqual(scale.healthyMin);
      expect(scale.healthyMin).toBeLessThan(scale.healthyMax);
      expect(scale.healthyMax).toBeLessThan(scale.max);
      expect(scale.ticks[0]).toBe(scale.min);
      expect(scale.ticks.at(-1)).toBe(scale.max);
      expect(scale.ticks).toContain(scale.healthyMax);
      expect([...scale.ticks].sort((left, right) => left - right)).toEqual(scale.ticks);
      expect(scale.rangeText).not.toContain('·');
    }
  });

  it('starts every window at zero and leaves room above the top band', () => {
    for (const key of keys) {
      const scale = speechScale(key);
      // All three measurements really can be zero, so no needle is ever
      // pinned to a cropped left edge.
      expect(scale.min).toBe(0);
      expect(scale.max - scale.healthyMax).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('speechMetrics', () => {
  it('is null without spoken time', () => {
    expect(speechMetrics([])).toBeNull();
    expect(speechMetrics([{ startMs: 0, endMs: 0, text: '안녕' }])).toBeNull();
  });

  it('measures pace, fillers and pauses over the spoken time only', () => {
    const line = '오늘은 지도학습을 배워요 음 정답이 있는 데이터로 학습해요';
    // 25 characters, 1 filler, per 30 s segment.
    const metrics = speechMetrics([
      { startMs: 0, endMs: 30_000, text: line },
      // A 10 s gap the metric must not count as speaking time.
      { startMs: 40_000, endMs: 70_000, text: line },
    ]);
    expect(metrics).not.toBeNull();
    expect(metrics?.spokenMs).toBe(60_000);
    expect(metrics?.characterCount).toBe(50);
    expect(metrics?.fillerCount).toBe(2);
    expect(metrics?.pace.value).toBe(50);
    expect(metrics?.pace.band).toBe('느려요');
    expect(metrics?.pace.unit).toBe('분당 글자');
    expect(metrics?.fillers.value).toBe(2);
    expect(metrics?.fillers.valueText).toBe('2.0');
    expect(metrics?.fillers.band).toBe('보통이에요');
    expect(metrics?.pauses.value).toBe(1);
    expect(metrics?.pauses.valueText).toBe('1');
    expect(metrics?.pauses.band).toBe('괜찮아요');
    expect(metrics?.pauses.advice).toBe('긴 멈춤은 강조에 써요');
  });
});
