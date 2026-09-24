import type { StudyConcept } from '@/types';

import {
  BRANCH_FONT_SIZE,
  BRANCH_MAX_LINES,
  BRANCH_MIN_HEIGHT,
  LEAF_EDGE_INSET,
  LEAF_MIN_REACH,
  MAX_NODES,
  MIN_REACH,
  ROOT_SIDE_MARGIN,
  SPINE_BOW,
  boxesOverlap,
  computeMindMapLayout,
  ellipsise,
  estimateTextWidth,
  hookRise,
  leafPointsFor,
  mindMapFit,
  mindMapNodesFor,
  sideFor,
  widestLine,
  wrapLabel,
  type MindMapLayout,
  type MindMapNode,
  type MindMapNodeInput,
} from './mind-map-layout';

/** The panel width on a 360dp phone and on a 320dp one, both after the 20pt gutter. */
const PANEL_360 = 320;
const PANEL_320 = 280;

const concepts: StudyConcept[] = [
  { id: 'c1', term: '지도학습', description: '…', sourceStartMs: 402_000, difficulty: 'basic' },
  { id: 'c2', term: '과적합', description: '…', sourceStartMs: 1_694_000, difficulty: 'intermediate' },
  { id: 'c3', term: '재현율', description: '…', sourceStartMs: 2_238_000, difficulty: 'intermediate' },
];

const keyPoints = [
  '지도학습은 입력과 정답의 관계를 데이터에서 학습한다.',
  '분류는 범주를, 회귀는 연속값을 예측한다.',
  '훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다.',
  '불균형 데이터에서는 정확도 외 지표도 함께 확인한다.',
];

/** The terms the 마인드맵 has to keep legible on the narrow phone. */
const REAL_TERMS = [
  '대체 행동 개발 및 활용',
  'ABA 치료의 효과 및 입증',
  'ABA 치료 성공의 핵심 요인',
  '문제행동 발생 시 대처',
  '의사소통 능력 향상 방법',
];

function conceptNode(id: string, label: string): MindMapNodeInput {
  return { id, kind: 'concept', label, difficulty: 'basic', sourceStartMs: 0 };
}

function branchesOf(layout: MindMapLayout): MindMapNode[] {
  return layout.nodes.filter((node) => node.level === 'branch');
}

function leavesOf(layout: MindMapLayout): MindMapNode[] {
  return layout.nodes.filter((node) => node.level === 'leaf');
}

/**
 * The whole point of the map: nothing may stick out of the panel it was
 * measured in, nothing may cross the spine, and two nodes on the same side
 * may never collide. Opposite sides *are* allowed to interlock vertically —
 * that is what makes it zigzag — so the overlap check is per side.
 */
function expectInsideCanvas(layout: MindMapLayout) {
  for (const box of [layout.root, ...layout.nodes]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
  }
  for (const node of layout.nodes) {
    expect(boxesOverlap(node, layout.root)).toBe(false);
    if (node.side === 'right') {
      expect(node.x).toBeGreaterThanOrEqual(layout.centerX);
    } else {
      expect(node.x + node.width).toBeLessThanOrEqual(layout.centerX);
    }
    expect(node.joint.x).toBeGreaterThanOrEqual(0);
    expect(node.joint.x).toBeLessThanOrEqual(layout.width);
    expect(node.dot.x).toBeGreaterThanOrEqual(0);
    expect(node.dot.x).toBeLessThanOrEqual(layout.width);
  }
  for (const [index, node] of layout.nodes.entries()) {
    for (const other of layout.nodes.slice(index + 1)) {
      if (other.side !== node.side) continue;
      expect(boxesOverlap(node, other)).toBe(false);
    }
  }
}

