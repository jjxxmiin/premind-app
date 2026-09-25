import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { normalizeLocale, type AppLocale } from './core';

/**
 * 지금 화면 언어. MY → 앱 설정에서 고른 값이 먼저, 없으면 기기(브라우저) 언어가 영어일 때만 영어.
 * 한국어가 기본이다 — 모르는 언어도 한국어.
 */
const STORAGE_KEY = 'premind.locale.v1';

function deviceLocale(): AppLocale {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return normalizeLocale(navigator.language) ?? 'ko';
    }
    return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale) ?? 'ko';
  } catch {
    return 'ko';
  }
}

let current: AppLocale = deviceLocale();
let chosen = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getLocale(): AppLocale {
  return current;
}

/** Whether the person picked a language (vs. following the device). */
export function localeWasChosen(): boolean {
  return chosen;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(next: AppLocale): void {
  chosen = true;
  if (next !== current) {
    current = next;
    emit();
  }
  void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
}

/** Read the saved choice once at start-up. */
export async function hydrateLocale(): Promise<void> {
  try {
    const saved = normalizeLocale(await AsyncStorage.getItem(STORAGE_KEY));
    if (saved) {
      chosen = true;
      if (saved !== current) {
        current = saved;
        emit();
      }
    }
  } catch {
    // Storage unavailable (private window): keep the device language.
  }
}

/** Tests only. */
export function resetLocaleForTests(next: AppLocale = 'ko'): void {
  current = next;
  chosen = false;
  emit();
}
