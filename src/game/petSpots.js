// Spot-based pet system (Neko Atsume style). Pets don't walk — they relocate
// between fixed spots, and come/go ("home" vs "away"), only when UNOBSERVED
// (app open, or returning to the room). Everything is data-driven.
//
// Per pet (PETS):
//   id, name, emoji, gender, placeholderColor — identity
//   relocateChance      — chance of moving spots on a return visit
//   goAwayChance/returnChance — presence model (steady-state ~home/away mix)
//   awayStatuses[]      — flavor lines shown in the overview when away
//   homeSpot            — spot id used on first placement
//   tapReactions        — small reactions shown when tapped
//   flatSleepPoses[]    — interchangeable flat-surface sleep poses (pooled)
//   spots[]             — see below
//
// Per spot:
//   id, label           — 'sunbeam' / 'the sunbeam' (label shows in the overview)
//   position {x,y}      — % of room image (the anchor point)
//   scale               — cat width as % of room width
//   anchor              — which sprite point pins to (x,y):
//                           'feet_center' (cat ON a surface — couch/floor/sill)
//                           'body_center' (cat IN something — basket/cushion)
//   zOrder              — z (paint order)
//   weight              — relocation preference
//   minRoomState        — spot exists once this many projects are complete
//   poses[]             — poses this spot allows (pose pinning/pooling)
//   banana              — Remy may roll banana_hug here (cozy/safe)
//
// The CALIBRATION fields (position/scale/anchor/zOrder) are seeded but meant to
// be perfected on the real phone via ?calibrate (see RoomScreen calibrate mode).

import { ECONOMY } from './economy.js';
import { rollPetGift, boomboxFirstKeepsake } from './petGifts.js';

// ── Matted pose + present images (RGBA, from `npm run matte-pets`) ─────────────
const _poseMods = import.meta.glob('../assets/pets/*.png', { eager: true });
const PET_IMAGES = {};
for (const [p, m] of Object.entries(_poseMods)) {
  PET_IMAGES[p.split('/').pop().replace('.png', '')] = m.default;
}
export function poseImage(petId, pose) { return PET_IMAGES[`${petId}-${pose}`] ?? null; }
export function presentImage(petId)    { return PET_IMAGES[`${petId}-present`] ?? null; }
export const SNUGGLE_IMAGE = PET_IMAGES['snuggle'] ?? null;

// The one spot two cats are allowed to share — when both land here, they snuggle.
export const SHARED_SPOT = 'couch';

