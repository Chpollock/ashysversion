// Post-game overlay. Always: result + Pennies earned (first-win bonus called out),
// one fun snippet, then any newly-unlocked achievement cards. No stat dump.

export default function PostGameScreen({ summary, onPlayAgain, onBackToRoom }) {
  if (!summary) return null;
  const { result, payout, snippet, newAchievements, isFirstWinOfDay } = summary;
  const won = result === 'win';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, padding: 22,
      background: 'rgba(70,45,12,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.35s ease',
      fontFamily: 'Georgia, serif',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn { 0% { opacity: 0; transform: translateY(10px) scale(0.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div style={{
        background: 'linear-gradient(160deg,#fffdf2,#f3e6c4)',
        borderRadius: 24, padding: '30px 26px', maxWidth: 340, width: '100%',
        textAlign: 'center', border: '2px solid #d4aa60',
        boxShadow: '0 8px 48px rgba(0,0,0,0.45)',
        maxHeight: '88dvh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 44, marginBottom: 4 }}>{won ? '✨' : '🎲'}</div>
        <h2 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 'normal', color: '#5a3010' }}>
          {won ? 'You won!' : 'Charlie wins'}
        </h2>

        {/* Pennies earned */}
        <div style={{ margin: '10px 0 6px', fontSize: 17, color: '#7a5430' }}>
          🪙 +{payout.total} Pennies
        </div>
        {isFirstWinOfDay && payout.firstWinBonus > 0 && (
          <div style={{ fontSize: 12.5, color: '#c8862a', fontStyle: 'italic', marginBottom: 2 }}>
            includes +{payout.firstWinBonus} first win of the day!
          </div>
        )}
        {payout.streakBonus > 0 && (
          <div style={{ fontSize: 12, color: '#a07a40', fontStyle: 'italic' }}>
            +{payout.streakBonus} win-streak bonus
          </div>
        )}

        {/* One snippet */}
        <p style={{
          margin: '16px 0 4px', fontSize: 14, color: '#6a4a28', fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          {snippet}
        </p>

        {/* Newly unlocked achievements */}
        {newAchievements.length > 0 && (
          <div style={{ margin: '16px 0 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {newAchievements.map((a, i) => (
              <div key={a.id} style={{
                background: 'linear-gradient(135deg,#fff6dc,#f6e2a8)',
                border: '1.5px solid #d8b256', borderRadius: 14,
                padding: '8px 12px', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                animation: `cardIn 0.4s ease-out ${0.15 + i * 0.12}s both`,
              }}>
                <span style={{ fontSize: 22 }}>🏆</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: '#6a4310', fontWeight: 'bold' }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: '#8a6a40', fontStyle: 'italic' }}>{a.description}</div>
                </div>
                {a.reward > 0 && (
                  <span style={{ fontSize: 12, color: '#b8843c', whiteSpace: 'nowrap' }}>+{a.reward}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
          <button onPointerDown={onPlayAgain} style={primaryBtn}>Play again</button>
          <button onPointerDown={onBackToRoom} style={secondaryBtn}>Back to the room</button>
        </div>
      </div>
    </div>
  );
}

const primaryBtn = {
  padding: '10px 20px', borderRadius: 18,
  border: '2px solid #b8843c', background: 'linear-gradient(135deg,#e8b45a,#c8862a)',
  color: '#fff8e7', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold',
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};

const secondaryBtn = {
  padding: '10px 18px', borderRadius: 18,
  border: '1.5px solid rgba(120,80,40,0.4)', background: 'rgba(120,80,40,0.08)',
  color: '#7a5430', fontFamily: 'Georgia, serif', fontSize: 14,
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};
