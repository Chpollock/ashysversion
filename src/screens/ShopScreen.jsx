import { useState } from 'react';
import { SHOP_CATEGORIES, SHOP_ITEMS, isOwned, applyPurchase } from '../game/shopItems.js';

export default function ShopScreen({ save, updateSave, onBack }) {
  const [activeCat, setActiveCat] = useState(SHOP_CATEGORIES[0].id);
  const [justBought, setJustBought] = useState(null); // item id, for a brief confirm pulse

  const items = SHOP_ITEMS.filter(i => i.category === activeCat);

  function handleBuy(item) {
    if (isOwned(item, save)) return;
    if (save.pennies < item.price) return;
    updateSave(s => applyPurchase(s, item));
    setJustBought(item.id);
    setTimeout(() => setJustBought(null), 900);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #f3e3bf 0%, #e9d49e 100%)',
      fontFamily: 'Georgia, serif',
      display: 'flex', flexDirection: 'column',
      padding: '14px 12px 28px', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onPointerDown={onBack} style={backBtnStyle} aria-label="Back to room">‹ Room</button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 'normal', color: '#5a3a1a' }}>The Little Shop</h2>
        <span style={{
          fontSize: 14, color: '#8a6030', display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,240,200,0.7)', borderRadius: 14, padding: '4px 10px',
          border: '1px solid rgba(180,140,70,0.4)',
        }}>
          🪙 {save.pennies}
        </span>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SHOP_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onPointerDown={() => setActiveCat(cat.id)}
            style={{
              padding: '6px 12px', borderRadius: 14,
              border: '1.5px solid ' + (activeCat === cat.id ? '#b8843c' : 'rgba(150,110,60,0.3)'),
              background: activeCat === cat.id ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'rgba(255,250,235,0.6)',
              color: activeCat === cat.id ? '#fff8e7' : '#7a5430',
              fontFamily: 'Georgia, serif', fontSize: 12.5, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {items.map(item => {
          const owned = isOwned(item, save);
          const afford = save.pennies >= item.price;
          const bought = justBought === item.id;
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,252,242,0.85)',
              border: '1px solid rgba(180,140,70,0.35)',
              borderRadius: 16, padding: 12,
              boxShadow: bought ? '0 0 0 2px #d4aa60, 0 4px 14px rgba(200,150,40,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'box-shadow 0.25s',
            }}>
              {/* Thumbnail placeholder */}
              <div style={{
                width: 54, height: 54, borderRadius: 12, flexShrink: 0,
                background: item.thumb ? `url(${item.thumb}) center/cover` : 'repeating-linear-gradient(45deg,#e7d6ad,#e7d6ad 6px,#dcc89a 6px,#dcc89a 12px)',
                border: '1px dashed rgba(140,100,50,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#9a7a4a', textAlign: 'center',
              }}>
                {!item.thumb && 'art\nTBD'}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: '#5a3a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.name}
                  {owned && <span style={{
                    fontSize: 10, color: '#6a8a4a', border: '1px solid #8aa86a',
                    borderRadius: 8, padding: '1px 6px', fontStyle: 'italic',
                  }}>owned</span>}
                </div>
                <div style={{ fontSize: 12, color: '#8a6f50', fontStyle: 'italic', marginTop: 2 }}>
                  {item.description}
                </div>
              </div>

              {/* Price / buy */}
              {owned ? (
                <span style={{ fontSize: 18, color: '#8aa86a' }}>✓</span>
              ) : (
                <button
                  onPointerDown={() => handleBuy(item)}
                  disabled={!afford}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px', borderRadius: 12,
                    border: '1.5px solid ' + (afford ? '#b8843c' : 'rgba(150,110,60,0.25)'),
                    background: afford ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'transparent',
                    color: afford ? '#fff8e7' : 'rgba(140,110,70,0.55)',
                    fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold',
                    cursor: afford ? 'pointer' : 'default',
                    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🪙 {item.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: 'rgba(255,250,235,0.6)',
  border: '1px solid rgba(150,110,60,0.3)',
  borderRadius: 12, padding: '6px 12px',
  color: '#7a5430', fontFamily: 'Georgia, serif', fontSize: 13,
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};