export const PETS = {
  boombox: {
    id: 'boombox',
    name: 'Boombox',
    emoji: '🐈',
    gender: 'male',
    placeholderColor: '#caa46a',
    relocateChance: 0.22,    // fairly settled
    goAwayChance: 0.18,      // adventurous — wanders off the most
    returnChance: 0.6,
    awayStatuses: [
      'hanging out on the roof',
      'off on an adventure',
      'supervising the neighbours',
      'snoozin’ in the closet',
    ],
    homeSpot: 'sunbeam',
    tapReactions: ['🎵', '♪', '😺'],
    flatSleepPoses: ['curl_sleep', 'loaf_sleep', 'nap'],
    spots: [
      { id: 'sunbeam', label: 'in his sunbeam', position: { x: 74, y: 64 }, scale: 40, anchor: 'feet_center', zOrder: 6, weight: 10,
        poses: ['curl_sleep', 'loaf_sleep', 'nap', 'flop'] },
      { id: 'windowLedge', label: 'on the windowsill', position: { x: 32, y: 36 }, scale: 26, anchor: 'feet_center', zOrder: 6, weight: 2,
        poses: ['regal_sit'] },
      { id: 'couch', label: 'on the couch', position: { x: 60, y: 58 }, scale: 38, anchor: 'feet_center', zOrder: 6, weight: 4, minRoomState: 8,
        poses: ['loaf_sleep', 'nap', 'curl_sleep', 'regal_sit'] },
      { id: 'cornerNap', label: 'curled in the corner', position: { x: 14, y: 74 }, scale: 34, anchor: 'feet_center', zOrder: 6, weight: 2,
        poses: ['curl_back', 'curl_sleep'] },
      { id: 'byTheBox', label: 'by the boxes', position: { x: 48, y: 68 }, scale: 36, anchor: 'feet_center', zOrder: 6, weight: 2,
        poses: ['flop', 'loaf_sleep', 'nap'] },
    ],
  },

  remy: {
    id: 'remy',
    name: 'Remy',
    emoji: '🐈',
    gender: 'female',
    placeholderColor: '#a8794a',
    relocateChance: 0.10,    // relocates the least — blind, sticks to known spots
    goAwayChance: 0.10,      // a homebody; rarely off
    returnChance: 0.7,
    awayStatuses: [
      'grabbing a bite',
      'exploring the rest of the house',
      'napping somewhere warm',
    ],
    homeSpot: 'byLamp',
    tapReactions: ['🐾', '💤', '❤️'],
    flatSleepPoses: ['curl_sleep', 'nap'],
    spots: [
      // Blind → favours a few warm, known-safe spots near the walls/lamp.
      { id: 'byLamp', label: 'by the lamp', position: { x: 18, y: 62 }, scale: 32, anchor: 'feet_center', zOrder: 5, weight: 8,
        poses: ['sit', 'side_awake', 'curl_sleep'] },
      { id: 'rug', label: 'on the rug', position: { x: 44, y: 78 }, scale: 36, anchor: 'feet_center', zOrder: 5, weight: 6, minRoomState: 7,
        poses: ['side_down', 'side_awake', 'curl_sleep', 'nap'], banana: true },
      { id: 'couch', label: 'on the couch', position: { x: 66, y: 58 }, scale: 36, anchor: 'feet_center', zOrder: 5, weight: 5, minRoomState: 8,
        poses: ['curl_sleep', 'nap', 'side_down'], banana: true },
    ],
  },

  // Third pet (future — Hammy, a cockapoo). Data only; no art wired yet. Kept so
  // nothing hardcodes "two pets".
  hammy: {
    id: 'hammy',
    name: 'Hammy',
    emoji: '🐶',
    gender: 'male',
    placeholderColor: '#d8b878',
    relocateChance: 0.45,
    goAwayChance: 0.2,
    returnChance: 0.55,
    awayStatuses: ['out for a walk', 'making friends', 'chasing something'],
    homeSpot: 'shelf',
    tapReactions: ['✨', '🐶', '❤️'],
    flatSleepPoses: ['curl_sleep'],
    spots: [
      { id: 'shelf', label: 'by the shelf', position: { x: 60, y: 22 }, scale: 11, anchor: 'feet_center', zOrder: 7, weight: 3, poses: ['curl_sleep'] },
      { id: 'rugEdge', label: 'at the rug’s edge', position: { x: 38, y: 80 }, scale: 11, anchor: 'feet_center', zOrder: 7, weight: 3, minRoomState: 7, poses: ['curl_sleep'] },
    ],
  },
};

// ── Pets arrive — they aren't bought ─────────────────────────────────────────
const ARRIVAL_MIN = 60 * 1000;

export const PET_ARRIVALS = {
  remy: {
    petId: 'remy',
    itemName: 'Remy’s Homecoming',
    price: 300,
    requiresProject: 'floors',
    teaser: 'The floors are clear now. Someone small has been waiting to map them.',
    lockedHint: 'Someone’s waiting until the floors are safe…',
    arrivalMs: 2 * ARRIVAL_MIN,
    arrivalLine: 'Remy pads in, nose first. She leans into the doorframe, finds her bearings, then picks her spot like she’s always known it.',
  },
  hammy: {
    petId: 'hammy',
    itemName: 'Hammy Moves In',
    price: 400,
    requiresProject: 'couch',
    teaser: 'He’s been coming by after work. He’d like to stay.',
    lockedHint: 'He visits after work. He’s waiting for somewhere to sit…',
    arrivalMs: 2 * ARRIVAL_MIN,
    arrivalLine: 'Hammy moves in with one tiny bag. He’s already rearranging things.',
  },
};

// ── Spot helpers ──────────────────────────────────────────────────────────────

export function getSpot(petId, spotId) {
  return PETS[petId]?.spots.find(s => s.id === spotId) || null;
}

