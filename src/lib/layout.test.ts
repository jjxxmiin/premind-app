import { resolveLayout } from './layout';

/** What `useLayout()` returns for a window of exactly this size. */
const layoutAt = resolveLayout;

describe('layout breakpoints', () => {
  it.each([
    { label: 'a phone', width: 390, height: 844, breakpoint: 'compact', columns: 1 },
    { label: 'a small phone', width: 320, height: 568, breakpoint: 'compact', columns: 1 },
    { label: 'a tablet in portrait', width: 834, height: 1112, breakpoint: 'medium', columns: 2 },
    { label: 'a tablet in landscape', width: 1194, height: 834, breakpoint: 'expanded', columns: 3 },
  ])('reads $label as $breakpoint', ({ width, height, breakpoint, columns }) => {
    const layout = layoutAt(width, height);
    expect(layout.breakpoint).toBe(breakpoint);
    expect(layout.columns).toBe(columns);
    expect(layout.isTablet).toBe(breakpoint !== 'compact');
  });

  it('is decided by the window, not the device', () => {
    // A tablet running the app in a narrow split-screen pane is a phone layout:
    // the breakpoint has to follow the space the app actually has.
    expect(layoutAt(480, 1112).breakpoint).toBe('compact');
  });

  it.each([
    { width: 599, breakpoint: 'compact' },
    { width: 600, breakpoint: 'medium' },
    { width: 1023, breakpoint: 'medium' },
    { width: 1024, breakpoint: 'expanded' },
  ])('puts $width in $breakpoint', ({ width, breakpoint }) => {
    expect(layoutAt(width, 900).breakpoint).toBe(breakpoint);
  });

  it('widens the gutter and the column as the window grows', () => {
    const phone = layoutAt(390, 844);
    const portrait = layoutAt(834, 1112);
    const landscape = layoutAt(1194, 834);

    expect(phone.gutter).toBeLessThan(portrait.gutter);
    expect(portrait.gutter).toBeLessThan(landscape.gutter);
    expect(portrait.contentMaxWidth).toBeLessThan(landscape.contentMaxWidth);
    // …but never past a readable measure.
    expect(landscape.contentMaxWidth).toBeLessThan(landscape.width);
  });

  it('reports orientation from the window', () => {
    expect(layoutAt(1194, 834).isLandscape).toBe(true);
    expect(layoutAt(834, 1112).isLandscape).toBe(false);
  });
});

describe('gridItemWidth', () => {
  it('divides the content column, gaps included', () => {
    const { gridItemWidth, gutter, contentMaxWidth } = layoutAt(1194, 834);
    const available = contentMaxWidth - gutter * 2;

    expect(gridItemWidth(3, 12)).toBe(Math.floor((available - 24) / 3));
    expect(gridItemWidth(1, 12)).toBe(available);
  });

  it('never lets a row overflow the column it sits in', () => {
    for (const width of [320, 390, 600, 834, 1024, 1194, 1600]) {
      const layout = layoutAt(width, 900);
      const gap = 12;
      const row =
        layout.gridItemWidth(layout.columns, gap) * layout.columns +
        gap * (layout.columns - 1);
      const column = Math.min(width, layout.isTablet ? layout.contentMaxWidth : width);

      expect(row).toBeLessThanOrEqual(column - layout.gutter * 2);
    }
  });

  it('measures a phone against the window rather than the tablet column', () => {
    const layout = layoutAt(390, 844);
    expect(layout.gridItemWidth(1)).toBe(390 - layout.gutter * 2);
  });
});
