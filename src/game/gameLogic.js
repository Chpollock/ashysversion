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
    // Shuffled lookup: pieceImages[player][n] → index into the piece-NN.png array.
    // Stable for the whole game; fresh each NEW_GAME so pieces look different.
    pieceImages: {
      ashton:  shuffledIndices(),
      charlie: shuffledIndices(),
    },
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
  const [homeLo, homeHi] = homeRange(player);
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
    case 'ROLL_DICE': return handleRollDice(state);
    case 'SELECT_PIECE': return handleSelectPiece(state, action.point);
    case 'MOVE_PIECE': return handleMovePiece(state, action.from, action.to);
    case 'END_TURN': return handleEndTurn(state);
    case 'NEW_GAME': return createInitialState();
    default: return state;
  }
}

function handleRollDice(state) {
  if (state.phase !== 'rolling') return state;
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  // Doubles = four moves
  const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];

  const next = { ...state, dice, usedDice: [], phase: 'moving', selectedPoint: null };

  // If no legal moves exist, auto-pass
  if (allLegalMoves(next).length === 0) {
    return { ...next, phase: 'rolling', currentPlayer: opponent(state.currentPlayer), dice: [], usedDice: [] };
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

function handleMovePiece(state, from, to) {
  if (state.phase !== 'moving') return state;

  // Find which die value enables this move
  const avail = availableDice(state);
  const uniqueDice = [...new Set(avail)];
  let usedDie = null;

  for (const die of uniqueDice) {
    const legal = legalMovesForDie(state, from, die);
    if (legal.some(m => m.to === to)) {
      usedDie = die;
      break;
    }
  }
  if (usedDie === null) return state;

  // Find the first unused index of that die value
  const dieIdx = state.dice.findIndex((d, i) => d === usedDie && !state.usedDice.includes(i));
  if (dieIdx === -1) return state;

  let points = state.points.map(p => ({ ...p }));
  let bar = { ...state.bar };
  let borneOff = { ...state.borneOff };
  const player = state.currentPlayer;
  const opp = opponent(player);

  // Remove piece from source
  if (from === 'bar') {
    bar[player]--;
  } else {
    points[from] = { ...points[from], count: points[from].count - 1 };
    if (points[from].count === 0) points[from] = { count: 0, player: null };
  }

  if (to === 'off') {
    borneOff[player]++;
  } else {
    // Hit opponent blot?
    if (points[to].player === opp && points[to].count === 1) {
      bar[opp]++;
      points[to] = { count: 0, player: null };
    }
    // Place piece
    points[to] = { count: points[to].count + 1, player };
  }

  const usedDice = [...state.usedDice, dieIdx];

  // Check win
  if (borneOff[player] === 15) {
    return { ...state, points, bar, borneOff, usedDice, phase: 'gameover', winner: player, selectedPoint: null };
  }

  const next = { ...state, points, bar, borneOff, usedDice, selectedPoint: null };

  // Auto-end turn if all dice used or no legal moves remain
  const remainingMoves = allLegalMoves(next);
  if (usedDice.length === state.dice.length || remainingMoves.length === 0) {
    return endTurn(next);
  }

  return next;
}

function handleEndTurn(state) {
  // Guard: only end the turn if we're still in the moving phase
  if (state.phase !== 'moving') return state;
  return endTurn(state);
}

function endTurn(state) {
  const next = {
    ...state,
    currentPlayer: opponent(state.currentPlayer),
    dice: [],
    usedDice: [],
    phase: 'rolling',
    selectedPoint: null,
  };
  return next;
}

// Legal destination points from a selected source (for highlighting)
export function legalDestinations(state, fromPoint) {
  const avail = availableDice(state);
  const uniqueDice = [...new Set(avail)];
  const dests = new Set();
  for (const die of uniqueDice) {
    for (const m of legalMovesForDie(state, fromPoint, die)) {
      dests.add(m.to);
    }
  }
  return [...dests];
}
