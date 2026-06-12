// AI opponent move selection.
// Returns a full sequence of moves for Charlie's turn.
//
// Tiers (see aiOpponents.js):
//   sleepy  — random legal moves
//   classic — decent but beatable greedy scoring
//   sharp   — evaluates whole turn sequences, watches his blots
//
// Styles multiply the scoring weights (feisty hits more, careful hides blots).
//
// Each move: { from: number|'bar', to: number|'off', die: number }

import { allLegalMoves, enumerateMaxSequences, gameReducer, pipCount } from './gameLogic.js';
import { STYLE_BY_ID } from './aiOpponents.js';

export function getAIMoves(state, { tier = 'sleepy', style = 'balanced' } = {}) {
  const styleWeights = STYLE_BY_ID[style]?.weights ?? {};

  if (tier === 'sharp') return sharpMoves(state, styleWeights);
  return greedyMoves(state, tier, styleWeights);
}

// ─── Sleepy + Classic: greedy, one move at a time ─────────────────────────────

function greedyMoves(state, tier, styleWeights) {
  const moves = [];
  let current = state;

  // Keep picking moves until no dice remain or no legal moves
  for (let i = 0; i < 4; i++) {
    const legal = allLegalMoves(current);
    if (!legal.length) break;

    const move = tier === 'sleepy'
      ? pickRandom(legal)
      : pickSmart(current, legal, styleWeights);

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

// Classic: score each move and pick the best.
// Priorities (descending): bear off > hit blot > make point > advance > safety
const CLASSIC_WEIGHTS = {
  off: 100,        // always bear off
  barEscape: 60,   // always escape the bar
  hit: 80,         // hitting a blot is very desirable
  point: 40,       // landing on own checkers (stacking/making points)
  stackBonus: 5,   // small extra per checker already there (capped)
  advance: 0.5,    // per point of forward progress on an empty landing
  blotPenalty: 8,  // landing alone where Ashton might hit back
};

function pickSmart(state, moves, styleWeights) {
  let best = null;
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = scoreMoveClassic(state, move, styleWeights);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  // Add small randomness so Charlie isn't perfectly predictable
  const threshold = bestScore - 2;
  const goodMoves = moves.filter(m => scoreMoveClassic(state, m, styleWeights) >= threshold);
  return pickRandom(goodMoves) ?? best;
}

function scoreMoveClassic(state, move, sw) {
  const { points } = state;
  const player = 'charlie';
  const opp = 'ashton';

  if (move.to === 'off') return CLASSIC_WEIGHTS.off;

  if (move.from === 'bar') return CLASSIC_WEIGHTS.barEscape;

  const destPt = points[move.to];

  // Hit a blot — very desirable
  if (destPt.player === opp && destPt.count === 1) {
    return CLASSIC_WEIGHTS.hit * (sw.hit ?? 1);
  }

  // Make a point (land on own checker = stack)
  if (destPt.player === player && destPt.count >= 1) {
    const stackBonus = Math.min(destPt.count, 2); // Prefer making points over stacking high
    return (CLASSIC_WEIGHTS.point + stackBonus * CLASSIC_WEIGHTS.stackBonus) * (sw.point ?? 1);
  }

  // Landing alone on an empty point: score by forward progress, minus a little
  // caution for the blot it leaves (styles tune how much Charlie cares).
  // Charlie's home is 18–23; higher index = more advanced.
  let score = move.to * CLASSIC_WEIGHTS.advance;
  score -= CLASSIC_WEIGHTS.blotPenalty * (sw.blotPenalty ?? 1) * (move.to < 18 ? 1 : 0.4);
  if (typeof move.from === 'number' && points[move.from].count === 2) {
    // Leaving a blot behind, too
    score -= CLASSIC_WEIGHTS.blotPenalty * 0.7 * (sw.blotPenalty ?? 1);
  }
  return score;
}

// ─── Sharp: evaluate whole turn sequences ─────────────────────────────────────

const SHARP_WEIGHTS = {
  pip: 1,           // race progress (pip difference)
  off: 30,          // per checker borne off
  oppBar: 22,       // per Ashton checker on the bar
  blotShot: 0.45,   // per (direct shot × pips lost) on a Charlie blot
  point: 3,         // per made point (2+ checkers)
  homePoint: 3.5,   // extra for made points in Charlie's home (blocks re-entry)
};

function sharpMoves(state, sw) {
  const sequences = enumerateMaxSequences(state);
  if (!sequences.length) return [];

  // Score the board each sequence ends on
  let scored = sequences.map(seq => {
    let cur = state;
    for (const m of seq) {
      cur = gameReducer(cur, { type: 'MOVE_PIECE', from: m.from, to: m.to });
      if (cur.phase === 'gameover') break;
    }
    return { seq, score: evaluateBoard(cur, sw) };
  });

  // Small randomness among near-best sequences so he stays human (and beatable)
  const best = Math.max(...scored.map(s => s.score));
  const good = scored.filter(s => s.score >= best - 3);
  return good[Math.floor(Math.random() * good.length)].seq;
}

// Static evaluation of a position from Charlie's perspective. Bigger = better.
function evaluateBoard(state, sw) {
  const { points, bar, borneOff } = state;
  let score = 0;

  if (state.winner === 'charlie') return Infinity;

  // Race: how far ahead Charlie is in pips
  score += (pipCount(state, 'ashton') - pipCount(state, 'charlie')) * SHARP_WEIGHTS.pip;

  // Checkers off and Ashton stuck on the bar
  score += borneOff.charlie * SHARP_WEIGHTS.off;
  score += bar.ashton * SHARP_WEIGHTS.oppBar * (sw.hit ?? 1);

  for (let b = 0; b < 24; b++) {
    const pt = points[b];
    if (pt.player !== 'charlie' || pt.count === 0) continue;

    if (pt.count === 1) {
      // Blot: count Ashton's direct shots. Ashton at i hits b when i−b ∈ 1..6;
      // from the bar he enters at 24−die, which reaches b ≥ 18 directly.
      let shots = 0;
      for (let i = b + 1; i <= Math.min(23, b + 6); i++) {
        if (points[i].player === 'ashton') shots += points[i].count;
      }
      if (b >= 18) shots += bar.ashton;
      // Pips Charlie loses if this blot is hit = b + 1
      score -= shots * (b + 1) * SHARP_WEIGHTS.blotShot * (sw.blotPenalty ?? 1);
    } else {
      // Made point — extra value inside his home board (blocks re-entry)
      const homeBonus = b >= 18 ? SHARP_WEIGHTS.homePoint : 0;
      score += (SHARP_WEIGHTS.point + homeBonus) * (sw.point ?? 1);
    }
  }

  return score;
}
