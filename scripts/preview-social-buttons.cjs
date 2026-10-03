// Isolated visual preview of the REAL components. Only auth availability and
// i18n are stubbed; it neither changes production provider gates nor logs in.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return originalLoad.call(this, name === 'react-native' ? 'react-native-web' : name, ...args);
};
const rn = require('react-native-web');
const cache = new Map();
function loadSource(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { code } = babel.transformFileSync(filename, {
    configFile: false, babelrc: false,
    presets: ['@babel/preset-typescript'],
    plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }], '@babel/plugin-transform-modules-commonjs'],
  });
  const localRequire = (name) => {
    if (name === '@/features/auth/use-social-sign-in') return {
      useAvailableProviders: () => ['kakao', 'google'],
      useGoogleSignIn: () => async () => {}, useKakaoSignIn: () => async () => {},
      SocialSignInCancelled: class extends Error {},
    };
    if (name === '@/lib/i18n') return { useT: () => (text) => text };
    if (name === 'react-native-svg') return require('react-native-svg/lib/commonjs/elements.web');
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!resolved) throw new Error(`Cannot resolve ${name}`);
      return loadSource(resolved);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

async function main() {
  const { SocialSignInButtons } = loadSource(path.join(root, 'src/components/SocialSignInButtons.tsx'));
  rn.AppRegistry.registerComponent('SocialButtonsPreview', () => () =>
    React.createElement(rn.View, { style: { padding: 20, backgroundColor: '#fff' } },
      React.createElement(SocialSignInButtons, { onError: () => {} })));
  const { element, getStyleElement } = rn.AppRegistry.getApplication('SocialButtonsPreview');
  const fontFaces = ['Medium', 'Bold'].map((weight) => `@font-face { font-family: Pretendard-${weight}; src: url(data:font/ttf;base64,${fs.readFileSync(path.join(root, `assets/fonts/Pretendard-${weight}.ttf`)).toString('base64')}) format('truetype'); }`).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">${renderToStaticMarkup(getStyleElement())}<style>body{margin:0;background:#fff}${fontFaces}</style></head><body>${renderToStaticMarkup(element)}</body></html>`;
  const outputDir = path.join(root, 'dist/social-buttons-preview');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 180 }, deviceScaleFactor: 3 });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator('svg').count() !== 2 || await page.locator('img, image').count() !== 0) throw new Error('Expected two vector icons and no raster images');
    await page.screenshot({ path: path.join(outputDir, 'social-buttons.png') });
    console.log(`Preview: ${path.join(outputDir, 'social-buttons.png')}`);
  } finally {
    await browser.close();
    Module._load = originalLoad;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
