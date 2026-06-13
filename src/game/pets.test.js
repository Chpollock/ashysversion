import { describe, it, expect } from 'vitest';
import { getDefaultState } from '../state/saveState.js';
import { relocatePets, bothSnuggling, SHARED_SPOT, petLocation } from './petSpots.js';
import { rollPetGift, boomboxFirstKeepsake, openGift } from './petGifts.js';
import { addBond, dailyVisit, currentMilestone, BOND_MILESTONES } from './petBond.js';
import { buyTreat, TREAT_BY_ID, ownsTreat } from './petTreats.js';

// A save with both cats home, well past the early room states.
function homeSave() {
  const s = getDefaultState();
  s.roomStateIndex = 12;
  s.pets.boombox = { ...s.pets.boombox, unlocked: true, spotId: 'sunbeam', pose: 'curl_sleep', away: false };
  s.pets.remy = { ...s.pets.remy, unlocked: true, spotId: 'byLamp', pose: 'sit', away: false };
  s.pennies = 1000;
  return s;
}

describe('presence + relocation', () => {
  it('never puts two cats on the same non-shared spot (over many runs)', () => {
    for (let i = 0; i < 300; i++) {
      const { pets } = relocatePets(homeSave(), 'return');
      const b = pets.boombox, r = pets.remy;
      if (!b.away && !r.away && b.spotId && r.spotId && b.spotId === r.spotId) {
        expect(b.spotId).toBe(SHARED_SPOT); // the only spot they may share
      }
    }
  });

  it('a finished game (gameOver) brings an away cat home', () => {
    const s = homeSave();
    s.pets.boombox = { ...s.pets.boombox, away: true, awayStatus: 'on the roof', spotId: null };
    const { pets } = relocatePets(s, 'gameOver');
    expect(pets.boombox.away).toBe(false);
    expect(pets.boombox.spotId).toBeTruthy();
    expect(pets.boombox.pose).toBeTruthy();
  });

  it('placed cats always get a pose, and bothSnuggling reflects the shared spot', () => {
    const { pets } = relocatePets(homeSave(), 'return');
    if (!pets.boombox.away) expect(pets.boombox.pose).toBeTruthy();
    const snug = { ...homeSave() };
    snug.pets.boombox.spotId = SHARED_SPOT;
    snug.pets.remy.spotId = SHARED_SPOT;
    expect(bothSnuggling(snug)).toBe(true);
  });

  it('petLocation reads home spot label and away status', () => {
    const s = homeSave();
    expect(petLocation(s, 'remy')).toContain('living room');
    s.pets.remy = { ...s.pets.remy, away: true, awayStatus: 'grabbing a bite' };
    expect(petLocation(s, 'remy')).toBe('grabbing a bite');
  });
});

describe('gifts', () => {
  it('rollPetGift always returns a known tier with a non-negative amount', () => {
    const s = homeSave();
    for (let i = 0; i < 200; i++) {
      const g = rollPetGift('boombox', s);
      expect(['pennies', 'found', 'bonus', 'keepsake']).toContain(g.tier);
      expect(g.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('higher bond yields more keepsakes than zero bond (statistically)', () => {
    const lo = homeSave(); lo.pets.remy.bond = 0;
    const hi = homeSave(); hi.pets.remy.bond = 60;
    let loK = 0, hiK = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollPetGift('remy', lo).tier === 'keepsake') loK++;
      if (rollPetGift('remy', hi).tier === 'keepsake') hiK++;
    }
    expect(hiK).toBeGreaterThan(loK);
  });

  it('opening a Pennies gift pays out and logs to history', () => {
    const s = homeSave();
    const gift = { id: 'g1', from: 'boombox', tier: 'pennies', amount: 12, position: { x: 1, y: 1 } };
    s.pendingGifts = [gift];
    const { save } = openGift(s, gift);
    expect(save.pennies).toBe(1012);
    expect(save.pendingGifts).toHaveLength(0);
    expect(save.giftHistory.at(-1)).toMatchObject({ from: 'boombox', amount: 12 });
  });

  it('a non-banana keepsake shelves into keepsakes; the brass key is the scripted first', () => {
    const s = homeSave();
    const k = boomboxFirstKeepsake();
    expect(k).toMatchObject({ tier: 'keepsake', amount: 0, keepsakeId: 'brass-key' });
    const gift = { id: 'g2', from: 'boombox', ...k };
    s.pendingGifts = [gift];
    const { save } = openGift(s, gift);
    expect(save.keepsakes.map(x => x.id)).toContain('brass-key');
    expect(save.pets.remy.bananaCollection.count).toBe(0); // not a banana
  });

  it('a banana keepsake feeds the Banana collection (not the keepsake shelf)', () => {
    const s = homeSave();
    const gift = { id: 'g3', from: 'remy', tier: 'keepsake', amount: 0, keepsakeId: 'banana', banana: true, name: 'banana', line: 'hers' };
    s.pendingGifts = [gift];
    const { save, banana } = openGift(s, gift);
    expect(banana.firstEver).toBe(true);
    expect(save.pets.remy.bananaCollection.count).toBe(1);
    expect(save.pets.remy.remyFirstBananaSeen).toBe(true);
    expect(save.keepsakes.find(k => k.id === 'banana')).toBeUndefined(); // routed to bananas
  });
});

describe('bond + visits', () => {
  it('bond only rises and grants each milestone once', () => {
    let s = homeSave();
    s.pets.boombox.bond = 0;
    const before = s.pennies;
    const r1 = addBond(s, 'boombox', 5); // crosses the first milestone
    expect(r1.milestones).toHaveLength(1);
    expect(r1.save.pets.boombox.bond).toBe(5);
    expect(r1.save.pennies).toBe(before + BOND_MILESTONES.boombox[0].reward);
    const r2 = addBond(r1.save, 'boombox', 1); // no new milestone
    expect(r2.milestones).toHaveLength(0);
    expect(currentMilestone('boombox', r2.save.pets.boombox.bond).id).toBe('b1');
  });

  it('daily visit fires once per day and a 2+ day gap reads as "missed you"', () => {
    const s = homeSave();
    s.pets.remy.lastVisitDate = '2026-06-01';
    const r = dailyVisit(s, 'remy', '2026-06-10');
    expect(r.missed).toBe(true);
    expect(r.save.pets.remy.lastVisitDate).toBe('2026-06-10');
    expect(dailyVisit(r.save, 'remy', '2026-06-10')).toBe(null); // already greeted today
  });
});

describe('treats', () => {
  it('buying a banana adds inventory, bond, and a banana to the collection', () => {
    const s = homeSave();
    s.pets.remy.bond = 10; // past the first milestone (already granted) so the bump crosses none
    s.pets.remy.milestonesGranted = ['r1'];
    const banana = TREAT_BY_ID['remy-banana'];
    const { save, banana: info } = buyTreat(s, banana);
    expect(save.pennies).toBe(1000 - banana.price); // no milestone reward this time
    expect(save.pets.remy.inventory.banana).toBe(1);
    expect(save.pets.remy.bond).toBe(10 + banana.bondBump);
    expect(info.count).toBe(1);
    expect(save.pets.remy.bananaCollection.count).toBe(1);
  });

  it('non-stackable toys are owned once; bananas restack', () => {
    let s = homeSave();
    const blanket = TREAT_BY_ID['remy-blanket'];
    s = buyTreat(s, blanket).save;
    expect(ownsTreat(s, blanket)).toBe(true);
    expect(ownsTreat(s, TREAT_BY_ID['remy-banana'])).toBe(false); // stackable, always buyable
  });
});
