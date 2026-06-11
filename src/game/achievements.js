// Data-driven achievements. Each entry has a `test(ctx)` predicate that runs
// once at game-over. ctx = {
//   result: 'win' | 'loss',          // from Ashton's perspective
//   eventLog: [...],                  // game/events.js events for the finished game
//   pipStats: { ashtonMaxDeficit },
//   statsAfter: { gamesPlayed, gamesWon, currentWinStreak, bestWinStreak, ... },
//   save: <full save before this game's stat update>,
// }
//
// Tone: warm and funny. Both good luck and terrible luck are worth celebrating.

import { EV, countEvents, hasEvent } from './events.js';

export const ACHIEVEMENTS = [
  // ── Milestones ───────────────────────────────────────────────────────────
  { id: 'first_win', name: 'First Blood (Politely)', category: 'milestone', reward: 25,
    description: 'Win your very first game against Charlie.',
    test: c => c.result === 'win' && c.statsAfter.gamesWon === 1 },
  { id: 'ten_games', name: 'Regular at the Table', category: 'milestone', reward: 25,
    description: 'Play 10 games.',
    test: c => c.statsAfter.gamesPlayed === 10 },
  { id: 'fifty_games', name: 'This Is Our Spot Now', category: 'milestone', reward: 50,
    description: 'Play 50 games.',
    test: c => c.statsAfter.gamesPlayed === 50 },
  { id: 'ten_wins', name: 'Double Digits', category: 'milestone', reward: 50,
    description: 'Win 10 games.',
    test: c => c.statsAfter.gamesWon === 10 },

  // ── Streaks ──────────────────────────────────────────────────────────────
  { id: 'streak_3', name: 'On a Roll', category: 'streak', reward: 20,
    description: 'Win 3 in a row.',
    test: c => c.statsAfter.currentWinStreak === 3 },
  { id: 'streak_5', name: 'Charlie Is Sweating', category: 'streak', reward: 35,
    description: 'Win 5 in a row.',
    test: c => c.statsAfter.currentWinStreak === 5 },
  { id: 'streak_10', name: 'Absolutely Ruthless', category: 'streak', reward: 75,
    description: 'Win 10 in a row.',
    test: c => c.statsAfter.currentWinStreak === 10 },

  // ── Comebacks ──────────────────────────────────────────────────────────────
  { id: 'comeback', name: 'Wiped the Smirk Off', category: 'comeback', reward: 40,
    description: 'Win a game after trailing badly.',
    test: c => c.result === 'win' && hasEvent(c.eventLog, EV.WON_FROM_BEHIND, 'ashton') },
  { id: 'big_comeback', name: 'No Notes, Just Vibes', category: 'comeback', reward: 60,
    description: 'Win after being more than 60 pips behind.',
    test: c => c.result === 'win' && c.pipStats.ashtonMaxDeficit > 60 },

  // ── Skill ────────────────────────────────────────────────────────────────
  { id: 'gammon', name: 'Shut Out', category: 'skill', reward: 50,
    description: 'Win a gammon — Charlie bears off nothing.',
    test: c => c.result === 'win' && hasEvent(c.eventLog, EV.GAMMON_WON, 'ashton') },
  { id: 'five_hits', name: 'Bar Fight', category: 'skill', reward: 30,
    description: 'Send 5 of Charlie’s pieces to the bar in one game.',
    test: c => hasEvent(c.eventLog, EV.FIVE_PLUS_HITS, 'ashton') },
  { id: 'three_hits', name: 'Rude (Affectionate)', category: 'skill', reward: 15,
    description: 'Hit 3 of Charlie’s blots in one game.',
    test: c => countEvents(c.eventLog, EV.BLOT_HIT, 'ashton') >= 3 },
  { id: 'no_doubles_win', name: 'The Hard Way', category: 'skill', reward: 30,
    description: 'Win a whole game without ever rolling doubles.',
    test: c => c.result === 'win' && hasEvent(c.eventLog, EV.NO_DOUBLES_ALL_GAME, 'ashton') },
  { id: 'clean_game', name: 'Untouchable', category: 'skill', reward: 35,
    description: 'Win without any of your pieces being hit.',
    test: c => c.result === 'win' && !hasEvent(c.eventLog, EV.GOT_HIT, 'ashton') },

  // ── Luck (good) ────────────────────────────────────────────────────────────
  { id: 'doubles_3', name: 'Dice Whisperer', category: 'luck', reward: 20,
    description: 'Roll doubles 3 times in one game.',
    test: c => countEvents(c.eventLog, EV.DOUBLES_ROLLED, 'ashton') >= 3 },
  { id: 'doubles_5', name: 'The Dice Adore You', category: 'luck', reward: 40,
    description: 'Roll doubles 5 times in one game.',
    test: c => countEvents(c.eventLog, EV.DOUBLES_ROLLED, 'ashton') >= 5 },

  // ── Luck (terrible) — celebrated, never punished ───────────────────────────
  { id: 'the_dice_owe_you', name: 'The Dice Owe You', category: 'luck', reward: 25,
    description: 'Lose a game where Charlie rolled doubles 3+ times.',
    test: c => c.result === 'loss' && countEvents(c.eventLog, EV.DOUBLES_ROLLED, 'charlie') >= 3 },
  { id: 'got_gammoned', name: 'We Don’t Talk About That One', category: 'luck', reward: 20,
    description: 'Lose a gammon. It happens. We move on.',
    test: c => c.result === 'loss' && hasEvent(c.eventLog, EV.GAMMON_WON, 'charlie') },
  { id: 'pincushion', name: 'Pincushion', category: 'luck', reward: 15,
    description: 'Get 4+ of your pieces sent to the bar in one game.',
    test: c => countEvents(c.eventLog, EV.GOT_HIT, 'ashton') >= 4 },

  // ── Silly ──────────────────────────────────────────────────────────────────
  { id: 'snake_eyes', name: 'Snake Eyes', category: 'silly', reward: 10,
    description: 'Roll double ones.',
    test: c => c.eventLog.some(e => e.type === EV.DOUBLES_ROLLED && e.player === 'ashton' && e.value === 1) },
  { id: 'box_cars', name: 'Boxcars', category: 'silly', reward: 10,
    description: 'Roll double sixes.',
    test: c => c.eventLog.some(e => e.type === EV.DOUBLES_ROLLED && e.player === 'ashton' && e.value === 6) },
  { id: 'comeback_kid_loss', name: 'Moral Victory', category: 'silly', reward: 15,
    description: 'Climb back from way behind… and still lose. Heroic, honestly.',
    test: c => c.result === 'loss' && c.pipStats.ashtonMaxDeficit > 50 },
  { id: 'first_of_day', name: 'Good Morning, Champion', category: 'milestone', reward: 0,
    description: 'Win the first game of a new day.',
    test: c => c.result === 'win' && c.isFirstWinOfDay },
  { id: 'night_owl', name: 'One More Game', category: 'silly', reward: 10,
    description: 'Play 3 games in a single day.',
    test: c => c.statsAfter.gamesPlayedToday >= 3 },
  { id: 'five_today', name: 'Marathon', category: 'silly', reward: 20,
    description: 'Play 5 games in a single day.',
    test: c => c.statsAfter.gamesPlayedToday >= 5 },
];

// Returns the achievement objects newly unlocked by this game (not already in unlockedIds).
export function evaluateAchievements(ctx, unlockedIds = []) {
  const unlocked = new Set(unlockedIds);
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    try {
      if (a.test(ctx)) newly.push(a);
    } catch {
      // A malformed predicate should never crash the post-game screen
    }
  }
  return newly;
}
