const sharp = require('sharp');
const path = require('path');

const TEAL = '#14B8A5';
const SRC = path.join(__dirname, '..', 'public', 'logo.png');
const PUB = path.join(__dirname, '..', 'public');

// Build a white silhouette of the emblem at innerSize, then center it on a
// solid teal canvas of `size`. iOS ignores transparency, so a full-bleed
// opaque teal square with a white mark is what we need.
async function makeIcon(size, padRatio, outPath) {
  const pad = Math.round(size * padRatio);
  const inner = size - 2 * pad;

  const emblem = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .toBuffer();

  // White square masked by the emblem's alpha -> white emblem on transparent.
  const whiteEmblem = await sharp({
    create: { width: inner, height: inner, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: emblem, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: TEAL },
  })
    .composite([{ input: whiteEmblem, left: pad, top: pad }])
    .png()
    .toFile(outPath);

  console.log('wrote', path.basename(outPath), `${size}x${size}`);
}

(async () => {
  await makeIcon(180, 0.16, path.join(PUB, 'apple-touch-icon.png'));
  await makeIcon(192, 0.16, path.join(PUB, 'icon-192x192.png'));
  await makeIcon(512, 0.16, path.join(PUB, 'icon-512x512.png'));
  // Maskable needs a larger safe zone so the OS can crop to a circle/squircle.
  await makeIcon(512, 0.26, path.join(PUB, 'icons', 'maskable-icon-512x512.png'));
  await makeIcon(192, 0.26, path.join(PUB, 'icons', 'maskable-icon.png'));
  console.log('done');
})();
