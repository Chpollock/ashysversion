// Bond — a gentle, no-stress affection system. Bond only ever RISES; it never
// decays and absence is never punished. The emotional message is "just coming
// by and petting does wonders." Bond pays out entirely through better gift
// rolls (see petGifts.js) — there is no separate dividend.
//
// Sources: petting (small, on the real tap cooldown), the first daily visit
// (warm bump + a few Pennies; a sweeter "missed you" after a gap), and treats
// (accelerators only). Crossing a milestone gives a one-time reward + a line.

// Editable milestone config. Names fit each cat (Boombox smug/regal, Remy warm).
export const BOND_MILESTONES = {
  boombox: [
    { id: 'b1', at: 5,   name: 'Tolerates You',           reward: 15, line: 'He has decided you may stay.' },
    { id: 'b2', at: 20,  name: 'Allows Petting',          reward: 20, line: 'Briefly. On his terms.' },
    { id: 'b3', at: 50,  name: 'Lap Cat (Conditional)',   reward: 30, line: 'Conditions subject to change without notice.' },
    { id: 'b4', at: 100, name: 'Velcro Cat',              reward: 40, line: 'Where you go, he supervises.' },
    { id: 'b5', at: 180, name: 'Heart Eyes (He’d Deny It)', reward: 60, line: 'Caught purring. He looked away.' },
  ],
  remy: [
    { id: 'r1', at: 5,   name: 'Warming Up', reward: 15, line: 'She knows your footsteps now.' },
    { id: 'r2', at: 20,  name: 'Leans In',   reward: 20, line: 'A whole side, pressed to your hand.' },
    { id: 'r3', at: 50,  name: 'Lap Cat',    reward: 30, line: 'She found you in the dark and stayed.' },
    { id: 'r4', at: 100, name: 'Velcro Cat', reward: 40, line: 'Wherever you are is the safe spot.' },
    { id: 'r5', at: 180, name: 'Heart Eyes', reward: 60, line: 'All the way home, all the way hers.' },
  ],
  hammy: [
    { id: 'h1', at: 5,  name: 'New Best Friend', reward: 15, line: 'Of course you are.' },
    { id: 'h2', at: 40, name: 'Inseparable',     reward: 30, line: 'He waits by the door now.' },
  ],
};

// The highest milestone reached so far (null before the first).
export function currentMilestone(petId, bond) {
  let cur = null;
  for (const m of (BOND_MILESTONES[petId] ?? [])) if ((bond ?? 0) >= m.at) cur = m;
  return cur;
}

export function nextMilestone(petId, bond) {
  for (const m of (BOND_MILESTONES[petId] ?? [])) if ((bond ?? 0) < m.at) return m;
  return null;
}

// Add bond and grant any newly-reached milestone rewards exactly once.
// Returns { save, milestones } — milestones reached this call (for celebration).
export function addBond(save, petId, amount) {
  const cur = save.pets[petId];
  if (!cur) return { save, milestones: [] };
  const after = (cur.bond ?? 0) + amount;
  const granted = new Set(cur.milestonesGranted ?? []);
  const reached = [];
  let pennies = 0;
  for (const m of (BOND_MILESTONES[petId] ?? [])) {
    if (after >= m.at && !granted.has(m.id)) { granted.add(m.id); reached.push(m); pennies += m.reward; }
  }
  const next = {
    ...save,
    pennies: save.pennies + pennies,
    stats: { ...save.stats, totalPenniesEarned: save.stats.totalPenniesEarned + pennies },
    pets: { ...save.pets, [petId]: { ...cur, bond: after, milestonesGranted: [...granted] } },
  };
  return { save: next, milestones: reached };
}

function dayNumber(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// First time seeing a cat today → a warm bump + a few Pennies (a sweeter
// "missed you" after a 2+ day gap). Returns null if already greeted today.
// `today` = local 'YYYY-MM-DD'.
export function dailyVisit(save, petId, today) {
  const cur = save.pets[petId];
  if (!cur?.unlocked || cur.away || cur.lastVisitDate === today) return null;

  const gap = cur.lastVisitDate ? dayNumber(today) - dayNumber(cur.lastVisitDate) : 0;
  const missed = gap >= 2;
  const bump = missed ? 4 : 2;
  const pennies = missed ? 8 : 4;

  let next = {
    ...save,
    pennies: save.pennies + pennies,
    stats: { ...save.stats, totalPenniesEarned: save.stats.totalPenniesEarned + pennies },
    pets: { ...save.pets, [petId]: { ...cur, lastVisitDate: today } },
  };
  const res = addBond(next, petId, bump);
  return { save: res.save, petId, missed, pennies, milestones: res.milestones };
}
