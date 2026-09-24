import type { StudyConcept } from '@/types';

/**
 * Pure geometry for the 마인드맵: given the panel width and the study pack's
 * concepts, decide where every node and connector goes. No React, no
 * platform — so it is unit-tested directly and the view only draws.
 *
 * The map is a **centre spine with branches alternating out to each side**.
 *
 * ```
 *               ╭───────────────╮
 *               │  root (자료)   │        ink capsule, centred
 *               ╰───────┬───────╯
 *                       │
 *                       ╰──────╮ ┌──────────────┐
 *                              └─┤  개념 1       │   right branch
 *                       │        └──────────────┘
 *          ┌─────────┐  │
 *          │  개념 2  ├──╯                            left branch
 *          └─────────┘
 *              ╰── 꼭 기억할 내용                      leaf on a twig
 * ```
 *
 * Why this and not a ring or a column (2026-09-07):
 *
 * - A **ring** spends the whole 280–320pt panel on reach, so every label was
 *   cut to six or seven characters and the side nodes still left the screen.
 * - A **single indented column** fits, but reads as a list of coloured bars:
 *   one x per level, one width for every card, connectors so short they add
 *   nothing.
 * - A spine spends the width on *two* label columns instead of one. Each node
 *   is flush with the panel edge on its side and only as wide as its own
 *   label, so the widths differ, the two columns interlock vertically, and
 *   the space left in the middle is exactly what the curved connectors need
 *   to read as branches. Nothing is ever wider than half the panel, so the
 *   canvas cannot overflow however long the terms are.
 *
 * Coordinates are **top-left**, in the same space the view lays nodes out
 * with `position: absolute`.
 */

export type MindMapDifficulty = StudyConcept['difficulty'];
export type MindMapNodeKind = 'concept' | 'point';
/** Root is the 자료, a branch hangs off the spine, a leaf hangs off a branch. */
export type MindMapNodeLevel = 'branch' | 'leaf';
/** Which side of the spine a node sits on. */
export type MindMapSide = 'left' | 'right';

export interface MindMapNodeInput {
  id: string;
  kind: MindMapNodeKind;
  /** Full label; the layout wraps it and only shortens as a last resort. */
  label: string;
  description?: string;
  /** Present for concepts; key-point fallback nodes have none. */
  sourceStartMs?: number;
  difficulty?: MindMapDifficulty;
}

export interface MindMapBox {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  width: number;
  height: number;
}

export interface MindMapPoint {
  x: number;
  y: number;
}

export interface MindMapNode extends MindMapBox {
  id: string;
  kind: MindMapNodeKind;
  level: MindMapNodeLevel;
  side: MindMapSide;
  /** The branch a leaf hangs off; undefined on a branch. */
  parentId?: string;
  /** The label as drawn, one entry per rendered line. */
  lines: string[];
  /** The label as written in the pack; always what the sheet and a11y read. */
  fullLabel: string;
  /** True when the label did not fit its lines and ends in an ellipsis. */
  truncated: boolean;
  /** Corner radius: a one-line node is a capsule, a taller one a rounded card. */
  radius: number;
  /** Text hugs the edge that faces the spine, so a branch grows outward. */
  align: 'left' | 'right';
  /** Where the connector meets this node: the middle of its inner edge. */
  joint: MindMapPoint;
  /** The joint bead, drawn just outside the node so the card cannot hide it. */
  dot: MindMapPoint;
  description?: string;
  sourceStartMs?: number;
  difficulty?: MindMapDifficulty;
}

export interface MindMapRoot extends MindMapBox {
  lines: string[];
  fullLabel: string;
  truncated: boolean;
  radius: number;
}

export type MindMapLinkKind = 'trunk' | 'branch' | 'leaf';

export interface MindMapLink {
  id: string;
  kind: MindMapLinkKind;
  path: string;
}

export interface MindMapLayout {
  width: number;
  height: number;
  /** The spine's x. Every branch hangs off it and no node crosses it. */
  centerX: number;
  root: MindMapRoot;
  nodes: MindMapNode[];
  links: MindMapLink[];
}

