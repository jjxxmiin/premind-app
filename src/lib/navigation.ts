import { router, type Href } from 'expo-router';

/**
 * Leave a detail screen without trapping users who opened it as a deep link.
 * `router.back()` is a no-op when the current document is the first history
 * entry, which is common on web bookmarks and notification launches.
 */
export function goBackOrReplace(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

/**
 * The screens that open 문제. Whoever pushes `/quiz/[id]` writes one of these
 * into a `from` param so the quiz can name the way back on its own, for the
 * times there is no history to walk: a deep link, a notification, a `replace`,
 * or a reload of the web build.
 */
export type QuizOrigin = 'mastery' | 'mastery-detail' | 'material';

/**
 * Where 문제 sends the reader when it is done.
 *
 * 이해도 opened it, so 이해도 gets them back; the same for the 이해도 상세
 * 화면. Anything else means the material's own screen, which is where 문제
 * 풀기 sits — and that stays the answer when `from` is missing, so an old link
 * behaves as it always did. Without a material there is nothing to return to,
 * so the library is the floor.
 */
export function quizReturnHref(
  from: unknown,
  materialId: string | undefined,
): Href {
  if (from === 'mastery') return '/(tabs)/mastery';
  if (!materialId) return '/(tabs)/library';
  if (from === 'mastery-detail') {
    return { pathname: '/mastery/[id]', params: { id: materialId } };
  }
  return {
    pathname: '/material/[id]',
    params: { id: materialId, tab: 'summary' },
  };
}
