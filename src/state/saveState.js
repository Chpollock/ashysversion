const STORAGE_KEY = 'ashys-version-save';

export function getDefaultState() {
  return {
    pennies: 0,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
    },
    currentRoom: 'livingRoom',
    version: 1,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const saved = JSON.parse(raw);
    // Deep merge saved over defaults so new keys never break old saves
    const defaults = getDefaultState();
    return {
      ...defaults,
      ...saved,
      stats: { ...defaults.stats, ...(saved.stats || {}) },
    };
  } catch {
    return getDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}
