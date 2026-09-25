import { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, fontFamilies } from '@/theme/tokens';

import { SCORE_BAND_EDGES, SCORE_MAX, bandTrack } from './lens-charts';

export interface RubricBandTrackProps {
  score: number;
  /**
   * Null inside a row that already announces the score, so the reading is not
   * duplicated; omitted to let the track describe itself.
   */
  accessibilityLabel?: string | null;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_WIDTH = 240;
const TRACK_HEIGHT = 8;
const MARKER_RADIUS = 6;
const MARKER_STROKE = 2;
/** Keeps the marker's white ring inside the drawing at 0 and at 5 points. */
const INSET = MARKER_RADIUS + MARKER_STROKE / 2;
const CENTER_Y = INSET;
const TRACK_Y = CENTER_Y - TRACK_HEIGHT / 2;
const LABEL_FONT_SIZE = 11;
const LABEL_Y = 27;
const SVG_HEIGHT = 31;

/** "2.5 보통, 3.5 좋아요, 4.5 아주 좋아요" — the edges this track draws. */
export const BAND_EDGE_TEXT = SCORE_BAND_EDGES.map((edge) => edge.toFixed(1)).join(', ');

/**
 * One rubric score placed against the bands rather than just measured: the
 * track is the whole 0–5 scale, the faint notches are the band edges, and the
 * ink dot sits where the score landed with its band word underneath.
 */
export function RubricBandTrack({ score, accessibilityLabel, style }: RubricBandTrackProps) {
  const t = useT();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const track = bandTrack(score, width, LABEL_Y, INSET, SCORE_MAX, t.locale);
  const usable = Math.max(0, width - INSET * 2);
  const described = accessibilityLabel === null;
  const label =
    accessibilityLabel ??
    t('{score}점, {band} 구간. {max}점 만점에 {edges}이 구간을 나눠요.', {
      score: score.toFixed(1),
      band: track.label.text,
      max: SCORE_MAX,
      edges: BAND_EDGE_TEXT,
    });

  return (
    <View
      {...(described ? decorative : { accessible: true, accessibilityLabel: label })}
      onLayout={(event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      style={[styles.wrap, style]}
    >
      <Svg height={SVG_HEIGHT} width={width}>
        <Rect
          fill={colors.backgroundMuted}
          height={TRACK_HEIGHT}
          rx={TRACK_HEIGHT / 2}
          width={usable}
          x={INSET}
          y={TRACK_Y}
        />
        {track.fillWidth > 0 ? (
          <Rect
            fill={colors.textFaint}
            fillOpacity={0.45}
            height={TRACK_HEIGHT}
            rx={TRACK_HEIGHT / 2}
            width={track.fillWidth}
            x={INSET}
            y={TRACK_Y}
          />
        ) : null}
        {track.separators.map((x, index) => (
          <Line
            key={`edge-${index}`}
            stroke={colors.surface}
            strokeWidth={2}
            x1={x}
            x2={x}
            y1={TRACK_Y}
            y2={TRACK_Y + TRACK_HEIGHT}
          />
        ))}
        <Circle
          cx={track.markerX}
          cy={CENTER_Y}
          fill={colors.text}
          r={MARKER_RADIUS}
          stroke={colors.surface}
          strokeWidth={MARKER_STROKE}
        />
        <SvgText
          fill={colors.textMuted}
          fontFamily={fontFamilies.bold}
          fontSize={LABEL_FONT_SIZE}
          textAnchor={track.label.textAnchor}
          x={track.label.x}
          y={track.label.y}
        >
          {track.label.text}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
});
