import { Platform } from 'react-native';

import type { BillingCycle } from '@/data/subscription-plans';

/**
 * Store billing (Google Play / App Store) through RevenueCat.
 *
 * Decided 2026-09-07: 스탠다드 is sold inside the Android app through Google
 * Play billing. Store policy requires a digital subscription bought in the app
 * to go through the store's own billing, so on Android and iOS this is the
 * checkout path; the web build keeps the web checkout.
 *
 * The SDK is a native module, which means it exists in a development/release
 * build but not in Expo Go — so it is loaded lazily and everything here
 * degrades to "unavailable" instead of crashing. Without
 * `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` / `_IOS_KEY` the module is never even
 * required, so a keyless build renders the screen and simply cannot sell.
 *
 * Nothing here talks to the PREMIND API. Telling the server about a purchase
 * is `src/features/billing/sync-subscription.ts`.
 */

/**
 * The entitlement that unlocks 스탠다드, as named in the RevenueCat dashboard.
 *
 * More than one is accepted because the id lives in a dashboard this code
 * cannot read, and getting it wrong is the worst possible failure here: the
 * purchase goes through, the money is taken, and the app never unlocks. Any
 * one of these being active counts as paid, so renaming it in the dashboard
 * cannot strand a paying customer. `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` adds
 * another without a code change.
 */
export const ENTITLEMENT_IDS: readonly string[] = [
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? '',
  'premind_pro',
  'standard',
].filter(Boolean);

/** The first active entitlement of ours, or undefined when none is. */
function activeEntitlement(
  active: Record<string, CustomerEntitlement | undefined>,
): CustomerEntitlement | undefined {
  for (const id of ENTITLEMENT_IDS) {
    const found = active[id];
    if (found) return found;
  }
  return undefined;
}
export const PRODUCT_IDS = {
  monthly: 'premind_standard_monthly',
  yearly: 'premind_standard_yearly',
} as const;

const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

type PurchasesModule = typeof import('react-native-purchases').default;

export interface StorePackage {
  cycle: BillingCycle;
  /** Localized price as the store formats it, e.g. "₩9,900". */
  priceString: string;
  /** The store's own per-month figure for a yearly plan; null when unknown. */
  perMonthString: string | null;
  /** The Play product id, needed for the Play subscription deep link. */
  productId: string;
  /** Opaque handle passed back to `purchaseStorePackage`. */
  identifier: string;
}

export interface StoreOffering {
  monthly: StorePackage | null;
  yearly: StorePackage | null;
}

export interface StoreEntitlement {
  active: boolean;
  /** The product the entitlement came from, for the Play manage link. */
  productId: string | null;
  /** When the current period ends, ISO, as the store reports it. */
  expiresAt: string | null;
  willRenew: boolean;
}

/**
 * Why a purchase did not end in an entitlement.
 *
 * `cancelled` is deliberately not in here: backing out of the Play sheet is a
 * normal thing to do and must never read as an error.
 */
export type PurchaseFailure =
  | 'store-unavailable'
  | 'product-missing'
  | 'payment-declined'
  | 'not-allowed'
  | 'network'
  | 'unknown';

export type StorePurchaseResult =
  | { status: 'purchased'; entitled: boolean }
  | { status: 'cancelled' }
  | { status: 'already-owned' }
  | { status: 'pending' }
  | { status: 'failed'; failure: PurchaseFailure };

export type StoreRestoreResult =
  | { status: 'restored'; entitlement: StoreEntitlement }
  | { status: 'none' }
  | { status: 'failed' };

let purchasesModule: PurchasesModule | null | undefined;
let configured = false;
let packagesByIdentifier = new Map<string, unknown>();

function apiKey(): string {
  return Platform.OS === 'android' ? ANDROID_KEY : Platform.OS === 'ios' ? IOS_KEY : '';
}

function loadPurchases(): PurchasesModule | null {
  if (purchasesModule !== undefined) return purchasesModule;
  if (Platform.OS === 'web' || !apiKey()) {
    purchasesModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('react-native-purchases') as { default: PurchasesModule };
    purchasesModule = loaded.default;
  } catch {
    purchasesModule = null;
  }
  return purchasesModule;
}

/** True when this build can sell the subscription through the store. */
export function isStoreBillingAvailable(): boolean {
  return loadPurchases() !== null;
}

/** Point RevenueCat at this account so purchases follow the user, not the device. */
export async function configureBilling(appUserId: string | null): Promise<boolean> {
  const Purchases = loadPurchases();
  if (!Purchases) return false;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: apiKey(), appUserID: appUserId ?? undefined });
      configured = true;
    } else if (appUserId) {
      await Purchases.logIn(appUserId);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The id RevenueCat knows this buyer by.
 *
 * `POST /api/billing/revenuecat/sync` needs it to ask RevenueCat about the
 * purchase that just happened, and it is not always the PREMIND user id: a
 * purchase made before sign-in keeps an anonymous id until `logIn` aliases it.
 */
export async function getStoreAppUserId(): Promise<string | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    const id = await Purchases.getAppUserID();
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Forget the buyer on sign-out, so the next person on this handset is not
 * handed the previous account's 스탠다드.
 *
 * Called from `sessionManager.signOut` before the local session is cleared.
 * It matters on a shared or resold handset: the store SDK keeps an identity
 * of its own, and without this the next person inherits the entitlement.
 */
export async function signOutBilling(): Promise<void> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous, or the store is unreachable. Either way the local
    // session is being cleared regardless, so this must never throw.
  }
  packagesByIdentifier = new Map();
}

