const STORAGE_KEY = 'ashys-version-save';

// Full persistent schema (v2). loadState() merges saved data over these defaults,
// recursing into nested objects, so adding fields here never breaks an old save.
export function getDefaultState() {
  return {
    // Enough found-in-the-box Pennies to start the very first project
    // (Draw the Board, 5) — the game itself is behind that board.
    pennies: 5,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      totalPenniesEarned: 0,
      lastPlayedDate: null,   // 'YYYY-MM-DD' local date string
      gamesPlayedToday: 0,
      winsByTier: {},         // { sleepy: n, classic: n, sharp: n }
      gamesByTier: {},        // completed games per tier (for the record book)
    },
    firstWinOfDayDone: false,  // resets each new day
    music: {
      lyricsUnlocked: false,
      lyricsEnabled: false,
      muted: false,
    },
    // The living room's story: how many PROJECTS (game/roomStates.js) are
    // complete, and the one currently building (null = none).
    roomStateIndex: 0,
    activeProject: null,   // { id, completesAt(ms) } | null
    room: {
      livingRoom: {
        repairs: {},        // legacy (pre-projects) — kept so old saves parse
        repairTimers: {},
        furniture: [],
      },
    },
    shop: { purchased: [] },
    boards: { owned: ['sharpie'], equipped: 'sharpie' },
    pieceSets: { owned: ['paper'], equipped: 'paper' },
    // Swappable game backdrop behind the board (see game/backdrops.js).
    backdrops: { owned: ['default'], equipped: 'default' },
    pets: {
      // spotId = current spot (null = not placed); away = temporarily out;
      // arrivesAt = en-route timestamp (purchased, not yet arrived);
      // welcomed = the arrival moment has been shown.
      boombox: { unlocked: true,  spotId: null, away: false, arrivesAt: null, welcomed: true },
      remy:    { unlocked: false, spotId: null, away: false, arrivesAt: null, welcomed: false },
      hammy:   { unlocked: false, spotId: null, away: false, arrivesAt: null, welcomed: false },
      lastGiftAt: 0,         // timestamp(ms) of last collected/spawned gift
      lastSeenAt: 0,         // timestamp(ms) the room was last arranged (for time-away)
    },
    // gifts waiting to be collected: [{ id, from, amount, position:{x,y}, zOrder }]
    pendingGifts: [],
    // unlocked = { achievementId: unlockedAt(ms) } — first-time-only, dated
    achievements: { unlocked: {}, progress: {} },
    // Charlie's equipped difficulty tier + play style (see game/aiOpponents.js).
    // celebrated = tier/style ids whose "unlocked!" card has already been shown.
    // Starts on the gentlest Charlie.
    opponents: { tier: 'sleepy', style: 'balanced', celebrated: [] },
    version: 7,
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

// Turn a raw parsed save (from localStorage OR an imported backup) into a
// complete, migrated, current-version state. Shared so a backup code is
// hydrated exactly like a stored save — even an old one.
function hydrate(saved) {
  const merged = mergeDeep(getDefaultState(), saved);
  // v4: the default opponent became Sleepy Charlie. Saves written before then
  // got 'classic' silently — reset them once so everyone starts gentle.
  if ((saved.version ?? 0) < 4) merged.opponents.tier = 'sleepy';
  // v5: achievements.unlocked moved from [id] to { id: unlockedAt }.
  // (Check the RAW save — mergeDeep folds an array into an object keyed 0,1,…)
  if (Array.isArray(saved?.achievements?.unlocked)) {
    const at = Date.now();
    merged.achievements = {
      ...merged.achievements,
      unlocked: Object.fromEntries(saved.achievements.unlocked.map(id => [id, at])),
    };
  }
  // v6: the game is gated behind the first project (Draw the Board, 5
  // Pennies) — make sure nobody is stranded at the start without the fare.
  if ((saved.version ?? 0) < 6 && merged.roomStateIndex === 0 && merged.pennies < 5) {
    merged.pennies = 5;
  }
  merged.version = getDefaultState().version; // always reflect current schema
  return merged;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    return hydrate(JSON.parse(raw));
  } catch {
    return getDefaultState();
  }
}

// ─── Portable backup codes ──────────────────────────────────────────────────
// A backup is a short magic prefix + Unicode-safe base64 of the save JSON.
// Copy-paste friendly (works in iOS standalone where file downloads don't).

const BACKUP_PREFIX = 'ASHY1-';

// Export the current save as a portable code string.
export function exportSave(state) {
  const json = JSON.stringify(state);
  return BACKUP_PREFIX + btoa(unescape(encodeURIComponent(json)));
}

// Parse a backup code back into a complete, migrated save. Never throws.
// Returns { ok: true, state } or { ok: false, error }.
export function importSave(code) {
  const trimmed = (code || '').trim();
  if (!trimmed) return { ok: false, error: 'Paste a backup code first.' };
  if (!trimmed.startsWith(BACKUP_PREFIX)) {
    return { ok: false, error: 'That doesn’t look like one of Ashy’s backups 🤔' };
  }
  try {
    const json = decodeURIComponent(escape(atob(trimmed.slice(BACKUP_PREFIX.length))));
    const parsed = JSON.parse(json);
    // Sanity-check it's actually one of our saves before trusting it
    if (!parsed || typeof parsed !== 'object' || typeof parsed.pennies !== 'number' || typeof parsed.stats !== 'object') {
      return { ok: false, error: 'That backup looks incomplete or corrupted.' };
    }
    return { ok: true, state: hydrate(parsed) };
  } catch {
    return { ok: false, error: 'That backup couldn’t be read — check it copied fully.' };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}
