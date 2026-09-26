import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, motion, radii, spacing } from '@/theme/tokens';

type PressState = { hovered?: boolean; pressed: boolean; focused?: boolean };

/**
 * 누르는 카드. ui/Card 와 같은 면(흰 면, 얇은 테두리, 16 반경)에 웹 hover(테두리 진하게,
 * 배경 살짝)와 포커스 링, 눌림(scale) 을 더했다. (공용으로 올릴 만하다: Card 의 hover)
 */
export function SpeakCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'default',
  style,
  testID,
}: PropsWithChildren<{
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** `brand`: 이어서 하기처럼 옅은 주황 면. */
  tone?: 'default' | 'brand';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  const brand = tone === 'brand';
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed, focused }: PressState) => [
        styles.card,
        brand ? styles.brand : null,
        hovered ? (brand ? styles.brandHover : styles.hover) : null,
        focused ? styles.focus : null,
        pressed ? styles.pressed : null,
        style,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    cursor: 'pointer',
    padding: spacing.gutter,
  },
  hover: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  brand: {
    backgroundColor: colors.brandSubtle,
    borderColor: colors.brandSoft,
  },
  brandHover: {
    borderColor: colors.brand,
  },
  focus: {
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
    outlineWidth: 3,
  } as object,
  pressed: {
    opacity: 0.92,
    transform: [{ scale: motion.press.cardScale }],
  },
});
