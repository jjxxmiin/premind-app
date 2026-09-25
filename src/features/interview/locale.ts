/**
 * The interview screens are Korean first. `en` exists only so the ported
 * helpers keep their signatures (the interview web app has an English UI).
 */
export type AppLocale = 'ko' | 'en';

export function enDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return sec && m < 10 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}
