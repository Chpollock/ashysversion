// Generate home-screen icons from the loading-house art.
// Square-crops the little yellow house out of loading-house.png (941×1672) and
// writes the iOS + manifest icons into public/.
//
//   npm run make-icons
//
// Tune HOUSE_CENTER_Y (0–1, fraction of image height where the crop centers)
// if the framing needs a nudge.

import sharp from 'sharp';

const SRC = 'src/assets/loading-house.png';
const HOUSE_CENTER_Y = 0.52; // the house sits just below the vertical middle

const OUTPUTS = [
  { size: 180, file: 'public/apple-touch-icon.png' },
  { size: 192, file: 'public/icon-192.png' },
  { size: 512, file: 'public/icon-512.png' },
];

const meta = await sharp(SRC).metadata();
const side = Math.min(meta.width, meta.height);
const left = Math.round((meta.width - side) / 2);
const top = Math.min(
  meta.height - side,
  Math.max(0, Math.round(meta.height * HOUSE_CENTER_Y - side / 2)),
);

for (const { size, file } of OUTPUTS) {
  await sharp(SRC)
    .extract({ left, top, width: side, height: side })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`✓ ${file} (${size}×${size})`);
}
