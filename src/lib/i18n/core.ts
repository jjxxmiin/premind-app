/**
 * 학생 앱 언어 — 2026-09-26 (CEO "영어도 무조건 지원"). 선생님 웹, 면접 웹의 lib/app-locale.ts 와 같은 방식.
 *
 * gettext 방식: **화면에 나가는 한국어 문장이 그대로 키**이고 영어 사전(EnDict)이 그 문장을 영어로 바꾼다.
 * 한국어 화면은 사전과 상관없이 예전과 한 글자도 다르지 않고(키 = 출력), 사전에 없는 문장은 한국어로 남는다.
 *
 *   const t = useT();                 // 컴포넌트 (src/lib/i18n)
 *   tr("저장")                         // 컴포넌트 밖(서비스, 상태, 알림 문구) — 지금 언어로
 *   t("자료 {n}개", { n })             // 치환 {이름}. 영어 값이 { one, other } 면 n(또는 count)이 1일 때 one
 *   t.ctx("quiz", "열기")              // 같은 한국어가 자리마다 다른 영어일 때 — 사전 키 "quiz|열기" 를 먼저 본다
 *
 * React, react-native 를 들이지 않는다(테스트와 서비스 코드에서 그대로 쓴다).
 */

export type AppLocale = 'ko' | 'en';
export const APP_LOCALES: readonly AppLocale[] = ['ko', 'en'];
export const APP_LOCALE_LABELS: Record<AppLocale, string> = { ko: '한국어', en: 'English' };

/** 영어 값 — 문장 하나, 또는 단수/복수 짝(n 또는 count 가 1이면 one). */
export type EnValue = string | { one: string; other: string };
/** 영어 사전 — 키는 화면의 한국어 문장 그대로(치환 토큰 포함). */
export type EnDict = Readonly<Record<string, EnValue>>;
export type Vars = Record<string, string | number | null | undefined>;

export type T = ((ko: string, vars?: Vars) => string) & {
  locale: AppLocale;
  /** 같은 한국어가 자리마다 다른 영어일 때: 사전 키 `${ctx}|${ko}` 를 먼저, 없으면 `ko` 를 본다. */
  ctx: (ctx: string, ko: string, vars?: Vars) => string;
};

/** 'en', 'en-US', 'EN_us' → 'en'. 모르는 값은 null(= 호출부가 기본값을 고른다). */
export function normalizeLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return base === 'en' ? 'en' : base === 'ko' ? 'ko' : null;
}

function fill(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? m : String(v);
  });
}

function pick(v: EnValue, vars?: Vars): string {
  if (typeof v === 'string') return v;
  const n = vars?.n ?? vars?.count;
  return Number(n) === 1 ? v.one : v.other;
}

/**
 * 사전에 없는 영어 문장의 마지막 대체: 숫자가 채워진 서버 문장 등(lib/i18n/server-messages.ts enServerDynamic).
 * 사전을 모두 본 뒤에만 부른다 — 고정 문장이 정규식보다 먼저다. 순환 참조를 피하려고 공통 사전이 등록한다.
 */
let dynamicFallback: ((ko: string) => string | null) | null = null;
export function setDynamicFallback(fn: (ko: string) => string | null): void {
  dynamicFallback = fn;
}

/** 번역 하나. 한국어면 사전을 보지 않는다 — 한국어 화면은 늘 원문 그대로.
 *  서버 응답을 그대로 넘기는 자리(t(data.message))에서 문자열이 아닌 값이 올 수 있어 조용히 문자열로 바꾼다. */
export function translate(locale: AppLocale, dicts: readonly EnDict[], ko: string, vars?: Vars, ctx?: string): string {
  if (typeof ko !== 'string') return ko === undefined || ko === null ? '' : String(ko);
  if (locale === 'en') {
    for (const d of dicts) {
      const v = (ctx !== undefined ? d[`${ctx}|${ko}`] : undefined) ?? d[ko];
      if (v !== undefined) return fill(pick(v, vars), vars);
    }
    const dynamic = dynamicFallback?.(ko);
    if (dynamic) return dynamic;
  }
  return fill(ko, vars);
}

export function makeT(locale: AppLocale, dicts: readonly EnDict[]): T {
  const t = ((ko: string, vars?: Vars) => translate(locale, dicts, ko, vars)) as T;
  t.locale = locale;
  t.ctx = (ctx: string, ko: string, vars?: Vars) => translate(locale, dicts, ko, vars, ctx);
  return t;
}

// ── 숫자, 날짜 ──────────────────────────────────────────────────────────────
// 한국어 화면의 기존 표기는 건드리지 않는다: 호출부는 한국어일 때 예전 코드를 그대로 두고,
// 영어일 때만 아래 도우미를 쓴다(예: locale === 'en' ? enDate(d) : 예전 한국어 표기).

export function intlTag(locale: AppLocale): string {
  return locale === 'en' ? 'en-US' : 'ko-KR';
}

export function fmtNumber(n: number, locale: AppLocale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlTag(locale), opts).format(n);
}

/** 원화. ko '19,900원' / en '₩19,900'. */
export function fmtWon(n: number, locale: AppLocale): string {
  return locale === 'en' ? `₩${fmtNumber(n, 'en')}` : `${fmtNumber(n, 'ko')}원`;
}

/** 영어 날짜 'Sep 25, 2026' (withTime 이면 'Sep 25, 2026, 3:04 PM'). */
export function enDate(d: Date | string | number, withTime = false): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/** 영어 짧은 날짜 'Sep 25'. */
export function enShortDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** 영어 상대 시각 'just now', '5 min ago', '3 hr ago', '2 days ago', 그보다 오래면 날짜. */
export function enAgo(d: Date | string | number, now: number = Date.now()): string {
  const date = d instanceof Date ? d : new Date(d);
  const ms = now - date.getTime();
  if (Number.isNaN(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? 'yesterday' : `${day} days ago`;
  return enDate(date);
}

/** 영어 길이 '1 h 5 min', '12 min', '45 s'. */
export function enDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return sec && m < 10 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}
