// Game events emitted by the reducer into gameState.eventLog.
// Achievements and the post-game snippet consume this log — no game logic
// lives here, just the vocabulary and the "what was notable?" selection.

export const EV = {
  DOUBLES_ROLLED:       'DOUBLES_ROLLED',       // { player, value }
  BLOT_HIT:             'BLOT_HIT',             // { player, point }  (player did the hitting)
  GOT_HIT:              'GOT_HIT',              // { player, point }  (player's blot was hit)
  PIECE_BORNE_OFF:      'PIECE_BORNE_OFF',      // { player, point }
  BAR_ENTER:            'BAR_ENTER',            // { player, point }
  // Derived at win time:
  GAMMON_WON:           'GAMMON_WON',           // { player }   loser bore off 0
  BACKGAMMON_WON:       'BACKGAMMON_WON',       // { player }   gammon + loser still on bar / in winner's home
  WON_FROM_BEHIND:      'WON_FROM_BEHIND',      // { player, deficit }
  NO_DOUBLES_ALL_GAME:  'NO_DOUBLES_ALL_GAME',  // { player }
  FIVE_PLUS_HITS:       'FIVE_PLUS_HITS',       // { player, count }
};

// Count helper
export function countEvents(eventLog, type, player) {
  return eventLog.filter(e => e.type === type && (!player || e.player === player)).length;
}

export function hasEvent(eventLog, type, player) {
  return eventLog.some(e => e.type === type && (!player || e.player === player));
}

// Warm generic lines shown when nothing especially notable happened.
const GENERIC_SNIPPETS = [
  'A cozy round by the window.',
  'The dice were feeling chatty today.',
  'Charlie put up a good fight.',
  'Another one in the books — well played.',
  'Boombox watched the whole thing from his sunbeam.',
  'The cardboard board has seen a few games now.',
];

// Pick the single most-notable thing that happened, as a charming one-liner.
// result = 'win' | 'loss' (from Ashton's perspective).
export function pickSnippet(eventLog, result) {
  const ashHits = countEvents(eventLog, EV.BLOT_HIT, 'ashton');
  const ashDoubles = countEvents(eventLog, EV.DOUBLES_ROLLED, 'ashton');

  if (result === 'win' && hasEvent(eventLog, EV.BACKGAMMON_WON, 'ashton')) {
    return 'A full backgammon. Charlie would like the record to show he was distracted.';
  }
  if (result === 'loss' && hasEvent(eventLog, EV.BACKGAMMON_WON, 'charlie')) {
    return 'A backgammon for Charlie. The dice have a lot to answer for.';
  }
  if (result === 'win' && hasEvent(eventLog, EV.GAMMON_WON, 'ashton')) {
    return 'A gammon! Charlie didn’t bear off a single piece. Ouch (for him).';
  }
  if (result === 'win' && hasEvent(eventLog, EV.WON_FROM_BEHIND, 'ashton')) {
    return 'You were way behind and still pulled it off. Wiped the smirk right off.';
  }
  if (hasEvent(eventLog, EV.FIVE_PLUS_HITS, 'ashton')) {
    return `${ashHits} of Charlie’s pieces sent to the bar. Merciless.`;
  }
  if (result === 'loss' && hasEvent(eventLog, EV.GAMMON_WON, 'charlie')) {
    return 'Charlie ran the table that time. The dice owe you one.';
  }
  if (ashDoubles >= 3) {
    return `You rolled doubles ${ashDoubles} times. The dice clearly adore you.`;
  }
  if (result === 'win' && ashHits >= 2) {
    return 'A few well-timed hits and the game was yours.';
  }
  if (result === 'loss') {
    return 'Close one. Charlie got the rolls this time — rematch?';
  }
  // Generic, rotating
  return GENERIC_SNIPPETS[Math.floor(Math.random() * GENERIC_SNIPPETS.length)];
}
