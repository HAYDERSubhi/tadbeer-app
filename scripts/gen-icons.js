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

// Notification small icon (Android status bar): Android masks it by ALPHA and
// renders the opaque pixels white. So it MUST be a transparent-background white
// silhouette — NOT the solid teal square (which masks to a white block).
async function makeBadge(size, padRatio, outPath) {
  const pad = Math.round(size * padRatio);
  const inner = size - 2 * pad;

  const emblem = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .toBuffer();

  const whiteEmblem = await sharp({
    create: { width: inner, height: inner, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: emblem, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // White emblem centered on a FULLY TRANSPARENT canvas (no teal).
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: whiteEmblem, left: pad, top: pad }])
    .png()
    .toFile(outPath);

  console.log('wrote', path.basename(outPath), `${size}x${size} (transparent badge)`);
}

(async () => {
  // apple-touch-icon: يبقى 0.16 — أيقونة iOS سليمة، لا نمسّها.
  await makeIcon(180, 0.16, path.join(PUB, 'apple-touch-icon.png'));
  // أيقونات 'any' (تستخدمها شاشة الإقلاع/السبلاش): هامش أصغر لتكبير الشعار.
  await makeIcon(192, 0.12, path.join(PUB, 'icon-192x192.png'));
  await makeIcon(512, 0.12, path.join(PUB, 'icon-512x512.png'));
  // Maskable: منطقة أمان كافية للقص الدائري/المربّع مع شعار أكبر (0.26 → 0.19).
  await makeIcon(512, 0.19, path.join(PUB, 'icons', 'maskable-icon-512x512.png'));
  await makeIcon(192, 0.19, path.join(PUB, 'icons', 'maskable-icon.png'));
  // أيقونة الإشعار (شريط الحالة): نخلات بيضاء على خلفية شفافة.
  await makeBadge(96, 0.10, path.join(PUB, 'badge-96.png'));
  console.log('done');
})();
