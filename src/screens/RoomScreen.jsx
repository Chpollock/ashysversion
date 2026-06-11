import { useState, useEffect, useRef } from 'react';
import roomImg from '../assets/living-room-start.png';
import { REPAIRS, FURNITURE_BY_ID, FIXTURES } from '../game/roomItems.js';
import { PETS, getSpot } from '../game/petSpots.js';

const PET_TAP_COOLDOWN_MS = 1200;

// Repair status helper. Returns 'none' | 'fixing' | 'ready' | 'done'.
function repairStatus(save, id, now) {
  const state = save.room.livingRoom.repairs[id];
  if (state === 'done') return 'done';
  if (state === 'in-progress') {
    const t = save.room.livingRoom.repairTimers[id];
    return t && now >= t ? 'ready' : 'fixing';
  }
  return 'none';
}

export default function RoomScreen({
  save, updateSave, onEnterGame, onOpenShop,
  muted, onToggleMute, welcomeBack,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [repairCardId, setRepairCardId] = useState(null); // open repair card
  const [revealing, setRevealing] = useState({});         // { id: true } during reveal anim
  const [petReactions, setPetReactions] = useState({});   // { petId: { emoji, key } }
  const [showWelcome, setShowWelcome] = useState(welcomeBack);
  const petTapCooldown = useRef({});                      // { petId: lastTapTs }

  // Tick once a second so "fixing" timers flip to "ready" live (no reload needed)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fade out the welcome-back moment after a beat
  useEffect(() => {
    if (!welcomeBack) return;
    const t = setTimeout(() => setShowWelcome(false), 2600);
    return () => clearTimeout(t);
  }, [welcomeBack]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function startRepair(item) {
    if (save.pennies < item.price) return;
    updateSave(s => ({
      ...s,
      pennies: s.pennies - item.price,
      room: {
        ...s.room,
        livingRoom: {
          ...s.room.livingRoom,
          repairs: { ...s.room.livingRoom.repairs, [item.id]: 'in-progress' },
          repairTimers: { ...s.room.livingRoom.repairTimers, [item.id]: Date.now() + item.durationMs },
        },
      },
    }));
    setRepairCardId(null);
  }

  // Tapping a "Ready!" hotspot — she witnesses the change here, never automatically
  function completeRepair(item) {
    updateSave(s => ({
      ...s,
      room: {
        ...s.room,
        livingRoom: {
          ...s.room.livingRoom,
          repairs: { ...s.room.livingRoom.repairs, [item.id]: 'done' },
        },
      },
    }));
    setRevealing(r => ({ ...r, [item.id]: true }));
    setTimeout(() => setRevealing(r => ({ ...r, [item.id]: false })), 900);
  }

  // Tap a pet — heart + a small per-pet reaction, with a cooldown so it stays charming
  function tapPet(petId) {
    const last = petTapCooldown.current[petId] || 0;
    if (Date.now() - last < PET_TAP_COOLDOWN_MS) return;
    petTapCooldown.current[petId] = Date.now();
    const reactions = PETS[petId].tapReactions;
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    setPetReactions(r => ({ ...r, [petId]: { emoji, key: Date.now() } }));
    setTimeout(() => {
      setPetReactions(r => {
        const next = { ...r };
        delete next[petId];
        return next;
      });
    }, 1100);
  }

  function collectGift(gift) {
    updateSave(s => ({
      ...s,
      pennies: s.pennies + gift.amount,
      stats: { ...s.stats, totalPenniesEarned: s.stats.totalPenniesEarned + gift.amount },
      pendingGifts: s.pendingGifts.filter(g => g.id !== gift.id),
    }));
  }

  const placedFurniture = save.room.livingRoom.furniture
    .map(id => FURNITURE_BY_ID[id]).filter(Boolean);

  // Pets currently in the room (unlocked, not away, placed at a known spot)
  const visiblePets = Object.keys(PETS)
    .map(petId => {
      const st = save.pets[petId];
      if (!st?.unlocked || st.away || !st.spotId) return null;
      const def = PETS[petId];
      const spot = getSpot(petId, st.spotId);
      if (!spot) return null;
      return { petId, def, spot };
    })
    .filter(Boolean);

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      fontFamily: 'Georgia, serif', background: '#2a2018',
    }}>
      <style>{`
        @keyframes roomReveal { 0% { opacity: 0; transform: scale(0.85); } 60% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes readyGlow { 0%,100% { box-shadow: 0 0 0 2px rgba(245,200,80,0.6), 0 0 16px rgba(245,200,80,0.5); } 50% { box-shadow: 0 0 0 3px rgba(245,200,80,0.9), 0 0 26px rgba(245,200,80,0.8); } }
        @keyframes fixingPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.85; } }
        @keyframes floatHeart { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-46px) scale(1.1); } }
        @keyframes giftBob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-6px); } }
        @keyframes welcomeIn { 0% { opacity: 0; transform: translate(-50%, -8px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes petBreathe { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.015); } }
        @keyframes petTapPop { 0% { opacity: 0; transform: translate(-50%,0) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-40px) scale(1.1); } }
      `}</style>

      {/* Room image */}
      <img src={roomImg} alt="living room" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />

      {/* Placed furniture overlays */}
      {placedFurniture.map(f => (
        <Overlay key={f.id} overlay={f.overlay} label={f.name} />
      ))}

      {/* Completed repair overlays */}
      {REPAIRS.map(item => {
        if (repairStatus(save, item.id, now) !== 'done') return null;
        return (
          <div key={`done-${item.id}`} style={{
            animation: revealing[item.id] ? 'roomReveal 0.9s ease-out' : 'none',
          }}>
            <Overlay overlay={item.overlay} label={`${item.name} (fixed)`} />
          </div>
        );
      })}

      {/* Repair hotspots */}
      {REPAIRS.map(item => {
        const status = repairStatus(save, item.id, now);
        if (status === 'done') return null;
        const h = item.hotspot;
        const common = {
          position: 'absolute', left: `${h.x}%`, top: `${h.y}%`,
          width: `${h.w}%`, height: `${h.h}%`, borderRadius: 10,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          zIndex: 5,
        };
        if (status === 'none') {
          return (
            <div key={item.id} onPointerDown={() => setRepairCardId(item.id)} style={{
              ...common,
              background: 'rgba(120,40,30,0.28)',
              border: '2px dashed rgba(160,60,40,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>⚠</div>
          );
        }
        if (status === 'fixing') {
          return (
            <div key={item.id} style={{
              ...common, cursor: 'default',
              background: 'rgba(80,90,120,0.3)',
              border: '2px solid rgba(150,170,200,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              animation: 'fixingPulse 1.4s ease-in-out infinite',
            }}>fixing…</div>
          );
        }
        // ready
        return (
          <div key={item.id} onPointerDown={() => completeRepair(item)} style={{
            ...common,
            background: 'rgba(245,200,80,0.25)',
            border: '2px solid rgba(245,200,80,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff8e0', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            animation: 'readyGlow 1.2s ease-in-out infinite',
          }}>Ready!</div>
        );
      })}

      {/* Game box hotspot */}
      <div onPointerDown={onEnterGame} style={{
        position: 'absolute',
        left: `${FIXTURES.gameBox.hotspot.x}%`, top: `${FIXTURES.gameBox.hotspot.y}%`,
        width: `${FIXTURES.gameBox.hotspot.w}%`, height: `${FIXTURES.gameBox.hotspot.h}%`,
        cursor: 'pointer', zIndex: 6, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        borderRadius: 12,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        <span style={{
          marginBottom: 6, fontSize: 12, color: '#fff8e0',
          background: 'rgba(60,35,10,0.6)', padding: '3px 10px', borderRadius: 12,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>Play ▸</span>
      </div>

      {/* Pets — each at its current spot, breathing gently, tappable */}
      {visiblePets.map(({ petId, def, spot }) => (
        <Pet
          key={petId}
          def={def}
          spot={spot}
          reaction={petReactions[petId]}
          onTap={() => tapPet(petId)}
        />
      ))}

      {/* Pending gifts — glowing pouches at the spots pets vacated */}
      {save.pendingGifts.map(gift => {
        const pos = gift.position || { x: 50, y: 70 }; // tolerate legacy gifts
        return (
          <div key={gift.id} onPointerDown={() => collectGift(gift)} style={{
            position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
            transform: 'translate(-50%, 0)',
            zIndex: (gift.zOrder ?? 6) + 1, cursor: 'pointer',
            animation: 'giftBob 1.6s ease-in-out infinite',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            fontSize: 26, filter: 'drop-shadow(0 0 8px rgba(245,200,80,0.9))',
          }}>🎁</div>
        );
      })}

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        <span style={{
          pointerEvents: 'auto',
          fontSize: 15, color: '#5a3a1a', fontWeight: 'bold',
          background: 'rgba(255,240,200,0.9)', borderRadius: 16, padding: '5px 12px',
          border: '1px solid rgba(180,140,70,0.5)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>🪙 {save.pennies}</span>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button onPointerDown={onToggleMute} style={hudBtn} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔉'}
          </button>
          <button onPointerDown={onOpenShop} style={hudBtn} aria-label="Shop">🛍️</button>
        </div>
      </div>

      {/* Welcome back moment */}
      {showWelcome && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', zIndex: 25,
          animation: 'welcomeIn 0.5s ease-out', pointerEvents: 'none',
          background: 'rgba(60,40,15,0.82)', color: '#ffeec8',
          padding: '8px 18px', borderRadius: 18, fontStyle: 'italic', fontSize: 14,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
        }}>
          The room is glad to see you ✨
        </div>
      )}

      {/* Repair card modal */}
      {repairCardId && (() => {
        const item = REPAIRS.find(r => r.id === repairCardId);
        const afford = save.pennies >= item.price;
        return (
          <div onPointerDown={() => setRepairCardId(null)} style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: 'rgba(30,20,10,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div onPointerDown={e => e.stopPropagation()} style={{
              background: 'linear-gradient(160deg,#fffdf2,#f3e6c4)',
              borderRadius: 20, padding: '24px 26px', maxWidth: 300, width: '100%',
              textAlign: 'center', border: '2px solid #d4aa60', boxShadow: '0 8px 36px rgba(0,0,0,0.4)',
            }}>
              <h3 style={{ margin: '0 0 6px', fontWeight: 'normal', color: '#5a3a1a', fontSize: 20 }}>{item.name}</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#8a6f50', fontStyle: 'italic' }}>{item.description}</p>
              <div style={{ fontSize: 13, color: '#7a5430', marginBottom: 16 }}>
                Cost: 🪙 {item.price} &nbsp;·&nbsp; Time: {formatDuration(item.durationMs)}
              </div>
              <button
                onPointerDown={() => startRepair(item)}
                disabled={!afford}
                style={{
                  padding: '10px 24px', borderRadius: 16,
                  border: '2px solid ' + (afford ? '#b8843c' : 'rgba(150,110,60,0.3)'),
                  background: afford ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'transparent',
                  color: afford ? '#fff8e7' : 'rgba(140,110,70,0.6)',
                  fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold',
                  cursor: afford ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}
              >
                {afford ? 'Start the repair' : 'Not enough Pennies yet'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// A pet at a spot. Shows its pose image, or a clearly-marked placeholder when the
// art doesn't exist yet. Gentle breathing loop = "alive". Tap → heart + reaction.
function Pet({ def, spot, reaction, onTap }) {
  const size = 11; // % of room width
  return (
    <div
      onPointerDown={onTap}
      style={{
        position: 'absolute', left: `${spot.position.x}%`, top: `${spot.position.y}%`,
        width: `${size}%`, paddingTop: `${size}%`,
        transform: 'translate(-50%,-50%)',
        zIndex: spot.zOrder ?? 6, cursor: 'pointer',
        animation: 'petBreathe 4s ease-in-out infinite',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}
    >
      {spot.pose ? (
        <img src={spot.pose} alt={def.name} draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))',
        }} />
      ) : (
        // Clearly-marked placeholder — replace by setting `pose` on the spot in petSpots.js
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: def.placeholderColor,
          border: '2px dashed rgba(255,255,255,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{def.emoji}</span>
          <span style={{ fontSize: 8, color: 'rgba(40,25,10,0.8)', marginTop: 1 }}>{def.name}</span>
        </div>
      )}

      {/* Tap reaction */}
      {reaction && (
        <div key={reaction.key} style={{
          position: 'absolute', top: -6, left: '50%',
          fontSize: 20, pointerEvents: 'none',
          animation: 'petTapPop 1.1s ease-out forwards',
        }}>
          {reaction.emoji}
        </div>
      )}
    </div>
  );
}

// Placeholder-aware overlay renderer
function Overlay({ overlay, label }) {
  const o = overlay;
  return (
    <div style={{
      position: 'absolute', left: `${o.x}%`, top: `${o.y}%`,
      width: `${o.w}%`, height: `${o.h}%`, zIndex: o.z ?? 2,
      pointerEvents: 'none',
      background: o.image ? `url(${o.image}) center/contain no-repeat` : o.color,
      borderRadius: 8,
      border: o.image ? 'none' : '1px dashed rgba(255,255,255,0.35)',
      display: o.image ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, color: 'rgba(255,255,255,0.85)', textAlign: 'center',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    }}>
      {!o.image && label}
    </div>
  );
}

function formatDuration(ms) {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)} min`;
  return `${Math.round(ms / 3600000)} hr`;
}

const hudBtn = {
  background: 'rgba(255,240,200,0.9)', border: '1px solid rgba(180,140,70,0.5)',
  borderRadius: 14, padding: '5px 10px', fontSize: 16, lineHeight: 1, cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};
