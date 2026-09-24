import { parseKakaoCallback } from './kakao-callback';
import { redirectSystemPath } from '../../app/+native-intent';

it('accepts only the callback for the pending login', () => {
  expect(parseKakaoCallback('premind://oauth/kakao?state=pending&code=one-use', 'pending'))
    .toEqual({ cancelled: false, code: 'one-use' });
});
it.each([
  'premind://oauth/kakao?state=other&code=x',
  'https://evil.test/oauth/kakao?state=pending&code=x',
  'premind://oauth/kakao?state=pending&state=other&code=x',
  'premind://oauth/kakao?state=pending',
  'premind://oauth/kakao?state=pending&code=x&code=y',
])('rejects an invalid callback: %s', (url) => {
  expect(() => parseKakaoCallback(url, 'pending')).toThrow();
});
it('distinguishes user cancellation from provider failure', () => {
  expect(parseKakaoCallback('premind://oauth/kakao?state=pending&error=access_denied', 'pending'))
    .toEqual({ cancelled: true });
  expect(() => parseKakaoCallback('premind://oauth/kakao?state=pending&error=login_failed', 'pending'))
    .toThrow('완료하지');
});
it('keeps the awaiting login screen mounted and strips cold-start credentials', () => {
  const path = 'premind://oauth/kakao?state=pending&code=x';
  expect(redirectSystemPath({ path, initial: false })).toBeNull();
  expect(redirectSystemPath({ path, initial: true })).toBe('/login');
  expect(redirectSystemPath({ path: 'premind://quiz/123', initial: false })).toBe('premind://quiz/123');
});