export interface MindMapLayoutInput {
  /** The panel width. The canvas is exactly this wide, never wider. */
  width: number;
  title: string;
  nodes: readonly MindMapNodeInput[];
  keyPoints?: readonly string[];
}

/**
 * Type sizes. Each pairs with the `AppText` variant the view uses, so the
 * measured line height here is the one that renders:
 * root → `itemTitle` (15/22), branch → `label` (14/20), leaf → `meta` (13/19).
 */
export const ROOT_FONT_SIZE = 15;
export const ROOT_LINE_HEIGHT = 22;
export const BRANCH_FONT_SIZE = 14;
export const BRANCH_LINE_HEIGHT = 20;
export const LEAF_FONT_SIZE = 13;
export const LEAF_LINE_HEIGHT = 19;

/**
 * Lines each level may take. A concept term is short enough for two on a
 * 360dp phone and three on a 320dp one; a 꼭 기억할 내용 is a whole sentence,
 * so it gets three before anything is cut. The sheet always has the rest.
 */
export const ROOT_MAX_LINES = 3;
export const BRANCH_MAX_LINES = 3;
export const LEAF_MAX_LINES = 3;

/** Horizontal inset from a node's edge to its text. */
export const ROOT_INSET_X = 20;
export const BRANCH_INSET_X = 13;
export const LEAF_INSET_X = 10;

const ROOT_PADDING_Y = 14;
const BRANCH_PADDING_Y = 12;
const LEAF_PADDING_Y = 6;

/**
 * A node hugs its own label, so the widths differ down the map — the single
 * strongest reason it stops reading as a list. These are the ends of that
 * range; the fit below caps the wide end at half the panel.
 */
export const ROOT_MIN_WIDTH = 150;
export const BRANCH_MIN_WIDTH = 76;
export const LEAF_MIN_WIDTH = 64;

/** A branch is a tap target, so it never drops under the 44pt minimum. */
export const BRANCH_MIN_HEIGHT = 44;
export const LEAF_MIN_HEIGHT = 40;
const ROOT_MIN_HEIGHT = 50;

/** Corner radius when a node needs more than one line; one-line nodes are capsules. */
const ROOT_RADIUS = 20;
const BRANCH_RADIUS = 16;
const LEAF_RADIUS = 12;

/**
 * The shortest horizontal run a connector gets. It is what stops the widest
 * branch from touching the spine, so the hook always has room to curve.
 */
export const MIN_REACH = 18;
/** A leaf keeps a little more room, and stops short of the panel edge. */
export const LEAF_MIN_REACH = 22;
export const LEAF_EDGE_INSET = 10;
/** The root never spans the full panel; it reads as a hub, not a header bar. */
export const ROOT_SIDE_MARGIN = 8;

/** Estimates over-measure by a hair, so a hugged box gets this back. */
const TEXT_SAFETY = 4;

const ROOT_GAP = 22;
const BRANCH_GAP = 16;
/**
 * Two branches on opposite sides may overlap vertically by this much: their
 * x ranges are disjoint, and the interlock is what makes the map zigzag
 * instead of stacking.
 */
const CROSS_LIFT = 14;
const LEAF_GAP_FIRST = 8;
const LEAF_GAP = 6;

/** The joint bead where a connector meets its node. */
export const BRANCH_DOT_RADIUS = 4.5;
export const LEAF_DOT_RADIUS = 3;

/**
 * The trunk starts this far *inside* the root. Nodes are drawn over the
 * connectors, so the join disappears under the card instead of stopping short
 * in the notch a rounded corner leaves.
 */
const TRUNK_TUCK = 8;
const TWIG_TUCK = 3;
/** How far the spine leans toward the branch it is releasing. */
export const SPINE_BOW = 7;
/** How far along a branch's inner edge its twig drops. */
const TWIG_INSET = 12;

/** Nodes on the map, at most; the pack rarely has more and a phone scroll should end. */
export const MAX_NODES = 8;
export const MAX_LEAVES_PER_NODE = 2;