// Spots that exist in the current room state (minRoomState gating)
function eligibleSpots(def, roomStateIndex) {
  const pool = def.spots.filter(s => (s.minRoomState ?? 0) <= roomStateIndex);
  return pool.length ? pool : [def.spots[0]]; // never strand a pet without a spot
}

// Weighted random spot pick, excluding any ids in `exclude` (a Set) when possible.
function pickWeightedSpot(spots, exclude = new Set()) {
  const pool = spots.filter(s => !exclude.has(s.id));
  const choices = pool.length ? pool : spots;
  const total = choices.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const s of choices) { r -= s.weight; if (r <= 0) return s; }
  return choices[choices.length - 1];
}

// Choose a pose for a cat newly placed at a spot. Flat-sleep poses are pooled;
// distinctive poses are pinned by the spot. Remy may roll banana_hug at a cozy
// spot (nudged up by owned bananas).
function choosePose(def, spot, save) {
  if (def.id === 'remy' && spot.banana) {
    const owned = save.pets?.remy?.inventory?.banana ?? 0;
    const chance = Math.min(0.25, 0.09 + owned * 0.03); // small base, gentle nudge
    if (Math.random() < chance) return 'banana_hug';
  }
  const poses = spot.poses?.length ? spot.poses : def.flatSleepPoses;
  return poses[Math.floor(Math.random() * poses.length)];
}

// ── Presence + relocation (pure; merge the result into save) ──────────────────
// Resolve every unlocked pet's home/away + spot + pose, leaving gifts behind,
// enforcing no-overlap (two cats never share a spot except SHARED_SPOT).
// Never call while the room is visible.
//   reason: 'appOpen' (factor time away) | 'return' (per-pet roll) | 'gameOver'
//           (finishing a game guarantees every away cat comes home)
export function relocatePets(save, reason, now = Date.now()) {
  const lastSeen = save.pets.lastSeenAt || now;
  const hoursAway = Math.max(0, (now - lastSeen) / 3_600_000);
  const roomStateIndex = save.roomStateIndex ?? 0;

  const pets = { ...save.pets };
  let gifts = [...save.pendingGifts];
  let boomboxFirstFired = false; // his first-ever gift is a scripted keepsake

  function leaveGift(petId, fromSpot) {
    if (!fromSpot) return;
    if (gifts.length >= ECONOMY.MAX_PENDING_GIFTS) return;
    if (Math.random() >= ECONOMY.GIFT_ON_MOVE_CHANCE) return;

    let gift;
    if (petId === 'boombox' && !save.pets.boombox?.firstGiftGiven && !boomboxFirstFired) {
      gift = boomboxFirstKeepsake();
      boomboxFirstFired = true;
    } else {
      gift = rollPetGift(petId, save); // tiered roll, bond-scaled (see petGifts.js)
    }
    gifts.push({
      id: `gift-${petId}-${now}-${Math.floor(Math.random() * 1e6)}`,
      from: petId,
      position: { x: fromSpot.position.x, y: fromSpot.position.y },
      zOrder: fromSpot.zOrder,
      ...gift,                            // { tier, amount, name, line, keepsakeId?, banana? }
    });
  }

  const takenSpots = new Set(); // for no-overlap (SHARED_SPOT is allowed to repeat)

  for (const petId of Object.keys(PETS)) {
    const def = PETS[petId];
    const cur = save.pets[petId];
    if (!cur?.unlocked) continue;

    const spots = eligibleSpots(def, roomStateIndex);

    const place = (cur2, excludePrev) => {
      // pick a distinct spot (bump off any already taken, unless it's the shared one)
      const exclude = new Set(takenSpots);
      exclude.delete(SHARED_SPOT);
      if (excludePrev && cur2.spotId) exclude.add(cur2.spotId);
      const spot = pickWeightedSpot(spots, exclude);
      if (spot.id !== SHARED_SPOT) takenSpots.add(spot.id);
      return { spotId: spot.id, pose: choosePose(def, spot, save), spot };
    };

    // First placement — home spot (or first eligible), no gift
    if (!cur.spotId && !cur.away) {
      const home = spots.find(s => s.id === def.homeSpot) ?? spots[0];
      if (home.id !== SHARED_SPOT) takenSpots.add(home.id);
      pets[petId] = { ...cur, spotId: home.id, pose: choosePose(def, home, save), away: false, awayStatus: null };
      continue;
    }

    // Finishing a game guarantees an away cat comes home
    if (cur.away && reason === 'gameOver') {
      const p = place(cur, false);
      pets[petId] = { ...cur, away: false, awayStatus: null, spotId: p.spotId, pose: p.pose };
      continue;
    }

    // Away → maybe return
    if (cur.away) {
      const back = reason === 'appOpen'
        ? Math.min(0.95, def.returnChance + hoursAway * 0.1)
        : def.returnChance;
      if (Math.random() < back) {
        const p = place(cur, false);
        pets[petId] = { ...cur, away: false, awayStatus: null, spotId: p.spotId, pose: p.pose };
      }
      continue;
    }

    // Home → maybe wander off entirely
    const away = reason === 'appOpen'
      ? Math.min(0.4, def.goAwayChance + hoursAway * 0.03)
      : def.goAwayChance;
    if (Math.random() < away) {
      const fromSpot = getSpot(petId, cur.spotId);
      pets[petId] = { ...cur, away: true, awayStatus: def.awayStatuses[Math.floor(Math.random() * def.awayStatuses.length)], spotId: null };
      leaveGift(petId, fromSpot);
      continue;
    }

    // Home → maybe relocate spots
    const move = reason === 'appOpen'
      ? Math.min(0.9, def.relocateChance + hoursAway * 0.12)
      : def.relocateChance;
    const curEligible = spots.some(s => s.id === cur.spotId);
    if (!curEligible || Math.random() < move) {
      const fromSpot = getSpot(petId, cur.spotId);
      const p = place(cur, curEligible); // exclude prev spot only if it was valid
      pets[petId] = { ...cur, spotId: p.spotId, pose: p.pose, away: false, awayStatus: null };
      if (curEligible) leaveGift(petId, fromSpot);
    } else {
      // stays put — but reserve its spot for no-overlap, and bump if collided
      if (cur.spotId !== SHARED_SPOT && takenSpots.has(cur.spotId)) {
        const p = place(cur, true);
        pets[petId] = { ...cur, spotId: p.spotId, pose: p.pose };
      } else {
        if (cur.spotId !== SHARED_SPOT) takenSpots.add(cur.spotId);
        if (!cur.pose) pets[petId] = { ...cur, pose: choosePose(def, getSpot(petId, cur.spotId) ?? spots[0], save) };
      }
    }
  }

  if (boomboxFirstFired && pets.boombox) {
    pets.boombox = { ...pets.boombox, firstGiftGiven: true };
  }

  pets.lastSeenAt = now;
  return { pets, pendingGifts: gifts };
}

