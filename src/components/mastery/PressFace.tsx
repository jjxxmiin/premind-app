import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Tappable, type TappableProps } from '@/components/app';

export interface PressFaceProps extends Omit<TappableProps, 'style' | 'children'> {
  /** The visible face: fill, radius, padding, layout. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * `Tappable` with the face drawn by an inner View.
 *
 * On the web build `Tappable` currently loses its `style` (it hands the
 * animated Pressable a style function, which react-native-web drops), so a
 * card's fill, padding and row layout vanished. Drawing the face inside keeps
 * it on every platform; the press, haptic and accessibility stay with
 * `Tappable`. Once the shared part is fixed this can pass `style` straight on.
 */
export function PressFace({ children, style, ...rest }: PressFaceProps) {
  return (
    <Tappable {...rest} style={styles.fill}>
      <View style={[styles.fill, style]}>{children}</View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
});
