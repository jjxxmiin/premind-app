/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://premind.co.kr/app/login"}
 */
import { authenticateKakaoWeb } from './kakao-web-auth.web';

const popup = { closed: false, close: jest.fn(), location: { replace: jest.fn() } };
const start = jest.fn();
const url = 'https://premind.co.kr/app/oauth/kakao.html?state=pending&code=one-use';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  popup.closed = false;
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: jest.requireActual('node:util').TextEncoder });
  Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: { digest: jest.fn(async () => new Uint8Array(32).buffer) } });
  jest.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  start.mockResolvedValue({ authorizationUrl: 'https://kauth.kakao.com/oauth/authorize?state=pending', state: 'pending' });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

async function prepare() {
  const promise = authenticateKakaoWeb(start);
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled(); // Popup opens synchronously, before network/crypto.
  await Promise.resolve();
  await Promise.resolve();
  return { promise };
}
function send(callbackUrl = url, origin = window.location.origin, source: unknown = popup) {
  const event = new MessageEvent('message', { origin, data: { type: 'premind:kakao:callback', url: callbackUrl } });
  Object.defineProperty(event, 'source', { value: source });
  window.dispatchEvent(event);
}

it('keeps PKCE in memory, validates the callback and closes the popup', async () => {
  const { promise } = await prepare();
  expect(start.mock.calls[0][0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(popup.location.replace).toHaveBeenCalledWith('https://kauth.kakao.com/oauth/authorize?state=pending');
  send();
  await expect(promise).resolves.toEqual({ code: 'one-use', state: 'pending', codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('ignores messages from other origins and windows', async () => {
  const { promise } = await prepare();
  send(url, 'https://evil.test');
  send(url, window.location.origin, window);
  expect(popup.close).not.toHaveBeenCalled();
  send();
  await expect(promise).resolves.toHaveProperty('code', 'one-use');
});

it('rejects a mismatched state even from the right popup', async () => {
  const { promise } = await prepare();
  send(url.replace('pending', 'forged'));
  await expect(promise).rejects.toThrow('일치하지');
  expect(jest.getTimerCount()).toBe(0);
});

it('treats closing the popup as cancellation', async () => {
  const { promise } = await prepare();
  popup.closed = true;
  jest.advanceTimersByTime(300);
  await expect(promise).resolves.toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});

it('reports popup blocking without starting a login', async () => {
  jest.mocked(window.open).mockReturnValue(null);
  await expect(authenticateKakaoWeb(start)).rejects.toThrow('팝업이 차단');
  expect(start).not.toHaveBeenCalled();
});

it('closes the popup when starting login fails', async () => {
  start.mockRejectedValue(new Error('network failed'));
  const { promise } = await prepare();
  await expect(promise).rejects.toThrow('network failed');
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