export async function getStoreOffering(): Promise<StoreOffering | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    packagesByIdentifier = new Map(
      current.availablePackages.map((pkg) => [pkg.identifier, pkg]),
    );
    const pick = (cycle: BillingCycle): StorePackage | null => {
      const pkg = cycle === 'monthly' ? current.monthly : current.annual;
      if (!pkg) return null;
      return {
        cycle,
        priceString: pkg.product.priceString,
        perMonthString: pkg.product.pricePerMonthString ?? null,
        productId: pkg.product.identifier || PRODUCT_IDS[cycle],
        identifier: pkg.identifier,
      };
    };
    return { monthly: pick('monthly'), yearly: pick('yearly') };
  } catch {
    return null;
  }
}

/**
 * RevenueCat's error codes, read as one of our outcomes.
 *
 * Exported because this mapping is the difference between "you backed out"
 * and "your card was declined", and that difference is worth a test.
 */
export function classifyPurchaseError(error: unknown): StorePurchaseResult {
  if (!error || typeof error !== 'object') {
    return { status: 'failed', failure: 'unknown' };
  }
  const row = error as { code?: unknown; userCancelled?: unknown };
  if (row.userCancelled === true) return { status: 'cancelled' };
  const code = typeof row.code === 'string' ? row.code : String(row.code ?? '');
  switch (code) {
    case '1': // PURCHASE_CANCELLED_ERROR
      return { status: 'cancelled' };
    case '6': // PRODUCT_ALREADY_PURCHASED_ERROR
    case '7': // RECEIPT_ALREADY_IN_USE_ERROR
    case '13': // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
      return { status: 'already-owned' };
    case '20': // PAYMENT_PENDING_ERROR
      return { status: 'pending' };
    case '10': // NETWORK_ERROR
    case '32': // PRODUCT_REQUEST_TIMED_OUT_ERROR
    case '33': // API_ENDPOINT_BLOCKED
    case '35': // OFFLINE_CONNECTION_ERROR
      return { status: 'failed', failure: 'network' };
    case '5': // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
      return { status: 'failed', failure: 'product-missing' };
    case '2': // STORE_PROBLEM_ERROR
    case '23': // CONFIGURATION_ERROR
    case '24': // UNSUPPORTED_ERROR
      return { status: 'failed', failure: 'store-unavailable' };
    case '3': // PURCHASE_NOT_ALLOWED_ERROR
    case '19': // INSUFFICIENT_PERMISSIONS_ERROR
      return { status: 'failed', failure: 'not-allowed' };
    case '4': // PURCHASE_INVALID_ERROR
    case '8': // INVALID_RECEIPT_ERROR
      return { status: 'failed', failure: 'payment-declined' };
    default:
      return { status: 'failed', failure: 'unknown' };
  }
}

/**
 * Open the store's purchase sheet.
 *
 * Never throws: every way this can end is one of `StorePurchaseResult`, so the
 * screen decides what to say instead of parsing an exception.
 */
export async function purchaseStorePackage(
  identifier: string,
): Promise<StorePurchaseResult> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) {
    return { status: 'failed', failure: 'store-unavailable' };
  }
  const pkg = packagesByIdentifier.get(identifier);
  if (!pkg) {
    return { status: 'failed', failure: 'product-missing' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(
      pkg as Parameters<PurchasesModule['purchasePackage']>[0],
    );
    return {
      status: 'purchased',
      entitled: Boolean(activeEntitlement(customerInfo.entitlements.active)),
    };
  } catch (error) {
    return classifyPurchaseError(error);
  }
}

export async function restoreStorePurchases(): Promise<StoreRestoreResult> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return { status: 'failed' };
  try {
    const info = await Purchases.restorePurchases();
    const entitlement = readEntitlement(info);
    return entitlement.active
      ? { status: 'restored', entitlement }
      : { status: 'none' };
  } catch {
    return { status: 'failed' };
  }
}

/** What the store thinks this account owns right now; null when it cannot say. */
export async function getStoreEntitlement(): Promise<StoreEntitlement | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    return readEntitlement(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

type CustomerInfoLike = Awaited<ReturnType<PurchasesModule['getCustomerInfo']>>;
type CustomerEntitlement = CustomerInfoLike['entitlements']['active'][string];

function readEntitlement(info: CustomerInfoLike): StoreEntitlement {
  const active = activeEntitlement(info.entitlements.active);
  if (!active) {
    return { active: false, productId: null, expiresAt: null, willRenew: false };
  }
  return {
    active: true,
    productId: active.productIdentifier || null,
    expiresAt: active.expirationDate ?? null,
    willRenew: Boolean(active.willRenew),
  };
}
