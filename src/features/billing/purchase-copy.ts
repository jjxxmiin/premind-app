import {
  formatKrw,
  yearlyPerMonth,
  type BillingCycle,
  type PlanPrice,
} from '@/data/subscription-plans';

/**
 * Every word the 구독 화면 puts around a price.
 *
 * Pure on purpose: Google Play rejects a subscription screen that does not
 * state the exact charge, its period, that it renews by itself, and how to
 * stop it. Those four sentences are therefore worth a test rather than being
 * inlined in JSX where a redesign can quietly drop one.
 *
 * The store is the authority on the price. When Play answered we show its
 * localized string untouched (a Korean buyer sees "₩9,900", a price change in
 * Play Console needs no app update); our own table is the fallback so the
 * screen is never blank while the offering loads.
 */

/** Where the money actually moves, which decides the cancel sentence. */
export type BillingSurface = 'play' | 'appstore' | 'web';

export interface PriceCopy {
  /** The big line: "월 ₩9,900" / "연 ₩99,000". */
  headline: string;
  /** The quieter line under it, or null when there is nothing to add. */
  subline: string | null;
  /** The exact charge and its period, as policy requires it. */
  billingLine: string;
}

/** The Android package id. Must match `app.json` → `android.package`. */
export const ANDROID_PACKAGE_ID = 'kr.co.premind.premind';

/**
 * The Play page where a subscription is changed or cancelled.
 *
 * Play *requires* this link and does not count it as an external payment
 * link: it goes to the store's own subscription settings, not to a checkout.
 */
export function playSubscriptionUrl(productId: string): string {
  return `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(
    productId,
  )}&package=${ANDROID_PACKAGE_ID}`;
}

/** The App Store equivalent. It takes no product, so there is nothing to pass. */
export const APPSTORE_SUBSCRIPTIONS_URL =
  'https://apps.apple.com/account/subscriptions';

/** Where "구독 관리" goes on this surface. */
export function manageSubscriptionUrl(
  surface: BillingSurface,
  productId: string,
): string {
  return surface === 'appstore'
    ? APPSTORE_SUBSCRIPTIONS_URL
    : playSubscriptionUrl(productId);
}

/**
 * The price block for one cycle.
 *
 * `storePrice` is the store's own formatted string when the offering loaded,
 * and null before that; `storePerMonth` is the store's yearly-to-monthly
 * figure, which only Play can compute correctly for its own currency.
 */
export function priceCopy(
  cycle: BillingCycle,
  price: PlanPrice,
  storePrice: string | null,
  storePerMonth: string | null = null,
): PriceCopy {
  const amount = storePrice ?? formatKrw(cycle === 'monthly' ? price.monthly : price.yearly);
  if (cycle === 'monthly') {
    return {
      headline: `월 ${amount}`,
      subline: null,
      billingLine: `매달 ${amount}씩 결제돼요.`,
    };
  }
  const perMonth = storePerMonth ?? formatKrw(yearlyPerMonth(price));
  return {
    headline: `연 ${amount}`,
    subline: `한 달에 ${perMonth} 꼴, 2개월 무료`,
    billingLine: `1년마다 ${amount}씩 한 번에 결제돼요.`,
  };
}

/** The auto-renewal sentence. Play rejects a purchase screen without it. */
export function autoRenewLine(cycle: BillingCycle): string {
  return cycle === 'monthly'
    ? '해지하기 전까지 매달 자동으로 갱신돼요.'
    : '해지하기 전까지 1년마다 자동으로 갱신돼요.';
}

/** How to stop paying, said in the place the buyer has to go. */
export function cancelLine(surface: BillingSurface): string {
  switch (surface) {
    case 'play':
      return 'Google Play 구독에서 언제든 해지할 수 있어요. 다음 갱신일 전에 해지하면 더 청구되지 않아요.';
    case 'appstore':
      return 'App Store 구독에서 언제든 해지할 수 있어요. 다음 갱신일 전에 해지하면 더 청구되지 않아요.';
    default:
      return 'PREMIND 웹의 구독 관리에서 언제든 해지할 수 있어요.';
  }
}

/** "9월 20일". A date the store or the server could not give us says so. */
export function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** The renewal date for a fact row: a real date, or an honest placeholder. */
export function renewalFact(iso: string | null, subscribed: boolean): string {
  return formatRenewalDate(iso) ?? (subscribed ? '확인 중' : '없어요');
}
