import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fontFamilies, radii, sizes, spacing } from '@/theme/tokens';
import type { LensMoment } from '@/types';

import { momentMarks, type MomentKind, type MomentMark, type TimelineScale } from './lens-charts';

export interface MomentsTimelineProps {
  strengths: readonly LensMoment[];
  improvements: readonly LensMoment[];
  priority: LensMoment | null;
  durationMs?: number;
  /** `${kind}-${index}` of the moment the list is currently showing. */
  activeKey?: string | null;
  onSelect: (mark: MomentMark) => void;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 280;
const SVG_HEIGHT = 58;
const BAR_Y = 30;
const BAR_HEIGHT = 6;
const HEAD_Y = 13;
const HEAD_RADIUS = 5;
const PRIORITY_RADIUS = 6.5;
const ACTIVE_RADIUS = 10;
const TICK_LABEL_Y = 54;
const TICK_FONT_SIZE = 11;
/** Keeps an edge marker's head inside the drawing. */
const INSET = HEAD_RADIUS + 2;
const HIT_SIZE = sizes.minimumTouchTarget;

const KIND_LABEL: Record<MomentKind, string> = {
  strength: '잘한 점',
  improvement: '더 좋아질 점',
};

const CAPTION: Record<TimelineScale, string> = {
  duration: '강의 전체 길이 기준이에요. 표시를 누르면 그 근거로 이동해요.',
  'last-moment': '강의 길이를 몰라 마지막 근거까지만 그렸어요. 표시를 누르면 그 근거로 이동해요.',
  even: '시간 정보가 없어 순서대로 나란히 놓았어요. 표시를 누르면 그 근거로 이동해요.',
};

export function momentKey(kind: MomentKind, index: number): string {
  return `${kind}-${index}`;
}

function colorFor(mark: MomentMark): string {
  if (mark.priority) return colors.brand;
  return mark.kind === 'strength' ? colors.text : colors.textFaint;
}

/**
 * The lecture as one bar with a pin for every piece of evidence: ink for a
 * strength, grey for an improvement, and the accent on the one thing to fix
 * first. Tapping a pin brings the matching row into view.
 */
export function MomentsTimeline({
  strengths,
  improvements,
  priority,
  durationMs,
  activeKey = null,
  onSelect,
  style,
}: MomentsTimelineProps) {
  const t = useT();
  const kindLabel = (kind: MomentKind) => t(KIND_LABEL[kind]);
  const priorityNote = `, ${t('먼저 고칠 것')}`;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const { marks, scale, spanMs } = momentMarks(
    strengths,
    improvements,
    priority,
    durationMs,
    width,
    INSET,
  );
  const momentOf = (mark: MomentMark): LensMoment | undefined =>
    mark.kind === 'strength' ? strengths[mark.index] : improvements[mark.index];
  const summary = marks
    .map((mark) => {
      const time = scale === 'even' ? '' : `${formatDuration(mark.sourceStartMs / 1_000)} `;
      return `${time}${kindLabel(mark.kind)}${mark.priority ? priorityNote : ''}`;
    })
    .join(', ');

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.stage}>
      <View
        accessibilityLabel={t('근거 시점, {n}개. {summary}', { n: marks.length, summary })}
        accessible
        style={styles.track}
      >
        <View
          {...decorative}
          onLayout={(event: LayoutChangeEvent) => {
            const next = Math.round(event.nativeEvent.layout.width);
            if (next > 0 && next !== width) setWidth(next);
          }}
        >
          <Svg height={SVG_HEIGHT} width={width}>
            <Rect
              fill={colors.backgroundMuted}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              width={width}
              x={0}
              y={BAR_Y}
            />
            {scale !== 'even' ? (
              <>
                <SvgText
                  fill={colors.textFaint}
                  fontFamily={fontFamilies.medium}
                  fontSize={TICK_FONT_SIZE}
                  textAnchor="start"
                  x={0}
                  y={TICK_LABEL_Y}
                >
                  0
                </SvgText>
                <SvgText
                  fill={colors.textFaint}
                  fontFamily={fontFamilies.medium}
                  fontSize={TICK_FONT_SIZE}
                  textAnchor="end"
                  x={width}
                  y={TICK_LABEL_Y}
                >
                  {formatDuration(spanMs / 1_000)}
                </SvgText>
              </>
            ) : null}
            {marks.map((mark) => (
              <Line
                key={`pin-${momentKey(mark.kind, mark.index)}`}
                stroke={colorFor(mark)}
                strokeWidth={1.5}
                x1={mark.x}
                x2={mark.x}
                y1={HEAD_Y}
                y2={BAR_Y + BAR_HEIGHT / 2}
              />
            ))}
            {marks.map((mark) => {
              const key = momentKey(mark.kind, mark.index);
              return (
                <Circle
                  cx={mark.x}
                  cy={HEAD_Y}
                  fill={colorFor(mark)}
                  key={`head-${key}`}
                  r={mark.priority ? PRIORITY_RADIUS : HEAD_RADIUS}
                  stroke={colors.surface}
                  strokeWidth={1.5}
                />
              );
            })}
            {marks.map((mark) => {
              const key = momentKey(mark.kind, mark.index);
              if (key !== activeKey) return null;
              return (
                <Circle
                  cx={mark.x}
                  cy={HEAD_Y}
                  fill="none"
                  key={`active-${key}`}
                  r={ACTIVE_RADIUS}
                  stroke={colorFor(mark)}
                  strokeWidth={1.5}
                />
              );
            })}
          </Svg>
        </View>
      </View>
      <View style={[styles.hits, { width }]}>
        {marks.map((mark) => {
          const key = momentKey(mark.kind, mark.index);
          const moment = momentOf(mark);
          const time = scale === 'even' ? '' : `${formatDuration(mark.sourceStartMs / 1_000)}, `;
          return (
            <Pressable
              accessibilityHint={t('목록에서 이 근거로 이동해요.')}
              accessibilityLabel={`${time}${kindLabel(mark.kind)}${mark.priority ? priorityNote : ''}. ${moment?.text ?? ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: key === activeKey }}
              hitSlop={spacing.xs}
              key={`hit-${key}`}
              onPress={() => onSelect(mark)}
              style={({ pressed }) => [
                styles.hit,
                { left: Math.round(mark.x - HIT_SIZE / 2) },
                pressed ? styles.hitPressed : null,
              ]}
            />
          );
        })}
      </View>
      </View>
      <View style={styles.legend}>
        {strengths.length ? <LegendItem color={colors.text} label={kindLabel('strength')} /> : null}
        {improvements.length ? (
          <LegendItem color={colors.textFaint} label={kindLabel('improvement')} />
        ) : null}
        {marks.some((mark) => mark.priority) ? (
          <LegendItem color={colors.brand} label={t('먼저 고칠 것')} />
        ) : null}
      </View>
      <AppText tone="faint" variant="badge">
        {t(CAPTION[scale])}
      </AppText>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View {...decorative} style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText tone="muted" variant="badge">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.sm },
  stage: { alignSelf: 'stretch', position: 'relative' },
  track: { alignSelf: 'stretch' },
  /** Sits over the drawing so every pin has a 44pt target. */
  hits: {
    height: SVG_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  hit: {
    borderRadius: radii.full,
    height: HIT_SIZE,
    position: 'absolute',
    top: HEAD_Y - HIT_SIZE / 2,
    width: HIT_SIZE,
  },
  hitPressed: { backgroundColor: colors.overlaySoft },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  legendDot: { borderRadius: radii.full, height: 8, width: 8 },
});
