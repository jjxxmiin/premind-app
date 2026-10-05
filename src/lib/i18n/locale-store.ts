import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { normalizeLocale, type AppLocale } from './core';

/**
 * 지금 화면 언어. MY → 앱 설정에서 고른 값이 먼저, 없으면 기기(브라우저) 언어.
 * 기기가 한국어면 한국어, 그 밖의 언어(일본어, 베트남어 …)는 모두 영어 — 2026-10-05 외국인 유입이 늘어
 * 한국어를 못 읽는 사람에게 한국어 화면을 보여 주지 않는다. 기기 언어를 못 읽으면 한국어.
 */
const STORAGE_KEY = 'premind.locale.v1';

/** 기기 언어 태그('ko-KR', 'ja-JP', 'en-US') → 화면 언어. 한국어만 한국어, 나머지는 영어. */
export function localeForDevice(tag: unknown): AppLocale {
  if (typeof tag !== 'string' || !tag.trim()) return 'ko';
  return normalizeLocale(tag) === 'ko' ? 'ko' : 'en';
}

function deviceLocale(): AppLocale {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return localeForDevice(navigator.language);
    }
    return localeForDevice(Intl.DateTimeFormat().resolvedOptions().locale);
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