function isWideGlyph(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x1100;
}

/**
 * Roughly how wide `text` renders in Pretendard at `fontSize`. Hangul is a
 * full em, Latin about 0.58em. Deliberately never an under-estimate: the
 * view draws each wrapped line with `numberOfLines={1}`, so a line we
 * measured too narrow would show an ellipsis it did not need, while one we
 * measured too wide only ever wastes a few points of a hugged box.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    width += fontSize * (isWideGlyph(char) ? 1 : 0.58);
  }
  return Math.ceil(width);
}

/** Cuts `text` down to what fits `maxWidth`, ending in an ellipsis. */
export function ellipsise(text: string, maxWidth: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  let kept = '';
  for (const char of text) {
    if (estimateTextWidth(`${kept}${char}…`, fontSize) > maxWidth) break;
    kept += char;
  }
  return `${kept.trimEnd()}…`;
}

export interface WrappedLabel {
  lines: string[];
  truncated: boolean;
}

/**
 * Greedy word wrap over `maxWidth`, at most `maxLines` lines. Words that are
 * themselves too long break by character — Korean terms are often written
 * without a space, so a per-word-only wrap would overflow. Past the last
 * line the rest is folded back in and ellipsised, so nothing is silently
 * dropped mid-word.
 */
export function wrapLabel(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number = BRANCH_MAX_LINES,
): WrappedLabel {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (estimateTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      if (chunk && estimateTextWidth(`${chunk}${char}`, fontSize) > maxWidth) {
        lines.push(chunk);
        chunk = char;
        continue;
      }
      chunk += char;
    }
    current = chunk;
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push('');

  if (lines.length <= maxLines) return { lines, truncated: false };
  const kept = lines.slice(0, maxLines - 1);
  const rest = lines.slice(maxLines - 1).join(' ');
  kept.push(ellipsise(rest, maxWidth, fontSize));
  return { lines: kept, truncated: true };
}

