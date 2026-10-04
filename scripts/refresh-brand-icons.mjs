import sharp from 'sharp';

// The app icon (2026-10-04): the pencil-P drawn on white, in
// assets/brand/icon-source.png. Trim the canvas padding, then place the mark on
// a white 1024 square at each target's size. Every surface it lands on is white
// (adaptive background, splash, web), so the mark keeps its own white ground.
// Adaptive artwork fits inside Android's central 66/108 safe-zone diameter.
// The source's ground is 252-255, not pure white, and would show as a faint box
// on the white icon; snap it to white first. The lightest part of the mark (the
// metal band, ~236) stays well clear of the cut.
const source = await sharp('assets/brand/icon-source.png')
  .flatten({ background: '#FFFFFF' })
  .raw()
  .toBuffer({ resolveWithObject: true });
const { data, info } = source;
for (let i = 0; i < data.length; i += info.channels) {
  if (Math.min(data[i], data[i + 1], data[i + 2]) >= 250) data.fill(255, i, i + 3);
}
const mark = await sharp(data, { raw: info })
  .trim({ background: '#FFFFFF', threshold: 1 })
  .png()
  .toBuffer();

for (const [path, markHeight] of [
  ['assets/brand/adaptive-foreground.png', 512],
  ['assets/brand/app-icon.png', 656],
  ['assets/brand/splash-symbol.png', 732],
]) {
  const sized = await sharp(mark).resize({ height: markHeight }).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: sized, gravity: 'centre' }])
    .png()
    .toFile(path);
}
await sharp('assets/brand/app-icon.png').resize(512).png().toFile('store/app-icon-512.png');
await sharp('assets/brand/app-icon.png').resize(180).png().toFile('public/apple-touch-icon.png');
console.log('Launcher, adaptive, splash, store and web icons generated from icon-source.png.');
