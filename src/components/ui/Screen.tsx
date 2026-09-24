import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useLayout } from '@/lib/layout';
import { colors } from '@/theme/tokens';

export type ScreenBackground = 'canvas' | 'soft' | 'paper' | 'stage';

export interface ScreenProps {
  scroll?: boolean;
  padded?: boolean;
  centered?: boolean;
  safeArea?: boolean;
  safeAreaEdges?: readonly Edge[];
  background?: ScreenBackground;
  /**
   * Let content span the whole window on tablets instead of sitting in a
   * centred readable column. For screens that are one edge-to-edge surface —
   * a video player, a full-bleed recording stage — not for screens of cards.
   */
  fullBleed?: boolean;
  /**
   * Narrow the content column past the default. For screens that are one
   * focused task — answering a question, watching a progress bar — where the
   * full readable width just spreads a short line of content thin.
   */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
  testID?: string;
}

const backgroundColors: Record<ScreenBackground, string> = {
  canvas: colors.background,
  soft: colors.backgroundSoft,
  paper: colors.surface,
  stage: colors.stage,
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  centered = false,
  safeArea = true,
  safeAreaEdges = ['top', 'right', 'bottom', 'left'],
  background = 'canvas',
  fullBleed = false,
  maxWidth,
  style,
  contentStyle,
  scrollViewProps,
  testID,
}: PropsWithChildren<ScreenProps>) {
  const { gutter, contentMaxWidth, isTablet } = useLayout();
  const backgroundColor = backgroundColors[background];

  // The column only exists on tablets. A phone screen is already a readable
  // measure, and wrapping it would be a layout change with no visible payoff.
  const column = isTablet && !fullBleed;

  const sharedContentStyle: StyleProp<ViewStyle> = [
    styles.content,
    padded ? { paddingHorizontal: gutter, paddingVertical: gutter } : null,
    centered ? styles.centered : null,
    column ? styles.columnHost : null,
    contentStyle,
  ];

  const body = column ? (
    <View
      style={[
        scroll ? styles.scrollColumn : styles.fillColumn,
        { maxWidth: Math.min(maxWidth ?? contentMaxWidth, contentMaxWidth) },
      ]}
    >
      {children}
    </View>
  ) : (
    children
  );

  const content = scroll ? (
    <ScrollView
      {...scrollViewProps}
      style={styles.fill}
      contentContainerStyle={sharedContentStyle}
      keyboardShouldPersistTaps={
        scrollViewProps?.keyboardShouldPersistTaps ?? 'handled'
      }
    >
      {body}
    </ScrollView>
  ) : (
    <View style={[sharedContentStyle, styles.nonScrollContent]}>{body}</View>
  );

  if (!safeArea) {
    return (
      <View testID={testID} style={[styles.safeArea, { backgroundColor }, style]}>
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView
      testID={testID}
      edges={[...safeAreaEdges]}
      style={[styles.safeArea, { backgroundColor }, style]}
    >
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  nonScrollContent: {
    flex: 1,
    minHeight: 0,
  },
  columnHost: {
    alignItems: 'center',
  },
  fillColumn: {
    flex: 1,
    width: '100%',
  },
  scrollColumn: {
    flexGrow: 1,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