describe('text measurement', () => {
  it('estimates Hangul a full em and Latin narrower', () => {
    expect(estimateTextWidth('지도학습', 12)).toBe(48);
    expect(estimateTextWidth('abcd', 12)).toBeLessThan(estimateTextWidth('지도학습', 12));
    expect(estimateTextWidth('', 12)).toBe(0);
  });

  it('grows with the text', () => {
    expect(estimateTextWidth('지도학습의 원리', 14)).toBeGreaterThan(estimateTextWidth('지도학습', 14));
  });

  it('measures a wrapped label by its longest line', () => {
    expect(widestLine(['지도학습', '원리'], 14)).toBe(estimateTextWidth('지도학습', 14));
    expect(widestLine([], 14)).toBe(0);
  });

  it('ellipsises only what does not fit', () => {
    expect(ellipsise('지도학습', 100, 14)).toBe('지도학습');
    const cut = ellipsise('훈련 데이터와 검증 데이터를 분리한다', 84, 14);
    expect(cut.endsWith('…')).toBe(true);
    expect(estimateTextWidth(cut, 14)).toBeLessThanOrEqual(84);
  });
});

describe('wrapLabel', () => {
  it('keeps a short term on one line', () => {
    expect(wrapLabel('지도학습', 268, BRANCH_FONT_SIZE)).toEqual({
      lines: ['지도학습'],
      truncated: false,
    });
  });

  it('reads a real concept term whole at both phone widths', () => {
    for (const panel of [PANEL_360, PANEL_320]) {
      const { branchMaxTextWidth } = mindMapFit(panel);
      for (const term of REAL_TERMS) {
        const wrapped = wrapLabel(term, branchMaxTextWidth, BRANCH_FONT_SIZE);
        expect(wrapped.truncated).toBe(false);
        expect(wrapped.lines.join(' ')).toBe(term);
        expect(wrapped.lines.length).toBeLessThanOrEqual(BRANCH_MAX_LINES);
      }
    }
  });

  it('breaks at a space onto a second line before it truncates', () => {
    const wrapped = wrapLabel('훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다', 228, 13, 2);
    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.truncated).toBe(false);
    expect(wrapped.lines.join(' ')).toBe('훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다');
  });

  it('breaks a word with no space in it by character', () => {
    const wrapped = wrapLabel('아주긴개념이름이띄어쓰기없이온다', 84, 14, 2);
    expect(wrapped.lines[0]).toBe('아주긴개념이');
    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.truncated).toBe(true);
  });

  it('never lets a line exceed the width it was given', () => {
    const samples = [
      '지도학습',
      ...REAL_TERMS,
      '훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다.',
      'Reinforcement learning with human feedback',
      '아주긴개념이름이띄어쓰기없이계속이어지는경우도있다',
    ];
    for (const width of [228, 268, 96, 60]) {
      for (const sample of samples) {
        const wrapped = wrapLabel(sample, width, BRANCH_FONT_SIZE);
        expect(wrapped.lines.length).toBeLessThanOrEqual(BRANCH_MAX_LINES);
        for (const line of wrapped.lines) {
          expect(estimateTextWidth(line, BRANCH_FONT_SIZE)).toBeLessThanOrEqual(width);
        }
      }
    }
  });

  it('ends in an ellipsis and reports it when the lines are not enough', () => {
    const wrapped = wrapLabel(
      '훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인하고 지표를 고른다',
      60,
      BRANCH_FONT_SIZE,
    );
    expect(wrapped.truncated).toBe(true);
    expect(wrapped.lines).toHaveLength(BRANCH_MAX_LINES);
    expect(wrapped.lines[BRANCH_MAX_LINES - 1]?.endsWith('…')).toBe(true);
  });

  it('survives an empty label and a width with no room', () => {
    expect(wrapLabel('   ', 200, 14)).toEqual({ lines: [''], truncated: false });
    const squeezed = wrapLabel('지도학습의 원리와 사례', 4, 14);
    expect(squeezed.lines).toHaveLength(BRANCH_MAX_LINES);
    expect(squeezed.truncated).toBe(true);
  });
});

