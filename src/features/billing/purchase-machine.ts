import type { StorePurchaseResult, StoreRestoreResult } from '@/services/billing';

/**
 * What the 구독 화면 shows while and after a store purchase.
 *
 * A purchase has more endings than "worked" and "broke": the buyer can back
 * out of the Play sheet (which must look like nothing happened), Play can hold
 * the payment for approval, the account can already own the subscription, the
 * card can be declined, the network can drop. Keeping every ending in one
 * reducer means the screen cannot invent a fifth answer, and means these
 * sentences can be checked without a device.
 */

export type BillingBusy = 'purchase' | 'restore' | 'sync' | null;

export interface BillingNotice {
  /** `positive` confirms, `negative` is a real failure, `muted` is neither. */
  tone: 'positive' | 'muted' | 'negative';
  text: string;
}

export interface PurchaseState {
  busy: BillingBusy;
  notice: BillingNotice | null;
  /** True once the store says the 스탠다드 entitlement is active. */
  entitled: boolean;
}

export type PurchaseEvent =
  | { type: 'purchase:start' }
  | { type: 'purchase:settle'; result: StorePurchaseResult }
  | { type: 'restore:start' }
  | { type: 'restore:settle'; result: StoreRestoreResult }
  | { type: 'sync:start' }
  | { type: 'sync:pending' }
  | { type: 'sync:failed' }
  | { type: 'sync:done' }
  | { type: 'entitlement:known'; entitled: boolean }
  | { type: 'notice:clear' };

export const initialPurchaseState: PurchaseState = {
  busy: null,
  notice: null,
  entitled: false,
};

const FAILURE_TEXT: Record<
  Extract<StorePurchaseResult, { status: 'failed' }>['failure'],
  string
> = {
  'store-unavailable':
    'Google Play에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  'product-missing':
    '상품 정보를 아직 못 불러왔어요. 잠시 후 다시 시도해 주세요.',
  'payment-declined':
    '결제가 승인되지 않았어요. 결제 수단을 확인하고 다시 시도해 주세요.',
  'not-allowed': '이 기기에서는 결제를 진행할 수 없어요.',
  network: '네트워크 연결을 확인하고 다시 시도해 주세요.',
  unknown: '결제를 마치지 못했어요. 잠시 후 다시 시도해 주세요.',
};

function settlePurchase(
  state: PurchaseState,
  result: StorePurchaseResult,
): PurchaseState {
  switch (result.status) {
    case 'purchased':
      return {
        busy: null,
        entitled: result.entitled || state.entitled,
        notice: result.entitled
          ? { tone: 'positive', text: '스탠다드가 시작됐어요. 바로 쓸 수 있어요.' }
          : {
              tone: 'muted',
              text: '결제가 접수됐어요. 반영되면 스탠다드로 바뀌어요.',
            },
      };
    case 'cancelled':
      // Backing out is not a failure. The screen goes back to how it was.
      return { ...state, busy: null, notice: null };
    case 'already-owned':
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'muted',
          text: '이미 구독 중인 계정이에요. 구매 복원을 눌러 주세요.',
        },
      };
    case 'pending':
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'muted',
          text: '결제 승인을 기다리고 있어요. 승인되면 스탠다드가 켜져요.',
        },
      };
    default:
      return {
        ...state,
        busy: null,
        notice: { tone: 'negative', text: FAILURE_TEXT[result.failure] },
      };
  }
}

function settleRestore(
  state: PurchaseState,
  result: StoreRestoreResult,
): PurchaseState {
  switch (result.status) {
    case 'restored':
      return {
        busy: null,
        entitled: true,
        notice: { tone: 'positive', text: '구독을 복원했어요.' },
      };
    case 'none':
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'muted',
          text: '복원할 구독이 없어요. 구매한 Google 계정으로 로그인했는지 확인해 주세요.',
        },
      };
    default:
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'negative',
          text: '구매를 복원하지 못했어요. 잠시 후 다시 시도해 주세요.',
        },
      };
  }
}

export function purchaseReducer(
  state: PurchaseState,
  event: PurchaseEvent,
): PurchaseState {
  switch (event.type) {
    case 'purchase:start':
      return { ...state, busy: 'purchase', notice: null };
    case 'restore:start':
      return { ...state, busy: 'restore', notice: null };
    case 'purchase:settle':
      return settlePurchase(state, event.result);
    case 'restore:settle':
      return settleRestore(state, event.result);
    case 'sync:start':
      // The store already said yes; the account is catching up.
      return { ...state, busy: 'sync' };
    case 'sync:done':
      return { ...state, busy: null };
    case 'sync:pending':
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'muted',
          text: '결제가 확인됐어요. 계정에 반영되기까지 잠시 걸릴 수 있어요.',
        },
      };
    case 'sync:failed':
      // The purchase itself is safe, so this is a delay, not a failure.
      return {
        ...state,
        busy: null,
        notice: {
          tone: 'muted',
          text: '결제는 끝났어요. 계정 반영이 늦어지면 앱을 다시 열어 주세요.',
        },
      };
    case 'entitlement:known':
      return { ...state, entitled: event.entitled };
    default:
      return { ...state, notice: null };
  }
}
