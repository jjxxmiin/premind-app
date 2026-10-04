import sharp from 'sharp';

// Strip source-canvas padding before placing the unchanged brand artwork.
// Adaptive artwork fits inside Android's central 66/108 safe-zone diameter.
const symbol = await sharp('assets/brand/symbol.png').trim().png().toBuffer();
for (const [path, markHeight, transparent] of [
  ['assets/brand/adaptive-foreground.png', 512, true],
  ['assets/brand/app-icon.png', 656, false],
]) {
  const mark = await sharp(symbol).resize({ height: markHeight }).png().toBuffer();
  const icon = await sharp({ create: {
    width: 1024, height: 1024, channels: 4,
    background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#FFFFFF',
  } }).composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  const output = sharp(icon);
  if (!transparent) output.removeAlpha();
  await output.png().toFile(path);
}
await sharp('assets/brand/app-icon.png').resize(512).removeAlpha().png().toFile('store/app-icon-512.png');
await sharp('assets/brand/app-icon.png').resize(180).removeAlpha().png().toFile('public/apple-touch-icon.png');
console.log('Centered launcher and store icons generated from the original symbol.');
