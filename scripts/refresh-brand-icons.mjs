import { Buffer } from 'node:buffer';

import sharp from 'sharp';

// The app icon (2026-10-04): an orange P on a cream rounded square, drawn in
// assets/brand/icon-source.png. The source bakes in its own rounded corners
// and a white margin, which an OS icon mask must not get, so the P is lifted
// out as a clean alpha mask and every icon is rebuilt from it:
//   full-bleed cream square + P   -> app-icon (iOS, web favicon), store, web home
//   transparent P on cream bg     -> Android adaptive foreground (+ monochrome)
//   cream rounded tile + P        -> splash symbol
//   the P alone, cut tight        -> in-app logo (src/components/ui/Wordmark.tsx)
export const CREAM = '#FDF6EB';
export const ORANGE = '#D45614';
const CREAM_BLUE = 235;
const ORANGE_BLUE = 20;
// The cream tile inside the source canvas; the P keeps its place in it.
const TILE = { left: 79, top: 79, width: 1096, height: 1096 };

const tile = await sharp('assets/brand/icon-source.png')
  .removeAlpha()
  .extract(TILE)
  .raw()
  .toBuffer({ resolveWithObject: true });
// Two flat colours: the blue channel alone says how much of a pixel is P.
// White outside the tile's rounded corners reads as "not P" too.
const alpha = Buffer.alloc(tile.info.width * tile.info.height);
for (let i = 0, p = 0; p < alpha.length; i += tile.info.channels, p += 1) {
  const t = (CREAM_BLUE - tile.data[i + 2]) / (CREAM_BLUE - ORANGE_BLUE);
  alpha[p] = Math.round(Math.min(1, Math.max(0, t)) * 255);
}
const maskInfo = { width: tile.info.width, height: tile.info.height, channels: 1 };

/** The P in `color` at `size` px, positioned as in the source tile. */
async function letter(size, color) {
  // resize hands back sRGB; keep the one grey channel.
  const a = await sharp(alpha, { raw: maskInfo }).resize(size, size).extractChannel(0).raw().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .joinChannel(a, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

async function onCanvas(path, { canvas = 1024, letterSize, background, rounded = false }) {
  const base = rounded
    ? sharp(
        Buffer.from(
          `<svg width="${canvas}" height="${canvas}"><rect width="${canvas}" height="${canvas}" rx="${Math.round(canvas * 0.22)}" fill="${CREAM}"/></svg>`,
        ),
      )
    : sharp({ create: { width: canvas, height: canvas, channels: 4, background } });
  await base
    .composite([{ input: await letter(letterSize, ORANGE), gravity: 'centre' }])
    .png()
    .toFile(path);
}

// Full bleed: the OS masks the corners. The P stays 54% tall as in the source.
await onCanvas('assets/brand/app-icon.png', { letterSize: 1024, background: CREAM });
// Adaptive: 108dp canvas, 72dp visible — the tile maps onto the visible part.
await onCanvas('assets/brand/adaptive-foreground.png', {
  letterSize: 683,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
});
const mono = await sharp(alpha, { raw: maskInfo }).resize(683, 683).extractChannel(0).raw().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    {
      input: await sharp({ create: { width: 683, height: 683, channels: 3, background: '#FFFFFF' } })
        .joinChannel(mono, { raw: { width: 683, height: 683, channels: 1 } })
        .png()
        .toBuffer(),
      gravity: 'centre',
    },
  ])
  .png()
  .toFile('assets/brand/adaptive-monochrome.png');
// Splash: the icon as a tile on the white launch screen.
await onCanvas('assets/brand/splash-symbol.png', { letterSize: 1024, rounded: true });
// In-app logo: the P alone, trimmed, in the wordmark's orange family.
await sharp(await letter(1024, ORANGE)).trim().resize({ height: 512 }).png().toFile('assets/brand/symbol.png');

await sharp('assets/brand/app-icon.png').resize(512).removeAlpha().png().toFile('store/app-icon-512.png');
await sharp('assets/brand/app-icon.png').resize(180).removeAlpha().png().toFile('public/apple-touch-icon.png');
console.log('Launcher, adaptive (+ monochrome), splash, in-app, store and web icons generated.');
