import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

/** How far a finger travels sideways before the panel changes tab. */
export const TAB_SWIPE_THRESHOLD = 40;
/** The pan claims the touch after this much sideways travel… */
const ACTIVATE_OFFSET_X = 16;
/**
 * …and gives up as soon as the finger moves this far vertically, so lists
 * scroll. Android's ScrollView takes over even earlier (its own touch slop
 * is about 8dp, at which point it calls `requestDisallowInterceptTouchEvent`
 * and the gesture-handler root cancels every pending handler), so a vertical
 * drag can never be eaten by this gesture as long as there is exactly one
 * `GestureHandlerRootView` above it.
 */
const FAIL_OFFSET_Y = 12;

/**
 * The tab a horizontal swipe lands on: a leftward swipe (negative
 * `translationX`) moves forward, rightward moves back, and either end of
 * the strip stays put. Null when the movement is under the threshold.
 */
export function nextTabForSwipe<T>(
  tabs: readonly T[],
  current: T,
  translationX: number,
  threshold = TAB_SWIPE_THRESHOLD,
): T | null {
  if (Math.abs(translationX) < threshold) return null;
  const index = tabs.indexOf(current);
  if (index < 0) return null;
  const target = tabs[translationX < 0 ? index + 1 : index - 1];
  return target === undefined ? null : target;
}

export interface UseTabSwipeOptions<T> {
  tabs: readonly T[];
  value: T;
  onChange: (next: T) => void;
  enabled?: boolean;
}

/**
 * A pan gesture that switches to the neighbouring tab. Attach it with
 * `GestureDetector` to the panel, not to anything that must own horizontal
 * touches itself (a composer, a carousel). Never wrap the detector in its own
 * `GestureHandlerRootView`: the app root already provides one, and a nested
 * root inside scroll content is at best inert and at worst a second touch
 * arbiter fighting the ScrollView.
 */
export function useTabSwipe<T>({ tabs, value, onChange, enabled = true }: UseTabSwipeOptions<T>) {
  // Rebuilt when the tab changes; GestureDetector swaps the gesture in place.
  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .maxPointers(1)
        .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .runOnJS(true)
        .onEnd((event) => {
          const next = nextTabForSwipe(tabs, value, event.translationX);
          if (next !== null) onChange(next);
        }),
    [enabled, onChange, tabs, value],
  );
}
