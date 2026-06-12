// Charlie's table talk. Each difficulty tier has its own voice, and play
// styles season the pool with extra lines. Picked occasionally (the caller
// rolls the dice on whether he speaks at all) when something dramatic happens.
//
// Events:
//   'charlie-hit'     — Charlie hit one of your blots
//   'charlie-got-hit' — you hit one of Charlie's blots
//   'charlie-doubles' — Charlie rolled doubles
//   'player-doubles'  — you rolled doubles
//   'charlie-stuck'   — Charlie rolled and has no legal moves
//   'player-stuck'    — you rolled and have no legal moves

const TIER_LINES = {
  sleepy: {
    'charlie-hit':     ['got one… back to my nap.', 'oh. gotcha. sorry.', 'didn’t even mean to do that.'],
    'charlie-got-hit': ['huh? oh no.', 'i was resting there…', 'rude. that was a cozy spot.'],
    'charlie-doubles': ['oh hey, doubles. neat.', 'the dice did a thing.'],
    'player-doubles':  ['nice roll… *yawn*', 'wow. lucky. anyway, so tired.'],
    'charlie-stuck':   ['can’t move. more nap then.', 'stuck. oh well. zzz.'],
    'player-stuck':    ['hehe… wait, what happened?', 'oh, you’re stuck? wild.'],
  },
  classic: {
    'charlie-hit':     ['Off you go!', 'To the bar with you!', 'Sorry — house rules.'],
    'charlie-got-hit': ['Hey!! I was using that!', 'Oh no. Oh no no no.', 'I’ll remember that.'],
    'charlie-doubles': ['Doubles, baby!', 'The dice love me today.'],
    'player-doubles':  ['Okay, that’s just unfair.', 'The dice are cheating for you.'],
    'charlie-stuck':   ['…I have no moves. Rude.', 'Blocked?! Outrageous.'],
    'player-stuck':    ['Nowhere to go, huh?', 'Take your time. Oh wait—'],
  },
  sharp: {
    'charlie-hit':     ['Calculated.', 'As predicted.', 'You left that open on purpose?'],
    'charlie-got-hit': ['Hm. A minor setback.', 'Statistically improbable. Annoying.', 'Noted. Recalculating.'],
    'charlie-doubles': ['Efficient.', 'Probability favors the prepared.'],
    'player-doubles':  ['Luck is not a strategy.', 'Variance. It happens.'],
    'charlie-stuck':   ['This position is… suboptimal.', 'A temporary inconvenience.'],
    'player-stuck':    ['Exactly as designed.', 'The wall holds.'],
  },
};

// Style seasoning — merged into the tier pool so any Charlie can get feisty.
const STYLE_LINES = {
  feisty: {
    'charlie-hit':     ['BOOM!', 'Get outta here!!'],
    'charlie-got-hit': ['OH IT’S ON NOW.', 'You’ll pay for that one.'],
    'player-doubles':  ['WHATEVER!!'],
  },
  careful: {
    'charlie-hit':     ['Sorry!! Nothing personal!', 'Oh gosh — sorry, sorry.'],
    'charlie-got-hit': ['I knew I shouldn’t have left that there…'],
    'charlie-doubles': ['Safely does it.'],
  },
};

export function pickCharlieLine(event, { tier = 'sleepy', style = 'balanced' } = {}) {
  const pool = [
    ...(TIER_LINES[tier]?.[event] ?? []),
    ...(STYLE_LINES[style]?.[event] ?? []),
  ];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
