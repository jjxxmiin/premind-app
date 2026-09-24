import { shouldOfferDemo } from './demo-entry';

describe('shouldOfferDemo', () => {
  it('is hidden in the store build: release bundle, real server', () => {
    expect(shouldOfferDemo({ development: false, serverConfigured: true })).toBe(
      false,
    );
  });

  it('is offered while developing', () => {
    expect(shouldOfferDemo({ development: true, serverConfigured: true })).toBe(
      true,
    );
  });

  it('is offered when there is no server to sign in to', () => {
    expect(
      shouldOfferDemo({ development: false, serverConfigured: false }),
    ).toBe(true);
  });
});
