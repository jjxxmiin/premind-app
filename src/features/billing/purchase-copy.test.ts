import { PLAN_PRICES } from '@/data/subscription-plans';

import {
  ANDROID_PACKAGE_ID,
  APPSTORE_SUBSCRIPTIONS_URL,
  autoRenewLine,
  cancelLine,
  formatRenewalDate,
  manageSubscriptionUrl,
  playSubscriptionUrl,
  priceCopy,
  REFUND_POLICY_URL,
  refundLine,
  renewalFact,
} from './purchase-copy';

const price = PLAN_PRICES.standard;

describe('priceCopy', () => {
  it('falls back to our own table before the store answers', () => {
    expect(priceCopy('monthly', price, null)).toEqual({
      headline: '월 9,900원',
      subline: null,
      billingLine: '매달 9,900원씩 결제돼요.',
    });
  });

  it('prefers the store price over our table, in the store formatting', () => {
    const copy = priceCopy('monthly', price, '₩10,900');
    expect(copy.headline).toBe('월 ₩10,900');
    expect(copy.billingLine).toBe('매달 ₩10,900씩 결제돼요.');
    // A Play price change must never be contradicted by the hardcoded number.
    expect(copy.billingLine).not.toContain('9,900');
  });

  it('states the yearly charge as the whole year, not a monthly slice', () => {
    const copy = priceCopy('yearly', price, null);
    expect(copy.headline).toBe('연 99,000원');
    expect(copy.billingLine).toBe('1년마다 99,000원씩 한 번에 결제돼요.');
    expect(copy.subline).toBe('한 달에 8,300원 꼴, 2개월 무료');
  });

  it('uses the store per-month figure for a yearly plan when it has one', () => {
    const copy = priceCopy('yearly', price, '₩99,000', '₩8,250');
    expect(copy.headline).toBe('연 ₩99,000');
    expect(copy.subline).toBe('한 달에 ₩8,250 꼴, 2개월 무료');
  });

  it('never writes a middot', () => {
    for (const cycle of ['monthly', 'yearly'] as const) {
      const copy = priceCopy(cycle, price, '₩9,900', '₩9,900');
      expect(`${copy.headline}${copy.subline ?? ''}${copy.billingLine}`).not.toContain('·');
    }
  });
});

describe('policy sentences', () => {
  it('says the subscription renews by itself, per cycle', () => {
    expect(autoRenewLine('monthly')).toBe('해지하기 전까지 매달 자동으로 갱신돼요.');
    expect(autoRenewLine('yearly')).toBe('해지하기 전까지 1년마다 자동으로 갱신돼요.');
  });

  it('sends the buyer to the store they actually paid through', () => {
    expect(cancelLine('play')).toContain('Google Play 구독에서 언제든 해지할 수 있어요');
    expect(cancelLine('appstore')).toContain('App Store 구독에서 언제든 해지할 수 있어요');
    expect(cancelLine('web')).toContain('PREMIND 웹');
  });

  it('states the 7-day withdrawal rule of the refund policy before paying', () => {
    expect(refundLine()).toContain('결제일부터 7일 안에');
    expect(refundLine()).toContain('전액 환불');
    expect(refundLine('en')).toContain('7 days');
    expect(REFUND_POLICY_URL).toBe('https://premind.co.kr/refund');
  });
});

describe('manage links', () => {
  it('builds the Play subscription deep link Play requires', () => {
    expect(playSubscriptionUrl('premind_standard_monthly')).toBe(
      'https://play.google.com/store/account/subscriptions' +
        '?sku=premind_standard_monthly&package=kr.co.premind.premind',
    );
  });

  it('keeps the package id in step with app.json', () => {
    const appConfig = require('../../../app.json') as {
      expo: { android: { package: string } };
    };
    expect(ANDROID_PACKAGE_ID).toBe(appConfig.expo.android.package);
  });

  it('escapes a product id rather than pasting it into the query', () => {
    expect(playSubscriptionUrl('a b&c')).toContain('sku=a%20b%26c&package=');
  });

  it('sends iOS to the App Store page, which takes no product', () => {
    expect(manageSubscriptionUrl('appstore', 'premind_standard_yearly')).toBe(
      APPSTORE_SUBSCRIPTIONS_URL,
    );
    expect(manageSubscriptionUrl('play', 'premind_standard_yearly')).toContain('sku=');
  });
});

describe('renewal dates', () => {
  it('formats an ISO date the Korean way', () => {
    expect(formatRenewalDate('2026-10-04T12:00:00.000Z')).toBe('10월 4일');
  });

  it('returns null for nothing and for nonsense rather than a fake date', () => {
    expect(formatRenewalDate(null)).toBeNull();
    expect(formatRenewalDate('나중에')).toBeNull();
  });

  it('says why the date is missing instead of leaving a blank', () => {
    expect(renewalFact(null, true)).toBe('확인 중');
    expect(renewalFact(null, false)).toBe('없어요');
    expect(renewalFact('2026-10-04T12:00:00.000Z', true)).toBe('10월 4일');
  });
});
