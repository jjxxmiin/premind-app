/**
 * A document's pages, read like a book (2026-10-04): the page strip and the
 * 쪽 요약 under it turn together, and a swipe on the panel turns the page
 * before it changes the tab. A lecture's 요약 and 대본 stay one scroll.
 */

/**
 * The card a sideways swipe lands on: leftward is forward. Null at either end,
 * so the swipe falls through to the neighbouring tab instead of doing nothing.
 */
export function cardForSwipe(index: number, count: number, translationX: number, threshold: number): number | null {
  if (Math.abs(translationX) < threshold || count <= 1) return null;
  const next = translationX < 0 ? index + 1 : index - 1;
  return next >= 0 && next < count ? next : null;
}
