// Exercises the exported production app in Chromium. Only provider/API
// responses are fixtures: no real account is created and no real login occurs.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(process.argv[2] ?? 'dist/web-production');
const output = path.resolve('dist/social-buttons-preview');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
  const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const exchanges = [];
  await context.route(/^https:\/\/premind\.co\.kr\/app(?:\/.*)?$/, async (route) => {
    const pathname = new URL(route.request().url()).pathname.slice('/app/'.length);
    const relative = pathname.includes('.') ? pathname : 'index.html';
    const file = path.resolve(root, relative);
    assert.ok(file.startsWith(root + path.sep));
    const ext = path.extname(file);
    const mime = { '.js': 'application/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.css': 'text/css' }[ext];
    await route.fulfill({ body: await readFile(file), contentType: mime ?? 'application/octet-stream' });
  });
  await context.route('https://api.premind.co.kr/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const cors = { 'access-control-allow-origin': 'https://premind.co.kr', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = {};
    let status = 200;
    if (pathname === '/api/auth/providers') body = { providers: ['google', 'kakao'], kakao_code_flow: true, kakao_web_code_flow: true };
    else if (pathname.endsWith('/kakao/start')) {
      const payload = route.request().postDataJSON();
      assert.equal(payload.platform, 'web');
      assert.match(payload.code_challenge, /^[A-Za-z0-9_-]{43}$/);
      body = { authorization_url: 'https://kauth.kakao.com/oauth/authorize?state=smoke-state', state: 'smoke-state' };
    } else if (pathname.endsWith('/kakao/exchange') || pathname.endsWith('/oauth/google')) {
      exchanges.push({ pathname, payload: route.request().postDataJSON() });
      status = 401;
      body = { detail: '테스트 로그인 응답이에요.' };
    } else status = 404;
    await route.fulfill({ status, json: body, headers: cors });
  });
  await context.route('https://kauth.kakao.com/**', (route) => route.fulfill({ contentType: 'text/html',
    body: '<script>location.replace("https://premind.co.kr/app/oauth/kakao.html?state=smoke-state&code=smoke-code")</script>',
  }));
  await context.route('https://accounts.google.com/**', (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.searchParams.get('redirect_uri'), 'https://premind.co.kr/app/login');
    const state = url.searchParams.get('state');
    assert.ok(state);
    const callback = `https://premind.co.kr/app/login#id_token=smoke-google-token&state=${encodeURIComponent(state)}`;
    return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(callback)})</script>` });
  });
  const page = await context.newPage();
  await page.goto('https://premind.co.kr/app/login');
  await page.getByRole('button', { name: '카카오 로그인', exact: true }).waitFor();
  await page.getByRole('button', { name: '구글 로그인', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500); // Let the login screen's entrance animation finish.
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'web-login.png'), fullPage: true });
  await page.getByRole('button', { name: '카카오 로그인', exact: true }).click();
  await page.getByText('테스트 로그인 응답이에요.', { exact: true }).waitFor();
  assert.equal(exchanges[0]?.payload.code, 'smoke-code');
  assert.equal(exchanges[0]?.payload.state, 'smoke-state');
  assert.match(exchanges[0]?.payload.code_verifier, /^[A-Za-z0-9_-]{43}$/);
  await page.getByRole('button', { name: '구글 로그인', exact: true }).click();
  // The error remains visible from Kakao, so wait on the exchange itself.
  for (let attempt = 0; attempt < 100 && exchanges.length < 2; attempt++) await page.waitForTimeout(100);
  assert.equal(exchanges[1]?.payload.token, 'smoke-google-token');
  assert.equal(context.pages().length, 1);
  console.log('PASS: both production web buttons, Kakao PKCE popup/callback/exchange, Google popup/callback/exchange. Provider responses mocked.');
} finally {
  await browser.close();
}
