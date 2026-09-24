import { TAB_SWIPE_THRESHOLD, nextTabForSwipe } from './useTabSwipe';

/** The material screen's three tabs, in strip order. */
const tabs = ['transcript', 'summary', 'mindmap'] as const;

describe('nextTabForSwipe', () => {
  it('moves forward on a leftward swipe and back on a rightward one', () => {
    expect(nextTabForSwipe(tabs, 'summary', -TAB_SWIPE_THRESHOLD)).toBe('mindmap');
    expect(nextTabForSwipe(tabs, 'summary', TAB_SWIPE_THRESHOLD)).toBe('transcript');
  });

  it('ignores a swipe under the threshold', () => {
    expect(nextTabForSwipe(tabs, 'summary', -(TAB_SWIPE_THRESHOLD - 1))).toBeNull();
    expect(nextTabForSwipe(tabs, 'summary', 0)).toBeNull();
  });

  it('stays put at either end of the strip', () => {
    expect(nextTabForSwipe(tabs, 'transcript', 80)).toBeNull();
    expect(nextTabForSwipe(tabs, 'mindmap', -80)).toBeNull();
  });

  it('does nothing for a tab outside the strip', () => {
    expect(nextTabForSwipe(tabs, 'chat' as never, -80)).toBeNull();
  });
});
