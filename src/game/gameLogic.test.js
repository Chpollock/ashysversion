import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  gameReducer,
  allLegalMoves,
  moveRestriction,
  reachableTargets,
  enumerateMaxSequences,
  furthestPath,
  deadDice,
} from './gameLogic.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

// Build a sparse board state. `points` maps index → [player, count].
function makeState({ points = {}, bar, borneOff, currentPlayer = 'ashton', dice = [], usedDice = [] } = {}) {
  const s = createInitialState();
  s.points = Array.from({ length: 24 }, () => ({ count: 0, player: null }));
  for (const [i, [player, count]] of Object.entries(points)) {
    s.points[Number(i)] = { count, player };
  }
  if (bar) s.bar = { ashton: 0, charlie: 0, ...bar };
  else s.bar = { ashton: 0, charlie: 0 };
  if (borneOff) s.borneOff = { ashton: 0, charlie: 0, ...borneOff };
  s.currentPlayer = currentPlayer;
  s.dice = dice;
  s.usedDice = usedDice;
  s.phase = dice.length ? 'moving' : 'rolling';
  return s;
}

// ─── Forced-move rules ────────────────────────────────────────────────────────

describe('must use both dice', () => {
  // Ashton checkers at 23 and 6. Dice [1,6].
  //   die 6: 23→17 blocked, 6→0 blocked → not directly playable
  //   die 1: 23→22 (then 6: 22→16 ✓ plays both) or 6→5 (strands the 6)
  // The strict list must drop 6→5.
  const state = makeState({
    points: {
      23: ['ashton', 1], 6: ['ashton', 1],
      17: ['charlie', 2], 0: ['charlie', 2],
    },
    dice: [1, 6],
  });

  it('filters a move that strands a playable die', () => {
    const moves = allLegalMoves(state);
    expect(moves).toEqual([{ from: 23, to: 22, die: 1 }]);
  });

  it('reports the use-both restriction', () => {
    expect(moveRestriction(state)).toBe('use-both');
  });

  it('blocks selecting a checker whose only move is filtered', () => {
    const next = gameReducer(state, { type: 'SELECT_PIECE', point: 6 });
    expect(next.selectedPoint).toBe(null);
  });

  it('reachableTargets excludes stranding paths', () => {
    expect(reachableTargets(state, 6).size).toBe(0);
    const from23 = reachableTargets(state, 23);
    expect(from23.has(22)).toBe(true);
    expect(from23.has(16)).toBe(true); // combined 1+6
  });
});

describe('must use the larger die', () => {
  // Ashton checkers at 6 and 23. Dice [5,6].
  //   die 6: 6→0 ✓, 23→17 blocked     die 5: 6→1 ✓, 23→18 blocked
  // After either, the other die has no move (23 stays blocked, can't bear off
  // with a checker still at 23). Only one die can be played → must be the 6.
  const state = makeState({
    points: {
      6: ['ashton', 1], 23: ['ashton', 1],
      17: ['charlie', 2], 18: ['charlie', 2],
      0: ['charlie', 1], 1: ['charlie', 1], // blots — landing is allowed
    },
    dice: [5, 6],
  });

  it('keeps only larger-die moves when only one die fits', () => {
    const moves = allLegalMoves(state);
    expect(moves).toEqual([{ from: 6, to: 0, die: 6 }]);
  });

  it('reports the use-larger restriction', () => {
    expect(moveRestriction(state)).toBe('use-larger');
  });
});

describe('doubles play the maximum', () => {
  it('a lone checker chains all four doubles', () => {
    // 9→6→3→0, then bear off (over-roll, outermost) — all in home after first hop?
    // No: bearing off needs all 15 accounted for. borneOff 14 + this checker.
    const state = makeState({
      points: { 9: ['ashton', 1] },
      borneOff: { ashton: 14 },
      dice: [3, 3, 3, 3],
    });
    const seqs = enumerateMaxSequences(state);
    expect(seqs.length).toBeGreaterThan(0);
    for (const seq of seqs) expect(seq.length).toBe(4);
  });

  it('moveRestriction is null when nothing is filtered', () => {
    const state = makeState({
      points: { 9: ['ashton', 1] },
      borneOff: { ashton: 14 },
      dice: [3, 3, 3, 3],
    });
    expect(moveRestriction(state)).toBe(null);
  });
});

