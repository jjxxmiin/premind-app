import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLayout } from '@/lib/layout';
import { spacing } from '@/theme/tokens';

/** 두 칸 화면이 쓰는 최대 폭. 사이드바를 뺀 노트북 폭을 거의 다 쓴다. */
export const SPEAK_WIDE_MAX = 1120;

/**
 * 말하기 화면의 폭. 폰, 태블릿은 한 칸, 데스크톱(expanded)은 주 내용 + 옆 칸 두 칸.
 * 옆 칸은 웹에서 스크롤을 따라 붙는다(sticky). (공용으로 올릴 만하다: layout/TwoColumn)
 */
export function SpeakColumns({
  main,
  side,
  sideFirstOnNarrow = false,
  sideWidth = 360,
  sticky = true,
  style,
}: {
  main: ReactNode;
  side: ReactNode;
  /** 한 칸일 때 옆 칸을 위에 둘지. */
  sideFirstOnNarrow?: boolean;
  sideWidth?: number;
  sticky?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { breakpoint } = useLayout();
  if (breakpoint !== 'expanded') {
    return (
      <View style={[styles.stack, style]}>
        {sideFirstOnNarrow ? side : main}
        {sideFirstOnNarrow ? main : side}
      </View>
    );
  }
  return (
    <View style={[styles.row, style]}>
      <View style={styles.main}>{main}</View>
      <View style={[styles.side, { width: sideWidth }, sticky && Platform.OS === 'web' ? styles.sticky : null]}>
        {side}
      </View>
    </View>
  );
}

/** 넓은 화면에서 가운데 두는 틀. 폰은 그대로 꽉 찬다. */
export function SpeakFrame({ children, maxWidth = SPEAK_WIDE_MAX }: { children: ReactNode; maxWidth?: number }) {
  return <View style={[styles.frame, { maxWidth }]}>{children}</View>;
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', width: '100%' },
  stack: { gap: spacing.xl },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.xl },
  main: { flex: 1, gap: spacing.xl, minWidth: 0 },
  side: { flexShrink: 0, gap: spacing.xl },
  sticky: { position: 'sticky' as 'relative', top: spacing.md },
});
