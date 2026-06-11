// Data-driven definitions for the living room.
//
// All positions are PERCENTAGES of the room image (living-room-start.png).
// `overlay.image` is null for everything not yet illustrated — RoomScreen draws a
// clearly-labeled colored-rectangle placeholder in that case. Drop real art in and
// set overlay.image to swap it in without touching components.
//
// Three kinds of thing live here:
//   REPAIRS  — tappable damage spots that cost Pennies + time, then reveal a fix
//   FURNITURE — shop-bought items rendered as overlays once owned/placed
//   FIXTURES — fixed interactive hotspots (the game box, the boombox)

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const REPAIRS = [
  {
    id: 'wallCrack1',
    name: 'Cracked Wall',
    description: 'A little crack by the window. Easy fix.',
    price: 30,
    durationMs: 8 * 1000,            // ~8s — first repairs are nearly instant
    hotspot: { x: 18, y: 28, w: 12, h: 16 },
    // The "fixed" overlay that appears after the reveal:
    overlay: { image: null, color: '#c9b48a', x: 18, y: 28, w: 12, h: 16, z: 2 },
  },
  {
    id: 'peelingPaint',
    name: 'Peeling Paint',
    description: 'The paint is curling at the corner. A coat will do it.',
    price: 60,
    durationMs: 10 * 1000,           // ~10s
    hotspot: { x: 70, y: 22, w: 14, h: 18 },
    overlay: { image: null, color: '#d8c69c', x: 70, y: 22, w: 14, h: 18, z: 2 },
  },
  {
    id: 'wobblyFloorboard',
    name: 'Wobbly Floorboard',
    description: 'A board near the middle creaks. Worth doing properly.',
    price: 150,
    durationMs: 30 * MIN,            // longer-term repair
    hotspot: { x: 40, y: 80, w: 18, h: 10 },
    overlay: { image: null, color: '#b89968', x: 40, y: 80, w: 18, h: 10, z: 1 },
  },
  {
    id: 'draftyWindow',
    name: 'Drafty Window',
    description: 'The window never quite sealed. A real project.',
    price: 300,
    durationMs: 2 * HOUR,
    hotspot: { x: 30, y: 18, w: 16, h: 22 },
    overlay: { image: null, color: '#9fc3d8', x: 30, y: 18, w: 16, h: 22, z: 1 },
  },
];

export const FURNITURE = [
  {
    id: 'cozyRug',
    name: 'Cozy Rug',
    overlay: { image: null, color: '#b5654a', x: 32, y: 72, w: 36, h: 18, z: 3 },
  },
  {
    id: 'warmLamp',
    name: 'Warm Lamp',
    overlay: { image: null, color: '#f3d27a', x: 8, y: 40, w: 10, h: 26, z: 3 },
  },
  {
    id: 'wallArt',
    name: 'Framed Print',
    overlay: { image: null, color: '#8a6f4a', x: 56, y: 24, w: 12, h: 14, z: 3 },
  },
];

// Fixed interactive hotspots. Coordinates are placeholders — tune against the art.
export const FIXTURES = {
  // The backgammon box — the most prominent tappable object → enters the game
  gameBox: { hotspot: { x: 38, y: 52, w: 24, h: 22 } },
  // Boombox in his sunbeam
  boombox: { hotspot: { x: 78, y: 58, w: 14, h: 18 } },
};

// Lookup helpers
export const REPAIR_BY_ID = Object.fromEntries(REPAIRS.map(r => [r.id, r]));
export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
