import { describe, it, expect } from 'vitest';
import { getDefaultState, exportSave, importSave } from './saveState.js';

describe('backup export/import', () => {
  it('round-trips the current save exactly', () => {
    const save = {
      ...getDefaultState(),
      pennies: 1240,
      roomStateIndex: 8,
      stats: { ...getDefaultState().stats, gamesPlayed: 30, gamesWon: 14 },
      achievements: { unlocked: { first_win: 1750000000000 }, progress: {} },
    };
    const code = exportSave(save);
    expect(code.startsWith('ASHY1-')).toBe(true);

    const res = importSave(code);
    expect(res.ok).toBe(true);
    expect(res.state.pennies).toBe(1240);
    expect(res.state.roomStateIndex).toBe(8);
    expect(res.state.stats.gamesWon).toBe(14);
    expect(res.state.achievements.unlocked.first_win).toBe(1750000000000);
  });

  it('migrates a legacy v2 backup (array achievements → dated map)', () => {
    // A backup taken from an old version, hand-rolled in the v2 shape
    const legacy = exportSave({
      pennies: 300,
      version: 2,
      stats: { gamesPlayed: 5, gamesWon: 2 },
      achievements: { unlocked: ['first_win', 'gammon'], progress: {} },
    });
    const res = importSave(legacy);
    expect(res.ok).toBe(true);
    // achievements became a { id: timestamp } map
    expect(Array.isArray(res.state.achievements.unlocked)).toBe(false);
    expect(typeof res.state.achievements.unlocked.first_win).toBe('number');
    expect(typeof res.state.achievements.unlocked.gammon).toBe('number');
    // stamped to the current schema version, with new fields defaulted in
    expect(res.state.version).toBe(getDefaultState().version);
    expect(res.state.opponents.tier).toBe('sleepy');
  });

  it('rejects empty, foreign, and tampered input without throwing', () => {
    expect(importSave('').ok).toBe(false);
    expect(importSave('   ').ok).toBe(false);
    expect(importSave('hello from another app').ok).toBe(false);
    expect(importSave('ASHY1-not-valid-base64!!').ok).toBe(false);
    // valid base64 of valid JSON but not one of our saves
    const foreign = 'ASHY1-' + btoa(JSON.stringify({ hi: 'there' }));
    expect(importSave(foreign).ok).toBe(false);
  });

  it('always returns an error message on failure', () => {
    for (const bad of ['', 'xyz', 'ASHY1-@@@']) {
      const res = importSave(bad);
      expect(res.ok).toBe(false);
      expect(typeof res.error).toBe('string');
      expect(res.error.length).toBeGreaterThan(0);
    }
  });
});
