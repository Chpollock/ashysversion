// All Penny economy values live here so they're easy to tune in one place.
// Tone: always rewarding, never punishing. Finishing a losing game is
// respectable — it pays half a win. Walking away early pays nothing.

export const ECONOMY = {
  WIN: 50,                     // base reward for beating Charlie
  LOSS_COMPLETED: 25,          // a finished loss — respectable
  ABANDONED_PROGRESS: 10,      // left mid-game after meaningful progress
  ABANDONED_EARLY: 0,          // left before anything really happened

  // "Meaningful progress" thresholds for abandonment
  ABANDON_MIN_TURNS: 10,       // 10+ turns elapsed, OR…
  // …any piece borne off (checked directly against the board)

  FIRST_WIN_OF_DAY_BONUS: 100, // celebrated extra on the day's first win
  STREAK_BONUS_PER_WIN: 5,     // +5 per consecutive win…
  STREAK_BONUS_CAP: 25,        // …capped so it stays gentle

  GIFT_MIN: 5,
  GIFT_MAX: 20,
  GIFT_COOLDOWN_MS: 3 * 60 * 60 * 1000, // at most one gift per 3 hours
  GIFT_ON_MOVE_CHANCE: 0.25,   // chance a relocating pet leaves a gift at its old spot
  MAX_PENDING_GIFTS: 3,        // cap so gifts never pile up
};

// Compute the Penny payout for a game.
//   result: 'win' | 'loss' | 'abandoned-progress' | 'abandoned-early'
//   winStreak = the streak AFTER this game (i.e. including this win)
//   tierMultiplier scales the base WIN payout only; losses stay flat.
export function computePayout({ result, isFirstWinOfDay = false, winStreak = 0, tierMultiplier = 1 }) {
  const zero = { base: 0, firstWinBonus: 0, streakBonus: 0, tierBonus: 0, total: 0 };

  if (result === 'abandoned-early') return zero;
  if (result === 'abandoned-progress') {
    return { ...zero, base: ECONOMY.ABANDONED_PROGRESS, total: ECONOMY.ABANDONED_PROGRESS };
  }
  if (result === 'loss') {
    return { ...zero, base: ECONOMY.LOSS_COMPLETED, total: ECONOMY.LOSS_COMPLETED };
  }

  // win
  const base = Math.round(ECONOMY.WIN * tierMultiplier);
  const tierBonus = base - ECONOMY.WIN; // negative for sleepy, positive for sharp
  const firstWinBonus = isFirstWinOfDay ? ECONOMY.FIRST_WIN_OF_DAY_BONUS : 0;
  // Streak bonus kicks in from the 2nd consecutive win onward
  const consecutive = Math.max(0, (winStreak || 1) - 1);
  const streakBonus = Math.min(consecutive * ECONOMY.STREAK_BONUS_PER_WIN, ECONOMY.STREAK_BONUS_CAP);
  return { base, firstWinBonus, streakBonus, tierBonus, total: base + firstWinBonus + streakBonus };
}

// Was an abandoned game "meaningful progress"?
export function isMeaningfulAbandon(gameState) {
  return gameState.turnCount >= ECONOMY.ABANDON_MIN_TURNS
    || gameState.borneOff.ashton > 0
    || gameState.borneOff.charlie > 0;
}

// Random gift amount, inclusive.
export function randomGiftAmount() {
  const { GIFT_MIN, GIFT_MAX } = ECONOMY;
  return Math.floor(Math.random() * (GIFT_MAX - GIFT_MIN + 1)) + GIFT_MIN;
}
