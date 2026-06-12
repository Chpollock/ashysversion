// The living room's story, told as an ordered list of PROJECTS.
//
// roomStateIndex on the save = how many projects are complete. The room image
// shown is the image of the LAST completed project (or the starting room).
// Only the NEXT project is ever offered, as a subtle hint in the room (and
// mirrored in the Shop's Projects tab).
//
// Per project:
//   id, name        — identity
//   teaser          — the hint line shown before purchase
//   revealLine      — shown briefly after she taps the finished reveal
//   cost            — Pennies
//   durationMs      — real-time build duration (completes while away)
//   image           — the room image AFTER this project completes
//   hintPos {x,y}   — % of room image; where the hint/construction marker sits
//   boardHotspot    — {x,y,w,h}%; the backgammon board's tappable region in the
//                     room state AFTER this project (the board moves around)
//
// ALL coordinates are placeholders to tune against the final art.

import startImage from '../assets/living-room-start.png';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

// ── Room state images ─────────────────────────────────────────────────────────
// Loaded by number from assets/Living Room Upgrades/*room-N.png (tolerates the
// "Linving-room-17" filename). Project at index i shows image i+1 when done;
// missing numbers fall back to the nearest earlier image.
const _mods = import.meta.glob('../assets/Living Room Upgrades/*.png', { eager: true });
const IMAGES_BY_NUM = {};
for (const [path, mod] of Object.entries(_mods)) {
  const m = path.match(/room-(\d+)\.png$/i);
  if (m) IMAGES_BY_NUM[Number(m[1])] = mod.default;
}

export function roomImageForState(roomStateIndex) {
  for (let n = roomStateIndex; n >= 1; n--) {
    if (IMAGES_BY_NUM[n]) return IMAGES_BY_NUM[n];
  }
  return startImage;
}

// The board starts on its cardboard box, then moves to the coffee table.
const BOARD_ON_BOX   = { x: 38, y: 52, w: 24, h: 22 };
const BOARD_ON_TABLE = { x: 40, y: 58, w: 22, h: 18 };

function project(i, id, name, teaser, revealLine, cost, durationMs, hintPos, boardHotspot) {
  return {
    id, name, teaser, revealLine, cost, durationMs,
    image: IMAGES_BY_NUM[i + 1] ?? null, // null → roomImageForState falls back
    hintPos,
    boardHotspot,
  };
}

export const PROJECTS = [
  project(0, 'draw-board', 'Draw the Board',
    'Boombox left the Sharpie out. He’s trying to tell us something.',
    'It’s perfect. It was always going to be perfect.',
    5, 10 * SEC, { x: 45, y: 60 }, BOARD_ON_BOX),

  project(1, 'unpack', 'Unpack',
    'We can’t live out of boxes forever. (We could. But we shouldn’t.)',
    'Boxes broken down, treasures found. We live here now.',
    25, 30 * SEC, { x: 20, y: 65 }, BOARD_ON_BOX),

  project(2, 'patch-walls-1', 'Patch the Walls I',
    'Every crack has a story. Let’s give them a fresh page.',
    'One wall smooth as new paper.',
    50, 2 * MIN, { x: 25, y: 30 }, BOARD_ON_BOX),

  project(3, 'patch-walls-2', 'Patch the Walls II',
    'Halfway there. The wall’s starting to believe in us.',
    'The walls are whole again. They look taller somehow.',
    75, 5 * MIN, { x: 70, y: 28 }, BOARD_ON_BOX),

  project(4, 'paint', 'Paint',
    'Fresh cream walls. A blank canvas for everything next.',
    'Cream from corner to corner. The whole room exhales.',
    100, 30 * MIN, { x: 50, y: 25 }, BOARD_ON_BOX),

  project(5, 'floors', 'Refinish the Floors',
    'These boards have carried a hundred years. A little love back.',
    'A hundred years of stories, finally gleaming.',
    125, 1 * HOUR, { x: 50, y: 82 }, BOARD_ON_BOX),

  project(6, 'rug', 'The Rug',
    'Something soft underfoot. The room’s first deep breath.',
    'Soft underfoot. The room’s first deep breath, taken.',
    150, 30 * MIN, { x: 45, y: 75 }, BOARD_ON_BOX),

  project(7, 'couch', 'The Couch',
    'We could use someplace to sit, right?',
    'Somewhere to sit. Somewhere to stay.',
    250, 2 * HOUR, { x: 68, y: 55 }, BOARD_ON_BOX),

  project(8, 'coffee-table', 'The Coffee Table',
    'The board deserves better than a cardboard box. (The box did great though.)',
    'The board has a throne now. (Thank you for your service, box.)',
    175, 1 * HOUR, { x: 42, y: 62 }, BOARD_ON_TABLE),

  project(9, 'arc-lamp', 'The Arc Lamp',
    'Five golden arms, like the room is reaching for something.',
    'Five golden arms, holding the evening up.',
    150, 30 * MIN, { x: 15, y: 38 }, BOARD_ON_TABLE),

  project(10, 'curtains', 'Curtains & Fairy Lights',
    'Velvet and tiny stars. Evenings just got cozier.',
    'Velvet down, stars on. Goodnight is gorgeous now.',
    175, 1 * HOUR, { x: 30, y: 20 }, BOARD_ON_TABLE),

  project(11, 'ceiling-light', 'The Ceiling Light',
    'Bye bye boob light!',
    'The boob light is gone. We never speak of it again.',
    150, 30 * MIN, { x: 50, y: 8 }, BOARD_ON_TABLE),

  project(12, 'plants', 'Plants & Side Table',
    'Something green and growing. Like everything else in here.',
    'Something green, reaching for the window.',
    125, 30 * MIN, { x: 85, y: 50 }, BOARD_ON_TABLE),

  project(13, 'gallery-1', 'Gallery Wall, Part I',
    'A few frames up. Hmm… not quite right yet, is it?',
    'Frames on the wall. Something’s still missing…',
    150, 1 * HOUR, { x: 60, y: 25 }, BOARD_ON_TABLE),

  project(14, 'cactus-lamp', 'The Cactus Lamp',
    'A cactus that glows. Obviously.',
    'It glows. Of course it glows.',
    175, 1 * HOUR, { x: 88, y: 62 }, BOARD_ON_TABLE),

  project(15, 'chairs', 'Chairs & Games Table',
    'More seats at the table. Room for everyone we love.',
    'Pull up a chair. Stay a while.',
    200, 2 * HOUR, { x: 75, y: 70 }, BOARD_ON_TABLE),

  project(16, 'gallery-2', 'Gallery Wall, Complete',
    'There it is. Every frame where it belongs.',
    'Every frame where it belongs. A whole story on one wall.',
    200, 2 * HOUR, { x: 60, y: 22 }, BOARD_ON_TABLE),

  project(17, 'hammy-lamp', 'The Hammy Lamp',
    'A little golden someone to watch over the games.',
    'A little golden someone, keeping watch.',
    150, 1 * HOUR, { x: 28, y: 48 }, BOARD_ON_TABLE),

  project(18, 'finishing', 'Finishing Touches',
    'Records, pillows, throws. Not a house anymore. Home.',
    'Not a house anymore. Home.',
    250, 4 * HOUR, { x: 12, y: 55 }, BOARD_ON_TABLE),
];

