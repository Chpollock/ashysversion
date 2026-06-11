// Spot-based pet system (Neko Atsume style). Pets do not walk — they relocate
// between fixed spots when unobserved. Everything is data-driven: add a spot or a
// whole pet here and the RoomScreen renders it with no component changes.
//
// Per pet:
//   id, name, emoji, placeholderColor — identity + placeholder look
//   relocateChance — base probability of relocating on a "return to room" visit
//   awayChance     — chance, when relocating, to leave the room entirely
//   homeSpot       — spot id used on first placement
//   tapReactions   — small reactions shown when tapped
//   spots[]        — { id, position:{x,y}%, zOrder, pose (image URL or null), weight }
//
// pose is null for now → RoomScreen draws a clearly-marked placeholder. To use real
// art, import the image and set `pose: thatImage` on the spot. Different spots can
// have different poses (sleeping, sitting, etc.).

import { ECONOMY, randomGiftAmount } from './economy.js';

export const PETS = {
  boombox: {
    id: 'boombox',
    name: 'Boombox',
    emoji: '🐈',
    placeholderColor: '#caa46a',
    relocateChance: 0.22,   // fairly settled
    awayChance: 0.03,       // rarely leaves
    homeSpot: 'sunbeam',
    tapReactions: ['🎵', '♪', '😺'],
    spots: [
      // Heavily favors his sunbeam
      { id: 'sunbeam',    position: { x: 78, y: 58 }, zOrder: 6, pose: null, weight: 10 },
      { id: 'windowLedge',position: { x: 34, y: 30 }, zOrder: 6, pose: null, weight: 2 },
      { id: 'byTheBox',   position: { x: 52, y: 64 }, zOrder: 6, pose: null, weight: 2 },
      { id: 'cornerNap',  position: { x: 12, y: 70 }, zOrder: 6, pose: null, weight: 1 },
    ],
  },

  remy: {
    id: 'remy',
    name: 'Remy',
    emoji: '🐕',
    placeholderColor: '#a8794a',
    relocateChance: 0.12,   // relocates least — a calm, steady presence
    awayChance: 0.02,
    homeSpot: 'rug',
    tapReactions: ['🐾', '💤', '❤️'],
    spots: [
      { id: 'rug',      position: { x: 46, y: 76 }, zOrder: 5, pose: null, weight: 8 },
      { id: 'byLamp',   position: { x: 14, y: 58 }, zOrder: 5, pose: null, weight: 4 },
      { id: 'armchair', position: { x: 66, y: 62 }, zOrder: 5, pose: null, weight: 3 },
    ],
  },

  hammy: {
    id: 'hammy',
    name: 'Hammy',
    emoji: '🐹',
    placeholderColor: '#d8b878',
    relocateChance: 0.45,   // busiest — moves the most
    awayChance: 0.06,
    homeSpot: 'shelf',
    tapReactions: ['✨', '🐹', '❤️'],
    spots: [
      { id: 'shelf',     position: { x: 60, y: 22 }, zOrder: 7, pose: null, weight: 3 },
      { id: 'rugEdge',   position: { x: 38, y: 80 }, zOrder: 7, pose: null, weight: 3 },
      { id: 'windowsill',position: { x: 30, y: 26 }, zOrder: 7, pose: null, weight: 2 },
      { id: 'underBox',  position: { x: 50, y: 72 }, zOrder: 7, pose: null, weight: 2 },
      { id: 'lampBase',  position: { x: 12, y: 64 }, zOrder: 7, pose: null, weight: 2 },
      { id: 'farCorner', position: { x: 88, y: 70 }, zOrder: 7, pose: null, weight: 2 },
    ],
  },
};

// Lookup a pet's spot definition
export function getSpot(petId, spotId) {
  return PETS[petId]?.spots.find(s => s.id === spotId) || null;
}

// Weighted random spot pick. excludeId avoids picking the spot the pet is already on
// (so a relocation is visibly a move), unless that's the only option.
function pickWeightedSpot(spots, excludeId) {
  const pool = spots.filter(s => s.id !== excludeId);
  const choices = pool.length ? pool : spots;
  const total = choices.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const s of choices) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return choices[choices.length - 1];
}

// Pure relocation pass. Returns { pets, pendingGifts } to merge into save.
// Never call this while the room is visible — only on entering the room.
//   reason: 'appOpen' (factor time away) | 'return' (flat per-pet chance)
export function relocatePets(save, reason, now = Date.now()) {
  const lastSeen = save.pets.lastSeenAt || now;
  const hoursAway = Math.max(0, (now - lastSeen) / 3_600_000);

  const pets = { ...save.pets };
  let gifts = [...save.pendingGifts];

  function maybeLeaveGift(petId, fromSpot) {
    if (!fromSpot) return;
    if (gifts.length >= ECONOMY.MAX_PENDING_GIFTS) return;
    if (Math.random() >= ECONOMY.GIFT_ON_MOVE_CHANCE) return;
    gifts.push({
      id: `gift-${petId}-${now}-${Math.floor(Math.random() * 1e6)}`,
      from: petId,
      amount: randomGiftAmount(),
      position: { x: fromSpot.position.x, y: fromSpot.position.y },
      zOrder: fromSpot.zOrder,
    });
  }

  for (const petId of Object.keys(PETS)) {
    const def = PETS[petId];
    const cur = save.pets[petId];
    if (!cur?.unlocked) continue;

    // First placement — drop into the home spot, no relocation/gift
    if (!cur.spotId) {
      pets[petId] = { ...cur, spotId: def.homeSpot, away: false };
      continue;
    }

    // Probability of moving this visit
    const chance = reason === 'appOpen'
      ? Math.min(0.9, def.relocateChance + hoursAway * 0.12) // longer away → more likely moved
      : def.relocateChance;

    // Away pets roll to come back
    if (cur.away) {
      if (Math.random() < chance) {
        const back = pickWeightedSpot(def.spots, null);
        pets[petId] = { ...cur, spotId: back.id, away: false };
      }
      continue;
    }

    if (Math.random() >= chance) continue; // stays put

    const fromSpot = getSpot(petId, cur.spotId);

    // Sometimes wander off entirely
    if (Math.random() < def.awayChance) {
      pets[petId] = { ...cur, away: true };
      maybeLeaveGift(petId, fromSpot);
      continue;
    }

    // Relocate to a new weighted spot, maybe leaving a gift behind
    const next = pickWeightedSpot(def.spots, cur.spotId);
    pets[petId] = { ...cur, spotId: next.id, away: false };
    maybeLeaveGift(petId, fromSpot);
  }

  pets.lastSeenAt = now;
  return { pets, pendingGifts: gifts };
}
