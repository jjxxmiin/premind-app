import type { LensMoment } from '@/types';

/**
 * Layout maths for the 평가 charts. Pure functions only, so the geometry can be
 * unit-tested without rendering: the components in this folder just draw
 * what these return.
 */

export interface Point {
  x: number;
  y: number;
}

/** Lens scores run 0–5 with one decimal. */
export const SCORE_MAX = 5;

export function clampScore(score: number, max = SCORE_MAX): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(max, Math.max(0, score));
}

/** Plain verdict printed under the big ring and next to every rubric number. */
export function verdictFor(overall: number): string {
  if (overall >= 4.5) return '아주 좋아요';
  if (overall >= 3.5) return '좋아요';
  if (overall >= 2.5) return '보통이에요';
  return '아쉬워요';
}

/** `stroke-dasharray` for a ring that is `score / max` full. */
export function ringDash(score: number, circumference: number, max = SCORE_MAX): string {
  const ratio = clampScore(score, max) / max;
  return `${circumference * ratio} ${circumference}`;
}

/** Angle of the `index`-th spoke, in radians, starting at the top and going clockwise. */
export function radarAngle(index: number, count: number): number {
  return -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count);
}

export function radarPoint(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  count: number,
  ratio = 1,
): Point {
  const angle = radarAngle(index, count);
  return {
    x: cx + Math.cos(angle) * radius * ratio,
    y: cy + Math.sin(angle) * radius * ratio,
  };
}

/** The value polygon: one vertex per score, scaled to `max`. */
export function radarPolygon(
  values: readonly number[],
  cx: number,
  cy: number,
  radius: number,
  max = SCORE_MAX,
): Point[] {
  return values.map((value, index) =>
    radarPoint(cx, cy, radius, index, values.length, clampScore(value, max) / max),
  );
}

/** Concentric grid polygons from the innermost ring out to the full radius. */
export function radarGrid(
  count: number,
  cx: number,
  cy: number,
  radius: number,
  rings = 4,
): Point[][] {
  const levels: Point[][] = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    const ratio = ring / rings;
    levels.push(
      Array.from({ length: count }, (_, index) =>
        radarPoint(cx, cy, radius, index, count, ratio),
      ),
    );
  }
  return levels;
}

