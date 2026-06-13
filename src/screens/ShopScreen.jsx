import { useState, useEffect } from 'react';
import { SHOP_ITEMS, FEATURED_ITEMS, isOwned, applyPurchase, equipBackdrop } from '../game/shopItems.js';
import { BACKDROPS, BACKDROP_BY_ID, backdropBackground } from '../game/backdrops.js';
import { nextProject, beginProject, projectDone, PROJECTS, formatDuration } from '../game/roomStates.js';
import { PETS, PET_ARRIVALS } from '../game/petSpots.js';

const TABS = [
  { id: 'featured', label: '✨ Featured' },
  { id: 'projects', label: 'Projects' },
  { id: 'pets', label: 'Pets' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'cosmetics', label: 'Boards & Pieces' },
];

export default function ShopScreen({ save, updateSave, onBack }) {
  const [tab, setTab] = useState('featured');
  const [justBought, setJustBought] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick so arrival/build countdowns stay live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function flash(id) {
    setJustBought(id);
    setTimeout(() => setJustBought(null), 900);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #f3e3bf 0%, #e9d49e 100%)',
      fontFamily: 'Georgia, serif',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(14px + env(safe-area-inset-top)) 12px calc(28px + env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {TABS.map(t => (
          <button key={t.id} onPointerDown={() => setTab(t.id)} style={{
            padding: '6px 12px', borderRadius: 14,
            border: '1.5px solid ' + (tab === t.id ? '#b8843c' : 'rgba(150,110,60,0.3)'),
            background: tab === t.id ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'rgba(255,250,235,0.6)',
            color: tab === t.id ? '#fff8e7' : '#7a5430',
            fontFamily: 'Georgia, serif', fontSize: 12.5, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {tab === 'featured' && <FeaturedTab save={save} updateSave={updateSave} flash={flash} justBought={justBought} />}
        {tab === 'projects' && <ProjectsTab save={save} updateSave={updateSave} now={now} flash={flash} justBought={justBought} />}
        {tab === 'pets' && <PetsTab save={save} updateSave={updateSave} now={now} flash={flash} justBought={justBought} />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'cosmetics' && <CosmeticsTab save={save} updateSave={updateSave} flash={flash} justBought={justBought} />}
      </div>
    </div>
  );
}

// ── Featured: highlighted purchasable items (data-driven via `featured`) ──────
function FeaturedTab({ save, updateSave, flash, justBought }) {
  if (!FEATURED_ITEMS.length) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: '#8a6f50', fontStyle: 'italic' }}>
          Nothing featured right now — check back soon. ✨
        </div>
      </Card>
    );
  }
  return FEATURED_ITEMS.map(item => {
    // Backdrops get a swatch + buy/equip; other featured items use a plain row.
    if (item.grants.type === 'backdrop') {
      return (
        <BackdropRow key={item.id} backdrop={BACKDROP_BY_ID[item.grants.id]} item={item}
          save={save} updateSave={updateSave} flash={flash} justBought={justBought} />
      );
    }
    const owned = isOwned(item, save);
    const afford = save.pennies >= item.price;
    return (
      <Card key={item.id} highlight={justBought === item.id}>
        <Row emoji="✨" title={item.name} subtitle={item.description}
          right={owned
            ? <span style={{ fontSize: 18, color: '#8aa86a' }}>✓</span>
            : (
              <button onPointerDown={() => { if (afford) { updateSave(s => applyPurchase(s, item)); flash(item.id); } }}
                disabled={!afford} style={buyBtn(afford)}>🪙 {item.price}</button>
            )} />
      </Card>
    );
  });
}

// A backdrop: swatch preview + buy (if a shop item) → equip → equipped.
function BackdropRow({ backdrop, item, save, updateSave, flash, justBought }) {
  const owned = (save.backdrops?.owned ?? ['default']).includes(backdrop.id);
  const equipped = (save.backdrops?.equipped ?? 'default') === backdrop.id;
  const afford = item ? save.pennies >= item.price : true;

  let right;
  if (equipped) {
    right = <span style={{ fontSize: 13, color: '#8aa86a', fontStyle: 'italic' }}>equipped ✓</span>;
  } else if (owned) {
    right = (
      <button onPointerDown={() => updateSave(s => equipBackdrop(s, backdrop.id))} style={equipBtn}>
        equip
      </button>
    );
  } else if (item) {
    right = (
      <button onPointerDown={() => { if (afford) { updateSave(s => applyPurchase(s, item)); flash(item.id); } }}
        disabled={!afford} style={buyBtn(afford)}>🪙 {backdrop.cost}</button>
    );
  }

  const swatch = (
    <div style={{
      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
      background: backdropBackground(backdrop.id),
      border: '1px solid rgba(140,100,50,0.3)',
      boxShadow: equipped ? '0 0 0 2px #c8862a' : 'inset 0 1px 2px rgba(0,0,0,0.08)',
    }} />
  );

  return (
    <Card highlight={!!item && justBought === item.id}>
      <Row swatch={swatch} title={backdrop.name} subtitle={backdrop.description} right={right} />
    </Card>
  );
}

// ── Projects: mirrors the room's next project ─────────────────────────────────
function ProjectsTab({ save, updateSave, now, flash, justBought }) {
  const project = nextProject(save);
  const active = save.activeProject;
  const done = save.roomStateIndex;

  if (!project) {
    return (
      <Card>
        <div style={{ fontSize: 26, marginBottom: 4 }}>🏡</div>
        <div style={{ fontSize: 15, color: '#5a3a1a' }}>The room is complete.</div>
        <div style={{ fontSize: 12.5, color: '#8a6f50', fontStyle: 'italic', marginTop: 4 }}>
          Not a house anymore. Home.
        </div>
      </Card>
    );
  }

  const building = active && active.id === project.id && now < active.completesAt;
  const ready = active && active.id === project.id && now >= active.completesAt;
  const afford = save.pennies >= project.cost;

  return (
    <>
      <div style={{ fontSize: 12, color: '#8a6f50', fontStyle: 'italic', textAlign: 'center' }}>
        {done} of {PROJECTS.length} projects complete
      </div>
      <Card highlight={justBought === project.id}>
        <div style={{ fontSize: 16, color: '#5a3a1a', marginBottom: 4 }}>{project.name}</div>
        <div style={{ fontSize: 12.5, color: '#8a6f50', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.45 }}>
          {project.teaser}
        </div>
        {ready ? (
          <div style={{ fontSize: 13.5, color: '#b8843c', fontWeight: 'bold' }}>
            ✨ It’s ready — go see it in the room
          </div>
        ) : building ? (
          <div style={{ fontSize: 13, color: '#7a5430' }}>
            🧰 Underway — ready in {formatDuration(Math.max(0, active.completesAt - now))}
          </div>
        ) : (
          <button
            onPointerDown={() => {
              if (!afford || active) return;
              updateSave(s => beginProject(s, project));
              flash(project.id);
            }}
            disabled={!afford}
            style={buyBtn(afford)}
          >
            {afford ? `🪙 ${project.cost} · takes ${formatDuration(project.durationMs)}` : `🪙 ${project.cost} — a few more Pennies first`}
          </button>
        )}
      </Card>
    </>
  );
}

// ── Pets: they arrive, they aren't bought ─────────────────────────────────────
function PetsTab({ save, updateSave, now, flash, justBought }) {
  return (
    <>
      {/* Boombox — already home */}
      <Card>
        <Row
          emoji={PETS.boombox.emoji}
          title="Boombox"
          subtitle="Came with the house. Wouldn’t leave if you asked."
          right={<span style={{ fontSize: 14, color: '#8aa86a' }}>home ✓</span>}
        />
      </Card>

      {Object.values(PET_ARRIVALS).map(arr => {
        const pet = PETS[arr.petId];
        const st = save.pets[arr.petId];
        const available = projectDone(save, arr.requiresProject);
        const arriving = !!st?.arrivesAt && !st.unlocked;
        const home = !!st?.unlocked;
        const afford = save.pennies >= arr.price;

        let right;
        if (home) {
          right = <span style={{ fontSize: 14, color: '#8aa86a' }}>home ✓</span>;
        } else if (arriving) {
          right = (
            <span style={{ fontSize: 12, color: '#a07a40', fontStyle: 'italic' }}>
              on the way… {formatDuration(Math.max(1000, st.arrivesAt - now))}
            </span>
          );
        } else if (available) {
          right = (
            <button
              onPointerDown={() => {
                if (!afford) return;
                updateSave(s => ({
                  ...s,
                  pennies: s.pennies - arr.price,
                  pets: { ...s.pets, [arr.petId]: { ...s.pets[arr.petId], arrivesAt: Date.now() + arr.arrivalMs } },
                }));
                flash(arr.petId);
              }}
              disabled={!afford}
              style={buyBtn(afford)}
            >
              🪙 {arr.price}
            </button>
          );
        }

        return (
          <Card key={arr.petId} highlight={justBought === arr.petId}>
            <Row
              emoji={available || home || arriving ? pet.emoji : '🌫️'}
              dim={!available && !home && !arriving}
              title={available || home || arriving ? arr.itemName : '???'}
              subtitle={home
                ? 'Settled in like they were always here.'
                : arriving ? 'Small footsteps, getting closer.'
                : available ? arr.teaser
                : arr.lockedHint}
              right={right}
            />
          </Card>
        );
      })}
    </>
  );
}

// ── Rooms: the kitchen waits ──────────────────────────────────────────────────
function RoomsTab() {
  return (
    <>
      <Card>
        <Row emoji="🛋️" title="The Living Room" subtitle="Where it all started." right={<span style={{ fontSize: 14, color: '#8aa86a' }}>✓</span>} />
      </Card>
      <Card dim>
        <Row emoji="🍳" dim title="The Kitchen" subtitle="Coming soon." right={<span style={{ fontSize: 13 }}>🔒</span>} />
      </Card>
    </>
  );
}

// ── Boards & Pieces (cosmetics) + backdrops equip ─────────────────────────────
function CosmeticsTab({ save, updateSave, flash, justBought }) {
  const cosmetics = SHOP_ITEMS.filter(i => i.category === 'cosmetics');
  return (
    <>
      {cosmetics.map(item => {
        const owned = isOwned(item, save);
        const afford = save.pennies >= item.price;
        return (
          <Card key={item.id} highlight={justBought === item.id}>
            <Row
              emoji="🎲"
              title={item.name}
              subtitle={item.description}
              right={owned
                ? <span style={{ fontSize: 18, color: '#8aa86a' }}>✓</span>
                : (
                  <button
                    onPointerDown={() => { if (afford) { updateSave(s => applyPurchase(s, item)); flash(item.id); } }}
                    disabled={!afford}
                    style={buyBtn(afford)}
                  >
                    🪙 {item.price}
                  </button>
                )}
            />
          </Card>
        );
      })}

      {/* Backdrops — owned ones equippable here (so she can always switch back) */}
      <div style={{ fontSize: 12, color: '#a07a40', fontStyle: 'italic', letterSpacing: 0.5, margin: '6px 2px -2px' }}>
        Backdrops
      </div>
      {BACKDROPS.map(b => (
        <BackdropRow key={b.id} backdrop={b}
          item={SHOP_ITEMS.find(i => i.grants.type === 'backdrop' && i.grants.id === b.id)}
          save={save} updateSave={updateSave} flash={flash} justBought={justBought} />
      ))}
    </>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Card({ children, highlight = false, dim = false }) {
  return (
    <div style={{
      background: 'rgba(255,252,242,0.85)',
      border: '1px solid rgba(180,140,70,0.35)',
      borderRadius: 16, padding: 14,
      opacity: dim ? 0.65 : 1,
      boxShadow: highlight ? '0 0 0 2px #d4aa60, 0 4px 14px rgba(200,150,40,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.25s',
      textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

function Row({ emoji, swatch, title, subtitle, right, dim = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
      {swatch ?? (
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: 'rgba(230,210,160,0.5)', border: '1px solid rgba(140,100,50,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, opacity: dim ? 0.45 : 1, filter: dim ? 'grayscale(0.7)' : 'none',
        }}>
          {emoji}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: '#5a3a1a' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#8a6f50', fontStyle: 'italic', marginTop: 2, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      {right}
    </div>
  );
}

function buyBtn(afford) {
  return {
    flexShrink: 0,
    padding: '8px 12px', borderRadius: 12,
    border: '1.5px solid ' + (afford ? '#b8843c' : 'rgba(150,110,60,0.25)'),
    background: afford ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'transparent',
    color: afford ? '#fff8e7' : 'rgba(140,110,70,0.55)',
    fontFamily: 'Georgia, serif', fontSize: 12.5, fontWeight: 'bold',
    cursor: afford ? 'pointer' : 'default',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  };
}

const equipBtn = {
  flexShrink: 0,
  padding: '7px 14px', borderRadius: 12,
  border: '1.5px solid rgba(150,110,60,0.45)', background: 'rgba(255,250,235,0.75)',
  color: '#7a5430', fontFamily: 'Georgia, serif', fontSize: 12.5,
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  whiteSpace: 'nowrap',
};

const backBtnStyle = {
  background: 'rgba(255,250,235,0.6)',
  border: '1px solid rgba(150,110,60,0.3)',
  borderRadius: 12, padding: '6px 12px',
  color: '#7a5430', fontFamily: 'Georgia, serif', fontSize: 13,
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};
