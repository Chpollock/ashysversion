// Background removal for the pet poses + presents.
//
//   npm run matte-pets
//
// The source PNGs are flat RGB on a near-white background with NO alpha. A naive
// global white key would eat the cats' white boots/blaze/cream fur and the
// presents' cream cloth/paper. Instead we flood-fill from the BORDERS inward:
// only near-white pixels CONTIGUOUS with the edge become transparent, so
// interior whites (surrounded by darker fur) are preserved. We then erode the
// matte by 1px to drop the white anti-aliased rim and feather (box-blur the
// alpha) so there's no halo over the warm room art. Output is RGBA into
// src/assets/pets/ named by semantic pose; originals are left untouched.

import sharp from 'sharp';

const POSES = 'src/assets/pet poses';
const OUT = 'src/assets/pets';

// [source, output] — semantic pose names per the brief
const FILES = [
  [`${POSES}/boombox-pose-1.png`, 'boombox-curl_sleep.png'],
  [`${POSES}/boombox-pose-2.png`, 'boombox-regal_sit.png'],
  [`${POSES}/boombox-pose-3.png`, 'boombox-loaf_sleep.png'],
  [`${POSES}/boombox-pose-4.png`, 'boombox-flop.png'],
  [`${POSES}/boombox-pose-5.png`, 'boombox-curl_back.png'],
  [`${POSES}/boombox-pose-6.png`, 'boombox-nap.png'],
  [`${POSES}/remy-pose-1.png`, 'remy-side_awake.png'],
  [`${POSES}/remy-pose-2.png`, 'remy-curl_sleep.png'],
  [`${POSES}/remy-pose-3.png`, 'remy-sit.png'],
  [`${POSES}/remy-pose-4.png`, 'remy-side_down.png'],
  [`${POSES}/remy-pose-5.png`, 'remy-banana_hug.png'],
  [`${POSES}/remy-pose-6.png`, 'remy-nap.png'],
  [`${POSES}/boombox-and-remy-pose-1.png`, 'snuggle.png'],
  ['src/assets/boombox-present.png', 'boombox-present.png'],
  ['src/assets/remy-present.png', 'remy-present.png'],
];

// A pixel only counts as background if it's quite white AND barely saturated.
// Cream fur/cloth (warmer, lower min channel) stays opaque; only the true white
// backdrop floods. Conservative on purpose — better to leave a sliver of white
// than to eat the cat.
const BG_MIN = 240;   // min(R,G,B) must be at least this
const BG_SAT = 14;    // max-min must be at most this

function boxBlur1(a, w, h) {
  // separable 3x3 average
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let s = a[i], n = 1;
      if (x > 0) { s += a[i - 1]; n++; }
      if (x < w - 1) { s += a[i + 1]; n++; }
      tmp[i] = s / n;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let s = tmp[i], n = 1;
      if (y > 0) { s += tmp[i - w]; n++; }
      if (y < h - 1) { s += tmp[i + w]; n++; }
      out[i] = s / n;
    }
  }
  return out;
}

async function matte(src, outName) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const N = w * h;

  const isBg = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn >= BG_MIN && (mx - mn) <= BG_SAT;
  };

  // Flood-fill background from every border pixel
  const bg = new Uint8Array(N);
  const stack = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i]) return;
    if (isBg(i)) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    seed(x - 1, y); seed(x + 1, y); seed(x, y - 1); seed(x, y + 1);
  }

  // Hard alpha (255 = keep), then erode foreground 1px to drop the white rim
  const eroded = new Float32Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bg[i]) { eroded[i] = 0; continue; }
      const touchesBg =
        (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) ||
        (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
      eroded[i] = touchesBg ? 0 : 255;
    }
  }

  // Feather the edge so it sits cleanly on the room art
  const soft = boxBlur1(eroded, w, h);
  for (let i = 0; i < N; i++) data[i * 4 + 3] = Math.round(soft[i]);

  // Trim the transparent margin so the sprite box tightly bounds the cat —
  // this makes feet_center/body_center anchoring meaningful and keeps natural
  // proportions (no forced square).
  const info2 = await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 6 })
    .png()
    .toFile(`${OUT}/${outName}`);

  return { outName, size: `${info2.width}x${info2.height}` };
}

import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

for (const [src, out] of FILES) {
  const r = await matte(src, out);
  console.log(`✓ ${r.outName.padEnd(26)} ${r.size}`);
}
console.log(`\nDone — ${FILES.length} mattes → ${OUT}/`);
