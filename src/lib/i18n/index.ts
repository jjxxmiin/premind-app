import { useSyncExternalStore } from 'react';

import { makeT, translate, type AppLocale, type T, type Vars } from './core';
import { EN } from './en';
import { getLocale, subscribeLocale } from './locale-store';

export * from './core';
export { getLocale, hydrateLocale, localeWasChosen, setLocale, subscribeLocale } from './locale-store';

const DICTS = [EN] as const;

/** The screen language, re-rendering when it changes. */
export function useLocale(): AppLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/**
 * `t` for a component. Put it at the top of the component, above any handler
 * or derived value that uses it (React Compiler memoises by declaration order).
 */
export function useT(): T {
  const locale = useLocale();
  return makeT(locale, DICTS);
}

/** Outside React (services, store, notification text): the current language. */
export function tr(ko: string, vars?: Vars): string {
  return translate(getLocale(), DICTS, ko, vars);
}

/** Outside React, with a context key (`ctx|한국어`). */
export function trCtx(ctx: string, ko: string, vars?: Vars): string {
  return translate(getLocale(), DICTS, ko, vars, ctx);
}
