// In-progress game persistence. The CURRENT game survives leaving the room,
// closing the tab, or the app being killed — it only ends by being finished
// or explicitly abandoned. Stored separately from the main save so the two
// can't corrupt each other.

const GAME_KEY = 'ashys-version-game';

export function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    // A finished game is not worth resuming
    if (!state || state.phase === 'gameover') return null;
    return state;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — losing a resume is acceptable
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    // ignore
  }
}

export function hasSavedGame() {
  return loadGame() !== null;
}
