import { createContext, useContext, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
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

const ScreenOverlayContext = createContext({
  bottomInsetHandled: false,
  dockHeight: 0,
  setDockHeight: (_height: number) => {},
});

export function useScreenOverlay() {
  return useContext(ScreenOverlayContext);
}

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
  /**
   * Use the wide column (`useLayout().wideMaxWidth`, 1200 on a desktop
   * window) instead of the reading column. For two-column screens and card
   * grids that have a use for the width; `maxWidth` may then go up to it.
   */
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
  /** Viewport-pinned feedback, outside the scrolling content. */
  overlay?: ReactNode;
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
  wide = false,
  style,
  contentStyle,
  scrollViewProps,
  overlay,
  testID,
}: PropsWithChildren<ScreenProps>) {
  const { gutter, contentMaxWidth, wideMaxWidth, isTablet } = useLayout();
  const [dockHeight, setDockHeight] = useState(0);
  const bottomInsetHandled = safeArea && safeAreaEdges.includes('bottom');
  const overlayContext = useMemo(
    () => ({ bottomInsetHandled, dockHeight, setDockHeight }),
    [bottomInsetHandled, dockHeight],
  );
  const columnLimit = wide ? wideMaxWidth : contentMaxWidth;
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
        { maxWidth: Math.min(maxWidth ?? columnLimit, columnLimit) },
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
        <ScreenOverlayContext value={overlayContext}>
          <View style={styles.fill}>
            {content}
            {overlay}
          </View>
        </ScreenOverlayContext>
      </View>
    );
  }

  return (
    <SafeAreaView
      testID={testID}
      edges={[...safeAreaEdges]}
      style={[styles.safeArea, { backgroundColor }, style]}
    >
      <ScreenOverlayContext value={overlayContext}>
        <View style={styles.fill}>
          {content}
          {overlay}
        </View>
      </ScreenOverlayContext>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    minHeight: 0,
  },
  fill: {
    flex: 1,
    minHeight: 0,
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
    minHeight: 0,
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
