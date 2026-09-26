import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration } from '@/lib/format';
import { tr, useT } from '@/lib/i18n';
import { colors, fontFamilies, radii, spacing } from '@/theme/tokens';
import type { ImportantMarker, StudyConcept } from '@/types';

export interface LectureTimelineProps {
  durationMs: number;
  markers: readonly ImportantMarker[];
  concepts: readonly StudyConcept[];
  positionMs: number;
  onSeek: (timestampMs: number) => void;
  style?: StyleProp<ViewStyle>;
}

const SVG_HEIGHT = 60;
const BAR_Y = 26;
const BAR_HEIGHT = 6;
const PIN_Y = 13;
const PIN_RADIUS = 3.5;
const DOT_RADIUS = 3.5;
const TICK_LABEL_Y = 54;
const TICK_FONT_SIZE = 12;
const TICK_EVERY_MS = 10 * 60_000;
/** A tick label this close to the end label would collide with it. */
const TICK_CLEARANCE = 30;
/** Screen-reader nudges move by half a minute. */
const A11Y_STEP_MS = 30_000;

interface Tick {
  ms: number;
  label: string;
}

/** Tick marks every ten minutes plus the end, dropping any that would sit on the end label. */
export function timelineTicks(durationMs: number, width: number): { ticks: Tick[]; end: Tick } {
  const end = { ms: durationMs, label: formatDuration(durationMs / 1000) };
  const ticks: Tick[] = [];
  for (let ms = 0; ms < durationMs; ms += TICK_EVERY_MS) {
    const x = (ms / durationMs) * width;
    if (ms > 0 && width - x < TICK_CLEARANCE + 12) break;
    ticks.push({ ms, label: ms === 0 ? '0' : tr('{n}분', { n: ms / 60_000 }) });
  }
  return { ticks, end };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The lecture as one bar: where the important moments are, where each
 * concept has its evidence, and where playback is right now. Tapping the
 * bar seeks; the list below it stays the place to read what each moment is.
 */
export function LectureTimeline({
  durationMs,
  markers,
  concepts,
  positionMs,
  onSeek,
  style,
}: LectureTimelineProps) {
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const trackRef = useRef<View>(null);
  const [width, setWidth] = useState(
    Math.max(160, windowWidth - spacing.gutter * 4),
  );
  const safeDuration = Math.max(1, durationMs);
  const toX = (ms: number) => clamp((ms / safeDuration) * width, 0, width);
  const positionX = toX(positionMs);
  const { ticks, end } = timelineTicks(safeDuration, width);
  const mine = markers.filter((marker) => marker.source === 'teacher');
  const detected = markers.filter((marker) => marker.source !== 'teacher');

  const seekToX = (x: number) => {
    onSeek(Math.round(clamp(x / width, 0, 1) * safeDuration));
  };

  const seekAt = (event: GestureResponderEvent) => {
    // Native presses carry the touch offset. React Native Web fires onPress
    // from a DOM click, which only knows the viewport position, so measure.
    const native = event.nativeEvent as { locationX?: number; clientX?: number };
    if (typeof native.locationX === 'number' && Number.isFinite(native.locationX)) {
      seekToX(native.locationX);
      return;
    }
    const clientX = native.clientX;
    if (typeof clientX !== 'number' || !Number.isFinite(clientX)) return;
    trackRef.current?.measureInWindow((left) => seekToX(clientX - left));
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    onSeek(clamp(positionMs + direction * A11Y_STEP_MS, 0, safeDuration));
  };

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.head}>
        <AppText variant="itemTitle">{t('강의 흐름')}</AppText>
        <AppText tabular tone="muted" variant="meta">
          {formatDuration(positionMs / 1000)} / {end.label}
        </AppText>
      </View>
      <Pressable
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityHint={t('누른 곳부터 재생해요.')}
        accessibilityLabel={t('강의 진행 위치')}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: `${formatDuration(positionMs / 1000)} / ${end.label}` }}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={(event: LayoutChangeEvent) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0 && next !== width) setWidth(next);
        }}
        onPress={seekAt}
        ref={trackRef}
        style={styles.track}
      >
        <View {...decorative}>
          <Svg height={SVG_HEIGHT} width={width}>
            <Rect
              fill={colors.backgroundMuted}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              width={width}
              x={0}
              y={BAR_Y}
            />
            {positionX > 0 ? (
              <Rect
                fill={colors.borderStrong}
                height={BAR_HEIGHT}
                rx={BAR_HEIGHT / 2}
                width={positionX}
                x={0}
                y={BAR_Y}
              />
            ) : null}
            {ticks.map((tick) => (
              <SvgText
                fill={colors.textFaint}
                fontFamily={fontFamilies.medium}
                fontSize={TICK_FONT_SIZE}
                key={tick.ms}
                textAnchor={tick.ms === 0 ? 'start' : 'middle'}
                x={toX(tick.ms)}
                y={TICK_LABEL_Y}
              >
                {tick.label}
              </SvgText>
            ))}
            <SvgText
              fill={colors.textFaint}
              fontFamily={fontFamilies.medium}
              fontSize={TICK_FONT_SIZE}
              textAnchor="end"
              x={width}
              y={TICK_LABEL_Y}
            >
              {end.label}
            </SvgText>
            {[...detected, ...mine].map((marker) => {
              const x = toX(marker.timestampMs);
              const tone = marker.source === 'teacher' ? colors.brand : colors.textFaint;
              return (
                <Line
                  key={`pin-${marker.id}`}
                  stroke={tone}
                  strokeWidth={1.5}
                  x1={x}
                  x2={x}
                  y1={PIN_Y}
                  y2={BAR_Y}
                />
              );
            })}
            {[...detected, ...mine].map((marker) => (
              <Circle
                cx={toX(marker.timestampMs)}
                cy={PIN_Y}
                fill={marker.source === 'teacher' ? colors.brand : colors.textFaint}
                key={`head-${marker.id}`}
                r={PIN_RADIUS}
              />
            ))}
            {concepts.map((concept) => (
              <Circle
                cx={toX(concept.sourceStartMs)}
                cy={BAR_Y + BAR_HEIGHT / 2}
                fill={colors.text}
                key={concept.id}
                r={DOT_RADIUS}
                stroke={colors.surface}
                strokeWidth={1.5}
              />
            ))}
            <Line
              stroke={colors.text}
              strokeLinecap="round"
              strokeWidth={1.5}
              x1={positionX}
              x2={positionX}
              y1={PIN_Y - 6}
              y2={BAR_Y + BAR_HEIGHT + 6}
            />
          </Svg>
        </View>
      </Pressable>
      {markers.length || concepts.length ? (
        <View style={styles.legend}>
          {mine.length ? <LegendItem color={colors.brand} label={t('내가 표시')} /> : null}
          {detected.length ? <LegendItem color={colors.textFaint} label={t('AI 감지')} /> : null}
          {concepts.length ? <LegendItem color={colors.text} label={t('개념')} /> : null}
        </View>
      ) : null}
    </Card>
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
  card: { gap: spacing.sm },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: { alignSelf: 'stretch' },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  legendDot: { borderRadius: radii.full, height: 8, width: 8 },
});
