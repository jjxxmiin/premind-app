import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { decorative } from '@/lib/a11y';
import { colors, illustration } from '@/theme/tokens';

import { arcDash, polarPoint, waveformBars } from './artwork-geometry';

/**
 * Line art for the screens a new account opens first.
 *
 * These are drawn, not imported: no network image, no clip art, no photograph.
 * They are built from the same palette as everything else — hairline strokes,
 * grey fills, one soft tone from `illustration.tones` — so an empty screen
 * still looks like the app rather than like a placeholder.
 *
 * Each piece is decorative. The `EmptyState` around it already announces its
 * title and sentence, and a screen reader gains nothing from hearing a
 * waveform described, so the artwork is hidden from the accessibility tree.
 */

/** The frame every piece is drawn in; the caller only chooses a width. */
const VIEW_BOX = { width: 160, height: 110 } as const;

export interface ArtworkProps {
  /** Rendered width in points. The height follows the frame's ratio. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

function ArtworkFrame({
  children,
  style,
  width = VIEW_BOX.width,
}: ArtworkProps & { children: ReactNode }) {
  const height = (width / VIEW_BOX.width) * VIEW_BOX.height;
  return (
    <View {...decorative} style={[styles.frame, style]}>
      <Svg
        height={height}
        viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
        width={width}
      >
        {children}
      </Svg>
    </View>
  );
}

const WAVEFORM_COUNT = 7;
const WAVEFORM_BAR = 4;
const WAVEFORM_GAP = 3;
const WAVEFORM_MIN = 12;
const WAVEFORM_MAX = 46;
const WAVEFORM_CENTRE_Y = 58;

/**
 * 홈, before the first 자료: a voice on the left turning into a 마인드팩 on
 * the right — the whole product in one shape.
 */
export function EmptyLibraryArtwork({ style, width }: ArtworkProps) {
  const bars = waveformBars(WAVEFORM_COUNT);
  return (
    <ArtworkFrame style={style} width={width}>
      <G>
        {bars.map((fraction, index) => {
          const barHeight = WAVEFORM_MIN + fraction * (WAVEFORM_MAX - WAVEFORM_MIN);
          return (
            <Rect
              fill={colors.textFaint}
              height={barHeight}
              key={index}
              // The voice darkens as it travels into the pack, so the eye
              // reads the artwork left to right without needing an arrow.
              opacity={0.22 + (index / (WAVEFORM_COUNT - 1)) * 0.6}
              rx={WAVEFORM_BAR / 2}
              width={WAVEFORM_BAR}
              x={4 + index * (WAVEFORM_BAR + WAVEFORM_GAP)}
              y={WAVEFORM_CENTRE_Y - barHeight / 2}
            />
          );
        })}
      </G>

      {/* The pack, with one card behind it so the library reads as a stack. */}
      <Rect
        fill={colors.backgroundSoft}
        height={72}
        rx={12}
        stroke={colors.border}
        strokeWidth={1}
        width={86}
        x={66}
        y={14}
      />
      <Rect
        fill={colors.surface}
        height={72}
        rx={12}
        stroke={colors.borderStrong}
        strokeWidth={1.5}
        width={86}
        x={60}
        y={24}
      />
      {/* 요약: a tinted label and two lines of text. */}
      <Rect
        fill={illustration.tones.sky}
        height={10}
        rx={5}
        width={28}
        x={70}
        y={34}
      />
      <Rect fill={colors.borderStrong} height={5} rx={2.5} width={66} x={70} y={52} />
      <Rect fill={colors.borderStrong} height={5} rx={2.5} width={48} x={70} y={62} />
      {/* 마인드맵: one idea with two branches. */}
      <Line
        stroke={colors.borderStrong}
        strokeLinecap="round"
        strokeWidth={1.5}
        x1={83}
        x2={104}
        y1={80}
        y2={74}
      />
      <Line
        stroke={colors.borderStrong}
        strokeLinecap="round"
        strokeWidth={1.5}
        x1={83}
        x2={104}
        y1={80}
        y2={86}
      />
      <Circle cx={78} cy={80} fill={colors.text} r={5} />
      <Circle cx={107} cy={74} fill={colors.borderStrong} r={3.5} />
      <Circle cx={107} cy={86} fill={colors.borderStrong} r={3.5} />
    </ArtworkFrame>
  );
}

const RING = { cx: 80, cy: 58, radius: 38, stroke: 9 } as const;
/** A hair of ink, centred on twelve o'clock: the gauge is at its start. */
const RING_START = 0.05;
const RING_START_OFFSET = -90 - (RING_START * 360) / 2;

/**
 * 이해도, before the first answer: a ring at zero over a 확인 목록, so the
 * screen shows what is about to be filled rather than only saying it.
 */
export function EmptyMasteryArtwork({ style, width }: ArtworkProps) {
  const centre = { x: RING.cx, y: RING.cy };
  const circumference = 2 * Math.PI * RING.radius;
  const ticks = [0, 90, 180, 270].map((degrees) => ({
    degrees,
    inner: polarPoint(centre, RING.radius + 10, degrees),
    outer: polarPoint(centre, RING.radius + 15, degrees),
  }));

  return (
    <ArtworkFrame style={style} width={width}>
      {ticks.map((tick) => (
        <Line
          key={tick.degrees}
          stroke={colors.border}
          strokeLinecap="round"
          strokeWidth={2}
          x1={tick.inner.x}
          x2={tick.outer.x}
          y1={tick.inner.y}
          y2={tick.outer.y}
        />
      ))}
      <Circle
        cx={RING.cx}
        cy={RING.cy}
        fill="none"
        r={RING.radius}
        stroke={colors.backgroundMuted}
        strokeWidth={RING.stroke}
      />
      <Circle
        cx={RING.cx}
        cy={RING.cy}
        fill="none"
        r={RING.radius}
        stroke={colors.text}
        strokeDasharray={arcDash(RING_START, circumference)}
        strokeLinecap="round"
        strokeWidth={RING.stroke}
        transform={`rotate(${RING_START_OFFSET} ${RING.cx} ${RING.cy})`}
      />

      {/* 꼭 기억할 내용: the first box ticked, the rest waiting. */}
      <Rect fill={colors.text} height={10} rx={3} width={10} x={59} y={44} />
      <Path
        d="M61.5 49 L63.8 51.3 L68 46.6"
        fill="none"
        stroke={colors.textInverse}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <Rect fill={colors.borderStrong} height={5} rx={2.5} width={26} x={75} y={46.5} />

      <Rect
        fill={colors.surface}
        height={10}
        rx={3}
        stroke={colors.borderStrong}
        strokeWidth={1.5}
        width={10}
        x={59}
        y={58}
      />
      <Rect fill={colors.borderStrong} height={5} rx={2.5} width={20} x={75} y={60.5} />

      <Rect
        fill={colors.surface}
        height={10}
        rx={3}
        stroke={colors.borderStrong}
        strokeWidth={1.5}
        width={10}
        x={59}
        y={72}
      />
      <Rect fill={colors.borderStrong} height={5} rx={2.5} width={24} x={75} y={74.5} />
    </ArtworkFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
});
