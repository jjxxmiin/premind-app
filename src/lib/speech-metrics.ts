import type { TranscriptSegment } from '../types';

/**
 * 말하기 습관: three numbers a speaker can act on, read straight from the
 * transcript on the device. They complement the server's Lens rubric, which
 * judges content; these judge the mouth.
 */

export type SpeechMetricKey = 'pace' | 'fillers' | 'pauses';

export type SpeechBandLevel = 'low' | 'mid' | 'high';

export interface SpeechMetric {
  key: SpeechMetricKey;
  /** "말 속도", "군말", "긴 멈춤". */
  title: string;
  value: number;
  /** "312", "3.4", "2". */
  valueText: string;
  /** "분당 글자", "분당 회", "번". */
  unit: string;
  level: SpeechBandLevel;
  /** "알맞아요", "많아요"... */
  band: string;
  /** One line of what to do about it. */
  advice: string;
}

export interface SpeechMetrics {
  /** Time actually spent talking, in ms: the sum of the segments. */
  spokenMs: number;
  characterCount: number;
  fillerCount: number;
  pace: SpeechMetric;
  fillers: SpeechMetric;
  pauses: SpeechMetric;
}

/** Characters per minute. Below the first is slow; above the second is fast. */
export const PACE_BANDS = { slow: 220, fast: 360 } as const;
/** Filler words per minute. */
export const FILLER_BANDS = { few: 2, many: 5 } as const;
/** Long pauses: none at all, and the count above which they read as too many. */
export const PAUSE_BANDS = { none: 0, many: 2 } as const;
/** A gap between two segments longer than this is a long pause. */
export const LONG_PAUSE_MS = 2_000;
/** Standalone tokens that are noise rather than words. */
export const FILLER_TOKENS: ReadonlySet<string> = new Set([
  '음',
  '어',
  '그',
  '저기',
  '이제',
  '약간',
]);

/** Letters and digits only, so spaces and punctuation never count as speech. */
export function countCharacters(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

/** Whitespace-separated tokens with surrounding punctuation stripped. */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/u)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0);
}

export function countFillers(text: string): number {
  return tokenize(text).filter((token) => FILLER_TOKENS.has(token)).length;
}

/** Gaps longer than `LONG_PAUSE_MS` between consecutive segments, in start order. */
export function countLongPauses(
  segments: readonly Pick<TranscriptSegment, 'startMs' | 'endMs'>[],
  thresholdMs = LONG_PAUSE_MS,
): number {
  const ordered = [...segments].sort((left, right) => left.startMs - right.startMs);
  let count = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (!current || !previous) continue;
    if (current.startMs - previous.endMs > thresholdMs) count += 1;
  }
  return count;
}

export function paceBand(charactersPerMinute: number): Pick<SpeechMetric, 'level' | 'band' | 'advice'> {
  if (charactersPerMinute < PACE_BANDS.slow) {
    return { level: 'low', band: '느려요', advice: '조금 더 힘 있게 이어가요' };
  }
  if (charactersPerMinute > PACE_BANDS.fast) {
    return { level: 'high', band: '빨라요', advice: '문장 끝에서 한 박자 쉬어요' };
  }
  return { level: 'mid', band: '알맞아요', advice: '지금 속도를 유지해요' };
}

export function fillerBand(fillersPerMinute: number): Pick<SpeechMetric, 'level' | 'band' | 'advice'> {
  if (fillersPerMinute < FILLER_BANDS.few) {
    return { level: 'low', band: '적어요', advice: '군말이 적어 듣기 편해요' };
  }
  if (fillersPerMinute > FILLER_BANDS.many) {
    return { level: 'high', band: '많아요', advice: '말 사이를 침묵으로 채워요' };
  }
  return { level: 'mid', band: '보통이에요', advice: '음, 어 대신 잠깐 멈춰요' };
}

