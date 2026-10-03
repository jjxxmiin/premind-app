// Capture real demo screens; derive store graphics from the shipped brand assets.
// Start the isolated demo preview described in store/README.md before running.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';

const baseUrl = process.env.PREMIND_STORE_PREVIEW_URL || 'http://127.0.0.1:18197';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Use a local, API-free demo export for store screenshots.');
}
const material = 'material-ai-intro-01';
const screens = [
  ['01-home', '/', '내 자료를 한곳에', '복습'],
  ['02-material-summary', `/material/${material}?tab=summary`, '핵심만 담은 요약', '요약'],
  ['03-material-mindmap', `/material/${material}?tab=mindmap`, '한눈에 보는 마인드맵', '마인드맵'],
  ['04-chat', `/chat/${material}`, '내 자료를 근거로 질문', '5주차, 지도학습의 원리'],
  ['05-mastery', '/mastery', '다시 볼 곳을 찾아 복습', '복습'],
  ['06-lens', '/speak?mode=presentation', '발표를 연습하고 평가', '발표'],
  ['07-report', `/report/${material}`, '근거와 함께 보는 피드백', '평가'],
  ['08-record', '/record', '강의를 녹음해 정리', '녹음'],
  ['09-interview', '/speak?mode=interview', '면접도 차근차근 연습', '면접'],
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PREMIND_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    reducedMotion: 'reduce',
  });
  // Never send demo screenshot actions to a real backend.
  await context.route('**/api/**', (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/login`);
  await page.getByText('데모로 둘러보기', { exact: true }).click();
  await page.getByRole('tab', { name: '복습, 자료별 이해도와 다시 볼 곳' }).waitFor();
  await mkdir('store/screenshots/framed', { recursive: true });

  const font = (await readFile('assets/fonts/Pretendard-Bold.ttf')).toString('base64');
  const designPage = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const fontCss = `@font-face{font-family:Pretendard;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:white;color:#17171B;font-family:Pretendard}`;
  for (const [name, path, caption, expected] of screens) {
    await page.goto(`${baseUrl}${path}`);
    await page.getByText(expected, { exact: false }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200); // Finish route and entry transitions.
    if (name === '04-chat') {
      await page.getByText('지도학습이 뭐야?', { exact: true }).click();
      await page.getByText('복사', { exact: true }).waitFor();
      await page.getByTestId('study-chat-messages').evaluate((element) => { element.scrollTop = 0; });
      await page.waitForTimeout(400);
    }
    if (name === '03-material-mindmap') {
      await page.mouse.move(180, 380);
      await page.mouse.wheel(0, 330);
      await page.waitForTimeout(400);
    }
    const raw = await page.screenshot({ path: `store/screenshots/${name}.png` });
    await designPage.setContent(`<style>${fontCss}.line{position:absolute;top:58px;left:512px;width:56px;height:4px;background:#E25A1C}h1{position:absolute;top:87px;margin:0;width:100%;text-align:center;font-size:58px}img{position:absolute;top:220px;left:62px;width:956px;height:1700px;object-fit:contain;border:1px solid #ECEDF0}</style><div class="line"></div><h1>${caption}</h1><img src="data:image/png;base64,${raw.toString('base64')}">`);
    await designPage.evaluate(() => document.fonts.ready);
    await designPage.screenshot({ path: `store/screenshots/framed/${name}.png` });
    console.log(`Captured ${name}: ${path}`);
  }
  if (errors.length) throw new Error(`Screenshot runtime errors: ${errors.join('; ')}`);

  // Exact resize of the production icon, without redrawing the brand mark.
  await sharp('assets/brand/app-icon.png').resize(512, 512).flatten({ background: '#FFFFFF' }).png().toFile('store/app-icon-512.png');
  const symbol = (await readFile('assets/brand/app-icon.png')).toString('base64');
  const wordmark = (await readFile('assets/brand/wordmark.png')).toString('base64');
  await designPage.setViewportSize({ width: 1024, height: 500 });
  await designPage.setContent(`<style>${fontCss}.symbol{position:absolute;left:56px;top:86px;width:328px;height:328px}.wordmark{position:absolute;left:414px;top:128px;width:476px}p{position:absolute;left:414px;top:229px;font-size:30px;line-height:1.65;margin:0}.accent{position:absolute;left:414px;top:365px;background:#E25A1C;width:56px;height:4px}</style><img class="symbol" src="data:image/png;base64,${symbol}"><img class="wordmark" src="data:image/png;base64,${wordmark}"><p>강의 정리부터 복습까지<br>발표와 면접도 함께 연습해요</p><div class="accent"></div>`);
  await designPage.evaluate(() => document.fonts.ready);
  await designPage.screenshot({ path: 'store/feature-graphic.png' });

  const config = JSON.parse(await readFile('app.json', 'utf8')).expo;
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    version: config.version,
    versionCode: config.android.versionCode,
    capture: 'Local web demo, 360×640 at 3x; not an Android device capture',
    iconSha256: createHash('sha256').update(await readFile('assets/brand/app-icon.png')).digest('hex'),
    iconSource: 'assets/brand/app-icon.png',
    // 08 contains browser-only recording instructions: do not submit it to Play.
    playScreenshots: screens.filter(([name]) => name !== '08-record').map(([name]) => `screenshots/framed/${name}.png`),
  };
  await writeFile('store/assets-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Updated icon, feature graphic, screenshots, and assets-manifest.json.');
} finally {
  await browser.close();
}