/** `points` attribute for an SVG polygon or polyline. */
export function pointsAttr(points: readonly Point[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
}

export type TextAnchor = 'start' | 'middle' | 'end';

export interface RadarLabel extends Point {
  textAnchor: TextAnchor;
}

/**
 * Where a dimension label sits: just outside its spoke, anchored so the text
 * runs away from the chart. Labels on the vertical axis are centred and moved
 * clear of the polygon; side labels get a small baseline nudge.
 */
export function radarLabel(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  count: number,
  gap: number,
  fontSize: number,
): RadarLabel {
  const angle = radarAngle(index, count);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const point = radarPoint(cx, cy, radius + gap, index, count);
  let textAnchor: TextAnchor = 'middle';
  if (cos > 0.2) textAnchor = 'start';
  else if (cos < -0.2) textAnchor = 'end';
  let dy = fontSize * 0.35;
  if (sin < -0.2) dy = -fontSize * 0.2;
  else if (sin > 0.2) dy = fontSize * 0.9;
  return { x: point.x, y: point.y + dy, textAnchor };
}

/**
 * Where one band ends and the next begins, matching `verdictFor`: under 2.5 is
 * 아쉬워요, 2.5 보통이에요, 3.5 좋아요, 4.5 아주 좋아요.
 */
export const SCORE_BAND_EDGES = [2.5, 3.5, 4.5] as const;

export interface BandLabel extends Point {
  textAnchor: TextAnchor;
  text: string;
}

export interface BandTrack {
  /** x of each band edge, left to right, on the same axis as the marker. */
  separators: number[];
  /** How far the ink runs from the left edge of the track to the score. */
  fillWidth: number;
  markerX: number;
  /** The word for the band the score landed in, placed under the marker. */
  label: BandLabel;
}

/**
 * One rubric score on a 0–`max` track: where the band edges fall, where the
 * score sits, and where its band word goes. `inset` keeps the marker's own
 * radius inside the drawing, and the separators use the same axis so the
 * marker really is left or right of the edge it looks left or right of.
 */
export function bandTrack(
  score: number,
  width: number,
  labelY: number,
  inset = 0,
  max = SCORE_MAX,
): BandTrack {
  const usable = Math.max(0, width - inset * 2);
  const at = (value: number) => inset + (clampScore(value, max) / max) * usable;
  const markerX = at(score);
  const text = verdictFor(clampScore(score, max));
  // The word is centred under the marker until that would run it off an edge.
  const half = text.length * 6;
  let textAnchor: TextAnchor = 'middle';
  let x = markerX;
  if (markerX - half < 0) {
    textAnchor = 'start';
    x = 0;
  } else if (markerX + half > width) {
    textAnchor = 'end';
    x = width;
  }
  return {
    separators: SCORE_BAND_EDGES.map(at),
    fillWidth: Math.max(0, markerX - inset),
    markerX,
    label: { x, y: labelY, textAnchor, text },
  };
}

/** A bar filled to `score` of `max`, as a percentage string for a `View`. */
export function scoreBarPercent(score: number, max = SCORE_MAX): `${number}%` {
  return `${Math.round((clampScore(score, max) / max) * 100)}%`;
}

export interface RubricComparisonRow {
  key: string;
  label: string;
  current: number;
  previous: number;
  /** current minus previous, to one decimal. */
  delta: number;
}

/**
 * The rubric of two evaluations side by side, in the current report's order.
 * An item the earlier report did not score is left out rather than compared
 * against a zero.
 */
export function rubricComparison(
  current: readonly { key: string; label: string; score: number }[],
  previous: readonly { key: string; label: string; score: number }[],
): RubricComparisonRow[] {
  const before = new Map(previous.map((metric) => [metric.key, metric.score]));
  const rows: RubricComparisonRow[] = [];
  for (const metric of current) {
    const was = before.get(metric.key);
    if (typeof was !== 'number' || !Number.isFinite(was)) continue;
    rows.push({
      key: metric.key,
      label: metric.label,
      current: metric.score,
      previous: was,
      delta: Math.round((metric.score - was) * 10) / 10,
    });
  }
  return rows;
}

export interface RubricMovers {
  /** The biggest rise, if anything rose at all. */
  improved: RubricComparisonRow | null;
  /** The biggest fall, if anything fell. */
  slipped: RubricComparisonRow | null;
}

/** On a tie the earlier row wins, so the order of the rubric decides it. */
export function rubricMovers(rows: readonly RubricComparisonRow[]): RubricMovers {
  let improved: RubricComparisonRow | null = null;
  let slipped: RubricComparisonRow | null = null;
  for (const row of rows) {
    if (row.delta > 0 && (improved === null || row.delta > improved.delta)) improved = row;
    if (row.delta < 0 && (slipped === null || row.delta < slipped.delta)) slipped = row;
  }
  return { improved, slipped };
}

export type MomentKind = 'strength' | 'improvement';

export interface MomentMark {
  kind: MomentKind;
  /** Index into the report's `strengths` or `improvements` list. */
  index: number;
  sourceStartMs: number;
  x: number;
  priority: boolean;
}

export type TimelineScale = 'duration' | 'last-moment' | 'even';

export interface MomentMarks {
  marks: MomentMark[];
  scale: TimelineScale;
  /** The span the bar represents; 0 when the marks are only ordered. */
  spanMs: number;
}

function hasTimestamps(moments: readonly LensMoment[]): boolean {
  return (
    moments.length > 0 &&
    moments.some((moment) => Number.isFinite(moment.sourceStartMs) && moment.sourceStartMs > 0)
  );
}

/**
 * Place every strength and improvement on a bar of `width`.
 *
 * With a known lecture length the bar is the lecture. Without one, the bar
 * ends at the last moment. If the moments carry no timestamps at all they are
 * spread evenly in list order, and the caller says so in the caption.
 */
export function momentMarks(
  strengths: readonly LensMoment[],
  improvements: readonly LensMoment[],
  priority: LensMoment | null,
  durationMs: number | undefined,
  width: number,
  inset = 0,
): MomentMarks {
  const all = [
    ...strengths.map((moment, index) => ({ kind: 'strength' as const, index, moment })),
    ...improvements.map((moment, index) => ({ kind: 'improvement' as const, index, moment })),
  ];
  const usable = Math.max(0, width - inset * 2);
  // The priority is written as its own moment, so it is the same evidence as
  // a listed one when it points at the same second, even if reworded.
  const isPriority = (moment: LensMoment) =>
    priority !== null &&
    Math.round(priority.sourceStartMs / 1_000) === Math.round(moment.sourceStartMs / 1_000);

  if (!hasTimestamps(all.map((entry) => entry.moment))) {
    const step = all.length > 1 ? usable / (all.length - 1) : 0;
    return {
      scale: 'even',
      spanMs: 0,
      marks: all.map((entry, order) => ({
        kind: entry.kind,
        index: entry.index,
        sourceStartMs: entry.moment.sourceStartMs,
        x: inset + (all.length > 1 ? step * order : usable / 2),
        priority: isPriority(entry.moment),
      })),
    };
  }

  const lastMs = Math.max(...all.map((entry) => entry.moment.sourceStartMs));
  const hasDuration = typeof durationMs === 'number' && durationMs > 0 && durationMs >= lastMs;
  const spanMs = hasDuration ? durationMs : lastMs;
  const marks = all
    .map((entry) => ({
      kind: entry.kind,
      index: entry.index,
      sourceStartMs: entry.moment.sourceStartMs,
      x: inset + (clampMs(entry.moment.sourceStartMs, spanMs) / spanMs) * usable,
      priority: isPriority(entry.moment),
    }))
    .sort((left, right) => left.x - right.x);
  return { scale: hasDuration ? 'duration' : 'last-moment', spanMs, marks };
}

function clampMs(ms: number, spanMs: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(spanMs, Math.max(0, ms));
}

/**
 * Scale a score series into a box. The vertical range is the series' own
 * min–max (padded so a flat line is still visible), which keeps a
 * +0.3 change readable; the axis is labelled with the real values.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  inset = 0,
): Point[] {
  if (values.length === 0) return [];
  const usableWidth = Math.max(0, width - inset * 2);
  const usableHeight = Math.max(0, height - inset * 2);
  const finite = values.map((value) => (Number.isFinite(value) ? value : 0));
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max - min < 0.5) {
    const mid = (max + min) / 2;
    min = mid - 0.25;
    max = mid + 0.25;
  }
  const step = finite.length > 1 ? usableWidth / (finite.length - 1) : 0;
  return finite.map((value, index) => ({
    x: inset + (finite.length > 1 ? step * index : usableWidth / 2),
    y: inset + usableHeight - ((value - min) / (max - min)) * usableHeight,
  }));
}

/** Latest score minus the one before it, to one decimal; null with fewer than two. */
export function scoreDelta(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  return Math.round((latest - previous) * 10) / 10;
}

/** "+0.6", "-0.3" or "0" — ASCII signs only. */
export function formatDelta(delta: number): string {
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)}`;
}

export interface BalanceSegment {
  x: number;
  width: number;
}

export interface BalanceSegments {
  strength: BalanceSegment;
  improvement: BalanceSegment;
}

/**
 * Split one bar between 강점 and 보완 by count, leaving `gap` between them.
 * A side with no items gets no width, and the other takes the whole bar.
 */
export function balanceSegments(
  strengthCount: number,
  improvementCount: number,
  width: number,
  gap = 2,
): BalanceSegments {
  const total = Math.max(0, strengthCount) + Math.max(0, improvementCount);
  if (total === 0 || width <= 0) {
    return { strength: { x: 0, width: 0 }, improvement: { x: 0, width: 0 } };
  }
  if (strengthCount <= 0) {
    return { strength: { x: 0, width: 0 }, improvement: { x: 0, width } };
  }
  if (improvementCount <= 0) {
    return { strength: { x: 0, width }, improvement: { x: width, width: 0 } };
  }
  const usable = width - gap;
  const strengthWidth = (usable * strengthCount) / total;
  return {
    strength: { x: 0, width: strengthWidth },
    improvement: { x: strengthWidth + gap, width: usable - strengthWidth },
  };
}

export interface GaugeTick {
  value: number;
  x: number;
  /** Anchored inwards at the ends so the first and last numbers never clip. */
  textAnchor: TextAnchor;
}

export interface GaugeLayout {
  /** Where the needle sits; always inside the track. */
  needleX: number;
  /** True when the measurement ran past the end of the scale and was pinned. */
  clamped: boolean;
  /** The stretch that needs no fixing, shaded on the track. */
  healthy: { x: number; width: number };
  ticks: GaugeTick[];
}

/**
 * A measurement on a fixed scale: the needle, the shaded healthy stretch, and
 * the numbers under the track. The window comes from the caller (the metric
 * owns it), so this only turns values into x positions.
 */
export function gaugeLayout(
  value: number,
  scale: { min: number; max: number; healthyMin: number; healthyMax: number; ticks: number[] },
  width: number,
  inset = 0,
): GaugeLayout {
  const usable = Math.max(0, width - inset * 2);
  const span = scale.max - scale.min;
  const at = (input: number) => {
    if (span <= 0) return inset + usable / 2;
    const ratio = (input - scale.min) / span;
    return inset + Math.min(1, Math.max(0, ratio)) * usable;
  };
  const safe = Number.isFinite(value) ? value : scale.min;
  const healthyStart = at(scale.healthyMin);
  return {
    needleX: at(safe),
    clamped: safe < scale.min || safe > scale.max,
    healthy: { x: healthyStart, width: Math.max(0, at(scale.healthyMax) - healthyStart) },
    ticks: scale.ticks.map((tick, index) => ({
      value: tick,
      x: at(tick),
      textAnchor:
        index === 0 ? 'start' : index === scale.ticks.length - 1 ? 'end' : ('middle' as TextAnchor),
    })),
  };
}

export interface DensityBucket {
  index: number;
  startMs: number;
  endMs: number;
  strengths: number;
  improvements: number;
}

export interface MomentDensity {
  buckets: DensityBucket[];
  /** The span the strip covers, matching the timeline above it. */
  spanMs: number;
  /** The busiest bucket's total, for scaling the columns. */
  peak: number;
  scale: Exclude<TimelineScale, 'even'>;
}

/**
 * How the evidence is spread across the recording, in equal time buckets, so
 * "the second half is where the problems are" is visible at a glance.
 *
 * Null when nothing carries a usable timestamp: an even spread would invent a
 * distribution the report does not have, so the caller draws nothing instead.
 */
export function momentDensity(
  strengths: readonly LensMoment[],
  improvements: readonly LensMoment[],
  durationMs: number | undefined,
  bucketCount = 6,
): MomentDensity | null {
  const all = [
    ...strengths.map((moment) => ({ kind: 'strength' as const, moment })),
    ...improvements.map((moment) => ({ kind: 'improvement' as const, moment })),
  ];
  const count = Math.max(1, Math.floor(bucketCount));
  if (!hasTimestamps(all.map((entry) => entry.moment))) return null;

  const lastMs = Math.max(...all.map((entry) => entry.moment.sourceStartMs));
  const hasDuration = typeof durationMs === 'number' && durationMs > 0 && durationMs >= lastMs;
  const spanMs = hasDuration ? durationMs : lastMs;
  const step = spanMs / count;
  const buckets: DensityBucket[] = Array.from({ length: count }, (_, index) => ({
    index,
    startMs: Math.round(step * index),
    endMs: Math.round(step * (index + 1)),
    strengths: 0,
    improvements: 0,
  }));
  for (const entry of all) {
    const ms = clampMs(entry.moment.sourceStartMs, spanMs);
    // The last bucket owns its own end, so a moment at the very end counts.
    const index = Math.min(count - 1, Math.floor((ms / spanMs) * count));
    const bucket = buckets[index];
    if (!bucket) continue;
    if (entry.kind === 'strength') bucket.strengths += 1;
    else bucket.improvements += 1;
  }
  const peak = buckets.reduce(
    (highest, bucket) => Math.max(highest, bucket.strengths + bucket.improvements),
    0,
  );
  return { buckets, spanMs, peak, scale: hasDuration ? 'duration' : 'last-moment' };
}

export interface DensityColumn {
  x: number;
  width: number;
}

/** Equal columns across `width`, with `gap` of canvas between them. */
export function densityColumns(count: number, width: number, gap = 3): DensityColumn[] {
  const columns = Math.max(0, Math.floor(count));
  if (columns === 0 || width <= 0) return [];
  const step = width / columns;
  const columnWidth = Math.max(1, step - gap);
  return Array.from({ length: columns }, (_, index) => ({
    x: step * index,
    width: columnWidth,
  }));
}

export interface DensityHalf {
  strengths: number;
  improvements: number;
}

export interface DensityHalves {
  first: DensityHalf;
  second: DensityHalf;
}

/**
 * The two halves of the recording. An odd number of buckets puts the middle
 * one in neither half, so a "front" or "back" reading is never decided by it.
 */
export function densityHalves(density: MomentDensity): DensityHalves {
  const count = density.buckets.length;
  const edge = Math.floor(count / 2);
  const first: DensityHalf = { strengths: 0, improvements: 0 };
  const second: DensityHalf = { strengths: 0, improvements: 0 };
  density.buckets.forEach((bucket, index) => {
    if (count % 2 === 1 && index === edge) return;
    const half = index < edge ? first : second;
    half.strengths += bucket.strengths;
    half.improvements += bucket.improvements;
  });
  return { first, second };
}

export type DensitySide = 'front' | 'back' | 'spread' | 'none';

/** Which half a kind of evidence sits in, once both halves are counted. */
export function densitySide(first: number, second: number): DensitySide {
  if (first + second === 0) return 'none';
  if (second === 0) return 'front';
  if (first === 0) return 'back';
  return 'spread';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
