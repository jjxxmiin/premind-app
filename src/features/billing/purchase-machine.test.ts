import { classifyPurchaseError } from '@/services/billing';

import {
  initialPurchaseState,
  purchaseReducer,
  type PurchaseEvent,
  type PurchaseState,
} from './purchase-machine';

function run(events: PurchaseEvent[], from = initialPurchaseState): PurchaseState {
  return events.reduce(purchaseReducer, from);
}

describe('purchaseReducer', () => {
  it('shows the button as busy while the store sheet is open', () => {
    const state = run([{ type: 'purchase:start' }]);
    expect(state.busy).toBe('purchase');
    expect(state.notice).toBeNull();
  });

  it('confirms a purchase that granted the entitlement', () => {
    const state = run([
      { type: 'purchase:start' },
      { type: 'purchase:settle', result: { status: 'purchased', entitled: true } },
    ]);
    expect(state).toEqual({
      busy: null,
      entitled: true,
      notice: { tone: 'positive', text: '스탠다드가 시작됐어요. 바로 쓸 수 있어요.' },
    });
  });

  it('does not claim 스탠다드 when the store took the money but shows no entitlement', () => {
    const state = run([
      { type: 'purchase:start' },
      { type: 'purchase:settle', result: { status: 'purchased', entitled: false } },
    ]);
    expect(state.entitled).toBe(false);
    expect(state.notice?.tone).toBe('muted');
  });

  it('treats backing out of the sheet as nothing happening', () => {
    const state = run([
      { type: 'purchase:start' },
      { type: 'purchase:settle', result: { status: 'cancelled' } },
    ]);
    // The whole point of the cancel branch: no error text, no red.
    expect(state).toEqual(initialPurchaseState);
  });

  it('clears an earlier error when a cancelled retry ends the same way', () => {
    const failed = run([
      { type: 'purchase:start' },
      { type: 'purchase:settle', result: { status: 'failed', failure: 'network' } },
    ]);
    expect(failed.notice?.tone).toBe('negative');
    const retried = run(
      [{ type: 'purchase:start' }, { type: 'purchase:settle', result: { status: 'cancelled' } }],
      failed,
    );
    expect(retried.notice).toBeNull();
  });

  it('tells a declined card apart from a cancelled purchase', () => {
    const declined = run([
      { type: 'purchase:settle', result: { status: 'failed', failure: 'payment-declined' } },
    ]);
    expect(declined.notice).toEqual({
      tone: 'negative',
      text: '결제가 승인되지 않았어요. 결제 수단을 확인하고 다시 시도해 주세요.',
    });
  });

  it('points an already-subscribed buyer at 구매 복원 instead of an error', () => {
    const state = run([{ type: 'purchase:settle', result: { status: 'already-owned' } }]);
    expect(state.notice?.tone).toBe('muted');
    expect(state.notice?.text).toContain('구매 복원');
    expect(state.entitled).toBe(false);
  });

  it('waits out a pending payment rather than calling it a failure', () => {
    const state = run([{ type: 'purchase:settle', result: { status: 'pending' } }]);
    expect(state.notice?.tone).toBe('muted');
    expect(state.busy).toBeNull();
  });

  it('names every failure without leaving one blank', () => {
    const failures = [
      'store-unavailable',
      'product-missing',
      'payment-declined',
      'not-allowed',
      'network',
      'unknown',
    ] as const;
    for (const failure of failures) {
      const state = run([{ type: 'purchase:settle', result: { status: 'failed', failure } }]);
      expect(state.notice?.tone).toBe('negative');
      expect(state.notice?.text.length).toBeGreaterThan(4);
      expect(state.notice?.text).not.toContain('·');
    }
  });

  it('restores a subscription and says so', () => {
    const state = run([
      { type: 'restore:start' },
      {
        type: 'restore:settle',
        result: {
          status: 'restored',
          entitlement: {
            active: true,
            productId: 'premind_standard_monthly',
            expiresAt: null,
            willRenew: true,
          },
        },
      },
    ]);
    expect(state).toEqual({
      busy: null,
      entitled: true,
      notice: { tone: 'positive', text: '구독을 복원했어요.' },
    });
  });

  it('explains an empty restore instead of showing an error', () => {
    const state = run([{ type: 'restore:settle', result: { status: 'none' } }]);
    expect(state.notice?.tone).toBe('muted');
    expect(state.entitled).toBe(false);
  });

  it('calls a broken restore a failure', () => {
    const state = run([{ type: 'restore:settle', result: { status: 'failed' } }]);
    expect(state.notice?.tone).toBe('negative');
  });

  it('keeps the purchase confirmation when the server sync had nothing to do', () => {
    const state = run([
      { type: 'purchase:settle', result: { status: 'purchased', entitled: true } },
      { type: 'sync:start' },
      { type: 'sync:done' },
    ]);
    expect(state.busy).toBeNull();
    expect(state.notice?.tone).toBe('positive');
    expect(state.entitled).toBe(true);
  });

  it('downgrades the confirmation to "it is on its way" when the server lags', () => {
    for (const type of ['sync:pending', 'sync:failed'] as const) {
      const state = run([
        { type: 'purchase:settle', result: { status: 'purchased', entitled: true } },
        { type: 'sync:start' },
        { type },
      ]);
      // Never negative: the money moved and the entitlement is real.
      expect(state.notice?.tone).toBe('muted');
      expect(state.entitled).toBe(true);
      expect(state.busy).toBeNull();
    }
  });

  it('takes the store’s word on the entitlement when the screen opens', () => {
    expect(run([{ type: 'entitlement:known', entitled: true }]).entitled).toBe(true);
    const lost = run([{ type: 'entitlement:known', entitled: false }], {
      busy: null,
      entitled: true,
      notice: null,
    });
    expect(lost.entitled).toBe(false);
  });
});

