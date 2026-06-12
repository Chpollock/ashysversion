import { describe, it, expect } from 'vitest';
import { getAIMoves } from './ai.js';
import { createInitialState, gameReducer, allLegalMoves, rollDiceValues } from './gameLogic.js';

// Build a Charlie-to-move state from the opening position with given dice
function charlieState(dice) {
  const s = createInitialState();
  s.currentPlayer = 'charlie';
  s.dice = dice;
  s.phase = 'moving';
  return s;
}

// Replay the returned moves through the reducer; every step must be accepted.
function replay(state, moves) {
  let cur = state;
  for (const m of moves) {
    const legal = allLegalMoves(cur);
    expect(legal.some(l => l.from === m.from && l.to === m.to)).toBe(true);
    cur = gameReducer(cur, { type: 'MOVE_PIECE', from: m.from, to: m.to });
  }
  return cur;
}

describe('getAIMoves', () => {
  it.each([['sleepy'], ['classic'], ['sharp']])('%s plays a full legal turn', (tier) => {
    for (const dice of [[6, 5], [3, 3, 3, 3], [2, 1]]) {
      const state = charlieState([...dice]);
      const moves = getAIMoves(state, { tier, style: 'balanced' });
      expect(moves.length).toBeGreaterThan(0);
      const end = replay(state, moves);
      // Turn fully settled: all dice used (reducer auto-ends the turn)
      expect(end.currentPlayer === 'ashton' || end.phase === 'gameover').toBe(true);
    }
  });

  it('every style produces a legal turn at every tier', () => {
    for (const tier of ['sleepy', 'classic', 'sharp']) {
      for (const style of ['balanced', 'feisty', 'careful', 'wild', 'racer']) {
        const state = charlieState([4, 2]);
        const moves = getAIMoves(state, { tier, style });
        replay(state, moves);
      }
    }
  });

  it('sharp plays the maximum number of dice', () => {
    const state = charlieState([6, 2]);
    const moves = getAIMoves(state, { tier: 'sharp' });
    expect(moves.length).toBe(2);
  });

  // Full game simulation: Charlie at each tier vs a random-moving Ashton.
  // Guards against rule deadlocks (a position where neither side can finish).
  it.each([['sleepy'], ['classic'], ['sharp']])('a full game vs %s Charlie finishes', (tier) => {
    let s = createInitialState();
    s = gameReducer(s, { type: 'OPENING_ROLL', ashtonDie: 6, charlieDie: 1 });

    let guard = 0;
    while (s.phase !== 'gameover' && guard++ < 3000) {
      if (s.phase === 'rolling') {
        s = gameReducer(s, { type: 'ROLL_DICE', dice: rollDiceValues() });
      } else {
        if (s.currentPlayer === 'charlie') {
          const moves = getAIMoves(s, { tier });
          if (!moves.length) { s = gameReducer(s, { type: 'END_TURN' }); continue; }
          for (const m of moves) {
            if (s.phase !== 'moving') break;
            s = gameReducer(s, { type: 'MOVE_PIECE', from: m.from, to: m.to });
          }
        } else {
          const legal = allLegalMoves(s);
          if (!legal.length) { s = gameReducer(s, { type: 'END_TURN' }); continue; }
          const m = legal[Math.floor(Math.random() * legal.length)];
          s = gameReducer(s, { type: 'MOVE_PIECE', from: m.from, to: m.to });
        }
      }
    }

    expect(s.phase).toBe('gameover');
    expect(s.borneOff[s.winner]).toBe(15);
  });
});