describe('turn flow: explicit end turn, dice stay on the table', () => {
  it('a fully blocked roll waits for an explicit End turn (dice stay visible)', () => {
    // Ashton on the bar; Charlie owns both entry points for dice [1,2]
    const state = makeState({
      points: { 23: ['charlie', 2], 22: ['charlie', 2] },
      bar: { ashton: 1 },
      currentPlayer: 'ashton',
    });
    state.phase = 'rolling';
    const rolled = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    expect(rolled.phase).toBe('moving');           // no instant auto-pass
    expect(rolled.currentPlayer).toBe('ashton');
    expect(allLegalMoves(rolled)).toEqual([]);     // …but nothing to play

    const ended = gameReducer(rolled, { type: 'END_TURN' });
    expect(ended.currentPlayer).toBe('charlie');
    expect(ended.phase).toBe('rolling');
    expect(ended.dice).toEqual([1, 2]);            // dice still on the table
    expect(ended.usedDice).toEqual([0, 1]);        // …marked used
  });

  it("Ashton can't end her turn while legal moves remain", () => {
    const state = makeState({
      points: { 23: ['charlie', 2], 12: ['ashton', 2] },
      currentPlayer: 'ashton',
    });
    state.phase = 'rolling';
    const rolled = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    expect(rolled.phase).toBe('moving');
    expect(gameReducer(rolled, { type: 'END_TURN' })).toBe(rolled); // rejected
  });

  it("Ashton's turn does not auto-end after her last die — End turn is explicit", () => {
    const state = makeState({
      points: { 12: ['ashton', 1] },
      dice: [1, 2],
    });
    let s = gameReducer(state, { type: 'MOVE_PIECE', from: 12, to: 11 });
    s = gameReducer(s, { type: 'MOVE_PIECE', from: 11, to: 9 });
    expect(s.phase).toBe('moving');                // still her turn
    expect(s.currentPlayer).toBe('ashton');
    expect(allLegalMoves(s)).toEqual([]);

    const ended = gameReducer(s, { type: 'END_TURN' });
    expect(ended.currentPlayer).toBe('charlie');
    expect(ended.dice).toEqual([1, 2]);            // dice persist until next roll
  });
});

describe('regression: bar entry when only the smaller die can play at all', () => {
  // Ashton on the bar with dice [1,6]:
  //   die 1 enters at 23 (open); die 6 entry at 18 is blocked.
  //   After entering, the 6 has no move anywhere (17 blocked; the checker on 5
  //   can't bear off while a checker sits outside home).
  // The larger-die rule must NOT block the only playable move — the game was
  // getting stuck here: the bar checker selectable but with no destinations.
  const state = makeState({
    points: {
      5: ['ashton', 1],
      18: ['charlie', 2], 17: ['charlie', 2],
    },
    bar: { ashton: 1 },
    dice: [1, 6],
  });

  it('allLegalMoves offers the smaller-die entry', () => {
    expect(allLegalMoves(state)).toEqual([{ from: 'bar', to: 23, die: 1 }]);
  });

  it('reachableTargets agrees (destination dot appears)', () => {
    const reach = reachableTargets(state, 'bar');
    expect(reach.has(23)).toBe(true);
    expect(reach.get(23)).toEqual([{ from: 'bar', to: 23, die: 1 }]);
  });
});

