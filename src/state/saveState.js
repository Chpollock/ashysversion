const STORAGE_KEY = 'ashys-version-save';

// Full persistent schema (v2). loadState() merges saved data over these defaults,
// recursing into nested objects, so adding fields here never breaks an old save.
export function getDefaultState() {
  return {
    pennies: 0,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      totalPenniesEarned: 0,
      lastPlayedDate: null,   // 'YYYY-MM-DD' local date string
      gamesPlayedToday: 0,
    },
    firstWinOfDayDone: false,  // resets each new day
    music: {
      lyricsUnlocked: false,
      lyricsEnabled: false,
      muted: false,
    },
    room: {
      livingRoom: {
        repairs: {},        // { itemId: 'in-progress' | 'done' }
        repairTimers: {},   // { itemId: completionTimestamp(ms) }
        furniture: [],      // placed furniture item ids
      },
    },
    shop: { purchased: [] },
    boards: { owned: ['sharpie'], equipped: 'sharpie' },
    pieceSets: { owned: ['paper'], equipped: 'paper' },
    pets: {
      // spotId = current spot id (null = not placed yet); away = temporarily not in room
      boombox: { unlocked: true,  spotId: null, away: false },
      remy:    { unlocked: false, spotId: null, away: false },
      hammy:   { unlocked: false, spotId: null, away: false },
      lastGiftAt: 0,         // timestamp(ms) of last collected/spawned gift
      lastSeenAt: 0,         // timestamp(ms) the room was last arranged (for time-away)
    },
    // gifts waiting to be collected: [{ id, from, amount, position:{x,y}, zOrder }]
    pendingGifts: [],
    achievements: { unlocked: [], progress: {} },
    version: 2,
  };
}

// Recursive merge: saved values win, but any key missing from saved falls back to
// the default. Arrays are taken wholesale from saved (or default if absent).
function mergeDeep(defaults, saved) {
  if (Array.isArray(defaults)) {
    return Array.isArray(saved) ? saved : defaults;
  }
  if (defaults && typeof defaults === 'object') {
    const out = { ...defaults };
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(saved)) {
        out[key] = key in defaults ? mergeDeep(defaults[key], saved[key]) : saved[key];
      }
    }
    return out;
  }
  // Primitive: prefer saved when it exists (including 0/false), else default
  return saved === undefined ? defaults : saved;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const saved = JSON.parse(raw);
    const merged = mergeDeep(getDefaultState(), saved);
    merged.version = getDefaultState().version; // always reflect current schema
    return merged;
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
