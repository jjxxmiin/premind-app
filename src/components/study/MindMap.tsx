import { ChevronLeft, Network } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  AnimatedReveal,
  AppText,
  BottomSheetModal,
  Button,
  EmptyState,
  StatusBadge,
  type StatusTone,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatSourcePosition } from '@/lib/format';
import { tr, useT } from '@/lib/i18n';
import { colors, iconSizes, palette, radii, spacing } from '@/theme/tokens';
import type { StudyConcept } from '@/types';

import {
  BRANCH_DOT_RADIUS,
  BRANCH_INSET_X,
  LEAF_DOT_RADIUS,
  LEAF_INSET_X,
  ROOT_INSET_X,
  computeMindMapLayout,
  mindMapNodesFor,
  type MindMapDifficulty,
  type MindMapLinkKind,
  type MindMapNode,
} from './mind-map-layout';

export interface MindMapProps {
  title: string;
  concepts: readonly StudyConcept[];
  keyPoints: readonly string[];
  /** Plays the evidence for a concept; the screen also switches to 대본. */
  onListen: (timestampMs: number) => void;
  /** True for an uploaded document: positions are pages, and nothing plays. */
  page?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 난이도 reads as a temperature: cool for 기본, warm for 심화. These are the
 * soft illustration tones, so a tinted node still sits on the white canvas,
 * and the accent is left out of the map entirely.
 */
const DIFFICULTY_META: Record<MindMapDifficulty, { label: string; fill: string; tone: StatusTone }> = {
  basic: { label: '기본', fill: palette.skySoft, tone: 'info' },
  intermediate: { label: '중간', fill: palette.butterSoft, tone: 'warning' },
  advanced: { label: '심화', fill: palette.apricotSoft, tone: 'brand' },
};

const DIFFICULTY_ORDER: readonly MindMapDifficulty[] = ['basic', 'intermediate', 'advanced'];

/** Line weight carries the hierarchy: the spine is heaviest, a twig lightest. */
const LINK_WIDTH: Record<MindMapLinkKind, number> = {
  trunk: 3,
  branch: 2,
  leaf: 1.25,
};

function nodeFill(node: MindMapNode): string {
  if (node.level === 'leaf') return colors.transparent;
  return node.difficulty ? DIFFICULTY_META[node.difficulty].fill : colors.backgroundSoft;
}

/**
 * A concept's own term is the sheet title; a key point is a whole sentence, so
 * it becomes the body under the glossary name instead of a heading-sized line.
 */
/** What the detail sheet needs: a laid-out node, or the focused concept itself. */
type SheetNode = Pick<MindMapNode, 'kind' | 'fullLabel' | 'description' | 'sourceStartMs' | 'difficulty'>;

function sheetTitle(node: SheetNode): string {
  return node.kind === 'concept' ? node.fullLabel : tr('꼭 기억할 내용');
}

function sheetBody(node: SheetNode): string {
  if (node.kind !== 'concept') return node.fullLabel;
  return node.description ?? tr('이 개념은 아직 설명이 없어요.');
}

/**
 * The study pack as a map: the 자료 as an ink hub at the top, a spine dropping
 * out of it, and every 개념 hanging off that spine on a curve — right, left,
 * right — with a 꼭 기억할 내용 on a twig under the concept that names it.
 * Tapping a node explains it and offers the moment in the lecture it came from.
 *
 * Why it is shaped this way (2026-09-07): a phone panel is 280–320pt wide, so
 * a ring cuts every label to a few characters and a single indented column
 * turns the map into a list of coloured bars. A spine splits the width into
 * two label columns instead, and because each node is only as wide as its own
 * term, the sizes differ, the sides interlock, and the middle is left free for
 * the curves. Nothing is ever wider than half the panel, so the canvas is
 * exactly the panel width and the page scroll and tab swipe stay the only
 * gestures in it — no pan, no zoom, nothing off the screen.
 *
 * One depth at a time (2026-10-04, CEO "클릭하면 뎁스 넘어가듯"): the map
 * opens on the 자료 and its 개념 only. A 개념 that has 꼭 기억할 내용 under it
 * carries a "›"; tapping it makes that 개념 the hub with its points around
 * it, and a path above the map ("자료 › 개념") steps back. Tapping the hub, a
 * point, or a 개념 with nothing under it opens the explanation sheet.
 */
export function MindMap({
  title,
  concepts,
  keyPoints,
  onListen,
  page = false,
  style,
}: MindMapProps) {
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(240, windowWidth - spacing.gutter * 2));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const nodes = useMemo(() => mindMapNodesFor(concepts, keyPoints), [concepts, keyPoints]);
  /** The 꼭 기억할 내용 that name each 개념: what opens when it is tapped. */
  const pointsByConcept = useMemo(() => {
    const byId = new Map<string, string[]>();
    for (const node of nodes) {
      if (node.kind !== 'concept') continue;
      const needle = node.label.trim().toLocaleLowerCase('ko-KR');
      const points = needle
        ? keyPoints.filter((point) => point.toLocaleLowerCase('ko-KR').includes(needle))
        : [];
      if (points.length) byId.set(node.id, points);
    }
    return byId;
  }, [keyPoints, nodes]);
  const focus = focusId ? nodes.find((node) => node.id === focusId) ?? null : null;