describe('furthestPath (double-tap to move the farthest)', () => {
  it('combines both dice to reach the farthest point', () => {
    const state = makeState({ points: { 10: ['ashton', 1] }, dice: [3, 5] });
    const steps = furthestPath(state, 10);
    expect(steps.at(-1).to).toBe(2);                 // 10 → 5 → 2 (or 10 → 7 → 2)
    expect(steps.reduce((s, m) => s + m.die, 0)).toBe(8);
  });

  it('bears off when that is the farthest a checker can go', () => {
    const state = makeState({
      points: { 2: ['ashton', 1] }, borneOff: { ashton: 14 }, dice: [3, 5],
    });
    expect(furthestPath(state, 2).at(-1).to).toBe('off');
  });

  it('returns null for a checker with no move', () => {
    const state = makeState({
      points: { 10: ['ashton', 1], 7: ['charlie', 2], 5: ['charlie', 2] },
      dice: [3, 5],
    });
    expect(furthestPath(state, 10)).toBe(null);
  });
});

describe('deadDice (crossed-out dice)', () => {
  it('marks the die that can never be played', () => {
    // Ashton on the bar, dice [1,6]: only the 1 can enter; the 6 is dead
    const state = makeState({
      points: { 5: ['ashton', 1], 18: ['charlie', 2], 17: ['charlie', 2] },
      bar: { ashton: 1 }, dice: [1, 6],
    });
    expect(deadDice(state)).toEqual([1]); // index of the 6
  });

  it('marks every die when the whole roll is unplayable', () => {
    const state = makeState({
      points: { 23: ['charlie', 2], 22: ['charlie', 2] },
      bar: { ashton: 1 }, dice: [1, 2],
    });
    expect(deadDice(state).sort()).toEqual([0, 1]);
  });

  it('marks nothing when both dice can be played', () => {
    const state = createInitialState();
    state.dice = [6, 5];
    state.phase = 'moving';
    expect(deadDice(state)).toEqual([]);
  });
});

describe('opening roll', () => {
  it('the winner plays BOTH opening dice as their first turn', () => {
    const fresh = createInitialState();
    expect(fresh.phase).toBe('opening');

    const charlieWins = gameReducer(fresh, { type: 'OPENING_ROLL', ashtonDie: 2, charlieDie: 5 });
    expect(charlieWins.currentPlayer).toBe('charlie');
    expect(charlieWins.phase).toBe('moving');           // straight into the turn
    expect(charlieWins.dice).toEqual([2, 5]);           // …with the opening dice
    expect(charlieWins.usedDice).toEqual([]);
    expect(charlieWins.diceOwner).toBe('charlie');

    const ashtonWins = gameReducer(fresh, { type: 'OPENING_ROLL', ashtonDie: 6, charlieDie: 1 });
    expect(ashtonWins.currentPlayer).toBe('ashton');
    expect(ashtonWins.phase).toBe('moving');
    expect(ashtonWins.dice).toEqual([6, 1]);
    expect(ashtonWins.turnStartSnapshot).toBeTruthy();  // undo works on turn one
    expect(allLegalMoves(ashtonWins).length).toBeGreaterThan(0);
  });

  it('rejects ties and rolls outside the opening phase', () => {
    const fresh = createInitialState();
    expect(gameReducer(fresh, { type: 'OPENING_ROLL', ashtonDie: 3, charlieDie: 3 })).toBe(fresh);

    const started = gameReducer(fresh, { type: 'OPENING_ROLL', ashtonDie: 6, charlieDie: 1 });
    expect(gameReducer(started, { type: 'OPENING_ROLL', ashtonDie: 1, charlieDie: 6 })).toBe(started);
  });
});

describe('normal positions are unaffected', () => {
  it('opening position with 6-5 offers moves for both dice', () => {
    const state = createInitialState();
    state.dice = [6, 5];
    state.phase = 'moving';
    const moves = allLegalMoves(state);
    expect(moves.some(m => m.die === 6)).toBe(true);
    expect(moves.some(m => m.die === 5)).toBe(true);
    expect(moveRestriction(state)).toBe(null);
  });

  it('bear-off over-roll still works for the outermost checker', () => {
    const state = makeState({
      points: { 3: ['ashton', 1], 1: ['ashton', 1] },
      borneOff: { ashton: 13 },
      dice: [6, 5],
    });
    const moves = allLegalMoves(state);
    expect(moves.some(m => m.from === 3 && m.to === 'off')).toBe(true);
  });
});
