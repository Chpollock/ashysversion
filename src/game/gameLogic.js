import { EV, countEvents } from './events.js';

// Pure backgammon rules — no React, fully testable.
//
// Board layout (points 0–23):
//   Ashton (human):  moves 23 → 0  (direction -1), home board 0–5,  bar enters at (24 - die)
//   Charlie (AI):    moves 0  → 23 (direction +1), home board 18–23, bar enters at (die - 1)
//
// points[i] = { count: number, player: 'ashton'|'charlie'|null }
// bar = { ashton: number, charlie: number }
// borneOff = { ashton: number, charlie: number }

// ─── Initial State ────────────────────────────────────────────────────────────

// Returns a shuffled copy of [0, 1, ..., 14] — used to randomise which
// extracted piece image each checker displays. Stored in game state so the
// mapping is stable for the entire game but fresh each new game.
function shuffledIndices() {
  const arr = Array.from({ length: 15 }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState() {
  const points = Array.from({ length: 24 }, () => ({ count: 0, player: null }));

  // Standard starting position (from Ashton's perspective, point 23 = top-right)
  // Ashton (cream) pieces
  const ashtonSetup = [
    [23, 2], [12, 5], [7, 3], [5, 5],
  ];
  // Charlie (brown) pieces
  const charlieSetup = [
    [0, 2], [11, 5], [16, 3], [18, 5],
  ];

  for (const [pt, count] of ashtonSetup) {
    points[pt] = { count, player: 'ashton' };
  }
  for (const [pt, count] of charlieSetup) {
    points[pt] = { count, player: 'charlie' };
  }

  return {
    points,
    bar: { ashton: 0, charlie: 0 },
    borneOff: { ashton: 0, charlie: 0 },
    currentPlayer: 'ashton', // placeholder until the opening roll decides
    dice: [],          // raw rolled values e.g. [3,3,3,3] for doubles
    usedDice: [],      // indices into dice that have been consumed
    diceOwner: null,   // who rolled the dice on the table: 'ashton' | 'charlie' | 'opening'
    rollId: 0,         // increments per roll — lets the UI animate each throw
    turnCount: 0,      // completed turns this game (for abandonment thresholds)
    phase: 'opening',  // 'opening' | 'rolling' | 'moving' | 'gameover'
    winner: null,
    selectedPoint: null, // point index or 'bar' of the selected piece
    pieceImages: {
      ashton:  shuffledIndices(),
      charlie: shuffledIndices(),
    },
    // Snapshot of the board state at the start of Ashton's moving phase.
    // Stored so UNDO can restore to just-rolled state (keeping dice, undoing moves).
    turnStartSnapshot: null,
    // Event log for achievements + post-game snippet (see game/events.js).
    eventLog: [],
    // Pip tracking — peak deficit Ashton faced this game (for comeback detection).
    pipStats: { ashtonMaxDeficit: 0 },
    // Maps die INDEX → the move it consumed this turn: { [i]: { from, to } }.
    // Powers the "hover a die to see which piece it moved" UI. Reset each turn.
    dieMoves: {},
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function opponent(player) {
  return player === 'ashton' ? 'charlie' : 'ashton';
}

export function direction(player) {
  return player === 'ashton' ? -1 : 1;
}

// Home board point range for bearing off
export function homeRange(player) {
  return player === 'ashton' ? [0, 5] : [18, 23];
}

// Point where a piece enters from the bar
export function barEntryPoint(player, die) {
  return player === 'ashton' ? 24 - die : die - 1;
}

// All 15 pieces accounted for (home + borne off)
export function allInHome(state, player) {
  const [lo, hi] = homeRange(player);
  let count = state.borneOff[player];
  for (let i = lo; i <= hi; i++) {
    if (state.points[i].player === player) count += state.points[i].count;
  }
  return count === 15;
}

// Available (unconsumed) dice values
export function availableDice(state) {
  return state.dice.filter((_, i) => !state.usedDice.includes(i));
}

// Pip count = total distance a player must still travel to bear off everything.
// Ashton moves 23→0 (off past 0), so a piece at point i is (i+1) pips out.
// Charlie moves 0→23 (off past 23), so a piece at point i is (24-i) pips out.
// Bar pieces count as 25 (furthest possible re-entry distance).
export function pipCount(state, player) {
  let pips = state.bar[player] * 25;
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    if (pt.player !== player) continue;
    pips += pt.count * (player === 'ashton' ? i + 1 : 24 - i);
  }
  return pips;
}

// ─── Move Validation ─────────────────────────────────────────────────────────

// Can player land on destPoint?
function canLandOn(points, destPoint, player) {
  if (destPoint < 0 || destPoint > 23) return false;
  const pt = points[destPoint];
  return pt.player === null || pt.player === player || pt.count === 1;
}

// Generate all legal moves for one die from a given board position
export function legalMovesForDie(state, fromPoint, die) {
  const { points, bar, currentPlayer } = state;
  const player = currentPlayer;
  const moves = [];

  // Must clear bar first
  if (bar[player] > 0 && fromPoint !== 'bar') return [];

  if (fromPoint === 'bar') {
    if (bar[player] === 0) return [];
    const dest = barEntryPoint(player, die);
    if (canLandOn(points, dest, player)) {
      moves.push({ from: 'bar', to: dest, die });
    }
    return moves;
  }

  if (points[fromPoint].player !== player || points[fromPoint].count === 0) return [];

  const canBearOff = allInHome(state, player);
  const dest = fromPoint + direction(player) * die;

  if (dest >= 0 && dest <= 23) {
    if (canLandOn(points, dest, player)) {
      moves.push({ from: fromPoint, to: dest, die });
    }
  } else if (canBearOff) {
    // Exact bear-off
    if ((player === 'ashton' && dest < 0) || (player === 'charlie' && dest > 23)) {
      // Check if this is an exact match or valid over-roll
      const exactMatch = (player === 'ashton' && fromPoint === die - 1) ||
                         (player === 'charlie' && fromPoint === 24 - die);
      if (exactMatch) {
        moves.push({ from: fromPoint, to: 'off', die });
      } else {
        // Over-roll: valid only if no piece is further from home
        const isOutermost = isOutermostPiece(state, player, fromPoint);
        if (isOutermost) {
          moves.push({ from: fromPoint, to: 'off', die });
        }
      }
    }
  }

  return moves;
}

// Is this the piece farthest from home (for over-roll bear-off)?
function isOutermostPiece(state, player, pointIndex) {
  const [lo, hi] = homeRange(player);
  const points = state.points;

  if (player === 'ashton') {
    // Outermost = highest index in home (5 down to 0)
    for (let i = hi; i >= lo; i--) {
      if (points[i].player === player && points[i].count > 0) {
        return i === pointIndex;
      }
    }
  } else {
    // Outermost = lowest index in home (18 up to 23)
    for (let i = lo; i <= hi; i++) {
      if (points[i].player === player && points[i].count > 0) {
        return i === pointIndex;
      }
    }
  }
  return false;
}

// All single-die moves with no forced-move filtering applied.
function rawAllLegalMoves(state) {
  const player = state.currentPlayer;
  const avail = availableDice(state);
  if (!avail.length) return [];

  const { points, bar } = state;
  const sources = [];

  if (bar[player] > 0) {
    sources.push('bar');
  } else {
    for (let i = 0; i < 24; i++) {
      if (points[i].player === player && points[i].count > 0) sources.push(i);
    }
  }

  // Deduplicate die values to avoid duplicate move sets
  const uniqueDice = [...new Set(avail)];
  const moves = new Set();

  for (const src of sources) {
    for (const die of uniqueDice) {
      for (const m of legalMovesForDie(state, src, die)) {
        moves.add(JSON.stringify(m));
      }
    }
  }

  return [...moves].map(m => JSON.parse(m));
}

// ─── Forced-move rules ───────────────────────────────────────────────────────
// Real backgammon: you must play as many dice as possible, and when only one of
// two different dice can be played, it must be the larger one. We enforce this
// by filtering the raw move list so a move that strands a playable die is never
// offered (to the UI highlights, the reducer, or the AI).

// Apply a raw move AND consume the physical die it used, so availableDice()
// works on the simulated state. (applyMoveToBoard alone doesn't touch usedDice.)
function applyAndConsume(state, move) {
  const dieIdx = state.dice.findIndex((d, i) => d === move.die && !state.usedDice.includes(i));
  return { ...applyMoveToBoard(state, move.from, move.to), usedDice: [...state.usedDice, dieIdx] };
}

// Compact signature of board + remaining dice, for memoising the search.
// (borneOff is implied by points+bar; currentPlayer is constant per search.)
function stateKey(state) {
  let s = '';
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    s += pt.count ? (pt.player === 'ashton' ? 'a' : 'c') + pt.count : '.';
  }
  return s + '|' + state.bar.ashton + ',' + state.bar.charlie + '|' + availableDice(state).join(',');
}

// Maximum number of dice playable from this state (DFS, memoised per call).
function maxPlayable(state, memo = new Map()) {
  const key = stateKey(state);
  if (memo.has(key)) return memo.get(key);
  const limit = availableDice(state).length;
  let best = 0;
  for (const m of rawAllLegalMoves(state)) {
    const depth = 1 + maxPlayable(applyAndConsume(state, m), memo);
    if (depth > best) best = depth;
    if (best === limit) break; // can't do better
  }
  memo.set(key, best);
  return best;
}

// States are immutable, so the strict move list can be cached per state object
// (this is called from the reducer, the board memo and the AI on the same state).
const strictMovesCache = new WeakMap();

// All legal moves for the current player, with forced-move rules enforced:
// a move is legal iff it still allows the maximum number of dice to be played,
// and the larger die wins when only one of two different dice can be played.
export function allLegalMoves(state) {
  const cached = strictMovesCache.get(state);
  if (cached) return cached;

  const raw = rawAllLegalMoves(state);
  let filtered = raw;

  if (raw.length > 1) {
    const memo = new Map();
    const max = maxPlayable(state, memo);
    filtered = raw.filter(m => 1 + maxPlayable(applyAndConsume(state, m), memo) === max);

    // Larger-die rule: only one die can be played and the two dice differ
    const avail = availableDice(state);
    if (max === 1 && avail.length === 2 && avail[0] !== avail[1]) {
      const larger = Math.max(avail[0], avail[1]);
      const largerMoves = filtered.filter(m => m.die === larger);
      if (largerMoves.length) filtered = largerMoves;
    }
  }

  strictMovesCache.set(state, filtered);
  return filtered;
}

// Why moves are currently being filtered out (for a gentle UI hint):
//   null         — nothing filtered (or no moves at all)
//   'use-both'   — a move was dropped because it would strand a playable die
//   'use-larger' — only one die fits, so the larger one must be played
export function moveRestriction(state) {
  const raw = rawAllLegalMoves(state);
  const strict = allLegalMoves(state);
  if (strict.length === raw.length) return null;

  const avail = availableDice(state);
  if (avail.length === 2 && avail[0] !== avail[1]) {
    const larger = Math.max(avail[0], avail[1]);
    if (strict.every(m => m.die === larger) && raw.some(m => m.die !== larger)
        && maxPlayable(state) === 1) {
      return 'use-larger';
    }
  }
  return 'use-both';
}

// All maximal turn sequences (each plays the most dice possible), deduplicated
// by final board position. Used by the strongest AI to evaluate whole turns.
// Searching with the strict allLegalMoves guarantees every path reaches the max.
export function enumerateMaxSequences(state, cap = 2000) {
  const max = maxPlayable(state);
  if (max === 0) return [];
  const sequences = [];
  const seen = new Set();

  function search(curState, path) {
    if (path.length === max) {
      const key = stateKey(curState);
      if (!seen.has(key)) { seen.add(key); sequences.push(path); }
      return;
    }
    for (const m of allLegalMoves(curState)) {
      if (sequences.length >= cap) return;
      search(applyAndConsume(curState, m), [...path, m]);
    }
  }
  search(state, []);
  return sequences;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function gameReducer(state, action) {
  switch (action.type) {
    case 'OPENING_ROLL': return handleOpeningRoll(state, action);
    case 'ROLL_DICE': return handleRollDice(state, action);
    case 'SELECT_PIECE': return handleSelectPiece(state, action.point);
    case 'MOVE_PIECE': return handleMovePiece(state, action.from, action.to);
    case 'MOVE_PATH': return handleMovePath(state, action.steps);
    case 'END_TURN': return handleEndTurn(state);
    case 'UNDO': return handleUndo(state);
    case 'NEW_GAME': return createInitialState();
    // Dev-only shortcut (wired behind import.meta.env.DEV in the UI):
    // jump straight to a finished game to preview the rewards screen.
    case 'DEBUG_END_GAME': return handleDebugEndGame(state, action);
    default: return state;
  }
}

// Roll two dice; doubles yields four moves. Kept OUTSIDE the reducer so the
// reducer stays pure (the component passes the result in via the action payload).
export function rollDiceValues() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

// Each player rolls one die; the higher roll goes first. The component rerolls
// ties before dispatching, so a tie here is simply rejected.
export function rollOpeningValues() {
  let ashtonDie, charlieDie;
  do {
    ashtonDie = Math.floor(Math.random() * 6) + 1;
    charlieDie = Math.floor(Math.random() * 6) + 1;
  } while (ashtonDie === charlieDie);
  return { ashtonDie, charlieDie };
}

function handleOpeningRoll(state, action) {
  if (state.phase !== 'opening') return state;
  const { ashtonDie, charlieDie } = action;
  if (!ashtonDie || !charlieDie || ashtonDie === charlieDie) return state;

  // Real backgammon: the winner of the opening roll plays BOTH dice as their
  // first turn — no re-roll. Straight into the moving phase.
  const winner = ashtonDie > charlieDie ? 'ashton' : 'charlie';
  const next = {
    ...state,
    currentPlayer: winner,
    dice: [ashtonDie, charlieDie],
    usedDice: [],
    diceOwner: winner,
    rollId: state.rollId + 1,
    phase: 'moving',
    selectedPoint: null,
    dieMoves: {},
  };

  // Undo snapshot for Ashton, same as a normal roll
  if (winner === 'ashton') {
    const snapshot = { ...next, turnStartSnapshot: null };
    return { ...next, turnStartSnapshot: snapshot };
  }
  return next;
}

function handleRollDice(state, action) {
  if (state.phase !== 'rolling') return state;
  // Dice come from the action payload (pure reducer); fall back to a roll for tests.
  const dice = action?.dice ?? rollDiceValues();
  const isDoubles = dice.length === 4;

  // Record doubles in the event log
  let eventLog = state.eventLog;
  if (isDoubles) {
    eventLog = [...eventLog, { type: EV.DOUBLES_ROLLED, player: state.currentPlayer, value: dice[0] }];
  }

  const next = {
    ...state, dice, usedDice: [], phase: 'moving', selectedPoint: null, eventLog, dieMoves: {},
    diceOwner: state.currentPlayer,
    rollId: state.rollId + 1,
  };

  // No auto-pass here: even with no legal moves the dice stay visible and the
  // turn ends explicitly (Ashton taps End turn; Charlie's orchestration ends it).

  // Save undo snapshot for Ashton only (state as-of-roll, moves undone)
  if (state.currentPlayer === 'ashton') {
    const snapshot = { ...next, turnStartSnapshot: null };
    return { ...next, turnStartSnapshot: snapshot };
  }

  return next;
}

function handleSelectPiece(state, point) {
  if (state.phase !== 'moving') return state;
  if (state.currentPlayer !== 'ashton') return state; // only human selects

  // Clicking the already-selected piece deselects
  if (state.selectedPoint === point) return { ...state, selectedPoint: null };

  // Validate there's a piece here
  if (point === 'bar') {
    if (state.bar[state.currentPlayer] === 0) return state;
  } else {
    if (state.points[point].player !== state.currentPlayer) return state;
  }

  // Check this source has at least one legal move under the forced-move rules
  // (matches the moveableSources glow, which also uses allLegalMoves)
  const hasMove = allLegalMoves(state).some(m => m.from === point);
  if (!hasMove) return state;

  return { ...state, selectedPoint: point };
}

// Apply ONE single-die move and return the new state — WITHOUT auto-ending the
// turn. Returns null if the move isn't legal with any available die. Sets
// phase 'gameover' if it wins. Used by both single moves and combined paths.
function consumeMove(state, from, to) {
  // Find which available die value enables from→to
  const avail = availableDice(state);
  const uniqueDice = [...new Set(avail)];
  const candidates = [];
  for (const die of uniqueDice) {
    if (legalMovesForDie(state, from, die).some(m => m.to === to)) candidates.push(die);
  }
  if (!candidates.length) return null;

  let usedDie = candidates[0];
  if (candidates.length > 1) {
    // Tie-break (bear-off: exact die vs over-roll with a bigger die) — prefer
    // the die that doesn't strand another playable die.
    const memo = new Map();
    const before = maxPlayable(state, memo);
    for (const die of candidates) {
      if (1 + maxPlayable(applyAndConsume(state, { from, to, die }), memo) === before) {
        usedDie = die;
        break;
      }
    }
  }

  const dieIdx = state.dice.findIndex((d, i) => d === usedDie && !state.usedDice.includes(i));
  if (dieIdx === -1) return null;

  const points = state.points.map(p => ({ ...p }));
  const bar = { ...state.bar };
  const borneOff = { ...state.borneOff };
  let eventLog = state.eventLog;
  const player = state.currentPlayer;
  const opp = opponent(player);

  if (from === 'bar') {
    bar[player]--;
    eventLog = [...eventLog, { type: EV.BAR_ENTER, player, point: to }];
  } else {
    points[from] = { ...points[from], count: points[from].count - 1 };
    if (points[from].count === 0) points[from] = { count: 0, player: null };
  }

  if (to === 'off') {
    borneOff[player]++;
    eventLog = [...eventLog, { type: EV.PIECE_BORNE_OFF, player, point: from }];
  } else {
    if (points[to].player === opp && points[to].count === 1) {
      bar[opp]++;
      points[to] = { count: 0, player: null };
      eventLog = [
        ...eventLog,
        { type: EV.BLOT_HIT, player, point: to },
        { type: EV.GOT_HIT, player: opp, point: to },
      ];
    }
    points[to] = { count: points[to].count + 1, player };
  }

  const usedDice = [...state.usedDice, dieIdx];
  const dieMoves = { ...state.dieMoves, [dieIdx]: { from, to } };

  // Track Ashton's peak pip deficit (for comeback achievements)
  let pipStats = state.pipStats;
  const afterMove = { ...state, points, bar, borneOff };
  const deficit = pipCount(afterMove, 'ashton') - pipCount(afterMove, 'charlie');
  if (deficit > pipStats.ashtonMaxDeficit) pipStats = { ...pipStats, ashtonMaxDeficit: deficit };

  // Win?
  if (borneOff[player] === 15) {
    let finalLog = eventLog;
    if (borneOff[opp] === 0) {
      finalLog = [...finalLog, { type: EV.GAMMON_WON, player }];
      // Backgammon (triple): the loser also has a checker on the bar or still
      // inside the winner's home board.
      const [lo, hi] = homeRange(player);
      let oppInWinnersHome = false;
      for (let i = lo; i <= hi; i++) {
        if (points[i].player === opp && points[i].count > 0) oppInWinnersHome = true;
      }
      if (bar[opp] > 0 || oppInWinnersHome) {
        finalLog = [...finalLog, { type: EV.BACKGAMMON_WON, player }];
      }
    }
    if (player === 'ashton' && pipStats.ashtonMaxDeficit > 30) {
      finalLog = [...finalLog, { type: EV.WON_FROM_BEHIND, player, deficit: pipStats.ashtonMaxDeficit }];
    }
    if (player === 'ashton' && countEvents(finalLog, EV.DOUBLES_ROLLED, 'ashton') === 0) {
      finalLog = [...finalLog, { type: EV.NO_DOUBLES_ALL_GAME, player }];
    }
    const hits = countEvents(finalLog, EV.BLOT_HIT, player);
    if (hits >= 5) finalLog = [...finalLog, { type: EV.FIVE_PLUS_HITS, player, count: hits }];
    return { ...state, points, bar, borneOff, usedDice, dieMoves, pipStats, eventLog: finalLog, phase: 'gameover', winner: player, selectedPoint: null };
  }

  return { ...state, points, bar, borneOff, usedDice, dieMoves, pipStats, eventLog, selectedPoint: null };
}

// After a move: Charlie's turn ends automatically when all dice are spent or
// no legal move remains. Ashton's turn waits for an explicit END_TURN so the
// dice stay up and Undo remains available.
function settleAfterMoves(state) {
  if (state.phase !== 'moving') return state; // already won/ended
  if (state.currentPlayer === 'ashton') return state;
  if (state.usedDice.length === state.dice.length || allLegalMoves(state).length === 0) {
    return endTurn(state);
  }
  return state;
}

function handleMovePiece(state, from, to) {
  if (state.phase !== 'moving') return state;
  const next = consumeMove(state, from, to);
  if (!next) return state;
  return settleAfterMoves(next);
}

// Apply a sequence of single-die moves atomically (a combined move that uses
// more than one die to reach a far destination), settling the turn only once.
// steps: [{ from, to }] where each step's `from` is the previous step's `to`.
function handleMovePath(state, steps) {
  if (state.phase !== 'moving') return state;
  if (!Array.isArray(steps) || steps.length === 0) return state;
  let cur = state;
  for (const step of steps) {
    const next = consumeMove(cur, step.from, step.to);
    if (!next) return state;          // illegal path — reject the whole thing
    cur = next;
    if (cur.phase === 'gameover') return cur;
  }
  return settleAfterMoves(cur);
}

function handleEndTurn(state) {
  // Guard: only end the turn if we're still in the moving phase
  if (state.phase !== 'moving') return state;
  // Ashton can't end early while legal moves remain (must play the maximum).
  // Charlie stays permissive — it's the AI orchestration's safety valve.
  if (state.currentPlayer === 'ashton' && allLegalMoves(state).length > 0) return state;
  return endTurn(state);
}

function handleDebugEndGame(state, action) {
  if (state.phase === 'gameover') return state;
  const winner = action.winner === 'charlie' ? 'charlie' : 'ashton';
  return {
    ...state,
    borneOff: { ...state.borneOff, [winner]: 15 },
    phase: 'gameover',
    winner,
    selectedPoint: null,
  };
}

function handleUndo(state) {
  if (state.phase !== 'moving') return state;
  if (state.currentPlayer !== 'ashton') return state;
  if (!state.usedDice.length) return state;
  if (!state.turnStartSnapshot) return state;
  return state.turnStartSnapshot;
}

function endTurn(state) {
  return {
    ...state,
    turnCount: state.turnCount + 1,
    currentPlayer: opponent(state.currentPlayer),
    // Keep the dice on the table (all marked used) until the next roll
    // replaces them — they only "disappear" by being rolled over. dieMoves
    // stays too, so hovering a die still reveals what it moved.
    usedDice: state.dice.map((_, i) => i),
    phase: 'rolling',
    selectedPoint: null,
    turnStartSnapshot: null,
  };
}

// Minimal board update used by the combined-move search (no events/win logic).
function applyMoveToBoard(state, from, to) {
  const points = state.points.map(p => ({ ...p }));
  const bar = { ...state.bar };
  const borneOff = { ...state.borneOff };
  const player = state.currentPlayer;
  const opp = opponent(player);

  if (from === 'bar') {
    bar[player]--;
  } else {
    points[from] = { ...points[from], count: points[from].count - 1 };
    if (points[from].count === 0) points[from] = { count: 0, player: null };
  }
  if (to === 'off') {
    borneOff[player]++;
  } else {
    if (points[to].player === opp && points[to].count === 1) {
      bar[opp]++;
      points[to] = { count: 0, player: null };
    }
    points[to] = { count: points[to].count + 1, player };
  }
  return { ...state, points, bar, borneOff };
}

// All destinations a checker at `fromPoint` can reach this turn, INCLUDING
// combined moves that use more than one die. Returns a Map:
//   endpoint (point index | 'off') → ordered steps [{ from, to, die }]
// (the shortest path found). This is what makes moving the full pip count in a
// single tap work, instead of forcing the player to move one die at a time.
export function reachableTargets(state, fromPoint) {
  const result = new Map();
  // Available dice as { value, idx } so each physical die is used at most once
  const avail = [];
  state.dice.forEach((value, idx) => { if (!state.usedDice.includes(idx)) avail.push({ value, idx }); });

  // Forced-move rules: the FIRST step must be one of the strict legal moves
  // (which already encode the larger-die rule correctly), and no step may
  // strand a playable die.
  const memo = new Map();
  const origMax = maxPlayable(state, memo);
  const strictFirst = allLegalMoves(state);

  function search(curState, curFrom, usedIdx, path) {
    for (const { value, idx } of avail) {
      if (usedIdx.has(idx)) continue;
      if (path.length === 0
          && !strictFirst.some(s => s.from === curFrom && s.die === value)) continue;
      for (const m of legalMovesForDie(curState, curFrom, value)) {
        const newPath = [...path, { from: curFrom, to: m.to, die: value }];
        // Simulated post-move state (board + consumed die); skip paths that
        // would lock out playing the maximum number of dice.
        const nextState = { ...applyMoveToBoard(curState, curFrom, m.to), usedDice: [...curState.usedDice, idx] };
        if (maxPlayable(nextState, memo) !== origMax - newPath.length) continue;
        const existing = result.get(m.to);
        if (!existing || newPath.length < existing.length) result.set(m.to, newPath);
        // Continue chaining from a landed point (can't chain off the board)
        if (typeof m.to === 'number') {
          search(nextState, m.to, new Set([...usedIdx, idx]), newPath);
        }
      }
    }
  }
  search(state, fromPoint, new Set(), []);
  return result;
}

// Legal destination points from a selected source (for highlighting). Includes
// combined-move endpoints.
export function legalDestinations(state, fromPoint) {
  return [...reachableTargets(state, fromPoint).keys()];
}