describe('classifyPurchaseError', () => {
  it('reads the RevenueCat cancel code as a cancel, not a failure', () => {
    expect(classifyPurchaseError({ code: '1', message: 'cancelled' })).toEqual({
      status: 'cancelled',
    });
  });

  it('honours the older userCancelled flag too', () => {
    expect(classifyPurchaseError({ code: '0', userCancelled: true })).toEqual({
      status: 'cancelled',
    });
  });

  it('maps the codes that mean the account already owns it', () => {
    for (const code of ['6', '7', '13']) {
      expect(classifyPurchaseError({ code })).toEqual({ status: 'already-owned' });
    }
  });

  it('maps a held payment to pending', () => {
    expect(classifyPurchaseError({ code: '20' })).toEqual({ status: 'pending' });
  });

  it('maps the network codes to one network failure', () => {
    for (const code of ['10', '32', '33', '35']) {
      expect(classifyPurchaseError({ code })).toEqual({
        status: 'failed',
        failure: 'network',
      });
    }
  });

  it('separates a store problem, a missing product and a declined payment', () => {
    expect(classifyPurchaseError({ code: '2' })).toEqual({
      status: 'failed',
      failure: 'store-unavailable',
    });
    expect(classifyPurchaseError({ code: '5' })).toEqual({
      status: 'failed',
      failure: 'product-missing',
    });
    expect(classifyPurchaseError({ code: '4' })).toEqual({
      status: 'failed',
      failure: 'payment-declined',
    });
    expect(classifyPurchaseError({ code: '3' })).toEqual({
      status: 'failed',
      failure: 'not-allowed',
    });
  });

  it('falls back to unknown for anything it has never seen', () => {
    expect(classifyPurchaseError(new Error('boom'))).toEqual({
      status: 'failed',
      failure: 'unknown',
    });
    expect(classifyPurchaseError(null)).toEqual({ status: 'failed', failure: 'unknown' });
    expect(classifyPurchaseError({ code: '999' })).toEqual({
      status: 'failed',
      failure: 'unknown',
    });
  });
});
