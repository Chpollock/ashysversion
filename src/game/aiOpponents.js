// Charlie's difficulty tiers and play-style personalities — data-driven, like
// shopItems.js. Both unlock by career wins (stats.gamesWon), never by Pennies.
//
// Tiers set HOW WELL Charlie plays (and scale the win payout).
// Styles set HOW he plays — multipliers over the AI's base scoring weights.

export const AI_TIERS = [
  {
    id: 'sleepy', name: 'Sleepy Charlie', emoji: '😴',
    unlockWins: 0, rewardMultiplier: 0.8,
    description: 'Half watching, half napping.',
  },
  {
    id: 'classic', name: 'Charlie', emoji: '🎲',
    unlockWins: 0, rewardMultiplier: 1.0,
    description: 'The usual rival.',
  },
  {
    id: 'sharp', name: 'Sharp Charlie', emoji: '🧐',
    unlockWins: 8, rewardMultiplier: 1.6,
    description: 'He read a book about this.',
  },
];

// Playstyles — how Charlie plays, at any difficulty. Weights multiply the AI's
// base scoring; `chaos` widens how far from "best" he's willing to stray.
export const AI_STYLES = [
  {
    id: 'balanced', name: 'Balanced', emoji: '⚖️',
    unlockWins: 0, weights: {},
    description: 'A little of everything.',
  },
  {
    id: 'feisty', name: 'Feisty', emoji: '🔥',
    unlockWins: 3, weights: { hit: 1.5, blotPenalty: 0.6 },
    description: 'Aggressive — lives to send you to the bar.',
  },
  {
    id: 'careful', name: 'Careful', emoji: '🧱',
    unlockWins: 5, weights: { blotPenalty: 1.6, point: 1.4, hit: 0.8 },
    description: 'Safe — builds little walls and hides behind them.',
  },
  {
    id: 'wild', name: 'Wild', emoji: '🤪',
    unlockWins: 7, weights: { chaos: 30, blotPenalty: 0.5 },
    description: 'Unpredictable — no plan, all vibes.',
  },
  {
    id: 'racer', name: 'Racer', emoji: '🏃',
    unlockWins: 10, weights: { advance: 1.7, pip: 1.4, hit: 0.7, point: 0.8 },
    description: 'Eyes on home, full speed, no stopping.',
  },
];

export const TIER_BY_ID  = Object.fromEntries(AI_TIERS.map(t => [t.id, t]));
export const STYLE_BY_ID = Object.fromEntries(AI_STYLES.map(s => [s.id, s]));

export function unlockedTiers(gamesWon) {
  return AI_TIERS.filter(t => gamesWon >= t.unlockWins);
}

export function unlockedStyles(gamesWon) {
  return AI_STYLES.filter(s => gamesWon >= s.unlockWins);
}