export function pauseBand(longPauses: number): Pick<SpeechMetric, 'level' | 'band' | 'advice'> {
  if (longPauses === PAUSE_BANDS.none) {
    return { level: 'low', band: '없어요', advice: '흐름이 끊기지 않았어요' };
  }
  if (longPauses > PAUSE_BANDS.many) {
    return { level: 'high', band: '많아요', advice: '다음 말을 정해 두고 시작해요' };
  }
  return { level: 'mid', band: '괜찮아요', advice: '긴 멈춤은 강조에 써요' };
}

/**
 * The window a gauge draws for one metric, and the stretch inside it that
 * needs no fixing.
 *
 * The healthy edges are the band constants above, never a range picked to
 * flatter a number: 말 속도 shades 220–360 because that is exactly what
 * `paceBand` calls 알맞아요. Every window starts at zero, which all three
 * measurements really have, and ends well above the top band, so a needle
 * near an edge is near the edge of what is normal rather than the edge of a
 * cropped picture. `ticks` are the numbers printed under the track, so the
 * reader can see the range rather than trust the shading.
 */
export interface SpeechScale {
  min: number;
  max: number;
  healthyMin: number;
  healthyMax: number;
  /** Left to right, always starting at `min` and ending at `max`. */
  ticks: number[];
  /** "분당 120에서 460 글자" — the range, in words, for a screen reader. */
  rangeText: string;
}

export const SPEECH_SCALES: Record<SpeechMetricKey, SpeechScale> = {
  pace: {
    min: 0,
    max: 480,
    healthyMin: PACE_BANDS.slow,
    healthyMax: PACE_BANDS.fast,
    ticks: [0, PACE_BANDS.slow, PACE_BANDS.fast, 480],
    rangeText: '분당 0에서 480 글자',
  },
  fillers: {
    min: 0,
    max: 8,
    // 적어요 and 보통이에요 both read as fine; only 많아요 is a problem.
    healthyMin: 0,
    healthyMax: FILLER_BANDS.many,
    ticks: [0, FILLER_BANDS.few, FILLER_BANDS.many, 8],
    rangeText: '분당 0에서 8회',
  },
  pauses: {
    min: 0,
    max: 6,
    healthyMin: PAUSE_BANDS.none,
    healthyMax: PAUSE_BANDS.many,
    ticks: [0, PAUSE_BANDS.many, 6],
    rangeText: '0에서 6번',
  },
};

export function speechScale(key: SpeechMetricKey): SpeechScale {
  return SPEECH_SCALES[key];
}

/**
 * All three metrics for a transcript, or null when there is nothing spoken
 * to measure (no segments, or segments without any duration).
 */
export function speechMetrics(
  segments: readonly Pick<TranscriptSegment, 'startMs' | 'endMs' | 'text'>[],
): SpeechMetrics | null {
  const spokenMs = segments.reduce(
    (total, segment) => total + Math.max(0, segment.endMs - segment.startMs),
    0,
  );
  if (segments.length === 0 || spokenMs <= 0) return null;
  const minutes = spokenMs / 60_000;
  const characterCount = segments.reduce(
    (total, segment) => total + countCharacters(segment.text),
    0,
  );
  const fillerCount = segments.reduce(
    (total, segment) => total + countFillers(segment.text),
    0,
  );
  const charactersPerMinute = Math.round(characterCount / minutes);
  const fillersPerMinute = Math.round((fillerCount / minutes) * 10) / 10;
  const longPauses = countLongPauses(segments);

  return {
    spokenMs,
    characterCount,
    fillerCount,
    pace: {
      key: 'pace',
      title: '말 속도',
      value: charactersPerMinute,
      valueText: String(charactersPerMinute),
      unit: '분당 글자',
      ...paceBand(charactersPerMinute),
    },
    fillers: {
      key: 'fillers',
      title: '군말',
      value: fillersPerMinute,
      valueText: fillersPerMinute.toFixed(1),
      unit: '분당 회',
      ...fillerBand(fillersPerMinute),
    },
    pauses: {
      key: 'pauses',
      title: '긴 멈춤',
      value: longPauses,
      valueText: String(longPauses),
      unit: '번',
      ...pauseBand(longPauses),
    },
  };
}
