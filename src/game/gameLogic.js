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
    currentPlayer: 'ashton',
    dice: [],          // raw rolled values e.g. [3,3,3,3] for doubles
    usedDice: [],      // indices into dice that have been consumed
    phase: 'rolling',  // 'rolling' | 'moving' | 'gameover'
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

// All legal moves for the current player given current dice state
export function allLegalMoves(state) {
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

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function gameReducer(state, action) {
  switch (action.type) {
    case 'ROLL_DICE': return handleRollDice(state, action);
    case 'SELECT_PIECE': return handleSelectPiece(state, action.point);
    case 'MOVE_PIECE': return handleMovePiece(state, action.from, action.to);
    case 'MOVE_PATH': return handleMovePath(state, action.steps);
    case 'END_TURN': return handleEndTurn(state);
    case 'UNDO': return handleUndo(state);
    case 'NEW_GAME': return createInitialState();
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

  const next = { ...state, dice, usedDice: [], phase: 'moving', selectedPoint: null, eventLog, dieMoves: {} };

  // If no legal moves exist, auto-pass
  if (allLegalMoves(next).length === 0) {
    return { ...next, phase: 'rolling', currentPlayer: opponent(state.currentPlayer), dice: [], usedDice: [], turnStartSnapshot: null, dieMoves: {} };
  }

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

  // Check this source has at least one legal move
  const avail = availableDice(state);
  const uniqueDice = [...new Set(avail)];
  const hasMove = uniqueDice.some(die => legalMovesForDie(state, point, die).length > 0);
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
  let usedDie = null;
  for (const die of uniqueDice) {
    if (legalMovesForDie(state, from, die).some(m => m.to === to)) { usedDie = die; break; }
  }
  if (usedDie === null) return null;

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
    if (borneOff[opp] === 0) finalLog = [...finalLog, { type: EV.GAMMON_WON, player }];
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

// End the turn automatically when all dice are spent or no legal move remains.
function settleAfterMoves(state) {
  if (state.phase !== 'moving') return state; // already won/ended
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
  return endTurn(state);
}

function handleUndo(state) {
  if (state.phase !== 'moving') return state;
  if (state.currentPlayer !== 'ashton') return state;
  if (!state.usedDice.length) return state;
  if (!state.turnStartSnapshot) return state;
  return state.turnStartSnapshot;
}

function endTurn(state) {
  const next = {
    ...state,
    currentPlayer: opponent(state.currentPlayer),
    dice: [],
    usedDice: [],
    phase: 'rolling',
    selectedPoint: null,
    turnStartSnapshot: null,
    dieMoves: {},
  };
  return next;
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

  function search(curState, curFrom, usedIdx, path) {
    for (const { value, idx } of avail) {
      if (usedIdx.has(idx)) continue;
      for (const m of legalMovesForDie(curState, curFrom, value)) {
        const newPath = [...path, { from: curFrom, to: m.to, die: value }];
        const existing = result.get(m.to);
        if (!existing || newPath.length < existing.length) result.set(m.to, newPath);
        // Continue chaining from a landed point (can't chain off the board)
        if (typeof m.to === 'number') {
          const nextState = applyMoveToBoard(curState, curFrom, m.to);
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
