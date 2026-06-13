// Tiered pet gifts. A relocating cat may leave a present at its old spot; the
// present art is shown until Ashton taps it, which opens it into the actual
// reward. Tiers (rarest last): pennies → found object → bonus → keepsake.
// Higher BOND shifts the roll toward better tiers and more Pennies — the bond
// system pays out entirely through these rolls (no separate dividend).
//
// Each rolled gift: { tier, amount, name?, line?, keepsakeId?, banana? }.
// Pools and copy are data — add to them freely.

import { ECONOMY } from './economy.js';

// Found objects: a small Penny payout + a name and a line, in each cat's voice.
const FOUND = {
  boombox: [ // escape souvenirs
    { name: 'an autumn leaf', line: 'Brought back from his travels.' },
    { name: 'a neighbour’s gardening glove', line: 'He insists it was abandoned.' },
    { name: 'a small, unharmed beetle', line: 'A gift. For you. Specifically.' },
    { name: 'a back-lane bottlecap', line: 'Treasure, obviously.' },
    { name: 'a chewed dandelion', line: 'Presented with great ceremony.' },
  ],
  remy: [ // found by touch
    { name: 'a hair tie', line: 'Located by patient investigation.' },
    { name: 'a bottle cap', line: 'It rolled. She followed.' },
    { name: 'a claimed sock', line: 'Hers now. Finders keepers.' },
    { name: 'a crinkly receipt', line: 'It sounded important.' },
    { name: 'a single saved kibble', line: 'She was thinking of you. Mostly.' },
  ],
  hammy: [
    { name: 'a chewed tennis ball', line: 'Slightly soggy. Much loved.' },
    { name: 'a stick', line: 'The stick. THE stick.' },
  ],
};

// Keepsakes: no payout, kept forever in a collection. Rare.
const KEEPSAKE = {
  boombox: [
    { keepsakeId: 'clover', name: 'a pressed four-leaf clover', line: 'Found on one of his expeditions.' },
    { keepsakeId: 'river-stone', name: 'a smooth river stone', line: 'Carried home with great purpose.' },
  ],
  // Remy's keepsakes — note the banana routes to her Banana collection, not the
  // general keepsake shelf (see `banana: true`).
  remy: [
    { keepsakeId: 'banana', banana: true, name: 'her well-loved yellow banana', line: 'Her most prized thing. She wanted to share it.' },
    { keepsakeId: 'dried-flower', name: 'a single dried flower', line: 'She kept it safe for you.' },
    { keepsakeId: 'warm-pebble', name: 'a smooth pebble', line: 'Warm from being held.' },
  ],
  hammy: [
    { keepsakeId: 'first-collar', name: 'his very first collar tag', line: 'He grew. He kept it.' },
  ],
};

// Boombox's scripted FIRST-EVER gift — fires exactly once (gated by
// pets.boombox.firstGiftGiven in relocatePets).
export function boomboxFirstKeepsake() {
  return {
    tier: 'keepsake',
    amount: 0,
    keepsakeId: 'brass-key',
    name: 'a tiny brass key',
    line: 'He left this by your spot on moving day. He was here first. He wanted you to know it’s your home too.',
  };
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

// Roll a gift for `petId`, scaled by that cat's bond.
export function rollPetGift(petId, save) {
  const bond = save.pets?.[petId]?.bond ?? 0;
  const f = Math.min(1, bond / 60); // ~60 bond ≈ best gift quality

  const pKeepsake = 0.03 + 0.05 * f;
  const pBonus    = 0.07 + 0.06 * f;
  const pFound    = 0.28 + 0.04 * f;
  const r = Math.random();

  if (r < pKeepsake) {
    const pool = KEEPSAKE[petId] ?? KEEPSAKE.boombox;
    return { tier: 'keepsake', amount: 0, ...pick(pool) };
  }
  if (r < pKeepsake + pBonus) {
    return { tier: 'bonus', amount: rint(25, 50 + Math.round(20 * f)), name: 'a lucky find', line: 'Some days the dice are kind.' };
  }
  if (r < pKeepsake + pBonus + pFound) {
    const obj = pick(FOUND[petId] ?? FOUND.boombox);
    return { tier: 'found', amount: rint(ECONOMY.GIFT_MIN, ECONOMY.GIFT_MAX), ...obj };
  }
  // plain Pennies — amount grows a little with bond
  return { tier: 'pennies', amount: rint(ECONOMY.GIFT_MIN, ECONOMY.GIFT_MAX + Math.round(15 * f)) };
}

function today() { return new Date().toISOString().slice(0, 10); }

// ── Remy's Banana collection (single source of truth) ─────────────────────────
// Both a banana TREAT and a banana GIFT funnel through here, so a banana is
// counted exactly once. The very first banana ever is a scripted moment.
export const BANANA_MILESTONES = [
  { id: 'bh1', at: 3,  name: 'A Respectable Bunch' },
  { id: 'bh2', at: 8,  name: 'Banana Hoarder' },
  { id: 'bh3', at: 15, name: 'Certified Banana Goblin' },
];

export function giveRemyBanana(save, source = 'gift') {
  const remy = save.pets.remy;
  const coll = remy.bananaCollection ?? { count: 0, entries: [] };
  const firstEver = !remy.remyFirstBananaSeen;
  const count = coll.count + 1;
  const milestone = BANANA_MILESTONES.find(m => m.at === count) ?? null;
  const next = {
    ...save,
    pets: {
      ...save.pets,
      remy: {
        ...remy,
        remyFirstBananaSeen: true,
        bananaCollection: { count, entries: [...coll.entries, { n: count, source, date: today() }] },
      },
    },
  };
  return { save: next, firstEver, count, milestone };
}

// Open a pending present → apply its reward, log it, and shelve any keepsake.
// Returns { save, banana? } (banana = giveRemyBanana result when it was a banana).
export function openGift(save, gift) {
  const amount = gift.amount ?? 0;
  let next = {
    ...save,
    pennies: save.pennies + amount,
    stats: { ...save.stats, totalPenniesEarned: save.stats.totalPenniesEarned + amount },
    pendingGifts: save.pendingGifts.filter(g => g.id !== gift.id),
    giftHistory: [
      ...(save.giftHistory ?? []),
      { from: gift.from, tier: gift.tier ?? 'pennies', name: gift.name ?? null, amount, date: today(), keepsakeId: gift.keepsakeId ?? null },
    ],
  };

  let banana = null;
  if (gift.tier === 'keepsake' && gift.banana) {
    const res = giveRemyBanana(next, 'gift');
    next = res.save;
    banana = res;
  } else if (gift.tier === 'keepsake' && gift.keepsakeId) {
    const have = (next.keepsakes ?? []).some(k => k.id === gift.keepsakeId);
    if (!have) {
      next = { ...next, keepsakes: [...(next.keepsakes ?? []), { id: gift.keepsakeId, petId: gift.from, name: gift.name, line: gift.line, date: today() }] };
    }
  }
  return { save: next, banana };
}