describe('mindMapFit', () => {
  it('gives every level half the panel minus the room its connector needs', () => {
    const fit = mindMapFit(PANEL_360);
    expect(fit.width).toBe(320);
    expect(fit.centerX).toBe(160);
    expect(fit.branchMaxWidth).toBe(fit.centerX - MIN_REACH);
    expect(fit.leafMaxWidth).toBe(fit.centerX - LEAF_MIN_REACH - LEAF_EDGE_INSET);
    expect(fit.rootMaxWidth).toBe(320 - ROOT_SIDE_MARGIN * 2);
  });

  it('leaves a readable text column on a 320dp phone', () => {
    const fit = mindMapFit(PANEL_320);
    expect(fit.width).toBe(280);
    // Six Hangul characters per line at 14pt, so three lines hold about 20 —
    // enough for every concept term the packs actually produce.
    expect(Math.floor(fit.branchMaxTextWidth / BRANCH_FONT_SIZE)).toBeGreaterThanOrEqual(6);
  });

  it('never returns a negative column, however small the panel', () => {
    const fit = mindMapFit(10);
    expect(fit.width).toBe(10);
    expect(fit.branchMaxWidth).toBeGreaterThan(0);
    expect(fit.leafMaxTextWidth).toBeGreaterThan(0);
  });
});

describe('mind map nodes', () => {
  it('uses concepts as they are when there are three or more', () => {
    const nodes = mindMapNodesFor(concepts, keyPoints);
    expect(nodes.map((node) => node.id)).toEqual(['c1', 'c2', 'c3']);
    expect(nodes.every((node) => node.kind === 'concept')).toBe(true);
  });

  it('fills a thin note with key points', () => {
    const nodes = mindMapNodesFor(concepts.slice(0, 1), keyPoints);
    expect(nodes).toHaveLength(5);
    expect(nodes[0]).toMatchObject({ kind: 'concept', difficulty: 'basic' });
    expect(nodes[1]).toMatchObject({ kind: 'point', label: keyPoints[0] });
    expect(nodes[1]?.difficulty).toBeUndefined();
  });

  it('caps the map at eight nodes', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...concepts[0]!,
      id: `c-${index}`,
      term: `개념${index}`,
    }));
    expect(mindMapNodesFor(many, [])).toHaveLength(MAX_NODES);
  });

  it('finds the key points that mention a term, two at most', () => {
    expect(leafPointsFor('지도학습', keyPoints)).toEqual([keyPoints[0]]);
    expect(leafPointsFor('과적합', keyPoints)).toEqual([]);
    expect(leafPointsFor('데이터', keyPoints)).toHaveLength(2);
  });

  it('hangs a key point off one branch only', () => {
    const taken = new Set([keyPoints[0]!]);
    expect(leafPointsFor('지도학습', keyPoints, taken)).toEqual([]);
  });

  it('alternates the sides so the map reads down the spine', () => {
    expect([0, 1, 2, 3].map(sideFor)).toEqual(['right', 'left', 'right', 'left']);
  });
});

describe('connector shape', () => {
  it('gives a long reach a long run down the spine, within limits', () => {
    expect(hookRise(0)).toBe(26);
    expect(hookRise(120)).toBe(44);
    expect(hookRise(30)).toBe(31.5);
  });
});

