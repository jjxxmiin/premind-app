import type { PropsWithChildren, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, motion, radii, spacing } from '@/theme/tokens';

/**
 * What react-native-web hands a Pressable's style function. The native types
 * only know `pressed`; on the web `hovered` and `focused` come along too.
 */
export interface InteractionState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * A pinned side column on the web build. RN web passes `position: sticky`
 * through to CSS; on a phone the value would be invalid, so it is web only.
 */
export function stickyColumn(top: number = spacing.sm): StyleProp<ViewStyle> {
  if (Platform.OS !== 'web') return null;
  return { position: 'sticky', top } as unknown as ViewStyle;
}

export interface SurfaceButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Styles for the chosen state; `style` is laid over them. */
  selectedStyle?: StyleProp<ViewStyle>;
  selected?: boolean;
  children?: ReactNode;
}

/**
 * A white, hairline-bordered surface the whole of which is one target: a
 * study tile, a quiz choice. On the web it answers the pointer (a slightly
 * darker border and a faint wash) and dips a hair when pressed. The keyboard
 * focus ring is left to the browser's own :focus-visible, which a mouse click
 * does not trigger; a `focused` style here would linger on the clicked card.
 */
export function SurfaceButton({
  children,
  selected = false,
  selectedStyle,
  style,
  ...props
}: PropsWithChildren<SurfaceButtonProps>) {
  return (
    <Pressable
      {...props}
      style={(state) => {
        const { hovered, pressed } = state as InteractionState;
        return [
          styles.surface,
          selected ? selectedStyle : null,
          // After the chosen state, so a caller's tint (a right or wrong
          // answer) wins over the plain "picked" border.
          style,
          hovered && !props.disabled ? styles.hovered : null,
          pressed ? styles.pressed : null,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}

/**
 * Tiles in rows of `columns`, every tile in a row the same width. Rows are
 * built by hand rather than with `flexWrap`, so a short last row keeps its
 * tiles at the width of the rows above instead of stretching them.
 */
export function TileGrid({
  children,
  columns,
  gap = spacing.md,
}: {
  children: ReactNode[];
  columns: number;
  gap?: number;
}) {
  const rows: ReactNode[][] = [];
  children.forEach((child, index) => {
    const row = Math.floor(index / columns);
    (rows[row] ??= []).push(child);
  });
  return (
    <View style={{ gap }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap }]}>
          {row.map((child, cellIndex) => (
            <View key={cellIndex} style={styles.cell}>
              {child}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, spare) => (
            <View key={`spare-${spare}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null),
  },
  hovered: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: motion.press.cardScale }],
  },
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
