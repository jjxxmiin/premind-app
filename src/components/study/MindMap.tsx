import { Network } from 'lucide-react-native';
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
import { colors, palette, radii, spacing } from '@/theme/tokens';
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
function sheetTitle(node: MindMapNode): string {
  return node.kind === 'concept' ? node.fullLabel : tr('꼭 기억할 내용');
}

function sheetBody(node: MindMapNode): string {
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

  const nodes = useMemo(() => mindMapNodesFor(concepts, keyPoints), [concepts, keyPoints]);
  const layout = useMemo(
    () => computeMindMapLayout({ width, title, nodes, keyPoints }),
    [keyPoints, nodes, title, width],
  );
  const selected = layout.nodes.find((node) => node.id === selectedId) ?? null;

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
        <View
          style={[
            styles.node,
            styles.root,
            {
              borderRadius: layout.root.radius,
              height: layout.root.height,
              left: layout.root.x,
              top: layout.root.y,
              width: layout.root.width,
            },
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
        </View>

        {layout.nodes.map((node) => (
          <Pressable
            accessibilityHint={t('설명과 근거 시점을 보여 줘요.')}
            accessibilityLabel={
              node.difficulty
                ? `${node.fullLabel}, ${t(DIFFICULTY_META[node.difficulty].label)}`
                : node.fullLabel
            }
            accessibilityRole="button"
            key={node.id}
            onPress={() => setSelectedId(node.id)}
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

      {concepts.length ? (
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
});
