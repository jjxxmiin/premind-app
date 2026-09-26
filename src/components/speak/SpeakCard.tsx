import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Press } from '@/components/speak/Press';
import type { PressState } from '@/components/ui';
import { colors, palette, radii, shadows, spacing } from '@/theme/tokens';

export type SpeakCardTone = 'raised' | 'soft' | 'brand';

/**
 * 누르는 카드(2026-09-26 앱다운): 테두리 대신 채운 면. `raised` 흰 면 + 옅은 그림자,
 * `soft` 옅은 회색 면, `brand` 옅은 주황 면. 누르면 가라앉고 폰은 가볍게 떨린다(Tappable).
 * 웹 hover 는 면을 한 단계 진하게, 포커스는 주황 링.
 */
export function SpeakCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'raised',
  style,
  testID,
}: PropsWithChildren<{
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  tone?: SpeakCardTone | 'default';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  const face = tone === 'default' ? 'raised' : tone;
  return (
    <Press
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, focused }: PressState) => [
        styles.card,
        styles[face],
        hovered ? styles[`${face}Hover`] : null,
        focused && Platform.OS === 'web' ? styles.focus : null,
        style,
      ]}
      testID={testID}
    >
      {children}
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.hero,
    cursor: 'pointer',
    padding: spacing.gutter,
  },
  raised: { backgroundColor: colors.surface, ...shadows.card },
  raisedHover: { ...shadows.raised },
  soft: { backgroundColor: colors.backgroundSoft },
  softHover: { backgroundColor: colors.backgroundMuted },
  brand: { backgroundColor: colors.brandSoft },
  brandHover: { backgroundColor: palette.accent100 },
  focus: {
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
    outlineWidth: 3,
  } as object,
});
