// AI opponent move selection.
// Returns a full sequence of moves for Charlie's turn.
//
// difficulty 1 = random legal moves
// difficulty 2 = decent but beatable (implemented)
// difficulty 3+ = stub for future stronger play
//
// Each move: { from: number|'bar', to: number|'off', die: number }

import { allLegalMoves, legalMovesForDie, availableDice, gameReducer, opponent } from './gameLogic.js';

export function getAIMoves(state, difficulty = 2) {
  const moves = [];
  let current = state;

  // Keep picking moves until no dice remain or no legal moves
  for (let i = 0; i < 4; i++) {
    const legal = allLegalMoves(current);
    if (!legal.length) break;

    let move;
    if (difficulty <= 1) {
      move = pickRandom(legal);
    } else {
      move = pickSmart(current, legal);
    }

    if (!move) break;
    moves.push(move);
    current = gameReducer(current, { type: 'MOVE_PIECE', from: move.from, to: move.to });
    if (current.phase !== 'moving') break;
  }

  return moves;
}

function pickRandom(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

// Difficulty 2: score each move and pick the best.
// Priorities (descending): bear off > hit blot > make point > advance > safety
function pickSmart(state, moves) {
  let best = null;
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = scoreMoveD2(state, move);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  // Add small randomness so Charlie isn't perfectly predictable
  const threshold = bestScore - 2;
  const goodMoves = moves.filter(m => scoreMoveD2(state, m) >= threshold);
  return pickRandom(goodMoves);
}

function scoreMoveD2(state, move) {
  const { points, bar } = state;
  const player = 'charlie';
  const opp = 'ashton';

  if (move.to === 'off') return 100; // Always bear off

  if (move.from === 'bar') return 60; // Always escape bar

  const destPt = points[move.to];

  // Hit a blot — very desirable
  if (destPt.player === opp && destPt.count === 1) return 80;

  // Make a point (land on own checker = stack)
  if (destPt.player === player && destPt.count >= 1) {
    const stackBonus = Math.min(destPt.count, 2); // Prefer making points over stacking high
    return 40 + stackBonus * 5;
  }

  // Landing on an empty point: score by how far advanced (closer to bearing off)
  // Charlie's home is 18–23; higher index = more advanced
  const advance = move.to; // higher = more advanced for Charlie
  return advance * 0.5;
}