  const layout = useMemo(() => {
    if (focus) {
      const focusPoints = pointsByConcept.get(focus.id) ?? [];
      return computeMindMapLayout({
        width,
        title: focus.label,
        nodes: focusPoints.map((point, index) => ({
          id: `${focus.id}-point-${index}`,
          kind: 'point' as const,
          label: point,
          description: point,
        })),
      });
    }
    return computeMindMapLayout({
      width,
      title,
      nodes: nodes.map((node) =>
        pointsByConcept.has(node.id) ? { ...node, label: `${node.label} ›` } : node,
      ),
    });
  }, [focus, nodes, pointsByConcept, title, width]);

  const FOCUS_SHEET = '__focus__';
  const selected: SheetNode | null =
    selectedId === FOCUS_SHEET && focus
      ? {
          kind: 'concept',
          fullLabel: focus.label,
          description: focus.description,
          sourceStartMs: focus.sourceStartMs,
          difficulty: focus.difficulty,
        }
      : layout.nodes.find((node) => node.id === selectedId) ?? null;

  const pressNode = (node: MindMapNode) => {
    if (!focus && pointsByConcept.has(node.id)) {
      setFocusId(node.id);
      return;
    }
    setSelectedId(node.id);
  };

  if (!nodes.length) {
    return (
      <EmptyState
        compact
        description={t('마인드팩에 개념이 생기면 여기에 연결해서 보여 줘요.')}
        icon={Network}
        style={style}
        title={t('아직 개념이 없어요')}
      />
    );
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const listen = () => {
    if (!selected || selected.sourceStartMs === undefined) return;
    const at = selected.sourceStartMs;
    setSelectedId(null);
    onListen(at);
  };

  return (
    <View onLayout={handleLayout} style={[styles.container, style]}>
      {focus ? (
        <Pressable
          accessibilityHint={t('처음 마인드맵으로 돌아가요.')}
          accessibilityLabel={t('{title}로 돌아가기', { title })}
          accessibilityRole="button"
          onPress={() => setFocusId(null)}
          style={({ pressed }) => [styles.crumbs, pressed ? styles.pressed : null]}
          testID="mind-map-back"
        >
          <ChevronLeft {...decorative} color={colors.textMuted} size={iconSizes.inline} strokeWidth={2} />
          <AppText numberOfLines={1} style={styles.crumbRoot} tone="muted" variant="label">
            {title}
          </AppText>
          <AppText tone="faint" variant="label">
            ›
          </AppText>
          <AppText numberOfLines={1} style={styles.crumbLeaf} variant="label">
            {focus.label}
          </AppText>
        </Pressable>
      ) : null}
      {/* Keyed by depth, so stepping in or out replays the reveal. */}
      <AnimatedReveal distance={8} key={focus?.id ?? 'root'}>
      <View style={{ height: layout.height, width: layout.width }}>
        {/* The linework sits under the nodes, so every join disappears under
            the card it feeds rather than stopping short of it. */}
        <View {...decorative} style={StyleSheet.absoluteFill}>
          <Svg height={layout.height} width={layout.width}>
            {layout.links.map((link) => (
              <Path
                d={link.path}
                fill="none"
                key={link.id}
                stroke={colors.borderStrong}
                strokeLinecap="round"
                strokeWidth={LINK_WIDTH[link.kind]}
              />
            ))}
            {/* A bead where each connector meets its node: tinted like the
                node on a branch, a plain dot at the head of a leaf. */}
            {layout.nodes.map((node) =>
              node.level === 'branch' ? (
                <Circle
                  cx={node.dot.x}
                  cy={node.dot.y}
                  fill={nodeFill(node)}
                  key={`dot-${node.id}`}
                  r={BRANCH_DOT_RADIUS}
                  stroke={colors.borderStrong}
                  strokeWidth={1.5}
                />
              ) : (
                <Circle
                  cx={node.dot.x}
                  cy={node.dot.y}
                  fill={colors.borderStrong}
                  key={`dot-${node.id}`}
                  r={LEAF_DOT_RADIUS}
                />
              ),
            )}
          </Svg>
        </View>

        {/* The hub repeats the 자료 title the header already announces, so it
            carries no heading role of its own — it is here to anchor the map. */}
        <Pressable
          accessibilityHint={focus ? t('설명과 근거 시점을 보여 줘요.') : undefined}
          accessibilityRole={focus ? 'button' : undefined}
          disabled={!focus}
          onPress={() => setSelectedId(FOCUS_SHEET)}
          style={({ pressed }) => [
            styles.node,
            styles.root,
            {
              borderRadius: layout.root.radius,
              height: layout.root.height,
              left: layout.root.x,
              top: layout.root.y,
              width: layout.root.width,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          {layout.root.lines.map((line, index) => (
            <AppText
              align="center"
              key={`root-${index}`}
              numberOfLines={1}
              tone="inverse"
              variant="itemTitle"
            >
              {line}
            </AppText>
          ))}
        </Pressable>

        {layout.nodes.map((node) => (
          <Pressable
            accessibilityHint={
              !focus && pointsByConcept.has(node.id)
                ? t('이 개념의 꼭 기억할 내용을 펼쳐요.')
                : t('설명과 근거 시점을 보여 줘요.')
            }
            accessibilityLabel={
              node.difficulty
                ? `${node.fullLabel}, ${t(DIFFICULTY_META[node.difficulty].label)}`
                : node.fullLabel
            }
            accessibilityRole="button"
            key={node.id}
            onPress={() => pressNode(node)}
            style={({ pressed }) => [
              styles.node,
              node.level === 'leaf' ? styles.leaf : styles.branch,
              {
                backgroundColor: nodeFill(node),
                borderRadius: node.radius,
                height: node.height,
                left: node.x,
                top: node.y,
                width: node.width,
              },
              pressed ? styles.pressed : null,
            ]}
          >
            {node.lines.map((line, index) => (
              <AppText
                align={node.align}
                key={`${node.id}-${index}`}
                numberOfLines={1}
                tone={node.level === 'leaf' ? 'muted' : 'default'}
                variant={node.level === 'leaf' ? 'meta' : 'label'}
              >
                {line}
              </AppText>
            ))}
          </Pressable>
        ))}
      </View>
      </AnimatedReveal>

      {concepts.length && !focus ? (
        <View style={styles.legend}>
          {DIFFICULTY_ORDER.map((difficulty) => (
            <View key={difficulty} style={styles.legendItem}>
              <View
                {...decorative}
                style={[styles.legendDot, { backgroundColor: DIFFICULTY_META[difficulty].fill }]}
              />
              <AppText tone="muted" variant="badge">
                {t(DIFFICULTY_META[difficulty].label)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <BottomSheetModal
        footer={
          selected?.sourceStartMs !== undefined ? (
            <Button fullWidth onPress={listen} size="large" variant="primary">
              {page
                ? t('근거 보기 {pos}', { pos: formatSourcePosition(selected.sourceStartMs, page) })
                : t('근거 듣기 {pos}', { pos: formatSourcePosition(selected.sourceStartMs, page) })}
            </Button>
          ) : undefined
        }
        onClose={() => setSelectedId(null)}
        title={selected ? sheetTitle(selected) : undefined}
        visible={selected !== null}
      >
        {selected ? (
          <View style={styles.sheetBody}>
            {selected.difficulty ? (
              <StatusBadge
                label={t(DIFFICULTY_META[selected.difficulty].label)}
                tone={DIFFICULTY_META[selected.difficulty].tone}
              />
            ) : null}
            {/* A concept explains itself; a 꼭 기억할 내용 *is* the sentence,
                so the sheet shows it in full rather than repeating the title. */}
            <AppText variant="body">{sheetBody(selected)}</AppText>
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  /** Every node is placed by the layout module, so the box is absolute. */
  node: {
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  root: {
    backgroundColor: colors.action,
    paddingHorizontal: ROOT_INSET_X,
  },
  /** A concept is a solid tinted bubble: the tone is the 난이도, no border needed. */
  branch: { paddingHorizontal: BRANCH_INSET_X },
  /** A key point is not a card at all — text on a twig, one clear level down. */
  leaf: { paddingHorizontal: LEAF_INSET_X },
  pressed: { opacity: 0.6 },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  legendDot: {
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 10,
    width: 10,
  },
  sheetBody: { gap: spacing.md },
  crumbs: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: '100%',
    minHeight: 32,
  },
  crumbRoot: { flexShrink: 1 },
  crumbLeaf: { flexShrink: 2 },
});
