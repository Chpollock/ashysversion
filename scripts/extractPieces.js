// One-time script: extracts individual checker circles from sprite sheets.
// Run with:  node scripts/extractPieces.js   (or: npm run extract-pieces)
//
// Reads:
//   src/assets/ashton-starting-pieces.png
//   src/assets/charlie-starting-pieces.png
//
// Writes:
//   src/assets/pieces/ashton/piece-01.png … piece-15.png
//   src/assets/pieces/charlie/piece-01.png … piece-15.png
//
// NOTE: The sprite sheets have a solid WHITE background (no transparency).
// Detection works by color distance from white, NOT alpha channel.

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dirname, '..');
const ASSETS = join(ROOT, 'src', 'assets');

// Pixels whose color distance from pure white is BELOW this are background.
// Ashton histogram shows a valley at dist 30-39; charlie circles are dist > 150.
// A threshold of 30 cleanly separates background from circles for both sheets.
const BG_THRESHOLD   = 30;   // color-dist from white → background if below this
const MIN_BLOB_PX    = 1000; // filter tiny edge fragments (real circles are ~30-50k px)
const CROP_MARGIN    = 12;   // px beyond blob bbox — keep tight so less white edge
const OUTPUT_SIZE    = 120;

const SHEETS = [
  { input: join(ASSETS, 'ashton-starting-pieces.png'),  outDir: join(ASSETS, 'pieces', 'ashton'),  name: 'ashton'  },
  { input: join(ASSETS, 'charlie-starting-pieces.png'), outDir: join(ASSETS, 'pieces', 'charlie'), name: 'charlie' },
];

// ── Color-distance blob detection ─────────────────────────────────────────────

function findBlobs(pixels, W, H) {
  const total  = W * H;
  const labels = new Int32Array(total).fill(-1);

  // Mark near-white (background) pixels as -2 so BFS skips them
  for (let i = 0; i < total; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
    if (dist < BG_THRESHOLD) labels[i] = -2;
  }

  const blobs = [];
  const queue = new Int32Array(total);

  for (let start = 0; start < total; start++) {
    if (labels[start] !== -1) continue;

    const id   = blobs.length;
    const blob = { minX: W, maxX: 0, minY: H, maxY: 0, pixelCount: 0 };
    labels[start] = id;

    let head = 0, tail = 0;
    queue[tail++] = start;

    while (head < tail) {
      const idx = queue[head++];
      const px  = idx % W;
      const py  = (idx / W) | 0;

      blob.pixelCount++;
      if (px < blob.minX) blob.minX = px;
      if (px > blob.maxX) blob.maxX = px;
      if (py < blob.minY) blob.minY = py;
      if (py > blob.maxY) blob.maxY = py;

      if (px > 0     && labels[idx - 1] === -1) { labels[idx - 1] = id; queue[tail++] = idx - 1; }
      if (px < W - 1 && labels[idx + 1] === -1) { labels[idx + 1] = id; queue[tail++] = idx + 1; }
      if (py > 0     && labels[idx - W] === -1) { labels[idx - W] = id; queue[tail++] = idx - W; }
      if (py < H - 1 && labels[idx + W] === -1) { labels[idx + W] = id; queue[tail++] = idx + W; }
    }

    blobs.push(blob);
  }

  return blobs.filter(b => b.pixelCount >= MIN_BLOB_PX);
}

// ── SVG circle mask ───────────────────────────────────────────────────────────

const CIRCLE_SVG = Buffer.from(
  `<svg viewBox="0 0 ${OUTPUT_SIZE} ${OUTPUT_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
  `<circle cx="${OUTPUT_SIZE / 2}" cy="${OUTPUT_SIZE / 2}" r="${OUTPUT_SIZE / 2}" fill="white"/>` +
  `</svg>`
);

// ── Process one sheet ─────────────────────────────────────────────────────────

async function processSheet({ input, outDir, name }) {
  console.log(`\n── ${name} ──────────────────────────────`);

  if (!existsSync(input)) { console.error(`  ERROR: ${input} not found`); return; }

  const { data, info } = await sharp(input).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  console.log(`  Image: ${W}×${H}px  (background detected by color distance < ${BG_THRESHOLD} from white)`);

  const blobs = findBlobs(data, W, H);
  console.log(`  Blobs found: ${blobs.length} significant (≥${MIN_BLOB_PX}px) — expected ~15`);

  if (!blobs.length) {
    console.error('  No blobs detected — try lowering BG_THRESHOLD.');
    return;
  }

  // Sort top-to-bottom then left-to-right for consistent naming
  blobs.sort((a, b) => {
    const rowA = Math.round(a.minY / 80);
    const rowB = Math.round(b.minY / 80);
    return rowA !== rowB ? rowA - rowB : a.minX - b.minX;
  });

  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    const cx = Math.round((blob.minX + blob.maxX) / 2);
    const cy = Math.round((blob.minY + blob.maxY) / 2);
    const half = Math.ceil(Math.max(blob.maxX - blob.minX, blob.maxY - blob.minY) / 2) + CROP_MARGIN;

    const left   = Math.max(0, cx - half);
    const top    = Math.max(0, cy - half);
    const right  = Math.min(W - 1, cx + half);
    const bottom = Math.min(H - 1, cy + half);
    const width  = right - left + 1;
    const height = bottom - top + 1;

    const num     = String(i + 1).padStart(2, '0');
    const outPath = join(outDir, `piece-${num}.png`);

    // Step 1: extract + resize, get raw RGBA pixels
    const { data } = await sharp(input)
      .extract({ left, top, width, height })
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'fill' })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    // Step 2: hard-cut near-white pixels to fully transparent.
    // A gradual fade leaves semi-transparent pixels that show as a faint ring —
    // a hard cutoff eliminates the halo completely. The SVG circle mask handles
    // the smooth circular edge on its own.
    for (let p = 0; p < data.length; p += 4) {
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
      if (dist < BG_THRESHOLD) data[p + 3] = 0;
    }

    // Step 3: reconstruct → apply circular clip → save
    await sharp(Buffer.from(data), {
      raw: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 4 },
    })
      .composite([{ input: CIRCLE_SVG, blend: 'dest-in' }])
      .png()
      .toFile(outPath);

    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    console.log(`  piece-${num}.png  ${bw}×${bh}px blob  core=${blob.pixelCount}px`);
  }

  console.log(`  ✓ Saved ${blobs.length} pieces → ${outDir}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

for (const sheet of SHEETS) {
  await processSheet(sheet);
}

console.log('\nDone. Restart your Vite dev server so the new images are picked up.');
