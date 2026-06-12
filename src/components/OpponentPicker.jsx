// Pre-game picker for Charlie's difficulty tier and play style.
// Opens from the chip on GameScreen before the first roll. Locked entries show
// how many more wins they need — unlocks are by career wins, never Pennies.

import { AI_TIERS, AI_STYLES } from '../game/aiOpponents.js';

export default function OpponentPicker({ gamesWon, tier, style, onPick, onClose }) {
  return (
    <div
      onPointerDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, padding: 22,
        background: 'rgba(70,45,12,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.25s ease',
        fontFamily: 'Georgia, serif',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg,#fffdf2,#f3e6c4)',
          borderRadius: 24, padding: '24px 22px', maxWidth: 340, width: '100%',
          border: '2px solid #d4aa60', boxShadow: '0 8px 48px rgba(0,0,0,0.45)',
          maxHeight: '88dvh', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 'normal', color: '#5a3010', textAlign: 'center' }}>
          Who's across the table?
        </h2>

        <Section title="Charlie's mood">
          {AI_TIERS.map(t => (
            <OptionRow
              key={t.id}
              emoji={t.emoji}
              name={t.name}
              description={t.description}
              tag={`🪙 ×${t.rewardMultiplier}`}
              selected={tier === t.id}
              locked={gamesWon < t.unlockWins}
              winsNeeded={t.unlockWins - gamesWon}
              onTap={() => onPick({ tier: t.id })}
            />
          ))}
        </Section>

        <Section title="Charlie's strategy">
          {AI_STYLES.map(s => (
            <OptionRow
              key={s.id}
              emoji={s.emoji}
              name={s.name}
              description={s.description}
              selected={style === s.id}
              locked={gamesWon < s.unlockWins}
              winsNeeded={s.unlockWins - gamesWon}
              onTap={() => onPick({ style: s.id })}
            />
          ))}
        </Section>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button onPointerDown={onClose} style={{
            padding: '10px 26px', borderRadius: 18,
            border: '2px solid #b8843c', background: 'linear-gradient(135deg,#e8b45a,#c8862a)',
            color: '#fff8e7', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontSize: 12, color: '#a07a40', fontStyle: 'italic',
        letterSpacing: 0.5, marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function OptionRow({ emoji, name, description, tag, selected, locked, winsNeeded, onTap }) {
  return (
    <button
      onPointerDown={locked ? undefined : onTap}
      disabled={locked}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        padding: '8px 12px', borderRadius: 14, width: '100%',
        border: selected ? '2px solid #d4942a' : '1.5px solid rgba(150,110,60,0.3)',
        background: selected
          ? 'linear-gradient(135deg,#fff6dc,#f6e2a8)'
          : 'rgba(255,250,235,0.5)',
        opacity: locked ? 0.55 : 1,
        cursor: locked ? 'default' : 'pointer',
        fontFamily: 'Georgia, serif',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}
    >
      <span style={{ fontSize: 20 }}>{locked ? '🔒' : emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, color: '#6a4310', fontWeight: selected ? 'bold' : 'normal' }}>
          {name}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: '#8a6a40', fontStyle: 'italic' }}>
          {locked
            ? `win ${winsNeeded} more game${winsNeeded === 1 ? '' : 's'}`
            : description}
        </span>
      </span>
      {tag && !locked && (
        <span style={{ fontSize: 11, color: '#b8843c', whiteSpace: 'nowrap' }}>{tag}</span>
      )}
      {selected && <span style={{ fontSize: 14, color: '#c8862a' }}>✓</span>}
    </button>
  );
}
