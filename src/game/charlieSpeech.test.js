import { describe, it, expect } from 'vitest';
import { pickCharlieLine } from './charlieSpeech.js';

const EVENTS = ['charlie-hit', 'charlie-got-hit', 'charlie-doubles', 'player-doubles', 'charlie-stuck', 'player-stuck'];

describe('pickCharlieLine', () => {
  it('every tier has a line for every event', () => {
    for (const tier of ['sleepy', 'classic', 'sharp']) {
      for (const event of EVENTS) {
        const line = pickCharlieLine(event, { tier, style: 'balanced' });
        expect(typeof line, `${tier}/${event}`).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it('style seasoning merges without breaking', () => {
    for (const style of ['balanced', 'feisty', 'careful']) {
      const line = pickCharlieLine('charlie-hit', { tier: 'classic', style });
      expect(typeof line).toBe('string');
    }
  });

  it('unknown events return null instead of crashing', () => {
    expect(pickCharlieLine('charlie-wins-lottery', { tier: 'classic', style: 'balanced' })).toBe(null);
  });
});
