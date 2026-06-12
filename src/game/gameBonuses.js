// Per-game bonuses — REPEATABLE rewards for notable moments, computed from the
// game's event log at game over. Separate from achievements (which are
// first-time-only): these fire every game they're earned, itemized on the
// post-game screen ("+10 — double hit!").
//
// ctx = { eventLog, result ('win'|'loss'), pipStats }

import { EV, countEvents, hasEvent } from './events.js';

// Longest run of consecutive same-type events by a player in the log,
// counting only that player's OWN events between (the opponent's turn
// naturally breaks a run because their events land in between).
function longestRun(eventLog, type, player) {
  let best = 0, run = 0;
  for (const ev of eventLog) {
    if (ev.type === type && ev.player === player) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export const GAME_BONUSES = [
  {
    id: 'double-hit', label: 'double hit!', amount: 10,
    test: c => countEvents(c.eventLog, EV.BLOT_HIT, 'ashton') >= 2
            && countEvents(c.eventLog, EV.BLOT_HIT, 'ashton') < 4,
  },
  {
    id: 'hit-parade', label: 'hit parade!', amount: 20,
    test: c => countEvents(c.eventLog, EV.BLOT_HIT, 'ashton') >= 4,
  },
  {
    id: 'doubles-streak', label: 'the dice adored you', amount: 10,
    test: c => countEvents(c.eventLog, EV.DOUBLES_ROLLED, 'ashton') >= 3,
  },
  {
    id: 'big-comeback', label: 'big comeback!', amount: 25,
    test: c => c.result === 'win' && c.pipStats.ashtonMaxDeficit > 40,
  },
  {
    id: 'gammon', label: 'gammon!', amount: 25,
    test: c => c.result === 'win' && hasEvent(c.eventLog, EV.GAMMON_WON, 'ashton'),
  },
  {
    id: 'bear-off-rush', label: 'bear-off rush!', amount: 15,
    test: c => longestRun(c.eventLog, EV.PIECE_BORNE_OFF, 'ashton') >= 4,
  },
  {
    id: 'untouched', label: 'never been touched', amount: 15,
    test: c => c.result === 'win' && !hasEvent(c.eventLog, EV.GOT_HIT, 'ashton'),
  },
  {
    id: 'survivor', label: 'survivor', amount: 15,
    test: c => c.result === 'win' && countEvents(c.eventLog, EV.GOT_HIT, 'ashton') >= 3,
  },
];

// All bonuses earned this game: [{ id, label, amount }]
export function computeGameBonuses(ctx) {
  const earned = [];
  for (const b of GAME_BONUSES) {
    try {
      if (b.test(ctx)) earned.push({ id: b.id, label: b.label, amount: b.amount });
    } catch {
      // A malformed predicate should never break the post-game screen
    }
  }
  return earned;
}
