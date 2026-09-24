import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { swipeVerdict, type CardVerdict } from '@/lib/flashcards';

/** The pan claims the touch after this much sideways travel… */
const ACTIVATE_OFFSET_X = 16;
/**
 * …and gives up this far vertically, so the page can still scroll and a
 * two-finger or diagonal drag never answers a card by accident. Same numbers
 * as the 마인드팩 tab swipe, for one feel across the app.
 */
const FAIL_OFFSET_Y = 14;

export interface UseCardSwipeOptions {
  onVerdict: (verdict: CardVerdict) => void;
  enabled?: boolean;
}

/**
 * Swipe a card away: right for 알아요, left for 다시 볼래요.
 *
 * Attach with `GestureDetector`. Never wrap the detector in its own
 * `GestureHandlerRootView` — the app root already provides one, and a second
 * touch arbiter inside it is at best inert.
 */
export function useCardSwipe({ onVerdict, enabled = true }: UseCardSwipeOptions) {
  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .maxPointers(1)
        .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .runOnJS(true)
        .onEnd((event) => {
          const verdict = swipeVerdict(event.translationX);
          if (verdict) onVerdict(verdict);
        }),
    [enabled, onVerdict],
  );
}
