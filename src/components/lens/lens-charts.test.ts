import type { LensMoment } from '@/types';

import {
  SCORE_BAND_EDGES,
  balanceSegments,
  bandTrack,
  clampScore,
  densityColumns,
  densityHalves,
  densitySide,
  formatDelta,
  gaugeLayout,
  momentDensity,
  momentMarks,
  pointsAttr,
  radarGrid,
  radarLabel,
  radarPolygon,
  ringDash,
  rubricComparison,
  rubricMovers,
  scoreBarPercent,
  scoreDelta,
  sparklinePoints,
  verdictFor,
} from './lens-charts';

const moment = (sourceStartMs: number, text = `근거 ${sourceStartMs}`): LensMoment => ({
  text,
  sourceStartMs,
});

describe('score ring', () => {
  it('fills the ring in proportion to the score and clamps out-of-range values', () => {
    expect(ringDash(2.5, 100)).toBe('50 100');
    expect(ringDash(7, 100)).toBe('100 100');
    expect(ringDash(-1, 100)).toBe('0 100');
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it('prints one word per band', () => {
    expect(verdictFor(4.5)).toBe('아주 좋아요');
    expect(verdictFor(4.1)).toBe('좋아요');
    expect(verdictFor(2.5)).toBe('보통이에요');
    expect(verdictFor(1.9)).toBe('아쉬워요');
  });
});

describe('radar geometry', () => {
  it('starts at the top and walks clockwise, scaling each vertex by its score', () => {
    const points = radarPolygon([5, 2.5, 0, 5], 100, 100, 80);
    expect(points[0]).toEqual({ x: expect.closeTo(100, 6), y: expect.closeTo(20, 6) });
    expect(points[1]).toEqual({ x: expect.closeTo(140, 6), y: expect.closeTo(100, 6) });
    expect(points[2]).toEqual({ x: expect.closeTo(100, 6), y: expect.closeTo(100, 6) });
    expect(points[3]).toEqual({ x: expect.closeTo(20, 6), y: expect.closeTo(100, 6) });
  });

  it('keeps every vertex inside the outer ring', () => {
    const outer = radarGrid(5, 120, 120, 90, 4).at(-1) ?? [];
    expect(outer).toHaveLength(5);
    for (const point of radarPolygon([4.3, 4.1, 3.8, 4, 5], 120, 120, 90)) {
      const distance = Math.hypot(point.x - 120, point.y - 120);
      expect(distance).toBeLessThanOrEqual(90 + 1e-9);
    }
  });

  it('anchors labels away from the chart', () => {
    expect(radarLabel(100, 100, 80, 0, 4, 10, 12).textAnchor).toBe('middle');
    expect(radarLabel(100, 100, 80, 1, 4, 10, 12).textAnchor).toBe('start');
    expect(radarLabel(100, 100, 80, 3, 4, 10, 12).textAnchor).toBe('end');
    expect(radarLabel(100, 100, 80, 0, 4, 10, 12).y).toBeLessThan(20);
    expect(radarLabel(100, 100, 80, 2, 4, 10, 12).y).toBeGreaterThan(180);
  });

  it('serialises points with two decimals', () => {
    expect(pointsAttr([{ x: 1.004, y: 2.5 }, { x: 3, y: 4.126 }])).toBe('1,2.5 3,4.13');
  });
});

describe('rubric band track', () => {
  it('puts the band edges and the marker on the same axis', () => {
    const track = bandTrack(4.3, 100, 20, 10);
    // usable = 80, so an edge at 2.5 of 5 sits at 10 + 40.
    expect(track.separators).toEqual([50, 66, 82]);
    expect(track.markerX).toBeCloseTo(78.8, 6);
    expect(track.fillWidth).toBeCloseTo(68.8, 6);
    // The marker is right of the 3.5 edge and left of the 4.5 one, as its word says.
    expect(track.markerX).toBeGreaterThan(track.separators[1] ?? 0);
    expect(track.markerX).toBeLessThan(track.separators[2] ?? 0);
    expect(track.label.text).toBe('좋아요');
  });

  it('draws every edge the bands actually use', () => {
    expect(SCORE_BAND_EDGES).toEqual([2.5, 3.5, 4.5]);
    for (const edge of SCORE_BAND_EDGES) {
      expect(verdictFor(edge)).not.toBe(verdictFor(edge - 0.1));
    }
  });

  it('keeps the band word inside the drawing at both ends', () => {
    expect(bandTrack(4.9, 100, 20, 10).label).toMatchObject({ textAnchor: 'end', x: 100 });
    expect(bandTrack(0.2, 100, 20, 10).label).toMatchObject({ textAnchor: 'start', x: 0 });
    const middle = bandTrack(2.5, 100, 20, 10);
    expect(middle.label.textAnchor).toBe('middle');
    expect(middle.label.x).toBeCloseTo(middle.markerX, 6);
    expect(middle.label.y).toBe(20);
  });

  it('pins an out-of-range score to the ends of the track', () => {
    expect(bandTrack(9, 100, 20, 10).markerX).toBe(90);
    expect(bandTrack(-2, 100, 20, 10).markerX).toBe(10);
    expect(bandTrack(-2, 100, 20, 10).fillWidth).toBe(0);
  });
});

describe('this evaluation against the last', () => {
  const current = [
    { key: 'structure', label: '구조', score: 4.3 },
    { key: 'clarity', label: '명료성', score: 4.1 },
    { key: 'delivery', label: '전달력', score: 4 },
  ];
  const previous = [
    { key: 'structure', label: '구조', score: 3.4 },
    { key: 'clarity', label: '명료성', score: 4.3 },
    { key: 'humour', label: '유머', score: 5 },
  ];

  it('pairs the items both reports scored and rounds the change', () => {
    const rows = rubricComparison(current, previous);
    expect(rows.map((row) => row.key)).toEqual(['structure', 'clarity']);
    expect(rows.map((row) => row.delta)).toEqual([0.9, -0.2]);
    // 전달력 is new and 유머 is gone, so neither is compared against a zero.
    expect(rows.map((row) => row.previous)).toEqual([3.4, 4.3]);
  });

  it('names the biggest rise and the biggest fall, earlier row winning a tie', () => {
    const rows = rubricComparison(current, previous);
    expect(rubricMovers(rows).improved?.key).toBe('structure');
    expect(rubricMovers(rows).slipped?.key).toBe('clarity');
    const tied = rubricComparison(current, [
      { key: 'structure', label: '구조', score: 3.8 },
      { key: 'clarity', label: '명료성', score: 3.6 },
    ]);
    expect(tied.map((row) => row.delta)).toEqual([0.5, 0.5]);
    expect(rubricMovers(tied).improved?.key).toBe('structure');
    expect(rubricMovers(tied).slipped).toBeNull();
  });

  it('has no movers when nothing moved', () => {
    expect(rubricMovers(rubricComparison(current, current))).toEqual({
      improved: null,
      slipped: null,
    });
    expect(rubricComparison(current, [])).toEqual([]);
  });

  it('fills a paired bar to the score, clamped to the scale', () => {
    expect(scoreBarPercent(4.3)).toBe('86%');
    expect(scoreBarPercent(3.4)).toBe('68%');
    expect(scoreBarPercent(0)).toBe('0%');
    expect(scoreBarPercent(9)).toBe('100%');
  });
});

describe('speech gauges', () => {
  const pace = { min: 120, max: 460, healthyMin: 220, healthyMax: 360, ticks: [120, 220, 360, 460] };

  it('places the needle and the healthy shading on the stated scale', () => {
    const gauge = gaugeLayout(312, pace, 100);
    expect(gauge.needleX).toBeCloseTo(((312 - 120) / 340) * 100, 6);
    expect(gauge.clamped).toBe(false);
    expect(gauge.healthy.x).toBeCloseTo(((220 - 120) / 340) * 100, 6);
    expect(gauge.healthy.width).toBeCloseTo(((360 - 220) / 340) * 100, 6);
    expect(gauge.ticks.map((tick) => tick.value)).toEqual([120, 220, 360, 460]);
    expect(gauge.ticks[0]?.x).toBe(0);
    expect(gauge.ticks.at(-1)?.x).toBe(100);
  });

  it('honours the inset so the needle never leaves the drawing', () => {
    const low = gaugeLayout(0, pace, 100, 6);
    const high = gaugeLayout(900, pace, 100, 6);
    expect(low.needleX).toBe(6);
    expect(high.needleX).toBe(94);
    expect(low.clamped).toBe(true);
    expect(high.clamped).toBe(true);
    expect(gaugeLayout(220, pace, 100, 6).needleX).toBeCloseTo(6 + (100 / 340) * 88, 6);
  });

  it('anchors the end numbers inwards', () => {
    expect(gaugeLayout(312, pace, 100).ticks.map((tick) => tick.textAnchor)).toEqual([
      'start',
      'middle',
      'middle',
      'end',
    ]);
  });

  it('survives a scale with no span and a value that is not a number', () => {
    const flat = { min: 3, max: 3, healthyMin: 3, healthyMax: 3, ticks: [3] };
    expect(gaugeLayout(3, flat, 100).needleX).toBe(50);
    expect(gaugeLayout(Number.NaN, pace, 100).needleX).toBe(0);
  });
});

describe('evidence density', () => {
  const strengths = [moment(402_000), moment(751_000)];
  const improvements = [moment(2_238_000)];

  it('buckets both lists over the lecture length', () => {
    const density = momentDensity(strengths, improvements, 3_134_000, 6);
    expect(density?.scale).toBe('duration');
    expect(density?.spanMs).toBe(3_134_000);
    expect(density?.peak).toBe(1);
    expect(density?.buckets.map((bucket) => bucket.strengths)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(density?.buckets.map((bucket) => bucket.improvements)).toEqual([0, 0, 0, 0, 1, 0]);
    expect(density?.buckets[0]).toMatchObject({ index: 0, startMs: 0 });
    expect(density?.buckets.at(-1)?.endMs).toBe(3_134_000);
  });

  it('ends at the last moment when the length is unknown, and keeps the end inside', () => {
    const density = momentDensity([moment(1_000)], [moment(60_000)], undefined, 6);
    expect(density?.scale).toBe('last-moment');
    expect(density?.spanMs).toBe(60_000);
    // The moment sitting exactly on the end belongs to the last bucket.
    expect(density?.buckets.at(-1)?.improvements).toBe(1);
    expect(density?.buckets[0]?.strengths).toBe(1);
  });

  it('draws nothing rather than inventing a spread without timestamps', () => {
    expect(momentDensity([moment(0)], [moment(0)], 3_134_000)).toBeNull();
    expect(momentDensity([], [], 3_134_000)).toBeNull();
  });

  it('splits the strip into equal columns with a gap', () => {
    expect(densityColumns(4, 100, 4)).toEqual([
      { x: 0, width: 21 },
      { x: 25, width: 21 },
      { x: 50, width: 21 },
      { x: 75, width: 21 },
    ]);
    expect(densityColumns(50, 100, 4).at(-1)).toEqual({ x: 98, width: 1 });
    expect(densityColumns(0, 100)).toEqual([]);
    expect(densityColumns(4, 0)).toEqual([]);
  });

  it('reads the halves without letting a middle bucket decide', () => {
    const density = momentDensity(strengths, improvements, 3_134_000, 6);
    expect(density).not.toBeNull();
    const halves = densityHalves(density!);
    expect(halves.first).toEqual({ strengths: 2, improvements: 0 });
    expect(halves.second).toEqual({ strengths: 0, improvements: 1 });
    expect(densitySide(halves.first.strengths, halves.second.strengths)).toBe('front');
    expect(densitySide(halves.first.improvements, halves.second.improvements)).toBe('back');

    const odd = momentDensity(strengths, improvements, 3_134_000, 5);
    expect(odd).not.toBeNull();
    const oddHalves = densityHalves(odd!);
    // Five buckets: the middle one is neither half, so it never tips the reading.
    expect(oddHalves.first).toEqual({ strengths: 2, improvements: 0 });
    expect(oddHalves.second).toEqual({ strengths: 0, improvements: 1 });
  });

  it('names a mixed or empty spread honestly', () => {
    expect(densitySide(1, 1)).toBe('spread');
    expect(densitySide(0, 0)).toBe('none');
  });
});

describe('moment marks', () => {
  const strengths = [moment(402_000), moment(751_000)];
  const improvements = [moment(2_238_000)];

  it('scales by the lecture length and flags the priority moment', () => {
    const result = momentMarks(strengths, improvements, improvements[0] ?? null, 3_134_000, 300);
    expect(result.scale).toBe('duration');
    expect(result.spanMs).toBe(3_134_000);
    expect(result.marks.map((mark) => mark.kind)).toEqual(['strength', 'strength', 'improvement']);
    expect(result.marks[0]?.x).toBeCloseTo((402_000 / 3_134_000) * 300, 6);
    expect(result.marks[2]?.priority).toBe(true);
    expect(result.marks[0]?.priority).toBe(false);
  });

  it('treats a reworded priority at the same second as that moment', () => {
    const reworded = moment(2_238_400, '먼저 고칠 것으로 다시 쓴 문장');
    const result = momentMarks(strengths, improvements, reworded, 3_134_000, 300);
    expect(result.marks.filter((mark) => mark.priority).map((mark) => mark.kind)).toEqual([
      'improvement',
    ]);
  });

  it('honours the inset and sorts by time across both lists', () => {
    const result = momentMarks([moment(2_000_000)], [moment(1_000_000)], null, 2_000_000, 100, 10);
    expect(result.marks.map((mark) => mark.kind)).toEqual(['improvement', 'strength']);
    expect(result.marks[0]?.x).toBe(50);
    expect(result.marks[1]?.x).toBe(90);
  });

  it('falls back to the last moment when the length is unknown or too short', () => {
    expect(momentMarks(strengths, improvements, null, undefined, 300).scale).toBe('last-moment');
    const short = momentMarks(strengths, improvements, null, 1_000, 300);
    expect(short.scale).toBe('last-moment');
    expect(short.spanMs).toBe(2_238_000);
    expect(short.marks.at(-1)?.x).toBe(300);
  });

  it('spreads untimed moments evenly and says so', () => {
    const result = momentMarks([moment(0), moment(0)], [moment(0)], null, 3_000_000, 200);
    expect(result.scale).toBe('even');
    expect(result.marks.map((mark) => mark.x)).toEqual([0, 100, 200]);
    expect(momentMarks([moment(0)], [], null, undefined, 200).marks[0]?.x).toBe(100);
    expect(momentMarks([], [], null, undefined, 200).marks).toEqual([]);
  });
});

describe('score trend', () => {
  it('maps the series across the width with the highest score at the top', () => {
    const points = sparklinePoints([3, 4, 5], 100, 40);
    expect(points.map((point) => point.x)).toEqual([0, 50, 100]);
    expect(points[0]?.y).toBe(40);
    expect(points[2]?.y).toBe(0);
    expect(points[1]?.y).toBe(20);
  });

  it('keeps a flat or single series visible in the middle', () => {
    expect(sparklinePoints([4, 4], 100, 40)).toEqual([
      { x: 0, y: 20 },
      { x: 100, y: 20 },
    ]);
    expect(sparklinePoints([4.2], 100, 40, 4)).toEqual([{ x: 50, y: 20 }]);
    expect(sparklinePoints([], 100, 40)).toEqual([]);
  });

  it('reports the latest change to one decimal', () => {
    expect(scoreDelta([3.5, 4.1])).toBe(0.6);
    expect(scoreDelta([4.1, 3.8])).toBe(-0.3);
    expect(scoreDelta([4.1])).toBeNull();
    expect(formatDelta(0.6)).toBe('+0.6');
    expect(formatDelta(-0.3)).toBe('-0.3');
    expect(formatDelta(0)).toBe('0');
  });
});

describe('balance strip', () => {
  it('splits the bar by count with a gap between the halves', () => {
    const segments = balanceSegments(2, 1, 302, 2);
    expect(segments.strength).toEqual({ x: 0, width: 200 });
    expect(segments.improvement).toEqual({ x: 202, width: 100 });
  });

  it('gives the whole bar to the only side that has items', () => {
    expect(balanceSegments(0, 3, 100)).toEqual({
      strength: { x: 0, width: 0 },
      improvement: { x: 0, width: 100 },
    });
    expect(balanceSegments(3, 0, 100).strength.width).toBe(100);
    expect(balanceSegments(0, 0, 100).improvement.width).toBe(0);
  });
});
