/**
 * Pure geometry for the app's small charts and SVG artwork.
 *
 * Every number a visual needs — an arc's dash, a rail's fill, a bar's height,
 * where the nodes of a stepper sit — is computed here so the components stay
 * declarative and the maths stays testable. Nothing in this file imports
 * React or reads a theme: it takes numbers and returns numbers.
 */

/** Clamps to 0–1. A NaN or an infinity reads as 0, never as a broken chart. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Clamps a ratio expressed against an arbitrary maximum to 0–1. */
export function ratioOf(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return clamp01(value / max);
}

/**
 * `strokeDasharray` for an arc that covers `ratio` of a circle: the drawn
 * length first, then the gap. A ring at zero draws nothing.
 */
export function arcDash(ratio: number, circumference: number): string {
  const safeCircumference = Number.isFinite(circumference) && circumference > 0
    ? circumference
    : 0;
  const drawn = clamp01(ratio) * safeCircumference;
  return `${drawn} ${safeCircumference - drawn}`;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A point on a circle, measured in degrees clockwise from 12 o'clock — the
 * direction a gauge fills, so callers write the angle they can see.
 */
export function polarPoint(
  centre: Point,
  radius: number,
  degreesFromTop: number,
): Point {
  const radians = ((degreesFromTop - 90) * Math.PI) / 180;
  return {
    x: centre.x + radius * Math.cos(radians),
    y: centre.y + radius * Math.sin(radians),
  };
}

/**
 * Deterministic waveform bar heights, as fractions of the tallest bar.
 *
 * A recording's artwork must look like a voice and never like noise, and it
 * must be identical on every render — a random one would flicker between
 * frames and could not be snapshot-tested. Two out-of-phase sines give a
 * shape that reads as speech, with a floor so no bar collapses to a dot.
 */
export function waveformBars(count: number, minimum = 0.28): number[] {
  const total = Math.max(0, Math.floor(count));
  const floor = clamp01(minimum);
  return Array.from({ length: total }, (_, index) => {
    const wave =
      Math.sin(index * 1.1) * 0.55 + Math.sin(index * 0.47 + 1.3) * 0.45;
    const normalised = (wave + 1) / 2;
    return floor + normalised * (1 - floor);
  });
}

/**
 * Bar heights in points for a small count chart: the tallest value fills
 * `maxHeight`, everything else is proportional, and a day with nothing still
 * draws a `minHeight` stub so the axis stays readable.
 */
export function barHeights(
  values: readonly number[],
  maxHeight: number,
  minHeight: number,
): number[] {
  const peak = values.reduce(
    (highest, value) => (Number.isFinite(value) && value > highest ? value : highest),
    0,
  );
  return values.map((value) => {
    if (!Number.isFinite(value) || value <= 0) return minHeight;
    if (peak <= 0) return minHeight;
    return minHeight + (value / peak) * (maxHeight - minHeight);
  });
}

/**
 * How full the rail between step `index` and the next one is, 0–1.
 *
 * A pipeline is a sequence of stages, not a percentage: the segments behind
 * the current stage are full, the ones ahead are empty, and only the segment
 * the work is inside of moves. `stageRatio` is that stage's own progress.
 */
export function railFill(
  index: number,
  stageIndex: number,
  stageRatio: number,
): number {
  if (index < stageIndex) return 1;
  if (index > stageIndex) return 0;
  return clamp01(stageRatio);
}

/**
 * The progress of the current stage on its own 0–1 scale, from a pipeline
 * percentage that runs across every stage.
 *
 * The two pipelines report differently (one spends its first half uploading),
 * so the overall number is only a hint. It is mapped into the current stage's
 * span and clamped, which keeps the rail moving forwards without ever letting
 * it overtake the stage the status actually reports.
 */
export function stageRatio(
  overall: number,
  stageIndex: number,
  stageCount: number,
): number {
  const steps = Math.max(1, Math.floor(stageCount));
  const span = 1 / steps;
  const start = Math.max(0, Math.min(stageIndex, steps - 1)) * span;
  return clamp01((clamp01(overall) - start) / span);
}

/**
 * Whether a question set is short enough to draw one segment per question.
 *
 * Past twenty, the segments are thinner than the gaps between them at 320dp
 * and the strip stops reading as progress, so the caller falls back to a
 * plain bar.
 */
export const MAX_PROGRESS_SEGMENTS = 20;

export function shouldSegment(count: number): boolean {
  return Number.isFinite(count) && count > 1 && count <= MAX_PROGRESS_SEGMENTS;
}