/** The width of the longest wrapped line. A node is exactly this wide, plus its inset. */
export function widestLine(lines: readonly string[], fontSize: number): number {
  return lines.reduce((widest, line) => Math.max(widest, estimateTextWidth(line, fontSize)), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The room each level gets at a given panel width. Every maximum is a
 * subtraction from half the panel, which is why the map cannot overflow: a
 * node reaches at most from the panel edge to the spine.
 */
export interface MindMapFit {
  width: number;
  centerX: number;
  rootMaxWidth: number;
  rootMaxTextWidth: number;
  branchMaxWidth: number;
  branchMaxTextWidth: number;
  leafMaxWidth: number;
  leafMaxTextWidth: number;
}

export function mindMapFit(width: number): MindMapFit {
  const canvas = Math.max(1, Math.floor(width));
  const centerX = Math.round(canvas / 2);
  const rootMaxWidth = Math.max(1, canvas - ROOT_SIDE_MARGIN * 2);
  const branchMaxWidth = Math.max(1, centerX - MIN_REACH);
  const leafMaxWidth = Math.max(1, centerX - LEAF_MIN_REACH - LEAF_EDGE_INSET);
  return {
    width: canvas,
    centerX,
    rootMaxWidth,
    rootMaxTextWidth: Math.max(1, rootMaxWidth - ROOT_INSET_X * 2),
    branchMaxWidth,
    branchMaxTextWidth: Math.max(1, branchMaxWidth - BRANCH_INSET_X * 2),
    leafMaxWidth,
    leafMaxTextWidth: Math.max(1, leafMaxWidth - LEAF_INSET_X * 2),
  };
}

function boxHeight(lineCount: number, lineHeight: number, paddingY: number, minimum: number): number {
  return Math.max(minimum, paddingY * 2 + lineCount * lineHeight);
}

export function boxesOverlap(a: MindMapBox, b: MindMapBox, gap = 0): boolean {
  return (
    a.x - gap < b.x + b.width &&
    a.x + a.width + gap > b.x &&
    a.y - gap < b.y + b.height &&
    a.y + a.height + gap > b.y
  );
}

/**
 * How far a hook runs down the spine before it turns out to its node. It
 * grows with the reach, so a short node far from the spine gets a long sweep
 * and a wide node close to it gets a tighter one — the connectors vary the
 * way the nodes do. The floor is what stops a wide node, which has only the
 * 18pt corridor to cross, from being joined on by a stub: the curve peels off
 * the spine well above the node and eases into it.
 */
export function hookRise(reach: number): number {
  return round(clamp(reach * 1.05, 26, 44));
}

/**
 * A connector that peels away from the spine and eases into the side of its
 * node: one cubic that leaves diagonally — a hook that hugged the spine and
 * only flicked out at the end would be invisible against the spine itself —
 * and arrives horizontally, so the node looks grown rather than pointed at.
 */
function hookPath(from: MindMapPoint, joint: MindMapPoint): string {
  const direction = joint.x >= from.x ? 1 : -1;
  const reach = Math.abs(joint.x - from.x);
  const rise = joint.y - from.y;
  const control1X = round(from.x + direction * reach * 0.5);
  const control1Y = round(joint.y - rise * 0.5);
  const control2X = round(from.x + direction * reach * 0.85);
  const endY = round(joint.y);
  return (
    `M ${round(from.x)} ${round(from.y)} ` +
    `C ${control1X} ${control1Y} ${control2X} ${endY} ${round(joint.x)} ${endY}`
  );
}

/**
 * The spine, drawn as one path through the points where the branches leave
 * it. It leans a few points toward the side it is about to feed, so the
 * middle of the map reads as something growing rather than as a ruled line
 * with cards pinned to it, and each hook carries on from where it bends.
 */
function trunkPath(top: MindMapPoint, departures: readonly MindMapPoint[]): string {
  let path = `M ${round(top.x)} ${round(top.y)}`;
  let previous = top;
  for (const point of departures) {
    const midY = round(previous.y + (point.y - previous.y) / 2);
    path +=
      ` C ${round(previous.x)} ${midY} ${round(point.x)} ${midY}` +
      ` ${round(point.x)} ${round(point.y)}`;
    previous = point;
  }
  return path;
}

/** The same shape one level down: out of the branch's underside, into the leaf. */
function twigPath(from: MindMapPoint, to: MindMapPoint): string {
  const control1Y = round(from.y + (to.y - from.y) * 0.55);
  const control2X = round(from.x + (to.x - from.x) * 0.5);
  const endY = round(to.y);
  return (
    `M ${round(from.x)} ${round(from.y)} ` +
    `C ${round(from.x)} ${control1Y} ${control2X} ${endY} ${round(to.x)} ${endY}`
  );
}

/**
 * Nodes for the map: the concepts, or — when there are fewer than three —
 * the concepts plus key points so a thin note still draws something honest.
 */
export function mindMapNodesFor(
  concepts: readonly StudyConcept[],
  keyPoints: readonly string[],
): MindMapNodeInput[] {
  const nodes: MindMapNodeInput[] = concepts.map((concept) => ({
    id: concept.id,
    kind: 'concept',
    label: concept.term,
    description: concept.description,
    sourceStartMs: concept.sourceStartMs,
    difficulty: concept.difficulty,
  }));
  if (nodes.length < 3) {
    keyPoints.forEach((point, index) => {
      if (nodes.some((node) => node.label === point)) return;
      nodes.push({ id: `point-${index}`, kind: 'point', label: point, description: point });
    });
  }
  return nodes.slice(0, MAX_NODES);
}

/**
 * Key points that mention the term, at most two per branch. `taken` holds the
 * points already hung elsewhere, so a point that names two concepts shows
 * once rather than twice.
 */
export function leafPointsFor(
  term: string,
  keyPoints: readonly string[],
  taken: ReadonlySet<string> = new Set(),
): string[] {
  const needle = term.trim().toLocaleLowerCase('ko-KR');
  if (!needle) return [];
  return keyPoints
    .filter((point) => !taken.has(point) && point.toLocaleLowerCase('ko-KR').includes(needle))
    .slice(0, MAX_LEAVES_PER_NODE);
}

/** Right, left, right … so the map reads down the spine rather than down a column. */
export function sideFor(index: number): MindMapSide {
  return index % 2 === 0 ? 'right' : 'left';
}

export function computeMindMapLayout({
  width,
  title,
  nodes: inputs,
  keyPoints = [],
}: MindMapLayoutInput): MindMapLayout {
  const fit = mindMapFit(width);
  const branchInputs = inputs.slice(0, MAX_NODES);
  const centerX = fit.centerX;

  const rootWrap = wrapLabel(title, fit.rootMaxTextWidth, ROOT_FONT_SIZE, ROOT_MAX_LINES);
  const rootWidth = Math.round(
    clamp(
      widestLine(rootWrap.lines, ROOT_FONT_SIZE) + ROOT_INSET_X * 2 + TEXT_SAFETY,
      Math.min(ROOT_MIN_WIDTH, fit.rootMaxWidth),
      fit.rootMaxWidth,
    ),
  );
  const rootHeight = boxHeight(rootWrap.lines.length, ROOT_LINE_HEIGHT, ROOT_PADDING_Y, ROOT_MIN_HEIGHT);
  const root: MindMapRoot = {
    x: Math.round((fit.width - rootWidth) / 2),
    y: 0,
    width: rootWidth,
    height: rootHeight,
    radius: rootWrap.lines.length === 1 ? rootHeight / 2 : ROOT_RADIUS,
    lines: rootWrap.lines,
    fullLabel: title,
    truncated: rootWrap.truncated,
  };

  const nodes: MindMapNode[] = [];
  // A key point that already stands on the map as a branch of its own — a
  // thin pack promotes them — never repeats itself as a leaf underneath.
  const taken = new Set<string>(branchInputs.map((input) => input.label));
  const bottom: Record<MindMapSide, number> = { left: root.height, right: root.height };
  const firstTop = root.height + ROOT_GAP;

  branchInputs.forEach((input, index) => {
    const side = sideFor(index);
    const other: MindMapSide = side === 'right' ? 'left' : 'right';

    const wrapped = wrapLabel(input.label, fit.branchMaxTextWidth, BRANCH_FONT_SIZE, BRANCH_MAX_LINES);
    const branchWidth = Math.round(
      clamp(
        widestLine(wrapped.lines, BRANCH_FONT_SIZE) + BRANCH_INSET_X * 2 + TEXT_SAFETY,
        Math.min(BRANCH_MIN_WIDTH, fit.branchMaxWidth),
        fit.branchMaxWidth,
      ),
    );
    const branchHeight = boxHeight(
      wrapped.lines.length,
      BRANCH_LINE_HEIGHT,
      BRANCH_PADDING_Y,
      BRANCH_MIN_HEIGHT,
    );
    const y = round(
      Math.max(firstTop, bottom[side] + BRANCH_GAP, bottom[other] - CROSS_LIFT),
    );
    const x = side === 'right' ? fit.width - branchWidth : 0;
    const jointX = side === 'right' ? x : x + branchWidth;
    const jointY = round(y + branchHeight / 2);

    const branch: MindMapNode = {
      id: input.id,
      kind: input.kind,
      level: 'branch',
      side,
      lines: wrapped.lines,
      fullLabel: input.label,
      truncated: wrapped.truncated,
      radius: wrapped.lines.length === 1 ? branchHeight / 2 : BRANCH_RADIUS,
      align: side === 'right' ? 'left' : 'right',
      joint: { x: jointX, y: jointY },
      dot: {
        x: round(jointX + (side === 'right' ? -BRANCH_DOT_RADIUS : BRANCH_DOT_RADIUS)),
        y: jointY,
      },
      description: input.description,
      sourceStartMs: input.sourceStartMs,
      difficulty: input.difficulty,
      x,
      y,
      width: branchWidth,
      height: branchHeight,
    };
    nodes.push(branch);
    bottom[side] = y + branchHeight;

    // A key point only hangs off a 개념; a branch that already *is* a key
    // point would otherwise repeat itself one level down.
    const points = input.kind === 'concept' ? leafPointsFor(input.label, keyPoints, taken) : [];
    points.forEach((point, leafIndex) => {
      taken.add(point);
      const leafWrap = wrapLabel(point, fit.leafMaxTextWidth, LEAF_FONT_SIZE, LEAF_MAX_LINES);
      const leafWidth = Math.round(
        clamp(
          widestLine(leafWrap.lines, LEAF_FONT_SIZE) + LEAF_INSET_X * 2 + TEXT_SAFETY,
          Math.min(LEAF_MIN_WIDTH, fit.leafMaxWidth),
          fit.leafMaxWidth,
        ),
      );
      const leafHeight = boxHeight(
        leafWrap.lines.length,
        LEAF_LINE_HEIGHT,
        LEAF_PADDING_Y,
        LEAF_MIN_HEIGHT,
      );
      const leafY = round(bottom[side] + (leafIndex === 0 ? LEAF_GAP_FIRST : LEAF_GAP));
      const leafX =
        side === 'right' ? fit.width - LEAF_EDGE_INSET - leafWidth : LEAF_EDGE_INSET;
      const leafJointX = side === 'right' ? leafX : leafX + leafWidth;
      const leafJointY = round(leafY + leafHeight / 2);

      nodes.push({
        id: `leaf-${branch.id}-${leafIndex}`,
        kind: 'point',
        level: 'leaf',
        side,
        parentId: branch.id,
        lines: leafWrap.lines,
        fullLabel: point,
        truncated: leafWrap.truncated,
        radius: LEAF_RADIUS,
        align: side === 'right' ? 'left' : 'right',
        joint: { x: leafJointX, y: leafJointY },
        dot: {
          x: round(leafJointX + (side === 'right' ? -LEAF_DOT_RADIUS : LEAF_DOT_RADIUS)),
          y: leafJointY,
        },
        description: point,
        x: leafX,
        y: leafY,
        width: leafWidth,
        height: leafHeight,
      });
      bottom[side] = leafY + leafHeight;
    });
  });

  const links: MindMapLink[] = [];
  const departures: MindMapPoint[] = [];
  const trunkTop: MindMapPoint = { x: centerX, y: round(root.height - TRUNK_TUCK) };
  let lowestDeparture = trunkTop.y;

  for (const node of nodes) {
    if (node.level === 'branch') {
      const rise = hookRise(Math.abs(node.joint.x - centerX));
      // The spine leans toward the branch it is about to release, and the
      // hook carries on from that bend.
      const departure: MindMapPoint = {
        x: centerX + (node.side === 'right' ? SPINE_BOW : -SPINE_BOW),
        y: Math.max(lowestDeparture, round(node.joint.y - rise)),
      };
      lowestDeparture = departure.y;
      departures.push(departure);
      links.push({ id: `hook-${node.id}`, kind: 'branch', path: hookPath(departure, node.joint) });
      continue;
    }
    const parent = nodes.find((candidate) => candidate.id === node.parentId);
    if (!parent) continue;
    const from: MindMapPoint = {
      x: parent.joint.x + (parent.side === 'right' ? TWIG_INSET : -TWIG_INSET),
      y: round(parent.y + parent.height - TWIG_TUCK),
    };
    links.push({ id: `twig-${node.id}`, kind: 'leaf', path: twigPath(from, node.joint) });
  }

  // The spine stops where the last hook leaves it, so it flows into the final
  // branch instead of ending in mid-air past it.
  if (departures.length) {
    links.unshift({ id: 'trunk', kind: 'trunk', path: trunkPath(trunkTop, departures) });
  }

  const lowest = nodes.reduce((deepest, node) => Math.max(deepest, node.y + node.height), root.height);

  return {
    width: fit.width,
    height: Math.ceil(lowest),
    centerX,
    root,
    nodes,
    links,
  };
}