export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
export const PROJECT_INDEX_BY_ID = Object.fromEntries(PROJECTS.map((p, i) => [p.id, i]));

// ── Derived helpers ───────────────────────────────────────────────────────────

// The next project available to start (null once the room is finished)
export function nextProject(save) {
  return PROJECTS[save.roomStateIndex] ?? null;
}

// Has a given project been completed?
export function projectDone(save, projectId) {
  const idx = PROJECT_INDEX_BY_ID[projectId];
  return idx !== undefined && save.roomStateIndex > idx;
}

// Begin building the next project (pure). Caller checks affordability + that
// no other project is active.
export function beginProject(save, proj, now = Date.now()) {
  return {
    ...save,
    pennies: save.pennies - proj.cost,
    activeProject: { id: proj.id, completesAt: now + proj.durationMs },
  };
}

// The board's tappable region for the CURRENT room state
export function boardHotspotForState(roomStateIndex) {
  const last = PROJECTS[Math.min(roomStateIndex, PROJECTS.length) - 1];
  return last?.boardHotspot ?? BOARD_ON_BOX;
}

// ── Room constants ────────────────────────────────────────────────────────────

// Boombox is painted INTO the room images up to and including this state index;
// beyond it, the pet-spot overlay system renders (and relocates) him.
export const BAKED_PETS_UP_TO = 5;

// Printer's type tray on the gallery wall — the achievements viewer. Unlocks
// when gallery-2 is revealed. Coordinates are placeholders.
export const TYPE_TRAY = {
  unlockAfter: 'gallery-2',
  hotspot: { x: 56, y: 18, w: 14, h: 12 },
};
export const TRAY_UNLOCK_INDEX = PROJECT_INDEX_BY_ID[TYPE_TRAY.unlockAfter] + 1;

// The wrapped present on the record player — the song gift. Appears once the
// final project is revealed. Coordinates are placeholders.
export const SONG_GIFT = {
  hotspot: { x: 12, y: 44, w: 9, h: 10 },
  cardText: 'Listen to this. It’s the words to the song that’s been playing the whole time you’ve been here. Love you, Charlie.',
};

// Penny jar HUD: jar reads as "full" at this many Pennies
export const JAR_FULL_AT = 500;

export function formatDuration(ms) {
  if (ms < MIN) return `${Math.round(ms / SEC)}s`;
  if (ms < HOUR) return `${Math.round(ms / MIN)} min`;
  return `${Math.round(ms / HOUR)} hr${ms >= 2 * HOUR ? 's' : ''}`;
}
