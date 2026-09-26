import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme/tokens';

/**
 * Width in points where the layout stops being a phone layout.
 *
 * 600 is the smallest tablet in portrait; 1024 is a tablet in landscape (and
 * anything larger the web build runs on). Both are read from the window rather
 * than the device, so a split-screen tablet gets the phone layout it deserves.
 */
export const breakpoints = { medium: 600, expanded: 1024 } as const;

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export interface Layout {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isTablet: boolean;
  isLandscape: boolean;
  /** Horizontal padding for screen content at this width. */
  gutter: number;
  /**
   * How wide the content column may get.
   *
   * A phone screen is already a readable measure; a tablet is not. Left
   * unbounded, a 1194pt window turns a paragraph into a 150-character line and
   * strands a card's content in its top-left corner, which is exactly what the
   * app did before this existed.
   */
  contentMaxWidth: number;
  /**
   * How wide a two-column or card-grid screen may get: 1200 on a laptop or
   * desktop window, where a single 960 column leaves a third of the screen
   * empty; the same as `contentMaxWidth` below that, where there is no second
   * column to make room for.
   */
  wideMaxWidth: number;
  /** Cards per row for the card grids (library, quick actions, packages). */
  columns: number;
  /** Exact pixel width of one grid cell, gaps accounted for. */
  gridItemWidth: (columns: number, gap?: number) => number;
}

/**
 * The whole layout decision, as a function of the window.
 *
 * Separate from the hook so it can be reasoned about — and tested — without a
 * renderer: everything here is arithmetic on two numbers.
 */
export function resolveLayout(width: number, height: number): Layout {
  const breakpoint: Breakpoint =
    width >= breakpoints.expanded
      ? 'expanded'
      : width >= breakpoints.medium
        ? 'medium'
        : 'compact';
  const isTablet = breakpoint !== 'compact';
  const gutter =
    breakpoint === 'expanded'
      ? spacing.xxl
      : breakpoint === 'medium'
        ? spacing.xl
        : spacing.gutter;
  const contentMaxWidth = breakpoint === 'expanded' ? 960 : 760;
  const wideMaxWidth = breakpoint === 'expanded' ? 1200 : contentMaxWidth;
  const columns = breakpoint === 'expanded' ? 3 : breakpoint === 'medium' ? 2 : 1;

  return {
    width,
    height,
    breakpoint,
    isTablet,
    isLandscape: width > height,
    gutter,
    contentMaxWidth,
    wideMaxWidth,
    columns,
    gridItemWidth: (count: number, gap: number = spacing.md) => {
      const available =
        Math.min(width, isTablet ? contentMaxWidth : width) - gutter * 2;
      // Floor, so rounding can only leave a hairline of slack rather than
      // pushing the last cell onto its own row.
      return Math.floor((available - gap * (count - 1)) / count);
    },
  };
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => resolveLayout(width, height), [height, width]);
}
