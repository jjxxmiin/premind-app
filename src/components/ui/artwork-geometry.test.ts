import {
  MAX_PROGRESS_SEGMENTS,
  arcDash,
  barHeights,
  clamp01,
  polarPoint,
  railFill,
  ratioOf,
  shouldSegment,
  stageRatio,
  waveformBars,
} from './artwork-geometry';

describe('clamp01', () => {
  it('keeps a value inside 0 and 1', () => {
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9)).toBe(1);
  });

  it('reads a broken number as zero rather than drawing NaN', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('ratioOf', () => {
  it('divides by the maximum', () => {
    expect(ratioOf(30, 120)).toBe(0.25);
  });

  it('refuses a zero or negative maximum instead of dividing by it', () => {
    expect(ratioOf(5, 0)).toBe(0);
    expect(ratioOf(5, -1)).toBe(0);
  });
});

describe('arcDash', () => {
  it('draws nothing at zero', () => {
    expect(arcDash(0, 100)).toBe('0 100');
  });

  it('draws the whole circle at one', () => {
    expect(arcDash(1, 100)).toBe('100 0');
  });

  it('splits the circumference at the ratio', () => {
    expect(arcDash(0.25, 200)).toBe('50 150');
  });

  it('survives a circumference of zero', () => {
    expect(arcDash(0.5, 0)).toBe('0 0');
  });
});

describe('polarPoint', () => {
  const centre = { x: 50, y: 50 };

  it('starts at twelve o clock', () => {
    const point = polarPoint(centre, 20, 0);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(30);
  });

  it('turns clockwise', () => {
    const right = polarPoint(centre, 20, 90);
    expect(right.x).toBeCloseTo(70);
    expect(right.y).toBeCloseTo(50);

    const bottom = polarPoint(centre, 20, 180);
    expect(bottom.x).toBeCloseTo(50);
    expect(bottom.y).toBeCloseTo(70);
  });
});

describe('waveformBars', () => {
  it('returns one fraction per bar', () => {
    expect(waveformBars(7)).toHaveLength(7);
  });

  it('is deterministic, so the artwork never flickers between renders', () => {
    expect(waveformBars(9)).toEqual(waveformBars(9));
  });

  it('keeps every bar between the floor and the full height', () => {
    for (const height of waveformBars(24, 0.3)) {
      expect(height).toBeGreaterThanOrEqual(0.3);
      expect(height).toBeLessThanOrEqual(1);
    }
  });

  it('varies, so the shape reads as a voice and not as a block', () => {
    const bars = waveformBars(8);
    expect(new Set(bars.map((bar) => bar.toFixed(3))).size).toBeGreaterThan(4);
  });

  it('handles a count of zero', () => {
    expect(waveformBars(0)).toEqual([]);
  });
});

describe('barHeights', () => {
  it('gives the tallest value the full height', () => {
    expect(barHeights([1, 4, 2], 34, 4)).toEqual([11.5, 34, 19]);
  });

  it('draws an empty day as the minimum stub', () => {
    expect(barHeights([0, 0, 3], 30, 6)).toEqual([6, 6, 30]);
  });

  it('draws every bar as a stub when nothing happened', () => {
    expect(barHeights([0, 0, 0], 30, 6)).toEqual([6, 6, 6]);
  });
});

describe('railFill', () => {
  it('fills a finished segment', () => {
    expect(railFill(0, 2, 0.1)).toBe(1);
  });

  it('leaves a segment ahead of the work empty', () => {
    expect(railFill(2, 1, 0.9)).toBe(0);
  });

  it('moves only the segment the work is inside of', () => {
    expect(railFill(1, 1, 0.4)).toBe(0.4);
  });
});

describe('stageRatio', () => {
  it('maps the overall percentage into the current stage', () => {
    expect(stageRatio(0.5, 1, 3)).toBeCloseTo(0.5);
    expect(stageRatio(0.5, 0, 3)).toBe(1);
    expect(stageRatio(0.5, 2, 3)).toBe(0);
  });

  it('never overtakes the stage the status reports', () => {
    expect(stageRatio(0.99, 0, 3)).toBe(1);
    expect(stageRatio(0, 2, 3)).toBe(0);
  });

  it('treats a single stage as the whole bar', () => {
    expect(stageRatio(0.33, 0, 1)).toBeCloseTo(0.33);
    expect(stageRatio(0.33, 0, 0)).toBeCloseTo(0.33);
  });
});

describe('shouldSegment', () => {
  it('segments a normal question set', () => {
    expect(shouldSegment(5)).toBe(true);
    expect(shouldSegment(MAX_PROGRESS_SEGMENTS)).toBe(true);
  });

  it('falls back to a plain bar for a set that would be hairlines', () => {
    expect(shouldSegment(MAX_PROGRESS_SEGMENTS + 1)).toBe(false);
  });

  it('does not segment a single question', () => {
    expect(shouldSegment(1)).toBe(false);
    expect(shouldSegment(0)).toBe(false);
  });
});
