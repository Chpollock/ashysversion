// All Penny economy values live here so they're easy to tune in one place.
// Tone: always rewarding, never punishing. A loss still pays something.

export const ECONOMY = {
  WIN: 50,                    // base reward for beating Charlie
  LOSS: 10,                   // consolation — always something
  FIRST_WIN_OF_DAY_BONUS: 50, // celebrated extra on the day's first win
  STREAK_BONUS_PER_WIN: 5,    // +5 per consecutive win...
  STREAK_BONUS_CAP: 25,       // ...capped so it stays gentle

  GIFT_MIN: 5,
  GIFT_MAX: 20,
  GIFT_CHANCE: 0.2,                  // (legacy) chance per room visit a pet left a gift
  GIFT_COOLDOWN_MS: 3 * 60 * 60 * 1000, // at most one gift per 3 hours
  GIFT_ON_MOVE_CHANCE: 0.25,        // chance a relocating pet leaves a gift at its old spot
  MAX_PENDING_GIFTS: 3,             // cap so gifts never pile up
};

// Compute the Penny payout for a finished game.
// winStreak = the streak AFTER this game (i.e. including this win).
export function computePayout({ won, isFirstWinOfDay, winStreak }) {
  if (!won) {
    return { base: ECONOMY.LOSS, firstWinBonus: 0, streakBonus: 0, total: ECONOMY.LOSS };
  }
  const base = ECONOMY.WIN;
  const firstWinBonus = isFirstWinOfDay ? ECONOMY.FIRST_WIN_OF_DAY_BONUS : 0;
  // Streak bonus kicks in from the 2nd consecutive win onward
  const consecutive = Math.max(0, (winStreak || 1) - 1);
  const streakBonus = Math.min(consecutive * ECONOMY.STREAK_BONUS_PER_WIN, ECONOMY.STREAK_BONUS_CAP);
  return { base, firstWinBonus, streakBonus, total: base + firstWinBonus + streakBonus };
}

// Random gift amount, inclusive.
export function randomGiftAmount() {
  const { GIFT_MIN, GIFT_MAX } = ECONOMY;
  return Math.floor(Math.random() * (GIFT_MAX - GIFT_MIN + 1)) + GIFT_MIN;
}
