import { normalizeReturnTo } from './return-to';

describe('normalizeReturnTo', () => {
  it('keeps where the visitor was going, without the /app base', () => {
    expect(normalizeReturnTo('/app/interview')).toBe('/interview');
    expect(normalizeReturnTo('/app/interview/join', '?code=AB12')).toBe('/interview/join?code=AB12');
    expect(normalizeReturnTo('/speak', '?mode=interview')).toBe('/speak?mode=interview');
  });

  it('ignores the entry screens themselves', () => {
    for (const path of ['/app', '/app/', '/', '/login', '/app/login', '/signup']) {
      expect(normalizeReturnTo(path)).toBeNull();
    }
  });

  it('never returns somewhere off-site', () => {
    expect(normalizeReturnTo('//evil.example/x')).toBeNull();
  });
});
