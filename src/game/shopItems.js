// Data-driven catalog for COSMETICS (Boards & Pieces). Projects live in
// roomStates.js, pet arrivals in petSpots.js — the shop screen pulls from all
// three. The Song is a gift, not a purchase (see RoomScreen's song gift).
//
// Each item:
//   { id, category, name, description, price, thumb (null = placeholder),
//     grants: { type, id } }
//
// grants.type tells the purchase handler where to record ownership:
//   'board'    → save.boards.owned.push(id)
//   'pieceSet' → save.pieceSets.owned.push(id)
//
// Every purchased id is also recorded in save.shop.purchased for the "owned" mark.

export const SHOP_ITEMS = [
  { id: 'feltBoard', category: 'cosmetics', name: 'Anniversary Felt Board', price: 400, thumb: null,
    description: 'A handmade board, soft green felt. (art coming soon)',
    grants: { type: 'board', id: 'felt' } },
  { id: 'feltPieces', category: 'cosmetics', name: 'Felt Piece Set', price: 250, thumb: null,
    description: 'Matching pieces for the felt board.',
    grants: { type: 'pieceSet', id: 'felt' } },
];

export const SHOP_ITEM_BY_ID = Object.fromEntries(SHOP_ITEMS.map(i => [i.id, i]));

// Is an item already owned, given the current save?
export function isOwned(item, save) {
  if (save.shop.purchased.includes(item.id)) return true;
  switch (item.grants.type) {
    case 'board':    return save.boards.owned.includes(item.grants.id);
    case 'pieceSet': return save.pieceSets.owned.includes(item.grants.id);
    default:         return false;
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
    case 'board':
      next.boards = { ...save.boards, owned: [...save.boards.owned, g.id] };
      break;
    case 'pieceSet':
      next.pieceSets = { ...save.pieceSets, owned: [...save.pieceSets.owned, g.id] };
      break;
    default:
      break;
  }
  return next;
}