describe('mind map layout', () => {
  const layout = computeMindMapLayout({
    width: PANEL_360,
    title: '5주차, 지도학습의 원리',
    nodes: mindMapNodesFor(concepts, keyPoints),
    keyPoints,
  });

  it('is exactly as wide as the panel it was measured in', () => {
    expect(layout.width).toBe(PANEL_360);
    expect(layout.centerX).toBe(160);
    expectInsideCanvas(layout);
  });

  it('centres the root on the spine and keeps it off the panel edges', () => {
    expect(layout.root.y).toBe(0);
    expect(Math.abs(layout.root.x * 2 + layout.root.width - layout.width)).toBeLessThanOrEqual(1);
    expect(layout.root.width).toBeLessThanOrEqual(layout.width - ROOT_SIDE_MARGIN * 2);
    expect(layout.root.lines).toEqual(['5주차, 지도학습의 원리']);
    expect(layout.root.truncated).toBe(false);
    // One line, so the hub is a capsule rather than a rounded box.
    expect(layout.root.radius).toBe(layout.root.height / 2);
    for (const node of layout.nodes) {
      expect(node.y).toBeGreaterThan(layout.root.y + layout.root.height);
    }
  });

  it('hangs the branches right, left, right off the spine', () => {
    const branches = branchesOf(layout);
    expect(branches.map((node) => node.id)).toEqual(['c1', 'c2', 'c3']);
    expect(branches.map((node) => node.side)).toEqual(['right', 'left', 'right']);
    for (const branch of branches) {
      if (branch.side === 'right') {
        expect(branch.x + branch.width).toBe(layout.width);
        expect(branch.joint.x).toBe(branch.x);
        expect(branch.align).toBe('left');
      } else {
        expect(branch.x).toBe(0);
        expect(branch.joint.x).toBe(branch.x + branch.width);
        expect(branch.align).toBe('right');
      }
      expect(Math.abs(branch.joint.x - layout.centerX)).toBeGreaterThanOrEqual(MIN_REACH);
      expect(branch.joint.y).toBe(branch.y + branch.height / 2);
    }
  });

  it('sizes each node to its own label instead of one width for all', () => {
    const mixed = computeMindMapLayout({
      width: PANEL_360,
      title: '제목',
      nodes: [
        conceptNode('short', '과적합'),
        conceptNode('long', 'ABA 치료 성공의 핵심 요인과 사례'),
      ],
    });
    const [short, long] = mixed.nodes;
    expect(short!.width).toBeLessThan(long!.width);
    expect(short!.width).toBeGreaterThanOrEqual(76);
    expect(long!.width).toBeLessThanOrEqual(mindMapFit(PANEL_360).branchMaxWidth);
    // A one-line node is a capsule; a wrapped one is a rounded card.
    expect(short!.radius).toBe(short!.height / 2);
    expect(long!.radius).toBe(16);
    expectInsideCanvas(mixed);
  });

  it('lets the two sides interlock so the map zigzags instead of stacking', () => {
    const zigzag = computeMindMapLayout({
      width: PANEL_360,
      title: '제목',
      nodes: concepts.map((concept) => conceptNode(concept.id, concept.term)),
    });
    const [first, second, third] = zigzag.nodes;
    // The left node starts before the right one above it has finished.
    expect(second!.y).toBeLessThan(first!.y + first!.height);
    expect(second!.y).toBeGreaterThan(first!.y);
    // Two nodes on the same side never do that.
    expect(third!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    expectInsideCanvas(zigzag);
  });

  it('keeps a branch tappable at 44pt and grows it line by line', () => {
    for (const branch of branchesOf(layout)) {
      expect(branch.height).toBeGreaterThanOrEqual(BRANCH_MIN_HEIGHT);
    }
    const wrapped = computeMindMapLayout({
      width: PANEL_320,
      title: '제목',
      nodes: [conceptNode('a', '훈련 데이터와 검증 데이터를 분리하는 이유')],
    });
    expect(wrapped.nodes[0]!.lines.length).toBeGreaterThan(1);
    expect(wrapped.nodes[0]!.height).toBeGreaterThan(BRANCH_MIN_HEIGHT);
  });

  it('hangs each matching key point on a twig under the concept that names it', () => {
    const leaves = leavesOf(layout);
    expect(leaves).toHaveLength(1);
    const leaf = leaves[0]!;
    const parent = layout.nodes.find((node) => node.id === leaf.parentId)!;
    expect(parent.id).toBe('c1');
    expect(leaf.side).toBe(parent.side);
    expect(leaf.y).toBeGreaterThanOrEqual(parent.y + parent.height);
    expect(leaf.fullLabel).toBe(keyPoints[0]);
    // A leaf stops short of the panel edge, so it reads as a level down.
    expect(leaf.x + leaf.width).toBe(layout.width - LEAF_EDGE_INSET);
  });

  it('reads every concept term whole, on three lines at most', () => {
    for (const branch of branchesOf(layout)) {
      expect(branch.truncated).toBe(false);
      expect(branch.lines.length).toBeLessThanOrEqual(BRANCH_MAX_LINES);
      expect(branch.lines.join(' ')).toBe(branch.fullLabel);
    }
  });

  /**
   * A leaf is a whole sentence, and half a phone panel does not hold one. It
   * shows as much as it can and ends in an ellipsis; the sheet and the
   * screen reader always read the sentence in full.
   */
  it('opens a long key point on the twig and keeps the rest for the sheet', () => {
    const leaf = leavesOf(layout)[0]!;
    expect(leaf.lines).toHaveLength(3);
    expect(leaf.lines[0]).toBe('지도학습은');
    expect(leaf.lines[2]?.endsWith('…')).toBe(true);
    expect(leaf.fullLabel).toBe(keyPoints[0]);
  });

  it('draws one spine, a hook per branch and a twig per leaf', () => {
    const kinds = layout.links.map((link) => link.kind);
    expect(kinds.filter((kind) => kind === 'trunk')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'branch')).toHaveLength(branchesOf(layout).length);
    expect(kinds.filter((kind) => kind === 'leaf')).toHaveLength(leavesOf(layout).length);
    expect(layout.links[0]!.id).toBe('trunk');
    expect(layout.links.every((link) => link.path.startsWith('M '))).toBe(true);
    for (const link of layout.links) {
      for (const token of link.path.split(' ')) {
        if (!token.length || 'MCLQ'.includes(token)) continue;
        expect(Number.isFinite(Number(token))).toBe(true);
      }
    }
  });

  it('curves each hook out of the spine and into the node it feeds', () => {
    for (const branch of branchesOf(layout)) {
      const hook = layout.links.find((link) => link.id === `hook-${branch.id}`)!;
      const numbers = hook.path.split(' ').filter((token) => token.length && !'MC'.includes(token));
      // It starts on the spine, at the bend that leans toward this branch.
      expect(Number(numbers[0])).toBe(
        layout.centerX + (branch.side === 'right' ? SPINE_BOW : -SPINE_BOW),
      );
      expect(Number(numbers[numbers.length - 2])).toBe(branch.joint.x);
      expect(Number(numbers[numbers.length - 1])).toBe(branch.joint.y);
      // A cubic, not an elbow: two control points between the ends.
      expect(numbers).toHaveLength(8);
      // It leaves the spine above the node and arrives level with its middle.
      expect(Number(numbers[1])).toBeLessThan(branch.joint.y);
    }
  });

  it('starts the spine inside the root and ends it where the last hook leaves', () => {
    const trunk = layout.links.find((link) => link.id === 'trunk')!;
    const tokens = trunk.path.split(' ');
    expect(Number(tokens[1])).toBe(layout.centerX);
    expect(Number(tokens[2])).toBeLessThan(layout.root.height);
    expect(Number(tokens[2])).toBeGreaterThan(layout.root.height - 12);
    // One curve per branch: the spine bends its way down past all of them.
    expect(tokens.filter((token) => token === 'C')).toHaveLength(branchesOf(layout).length);

    const numbers = tokens.filter((token) => token.length && !'MC'.includes(token));
    const last = branchesOf(layout).at(-1)!;
    const lastHook = layout.links.find((link) => link.id === `hook-${last.id}`)!;
    const hookStart = lastHook.path.split(' ').slice(1, 3).map(Number);
    // The spine hands over to the final hook rather than running past it.
    expect(Number(numbers[numbers.length - 2])).toBe(hookStart[0]);
    expect(Number(numbers[numbers.length - 1])).toBe(hookStart[1]);
    expect(Number(numbers[numbers.length - 1])).toBeCloseTo(
      last.joint.y - hookRise(Math.abs(last.joint.x - layout.centerX)),
      1,
    );
  });

  it('drops each twig out of its branch and into the head of its leaf', () => {
    for (const leaf of leavesOf(layout)) {
      const parent = layout.nodes.find((node) => node.id === leaf.parentId)!;
      const twig = layout.links.find((link) => link.id === `twig-${leaf.id}`)!;
      const numbers = twig.path.split(' ').filter((token) => token.length && !'MC'.includes(token));
      // It starts under the parent card, so the join hides beneath it.
      expect(Number(numbers[1])).toBeLessThan(parent.y + parent.height);
      expect(Number(numbers[1])).toBeGreaterThan(parent.y);
      expect(Number(numbers[numbers.length - 2])).toBe(leaf.joint.x);
      expect(Number(numbers[numbers.length - 1])).toBe(leaf.joint.y);
    }
  });

  it('puts the bead beside the node, never under it', () => {
    for (const node of layout.nodes) {
      if (node.side === 'right') {
        expect(node.dot.x).toBeLessThanOrEqual(node.x);
        expect(node.dot.x).toBeGreaterThan(layout.centerX);
      } else {
        expect(node.dot.x).toBeGreaterThanOrEqual(node.x + node.width);
        expect(node.dot.x).toBeLessThan(layout.centerX);
      }
      expect(node.dot.y).toBe(node.joint.y);
    }
  });

  it('ends the canvas at the lowest node', () => {
    const lowest = layout.nodes.reduce((deepest, node) => Math.max(deepest, node.y + node.height), 0);
    expect(layout.height).toBe(Math.ceil(lowest));
  });

  it('fits eight long concepts on either phone without leaving the panel', () => {
    for (const panel of [PANEL_360, PANEL_320]) {
      const crowded = computeMindMapLayout({
        width: panel,
        title: '발달장애 아동 양육한다면 꼭 알아야 할 ABA 치료법 2편, 문제행동 대처하기',
        nodes: Array.from({ length: 12 }, (_, index) =>
          conceptNode(`n${index}`, REAL_TERMS[index % REAL_TERMS.length]!),
        ),
        keyPoints,
      });
      expect(crowded.width).toBe(panel);
      expect(branchesOf(crowded)).toHaveLength(MAX_NODES);
      for (const branch of branchesOf(crowded)) {
        expect(branch.truncated).toBe(false);
      }
      expectInsideCanvas(crowded);
    }
  });

  it('keeps a very long key point inside the panel, truncated only at the end', () => {
    const long = computeMindMapLayout({
      width: PANEL_320,
      title: '제목',
      nodes: [conceptNode('a', '지도학습')],
      keyPoints: ['지도학습은 입력과 정답의 관계를 데이터에서 학습하고 새로운 입력에도 일반화한다.'],
    });
    const leaf = leavesOf(long)[0]!;
    expect(leaf.lines.length).toBeLessThanOrEqual(3);
    expect(leaf.fullLabel.startsWith('지도학습은')).toBe(true);
    expectInsideCanvas(long);
  });

  it('falls back to an ellipsis only when the lines cannot hold the term', () => {
    const squeezed = computeMindMapLayout({
      width: PANEL_320,
      title: '제목',
      nodes: [conceptNode('a', '아주긴개념이름이띄어쓰기없이한없이이어지는아주긴이름입니다정말로끝없이계속이어지는이름이에요')],
    });
    const node = squeezed.nodes[0]!;
    expect(node.truncated).toBe(true);
    expect(node.lines[node.lines.length - 1]?.endsWith('…')).toBe(true);
    // The sheet still has the whole thing, so nothing becomes unreachable.
    expect(node.fullLabel.startsWith('아주긴개념이름이')).toBe(true);
    expectInsideCanvas(squeezed);
  });

  it('draws nothing but the root when the pack has no concepts', () => {
    const empty = computeMindMapLayout({ width: PANEL_360, title: '제목', nodes: [] });
    expect(empty.nodes).toEqual([]);
    expect(empty.links).toEqual([]);
    expect(empty.height).toBe(empty.root.height);
  });

  it('keeps a thin note honest by promoting key points to branches', () => {
    const thin = computeMindMapLayout({
      width: PANEL_360,
      title: '시각화 실습, 좋은 그래프의 조건',
      nodes: mindMapNodesFor(concepts.slice(0, 1), keyPoints),
      keyPoints,
    });
    expect(thin.nodes.filter((node) => node.kind === 'point' && node.level === 'branch')).toHaveLength(4);
    // The point that already stands on its own never repeats as a leaf.
    expect(leavesOf(thin)).toHaveLength(0);
    expectInsideCanvas(thin);
  });
});
