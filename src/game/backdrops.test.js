import { describe, it, expect } from 'vitest';
import { BACKDROPS, BACKDROP_BY_ID, backdropBackground } from './backdrops.js';
import { SHOP_ITEM_BY_ID, FEATURED_ITEMS, isOwned, applyPurchase, equipBackdrop } from './shopItems.js';
import { getDefaultState } from '../state/saveState.js';

describe('backdrops data', () => {
  it('seeds the two backdrops with the expected shape', () => {
    expect(BACKDROPS.map(b => b.id)).toEqual(['default', 'pink']);
    expect(BACKDROP_BY_ID.default.cost).toBe(0);
    expect(BACKDROP_BY_ID.pink.cost).toBe(200);
    expect(BACKDROP_BY_ID.pink.description).toBe('She asked. Obviously.');
    for (const b of BACKDROPS) expect(typeof b.gradient).toBe('string');
  });

  it('composes texture over gradient (pink has a texture, default does not)', () => {
    expect(backdropBackground('default')).toBe(BACKDROP_BY_ID.default.gradient);
    const pink = backdropBackground('pink');
    expect(pink).toContain(BACKDROP_BY_ID.pink.gradient);
    expect(pink).toContain('repeating-linear-gradient'); // the linen texture
  });

  it('falls back to the default backdrop for unknown ids', () => {
    expect(backdropBackground('nope')).toBe(backdropBackground('default'));
  });
});

describe('default save', () => {
  it('owns and equips the default backdrop', () => {
    const s = getDefaultState();
    expect(s.backdrops).toEqual({ owned: ['default'], equipped: 'default' });
  });
});

describe('shop: pink backdrop purchase + equip', () => {
  const pink = SHOP_ITEM_BY_ID.pinkBackdrop;

  it('pink is a featured backdrop item', () => {
    expect(FEATURED_ITEMS.map(i => i.id)).toContain('pinkBackdrop');
    expect(pink.grants).toEqual({ type: 'backdrop', id: 'pink' });
    expect(pink.featured).toBe(true);
  });

  it('buying adds pink to owned but does not auto-equip', () => {
    const s0 = { ...getDefaultState(), pennies: 500 };
    expect(isOwned(pink, s0)).toBe(false);
    const s1 = applyPurchase(s0, pink);
    expect(s1.pennies).toBe(300);
    expect(s1.backdrops.owned).toEqual(['default', 'pink']);
    expect(s1.backdrops.equipped).toBe('default'); // still cream until equipped
    expect(isOwned(pink, s1)).toBe(true);
  });

  it('equips an owned backdrop, and can switch back to cream', () => {
    let s = applyPurchase({ ...getDefaultState(), pennies: 500 }, pink);
    s = equipBackdrop(s, 'pink');
    expect(s.backdrops.equipped).toBe('pink');
    s = equipBackdrop(s, 'default');
    expect(s.backdrops.equipped).toBe('default');
  });

  it('refuses to equip a backdrop that isn’t owned', () => {
    const s = getDefaultState();
    expect(equipBackdrop(s, 'pink')).toBe(s); // unchanged
  });
});
