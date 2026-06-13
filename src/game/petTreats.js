// Treats & toys — optional one-off shop delights. Each gives a bond bump (an
// ACCELERATOR only; bond climbs fine on petting + visits alone) and goes into
// that cat's inventory. A favourite owned toy can nudge a matching special pose
// (owned bananas → more banana_hug). Keep effects small and sweet.
//
// stackable: bananas can be bought again and again (count nudges banana_hug);
// other toys are owned once.

import { addBond } from './petBond.js';
import { giveRemyBanana } from './petGifts.js';

export const TREATS = [
  { id: 'remy-banana', petId: 'remy', emoji: '🍌', name: 'A Banana', stackable: true,
    description: 'Her one true love. Owning more nudges her banana cuddles.', price: 40, bondBump: 6, toy: 'banana', banana: true },
  { id: 'remy-blanket', petId: 'remy', emoji: '🧣', name: 'A Soft Blanket',
    description: 'Warm, safe, and unmistakably hers.', price: 60, bondBump: 8, toy: 'blanket' },
  { id: 'boombox-wand', petId: 'boombox', emoji: '🪶', name: 'A Feather Wand',
    description: 'He’ll pretend not to care. He cares.', price: 40, bondBump: 6, toy: 'wand' },
  { id: 'boombox-castle', petId: 'boombox', emoji: '🏰', name: 'A Cardboard Castle',
    description: 'A throne befitting him.', price: 70, bondBump: 8, toy: 'castle' },
];

export const TREAT_BY_ID = Object.fromEntries(TREATS.map(t => [t.id, t]));

export function treatsForPet(petId) {
  return TREATS.filter(t => t.petId === petId);
}

// Has this (non-stackable) toy already been bought?
export function ownsTreat(save, treat) {
  if (treat.stackable) return false; // always re-buyable
  return ((save.pets[treat.petId]?.inventory ?? {})[treat.toy] ?? 0) > 0;
}

// Buy a treat (caller checks affordability). Applies pennies−, bond+ (with
// milestones), inventory+, and the banana hooks. Returns { save, milestones, banana }.
export function buyTreat(save, treat) {
  const inv = { ...(save.pets[treat.petId].inventory ?? {}) };
  inv[treat.toy] = (inv[treat.toy] ?? 0) + 1;

  let next = {
    ...save,
    pennies: save.pennies - treat.price,
    pets: { ...save.pets, [treat.petId]: { ...save.pets[treat.petId], inventory: inv } },
  };

  const bonded = addBond(next, treat.petId, treat.bondBump);
  next = bonded.save;

  let banana = null;
  if (treat.banana) {
    const r = giveRemyBanana(next, 'treat');
    next = r.save;
    banana = r;
  }
  return { save: next, milestones: bonded.milestones, banana };
}