// Are both cats home and resolved to the shared cozy spot? → render the snuggle.
export function bothSnuggling(save) {
  const b = save.pets?.boombox, r = save.pets?.remy;
  return !!(b?.unlocked && r?.unlocked && !b.away && !r.away &&
    b.spotId === SHARED_SPOT && r.spotId === SHARED_SPOT);
}

// A pet's current location text for the overview roster.
export function petLocation(save, petId) {
  const st = save.pets?.[petId];
  if (!st?.unlocked) return null;
  if (st.away) return st.awayStatus || 'out and about';
  const spot = getSpot(petId, st.spotId);
  return spot ? `in the living room, ${spot.label}` : 'in the living room';
}

// ── Calibration override ──────────────────────────────────────────────────────
// The ?calibrate dev tool writes spot tweaks here so they take effect in normal
// play too (until the dev promotes the exported config into this file).
//   { petId: { spotId: { position?, scale?, anchor?, zOrder? } } }
export const CALIB_KEY = 'ashys-pet-calib';
try {
  const ov = JSON.parse(localStorage.getItem(CALIB_KEY) || 'null');
  if (ov) {
    for (const petId of Object.keys(ov)) {
      for (const spotId of Object.keys(ov[petId])) {
        const s = PETS[petId]?.spots.find(sp => sp.id === spotId);
        if (s) Object.assign(s, ov[petId][spotId]);
      }
    }
  }
} catch { /* no override / unavailable */ }
