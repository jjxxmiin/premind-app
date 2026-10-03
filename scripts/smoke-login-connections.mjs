// Run against an exported app; every API/provider request is intercepted.
// This never changes a production account or authenticates with a provider.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('dist/login-connections-preview');
const liveAssets = process.env.PREMIND_SMOKE_LIVE_ASSETS === '1';
const output = path.resolve(liveAssets ? 'dist/login-connections-live-images' : 'dist/login-connections-preview-images');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
  const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const session = { accessToken: 'preview-access', tokenType: 'bearer', issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), refreshToken: null, refreshExpiresAt: null,
    user: { id: 'preview-owner', email: 'owner@example.test', name: '테스트 사용자', role: 'member', mode: 'student' } };
  await context.addInitScript((value) => localStorage.setItem('premind.rn.access-session.v1', JSON.stringify(value)), session);
  const linked = new Set(['email']);
  const changes = [];
  const methods = () => ({ methods: ['email', 'google', 'kakao'].map(provider => ({ provider,
    connected: linked.has(provider), email: linked.has(provider) ? 'owner@example.test' : null,
    can_unlink: linked.has(provider) && linked.size > 1 })) });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://premind.co.kr' && url.pathname.startsWith('/app/')) {
      if (liveAssets) return route.continue();
      const relative = url.pathname.slice('/app/'.length);
      const file = path.resolve(root, relative.includes('.') ? relative : 'index.html');
      assert.ok(file.startsWith(root + path.sep));
      const mime = { '.js': 'application/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.css': 'text/css' }[path.extname(file)];
      return route.fulfill({ body: await readFile(file), contentType: mime ?? 'application/octet-stream' });
    }
    if (url.origin === 'https://api.premind.co.kr') {
      const request = route.request();
      const headers = { 'access-control-allow-origin': 'https://premind.co.kr', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,DELETE,PUT,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let body = {};
      let status = 200;
      if (url.pathname === '/api/auth/providers') body = { providers: ['google', 'kakao'], kakao_code_flow: true, kakao_web_code_flow: true };
      else if (url.pathname === '/api/auth/me') body = session.user;
      else if (url.pathname === '/api/auth/connections') body = methods();
      else if (url.pathname.startsWith('/api/auth/connections/')) {
        assert.equal(request.headers().authorization, 'Bearer preview-access');
        const provider = url.pathname.split('/').at(-1);
        if (request.method() === 'POST') {
          const proof = request.postDataJSON();
          if (provider === 'google') assert.equal(proof.token, 'preview-google-proof');
          if (provider === 'kakao') {
            assert.equal(proof.code, 'preview-kakao-code');
            assert.equal(proof.state, 'preview-kakao-state');
            assert.match(proof.code_verifier, /^[A-Za-z0-9_-]{43}$/);
          }
          linked.add(provider);
        } else {
          assert.equal(request.method(), 'DELETE');
          assert.ok(linked.size > 1);
          linked.delete(provider);
        }
        changes.push(`${request.method()} ${provider}`);
        body = methods();
      } else if (url.pathname.endsWith('/kakao/start')) {
        assert.equal(request.postDataJSON().platform, 'web');
        assert.match(request.postDataJSON().code_challenge, /^[A-Za-z0-9_-]{43}$/);
        body = { authorization_url: 'https://kauth.kakao.com/oauth/authorize?state=preview-kakao-state', state: 'preview-kakao-state' };
      } else if (url.pathname.endsWith('/recordings')) body = [];
      else {
        assert.ok(!url.pathname.includes('/oauth/'), `Must not sign in or switch accounts: ${url.pathname}`);
        status = 404;
      }
      return route.fulfill({ status, json: body, headers });
    }
    if (url.origin === 'https://kauth.kakao.com') return route.fulfill({ contentType: 'text/html',
      body: '<script>location.replace("https://premind.co.kr/app/oauth/kakao.html?state=preview-kakao-state&code=preview-kakao-code")</script>' });
    if (url.origin === 'https://accounts.google.com') {
      assert.equal(url.searchParams.get('redirect_uri'), 'https://premind.co.kr/app/login');
      assert.ok(url.searchParams.get('state'));
      const callback = `https://premind.co.kr/app/login#id_token=preview-google-proof&state=${encodeURIComponent(url.searchParams.get('state'))}`;
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(callback)})</script>` });
    }
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto('https://premind.co.kr/app/profile');
  await page.getByText('로그인 계정 관리', { exact: true }).click();
  await page.getByRole('button', { name: 'Google 연결하기', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '이메일 연결 해제', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Google 연결하기', exact: true }).click();
  try {
    await page.getByRole('button', { name: 'Google 연결 해제', exact: true }).waitFor();
  } catch (error) {
    console.error('Google link state:', changes, await page.locator('body').innerText());
    console.error('Open pages:', context.pages().map(p => p.url()));
    throw error;
  }
  await page.getByRole('button', { name: '카카오 연결하기', exact: true }).click();
  await page.getByRole('button', { name: '카카오 연결 해제', exact: true }).waitFor();
  assert.equal(context.pages().length, 1);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'login-accounts.png'), fullPage: true });
  await page.getByRole('button', { name: 'Google 연결 해제', exact: true }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  assert.deepEqual(changes, ['POST google', 'POST kakao']);
  for (const provider of ['Google', '카카오']) {
    await page.getByRole('button', { name: `${provider} 연결 해제`, exact: true }).click();
    await page.getByRole('button', { name: '연결 해제', exact: true }).click();
    await page.getByRole('button', { name: `${provider} 연결하기`, exact: true }).waitFor();
  }
  assert.equal(await page.getByRole('button', { name: '이메일 연결 해제', exact: true }).isDisabled(), true);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('premind.rn.access-session.v1')));
  assert.equal(retained.user.id, session.user.id);
  assert.equal(retained.accessToken, session.accessToken);
  assert.deepEqual(changes, ['POST google', 'POST kakao', 'DELETE google', 'DELETE kakao']);
  console.log(`PASS (${liveAssets ? 'live deployed assets' : 'local export'}): authenticated Google/Kakao popups link without sign-in/session replacement; unlink confirmation and last-method guard. API/provider responses mocked.`);
} finally { await browser.close(); }
