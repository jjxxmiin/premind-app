import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { useLayout } from '@/lib/layout';
import { colors, radii, spacing } from '@/theme/tokens';

import { Screen } from './Screen';

/**
 * Direction D (2026-10-04, CEO "D로 가"): a dark top that carries the screen's
 * one big thing — a greeting and the start box, the 이해도 number, the player —
 * and a white sheet rising over it with everything else. Every tab root and
 * the 마인드팩 screen are built from it, so the app reads as one product.
 *
 * The status bar turns light only while this screen is focused: unfocused tabs
 * stay mounted, and a light bar left behind would vanish on the white screens
 * pushed over them.
 */
export function useLightStatusBar(): ReactNode {
  const focused = useIsFocused();
  return focused ? <StatusBar style="light" /> : null;
}

/** The white sheet over the dark top. Rounded on top, white to the bottom. */
export function StageSheet({
  children,
  style,
  padded = true,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; padded?: boolean }>) {
  const { gutter } = useLayout();
  return (
    <View style={[styles.sheet, padded ? { paddingHorizontal: gutter } : null, style]}>{children}</View>
  );
}

/**
 * A scrolling tab root in direction D: `header` (an inverse `AppHeader`),
 * `hero` on the dark top, then `children` in the sheet. The sheet grows to the
 * bottom of the screen however short its content is.
 */
export function StageScreen({
  header,
  hero,
  children,
  heroStyle,
  sheetStyle,
  scrollViewProps,
}: PropsWithChildren<{
  header?: ReactNode;
  hero?: ReactNode;
  heroStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: ScrollViewProps;
}>) {
  const { gutter } = useLayout();
  const statusBar = useLightStatusBar();
  return (
    <Screen
      background="stage"
      padded={false}
      safeAreaEdges={['top', 'left', 'right']}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false, ...scrollViewProps }}
    >
      {statusBar}
      {header}
      {hero ? <View style={[styles.hero, { paddingHorizontal: gutter }, heroStyle]}>{hero}</View> : null}
      <StageSheet style={sheetStyle}>{children}</StageSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
});
