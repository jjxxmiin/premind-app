import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/lib/layout';
import { colors, spacing } from '@/theme/tokens';

/**
 * 엄지가 닿는 자리의 주 버튼(토스, 스픽): 폰에서는 화면 아래에 붙고 위로 옅게 흐려진다.
 * 태블릿, 데스크톱에서는 붙지 않고 제자리(본문 흐름)에 둔다 — 넓은 화면에서 바닥 띠는 웹 같다.
 * 폰에서 쓸 때는 본문 아래에 이 높이만큼 여백을 두어 마지막 내용이 가리지 않게 한다(BOTTOM_ACTION_SPACE).
 */
export const BOTTOM_ACTION_SPACE = 96;

export function BottomAction({ children }: { children: ReactNode }) {
  const { breakpoint } = useLayout();
  if (breakpoint !== 'compact') return <View style={styles.inline}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.dock}>
      <View style={styles.fade} pointerEvents="none" />
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dock: { bottom: 0, left: 0, position: 'absolute', right: 0 },
  fade: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    opacity: 0.94,
    position: 'absolute',
    right: 0,
    top: spacing.md,
  },
  inner: { gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  inline: { gap: spacing.sm },
});
