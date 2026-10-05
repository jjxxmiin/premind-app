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
// STORE_LOCALE=en captures the English set (en-US listing) into store/screenshots/en, with the
// demo in English; the Korean set and the Play icon stay where they are.
const locale = process.env.STORE_LOCALE === 'en' ? 'en' : 'ko';
const outDir = locale === 'en' ? 'store/screenshots/en' : 'store/screenshots';
const copy = {
  ko: {
    demo: '데모로 둘러보기',
    reviewTab: '복습, 자료별 이해도와 다시 볼 곳',
    chatQuestion: '지도학습이 뭐야?',
    copied: '복사',
    newPractice: '새 연습',
    questionSets: '준비된 질문',
    interviewAsk: '어떤 면접을 준비하나요?',
    interviewPack: '공기업 공통, 질문 8개',
    captureAlt: 'PREMIND 실제 앱 화면',
    graphic: '<h1>강의는 요약으로.<br>복습은 <span>문제로.</span></h1><p>내 자료로 정리하고, 묻고, 확인해요.<br>발표와 면접 연습까지 PREMIND</p>',
    graphicAlt: '실제 마인드팩 요약 화면',
    screens: [
      ['01-home', '/', ['녹음, 영상, PDF를', '공부할 거리로'], '링크를 붙여 넣거나 바로 녹음해요', '오늘의 복습'],
      ['02-material-summary', `/material/${material}?tab=summary`, ['긴 강의도', '핵심부터 읽어요'], '요약부터 꼭 기억할 내용까지', '요약'],
      ['03-material-mindmap', `/material/${material}?tab=mindmap`, ['개념 사이의 연결이', '한눈에 보여요'], '내 자료로 만든 마인드맵', '마인드맵'],
      ['04-chat', `/chat/${material}`, ['헷갈릴 때는', '내 자료에 물어봐요'], '답을 확인하고 근거까지 살펴봐요', '5주차, 지도학습의 원리'],
      ['05-mastery', '/mastery', ['읽고 끝내지 말고', '문제로 확인해요'], '이해도를 살펴보고 필요한 곳부터 복습해요', '복습'],
      ['06-lens', '/speak?mode=presentation', ['발표하기 전에', '한 번 더 연습해요'], '내 녹음으로 받아 보는 AI 발표 피드백', '발표'],
      ['07-report', `/report/${material}`, ['무엇을 고칠지', '근거와 함께 봐요'], '다음 연습에 적용할 개선점을 찾아요', '평가'],
      ['08-record', '/record', ['지금 듣는 강의를', '복습할 마인드팩으로'], '녹음부터 정리까지 이어져요', '녹음'],
      ['09-interview', '/speak?mode=interview', ['면접 답변도', '말하면서 다듬어요'], '내게 맞는 질문을 고르고 말해 보세요', '면접'],
    ],
  },
  en: {
    demo: 'Try the demo',
    reviewTab: 'Review, your mastery and what to revisit for each material',
    chatQuestion: 'What is supervised learning?',
    copied: 'Copy',
    newPractice: 'New practice',
    questionSets: 'Question sets',
    interviewAsk: 'What interview are you preparing for?',
    interviewPack: /^Public institutions \(common\)/,
    captureAlt: 'A real PREMIND app screen',
    graphic: '<h1>Lectures into notes.<br>Notes into <span>quizzes.</span></h1><p>Record, summarize, ask and review.<br>AI study app PREMIND</p>',
    graphicAlt: 'A real Mind Pack summary screen',
    screens: [
      ['01-home', '/', ['Lectures, videos and PDFs,', 'ready to study'], 'Paste a link or just hit record', "Today's review"],
      ['02-material-summary', `/material/${material}?tab=summary`, ['Long lecture?', 'Read the key points first'], 'From summary to what you must remember', 'Key points'],
      ['03-material-mindmap', `/material/${material}?tab=mindmap`, ['See how the ideas', 'connect'], 'A mind map made from your material', 'Mind map'],
      ['04-chat', `/chat/${material}`, ['Stuck?', 'Ask your own notes'], 'Answers with the passage they came from', 'Week 5: How supervised learning works'],
      ['05-mastery', '/mastery', ["Don't just reread.", 'Test yourself'], "See what you know and review what you don't", 'Mastery now'],
      ['06-lens', '/speak?mode=presentation', ['Rehearse before', 'you present'], 'AI feedback on your own recording', 'My reviews'],
      ['07-report', `/report/${material}`, ['Know exactly', 'what to fix'], 'Next steps, backed by evidence', 'Fix first'],
      ['08-record', '/record', ['Turn the lecture', 'into a Mind Pack'], 'From recording to review in one flow', 'Record'],
      ['09-interview', '/speak?mode=interview', ['Polish interview answers', 'out loud'], 'Pick questions that fit you and speak', 'Interview'],
    ],
  },
}[locale];
const screens = copy.screens;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PREMIND_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    locale: locale === 'en' ? 'en-US' : 'ko-KR',
    timezoneId: locale === 'en' ? 'America/New_York' : 'Asia/Seoul',
    reducedMotion: 'reduce',
  });
  // Never send demo screenshot actions to a real backend.
  await context.route('**/api/**', (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/login`);
  await page.getByText(copy.demo, { exact: true }).click();
  await page.getByRole('tab', { name: copy.reviewTab }).waitFor();
  await mkdir(`${outDir}/framed`, { recursive: true });

  const font = (await readFile('assets/fonts/Pretendard-Bold.ttf')).toString('base64');
  const designPage = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const fontCss = `@font-face{font-family:Pretendard;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#FFFFFF;color:#17171B;font-family:Pretendard;word-break:keep-all}img{display:block}`;
  for (const [name, path, headline, detail, expected] of screens) {
    await page.goto(`${baseUrl}${path}`);
    await page.getByText(expected, { exact: false }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200); // Finish route and entry transitions.
    if (name === '04-chat') {
      await page.getByText(copy.chatQuestion, { exact: true }).click();
      await page.getByText(copy.copied, { exact: true }).waitFor();
      await page.getByTestId('study-chat-messages').evaluate((element) => { element.scrollTop = 0; });
      await page.waitForTimeout(400);
    }
    // 03-material-mindmap needs no scroll since direction D pins the player and
    // tabs: the map starts right under the tabs.
    if (name === '09-interview') {
      await page.getByText(copy.newPractice, { exact: true }).click();
      await page.getByText(copy.questionSets, { exact: true }).click();
      await page.getByText(copy.interviewAsk, { exact: true }).waitFor();
      await page.getByRole('button', { name: copy.interviewPack, exact: typeof copy.interviewPack === 'string' }).first().click();
      await page.mouse.move(180, 480);
      await page.mouse.wheel(0, 110);
      await page.waitForTimeout(400);
    }
    const raw = await page.screenshot({ path: `${outDir}/${name}.png` });
    await designPage.setContent(`<style>${fontCss}.brand{position:absolute;top:44px;left:108px;font-size:24px;letter-spacing:2px;color:#E25A1C}h1{position:absolute;top:92px;left:108px;margin:0;font-size:64px;line-height:1.12;letter-spacing:-2px}p{position:absolute;top:258px;left:108px;margin:0;font-size:28px;line-height:1.4;color:#6B6E76}.capture{position:absolute;top:352px;left:108px;width:864px;height:1536px;border:1px solid #ECEDF0;object-fit:contain}</style><div class="brand">PREMIND</div><h1>${headline.join('<br>')}</h1><p>${detail}</p><img class="capture" alt="${copy.captureAlt}" src="data:image/png;base64,${raw.toString('base64')}">`);
    await designPage.evaluate(() => document.fonts.ready);
    await designPage.screenshot({ path: `${outDir}/framed/${name}.png` });
    console.log(`Captured ${name}: ${path}`);
  }
  if (errors.length) throw new Error(`Screenshot runtime errors: ${errors.join('; ')}`);

  // Exact resize of the production icon, without redrawing the brand mark.
  await sharp('assets/brand/app-icon.png').resize(512, 512).flatten({ background: '#FFFFFF' }).png().toFile('store/app-icon-512.png');
  const wordmark = (await readFile('assets/brand/wordmark.png')).toString('base64');
  const summaryCapture = (await readFile(`${outDir}/02-material-summary.png`)).toString('base64');
  await designPage.setViewportSize({ width: 1024, height: 500 });
  await designPage.setContent(`<style>${fontCss}.wordmark{position:absolute;left:64px;top:60px;width:256px}h1{position:absolute;left:64px;top:155px;margin:0;font-size:54px;line-height:1.22;letter-spacing:-2px}h1 span{color:#E25A1C}p{position:absolute;left:64px;top:320px;margin:0;font-size:24px;line-height:1.55;color:#6B6E76}.preview{position:absolute;left:670px;top:42px;width:234px;height:416px;border:1px solid #ECEDF0;object-fit:contain}</style><img class="wordmark" alt="PREMIND" src="data:image/png;base64,${wordmark}">${copy.graphic}<img class="preview" alt="${copy.graphicAlt}" src="data:image/png;base64,${summaryCapture}">`);
  await designPage.evaluate(() => document.fonts.ready);
  await designPage.screenshot({ path: locale === 'en' ? 'store/feature-graphic-en.png' : 'store/feature-graphic.png' });

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
    // 08 contains browser-only recording instructions: do not submit it to Play. The English set
    // also leaves out 09: its question packs are for Korean hiring (public institutions, Meister schools).
    locale,
    playScreenshots: screens.filter(([name]) => name !== '08-record' && !(locale === 'en' && name === '09-interview')).map(([name]) => `${outDir.replace('store/', '')}/framed/${name}.png`),
  };
  await writeFile(locale === 'en' ? 'store/assets-manifest-en.json' : 'store/assets-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Updated icon, feature graphic, screenshots, and assets-manifest.json.');
} finally {
  await browser.close();
}
