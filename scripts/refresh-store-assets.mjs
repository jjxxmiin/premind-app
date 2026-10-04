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
  ['01-home', '/', ['쌓여 있던 강의를', '복습할 자료로'], '녹음, 파일, 유튜브 링크를 한곳에 모아요', '복습'],
  ['02-material-summary', `/material/${material}?tab=summary`, ['긴 강의도', '핵심부터 읽어요'], '요약부터 꼭 기억할 내용까지', '요약'],
  ['03-material-mindmap', `/material/${material}?tab=mindmap`, ['개념 사이의 연결이', '한눈에 보여요'], '내 자료로 만든 마인드맵', '마인드맵'],
  ['04-chat', `/chat/${material}`, ['헷갈릴 때는', '내 자료에 물어봐요'], '답을 확인하고 근거까지 살펴봐요', '5주차, 지도학습의 원리'],
  ['05-mastery', '/mastery', ['읽고 끝내지 말고', '문제로 확인해요'], '이해도를 살펴보고 필요한 곳부터 복습해요', '복습'],
  ['06-lens', '/speak?mode=presentation', ['발표하기 전에', '한 번 더 연습해요'], '내 녹음으로 받아 보는 AI 발표 피드백', '발표'],
  ['07-report', `/report/${material}`, ['무엇을 고칠지', '근거와 함께 봐요'], '다음 연습에 적용할 개선점을 찾아요', '평가'],
  ['08-record', '/record', ['지금 듣는 강의를', '복습할 마인드팩으로'], '녹음부터 정리까지 이어져요', '녹음'],
  ['09-interview', '/speak?mode=interview', ['면접 답변도', '말하면서 다듬어요'], '내게 맞는 질문을 고르고 말해 보세요', '면접'],
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
  const fontCss = `@font-face{font-family:Pretendard;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#FFFFFF;color:#17171B;font-family:Pretendard;word-break:keep-all}img{display:block}`;
  for (const [name, path, headline, detail, expected] of screens) {
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
    if (name === '09-interview') {
      await page.getByText('새 연습', { exact: true }).click();
      await page.getByText('준비된 질문', { exact: true }).click();
      await page.getByText('어떤 면접을 준비하나요?', { exact: true }).waitFor();
      await page.getByRole('button', { name: '공기업 공통, 질문 8개', exact: true }).click();
      await page.mouse.move(180, 480);
      await page.mouse.wheel(0, 110);
      await page.waitForTimeout(400);
    }
    const raw = await page.screenshot({ path: `store/screenshots/${name}.png` });
    await designPage.setContent(`<style>${fontCss}.brand{position:absolute;top:44px;left:108px;font-size:24px;letter-spacing:2px;color:#E25A1C}h1{position:absolute;top:92px;left:108px;margin:0;font-size:64px;line-height:1.12;letter-spacing:-2px}p{position:absolute;top:258px;left:108px;margin:0;font-size:28px;line-height:1.4;color:#6B6E76}.capture{position:absolute;top:352px;left:108px;width:864px;height:1536px;border:1px solid #ECEDF0;object-fit:contain}</style><div class="brand">PREMIND</div><h1>${headline.join('<br>')}</h1><p>${detail}</p><img class="capture" alt="PREMIND 실제 앱 화면" src="data:image/png;base64,${raw.toString('base64')}">`);
    await designPage.evaluate(() => document.fonts.ready);
    await designPage.screenshot({ path: `store/screenshots/framed/${name}.png` });
    console.log(`Captured ${name}: ${path}`);
  }
  if (errors.length) throw new Error(`Screenshot runtime errors: ${errors.join('; ')}`);

  // Exact resize of the production icon, without redrawing the brand mark.
  await sharp('assets/brand/app-icon.png').resize(512, 512).flatten({ background: '#FFFFFF' }).png().toFile('store/app-icon-512.png');
  const wordmark = (await readFile('assets/brand/wordmark.png')).toString('base64');
  const summaryCapture = (await readFile('store/screenshots/02-material-summary.png')).toString('base64');
  await designPage.setViewportSize({ width: 1024, height: 500 });
  await designPage.setContent(`<style>${fontCss}.wordmark{position:absolute;left:64px;top:60px;width:256px}h1{position:absolute;left:64px;top:155px;margin:0;font-size:54px;line-height:1.22;letter-spacing:-2px}h1 span{color:#E25A1C}p{position:absolute;left:64px;top:320px;margin:0;font-size:24px;line-height:1.55;color:#6B6E76}.preview{position:absolute;left:670px;top:42px;width:234px;height:416px;border:1px solid #ECEDF0;object-fit:contain}</style><img class="wordmark" alt="PREMIND" src="data:image/png;base64,${wordmark}"><h1>강의는 요약으로.<br>복습은 <span>문제로.</span></h1><p>내 자료로 정리하고, 묻고, 확인해요.<br>발표와 면접 연습까지 PREMIND</p><img class="preview" alt="실제 마인드팩 요약 화면" src="data:image/png;base64,${summaryCapture}">`);
  await designPage.evaluate(() => document.fonts.ready);
  await designPage.screenshot({ path: 'store/feature-graphic.png' });

  const config = JSON.parse(await readFile('app.json', 'utf8')).expo;
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceWorktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    captureBundles: await page.locator('script[src]').evaluateAll((scripts) =>
      scripts.map((script) => script.getAttribute('src')).filter(Boolean)),
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
