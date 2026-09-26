import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Press } from '@/components/speak/Press';
import { AppText, BreathingView } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, palette, shadows, spacing } from '@/theme/tokens';

/**
 * 스픽 결의 큰 둥근 버튼: 화면의 주인공. 주황 원 + 옅은 숨 쉬는 테(움직임 줄이기면 멈춤) + 아래 이름.
 */
export function RoundAction({
  icon: Icon,
  label,
  onPress,
  accessibilityHint,
  size = 88,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  size?: number;
  testID?: string;
}) {
  const halo = size + 28;
  return (
    <Press
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      pressScale={0.94}
      style={styles.roundWrap}
      testID={testID}
    >
      {({ hovered }) => (
        <>
          <View style={{ alignItems: 'center', height: halo, justifyContent: 'center', width: halo }}>
            <BreathingView style={[styles.halo, { borderRadius: halo / 2, height: halo, width: halo }]}>
              <View />
            </BreathingView>
            <View
              {...decorative}
              style={[
                styles.round,
                { borderRadius: size / 2, height: size, width: size },
                hovered ? styles.roundHover : null,
              ]}
            >
              <Icon color={colors.textInverse} size={Math.round(size * 0.4)} strokeWidth={2.2} />
            </View>
          </View>
          <AppText align="center" variant="buttonLarge">
            {label}
          </AppText>
        </>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  roundWrap: { alignItems: 'center', alignSelf: 'center', cursor: 'pointer', gap: spacing.xs },
  halo: { backgroundColor: palette.accent100, position: 'absolute' },
  round: { alignItems: 'center', backgroundColor: colors.brand, justifyContent: 'center', ...shadows.raised },
  roundHover: { backgroundColor: colors.brandStrong },
});
