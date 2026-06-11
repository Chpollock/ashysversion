// Data-driven shop catalog. Add items here without touching components.
//
// Each item:
//   { id, category, name, description, price, thumb (null = placeholder),
//     grants: { type, id } }
//
// grants.type tells the purchase handler where to record ownership:
//   'furniture' → save.room.livingRoom.furniture.push(id)
//   'board'     → save.boards.owned.push(id)
//   'pieceSet'  → save.pieceSets.owned.push(id)
//   'pet'       → save.pets[id].unlocked = true
//   'song'      → save.music.lyricsUnlocked = true
//
// Every purchased id is also recorded in save.shop.purchased for the "owned" mark.

export const SHOP_CATEGORIES = [
  { id: 'furniture', label: 'Repairs & Furniture' },
  { id: 'cosmetics', label: 'Boards & Pieces' },
  { id: 'pets',      label: 'Pets' },
  { id: 'special',   label: 'Special' },
];

export const SHOP_ITEMS = [
  // ── Furniture ──────────────────────────────────────────────────────────────
  { id: 'cozyRug', category: 'furniture', name: 'Cozy Rug', price: 80, thumb: null,
    description: 'Soft underfoot. Ties the room together.',
    grants: { type: 'furniture', id: 'cozyRug' } },
  { id: 'warmLamp', category: 'furniture', name: 'Warm Lamp', price: 120, thumb: null,
    description: 'Golden light for long evenings.',
    grants: { type: 'furniture', id: 'warmLamp' } },
  { id: 'wallArt', category: 'furniture', name: 'Framed Print', price: 150, thumb: null,
    description: 'A little art for a bare wall.',
    grants: { type: 'furniture', id: 'wallArt' } },

  // ── Boards & Pieces ──────────────────────────────────────────────────────────
  { id: 'feltBoard', category: 'cosmetics', name: 'Anniversary Felt Board', price: 400, thumb: null,
    description: 'A handmade board, soft green felt. (art coming soon)',
    grants: { type: 'board', id: 'felt' } },
  { id: 'feltPieces', category: 'cosmetics', name: 'Felt Piece Set', price: 250, thumb: null,
    description: 'Matching pieces for the felt board.',
    grants: { type: 'pieceSet', id: 'felt' } },

  // ── Pets ─────────────────────────────────────────────────────────────────────
  { id: 'remy', category: 'pets', name: 'Remy', price: 300, thumb: null,
    description: 'A calm little companion who naps in the corner.',
    grants: { type: 'pet', id: 'remy' } },
  { id: 'hammy', category: 'pets', name: 'Hammy', price: 600, thumb: null,
    description: 'Smaller, rounder, somehow always busy.',
    grants: { type: 'pet', id: 'hammy' } },

  // ── Special ──────────────────────────────────────────────────────────────────
  { id: 'songLyrics', category: 'special', name: 'A Song for Ashy', price: 1000, thumb: null,
    description: 'The one with the words. Saved for a special moment.',
    grants: { type: 'song', id: 'lyrics' } },
];

export const SHOP_ITEM_BY_ID = Object.fromEntries(SHOP_ITEMS.map(i => [i.id, i]));

// Is an item already owned, given the current save?
export function isOwned(item, save) {
  if (save.shop.purchased.includes(item.id)) return true;
  switch (item.grants.type) {
    case 'furniture': return save.room.livingRoom.furniture.includes(item.grants.id);
    case 'board':     return save.boards.owned.includes(item.grants.id);
    case 'pieceSet':  return save.pieceSets.owned.includes(item.grants.id);
    case 'pet':       return !!save.pets[item.grants.id]?.unlocked;
    case 'song':      return !!save.music.lyricsUnlocked;
    default:          return false;
  }
}

// Apply a purchase to a save object (pure — returns next save). Caller checks affordability.
export function applyPurchase(save, item) {
  const next = {
    ...save,
    pennies: save.pennies - item.price,
    shop: { ...save.shop, purchased: [...save.shop.purchased, item.id] },
  };
  const g = item.grants;
  switch (g.type) {
    case 'furniture':
      next.room = {
        ...save.room,
        livingRoom: {
          ...save.room.livingRoom,
          furniture: [...save.room.livingRoom.furniture, g.id],
        },
      };
      break;
    case 'board':
      next.boards = { ...save.boards, owned: [...save.boards.owned, g.id] };
      break;
    case 'pieceSet':
      next.pieceSets = { ...save.pieceSets, owned: [...save.pieceSets.owned, g.id] };
      break;
    case 'pet':
      next.pets = { ...save.pets, [g.id]: { ...save.pets[g.id], unlocked: true } };
      break;
    case 'song':
      next.music = { ...save.music, lyricsUnlocked: true };
      break;
    default:
      break;
  }
  return next;
}
