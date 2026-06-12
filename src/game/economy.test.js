import { describe, it, expect } from 'vitest';
import { computePayout, isMeaningfulAbandon, ECONOMY } from './economy.js';

describe('computePayout result types', () => {
  it('win pays base, scaled by tier', () => {
    const p = computePayout({ result: 'win', winStreak: 1, tierMultiplier: 1.6 });
    expect(p.base).toBe(Math.round(ECONOMY.WIN * 1.6));
    expect(p.tierBonus).toBe(p.base - ECONOMY.WIN);
    expect(p.total).toBe(p.base);
  });

  it('a completed loss pays the consolation, flat regardless of tier', () => {
    const p = computePayout({ result: 'loss', tierMultiplier: 1.6 });
    expect(p.total).toBe(ECONOMY.LOSS_COMPLETED);
    expect(p.tierBonus).toBe(0);
  });

  it('abandonment pays 10 with progress, 0 early', () => {
    expect(computePayout({ result: 'abandoned-progress' }).total).toBe(ECONOMY.ABANDONED_PROGRESS);
    expect(computePayout({ result: 'abandoned-early' }).total).toBe(0);
  });

  it('first win of the day adds the big bonus and stacks with streak', () => {
    const p = computePayout({ result: 'win', isFirstWinOfDay: true, winStreak: 3 });
    expect(p.firstWinBonus).toBe(ECONOMY.FIRST_WIN_OF_DAY_BONUS);
    expect(p.streakBonus).toBe(2 * ECONOMY.STREAK_BONUS_PER_WIN);
    expect(p.total).toBe(ECONOMY.WIN + ECONOMY.FIRST_WIN_OF_DAY_BONUS + 2 * ECONOMY.STREAK_BONUS_PER_WIN);
  });

  it('streak bonus is capped', () => {
    const p = computePayout({ result: 'win', winStreak: 20 });
    expect(p.streakBonus).toBe(ECONOMY.STREAK_BONUS_CAP);
  });
});

describe('isMeaningfulAbandon', () => {
  const base = { turnCount: 0, borneOff: { ashton: 0, charlie: 0 } };
  it('10+ turns counts', () => {
    expect(isMeaningfulAbandon({ ...base, turnCount: 10 })).toBe(true);
    expect(isMeaningfulAbandon({ ...base, turnCount: 9 })).toBe(false);
  });
  it('any piece borne off counts', () => {
    expect(isMeaningfulAbandon({ ...base, borneOff: { ashton: 1, charlie: 0 } })).toBe(true);
    expect(isMeaningfulAbandon({ ...base, borneOff: { ashton: 0, charlie: 1 } })).toBe(true);
  });
});
