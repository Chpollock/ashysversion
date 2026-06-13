import { useState, useEffect, useRef } from 'react';

// Dice UI, split in two:
//   <DiceFaces>    — the dice themselves, rendered ON the board (each player's
//                    half, like a real game). Animates every roll via rollId.
//   <RollControls> — the Roll button / Charlie's thinking dots / hover hint,
//                    rendered below the board.

// ─── Dot layout per face ──────────────────────────────────────────────────────
const DOT_POSITIONS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

// ─── Animation keyframes ──────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes dieFlightWrapper {
    0%   { transform: translate(130px, -30px) scale(0.5) rotate(-20deg); opacity: 0; }
    15%  { opacity: 1; }
    70%  { transform: translate(0, -10px) scale(1.08) rotate(4deg); }
    84%  { transform: translate(0, 5px) scale(0.97) rotate(-2deg); }
    93%  { transform: translate(0, -3px) scale(1.02) rotate(1deg); }
    100% { transform: translate(0, 0) scale(1) rotate(0deg); }
  }
  @keyframes dieFaceSpin {
    0%   { transform: perspective(160px) rotateX(0deg)   rotateY(0deg)   rotateZ(0deg); }
    50%  { transform: perspective(160px) rotateX(270deg) rotateY(180deg) rotateZ(90deg); }
    100% { transform: perspective(160px) rotateX(540deg) rotateY(360deg) rotateZ(180deg); }
  }
  @keyframes dieSettle {
    0%   { transform: rotateZ(4deg) scale(1.07); }
    50%  { transform: rotateZ(-2deg) scale(1.01); }
    100% { transform: rotateZ(0deg) scale(1); }
  }
  @keyframes rollButtonBreathe {
    0%, 100% { transform: scale(1);    box-shadow: 0 3px 10px rgba(139,100,30,0.35), inset 0 1px 0 rgba(255,255,220,0.4); }
    50%       { transform: scale(1.04); box-shadow: 0 5px 18px rgba(139,100,30,0.55), inset 0 1px 0 rgba(255,255,220,0.4); }
  }
  @keyframes thinkDot {
    0%, 60%, 100% { transform: scale(0.7); opacity: 0.4; }
    30%            { transform: scale(1.2); opacity: 1; }
  }
`;

// ─── Single die face ──────────────────────────────────────────────────────────
function DieFace({ value, used, dead, isDouble, hoverable, active, size = 44 }) {
  const dots = DOT_POSITIONS[value] || DOT_POSITIONS[1];
  const dot = Math.max(5, Math.round(size * 0.16));
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.23), position: 'relative',
      flexShrink: 0,
      background: used
        ? 'rgba(139,109,56,0.22)'
        : isDouble
        ? 'linear-gradient(135deg, #fff8e7, #ffe4a0)'
        : 'linear-gradient(135deg, #fffdf5, #f5e9c8)',
      border: active
        ? '2px solid #e6a02a'
        : used
        ? '2px solid rgba(139,109,56,0.2)'
        : isDouble
        ? '2px solid #c8962a'
        : '2px solid #d4aa60',
      boxShadow: active
        ? '0 0 0 2px rgba(230,160,42,0.5), 0 2px 10px rgba(200,150,42,0.5)'
        : used
        ? 'none'
        : isDouble
        ? '0 2px 8px rgba(200,150,42,0.4), inset 0 1px 0 rgba(255,255,255,0.8)'
        : '0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
      opacity: dead ? 0.5 : used && !active ? 0.55 : 1,
      transform: active ? 'translateY(-2px) scale(1.05)' : 'none',
      transition: 'opacity 0.2s, transform 0.12s, box-shadow 0.12s',
      cursor: hoverable ? 'pointer' : 'default',
    }}>
      {dots.map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute', width: dot, height: dot, borderRadius: '50%',
          background: used && !active ? 'rgba(139,109,56,0.45)' : '#7a5430',
          left: `calc(${x}% - ${dot / 2}px)`, top: `calc(${y}% - ${dot / 2}px)`,
        }} />
      ))}
      {/* Unplayable this turn — crossed out */}
      {dead && (
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <line x1="16" y1="16" x2="84" y2="84" stroke="rgba(170,70,40,0.85)" strokeWidth="9" strokeLinecap="round" />
          <line x1="84" y1="16" x2="16" y2="84" stroke="rgba(170,70,40,0.85)" strokeWidth="9" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Dice faces (rendered on the board) ───────────────────────────────────────
// rollId increments on every roll, so both players' throws animate.
export function DiceFaces({ dice, usedDice, dieMoves = {}, deadDice = [], phase, rollId = 0, onHoverDie, size = 36, label = null }) {
  // 'resting' | 'throwing' | 'settling'
  const [throwState, setThrowState] = useState('resting');
  const [flyFaces, setFlyFaces] = useState([]);
  const [activeDie, setActiveDie] = useState(null); // die index currently pressed/hovered
  // -1 so the roll that mounts this component (dice appearing) animates too
  const lastRollRef = useRef(-1);

  // Animate the throw whenever a new roll lands (skip the initial mount)
  useEffect(() => {
    if (rollId === lastRollRef.current || !dice.length) return;
    lastRollRef.current = rollId;
    setThrowState('throwing');

    const spin = setInterval(() => {
      setFlyFaces(Array.from({ length: dice.length }, () => Math.ceil(Math.random() * 6)));
    }, 60);
    const t1 = setTimeout(() => { clearInterval(spin); setThrowState('settling'); }, 650);
    const t2 = setTimeout(() => setThrowState('resting'), 850);

    return () => { clearInterval(spin); clearTimeout(t1); clearTimeout(t2); };
  }, [rollId, dice.length]);

  if (!dice.length) return null;

  const isDoubles = dice.length === 4;
  const isThrowing = throwState === 'throwing';
  const isSettling = throwState === 'settling';

  function setHover(i) {
    setActiveDie(i);
    onHoverDie?.(i);
  }

  // A die is hoverable (to reveal which piece it moved) once it's been used —
  // during EITHER side's turn, and after a turn ends while the dice still rest.
  const canHover = phase === 'moving' || phase === 'rolling';

  const faces = dice.map((val, i) => (isThrowing ? (flyFaces[i] ?? val) : val));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <style>{KEYFRAMES}</style>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {faces.map((val, i) => {
          const used = !isThrowing && usedDice.includes(i);
          const dead = !isThrowing && !used && deadDice.includes(i);
          const hoverable = canHover && used && !!dieMoves[i];
          const faceAnim = isThrowing ? 'dieFaceSpin 0.65s linear both' : 'none';
          // Stagger via the shorthand's delay slot (mixing the `animation`
          // shorthand with a separate animationDelay upsets React)
          const wrapperAnim = isThrowing
            ? `dieFlightWrapper 0.68s cubic-bezier(0.25,0.46,0.45,0.94) ${i * 90}ms both`
            : isSettling
            ? 'dieSettle 0.18s ease-out both'
            : 'none';

          return (
            <div
              key={i}
              onPointerEnter={hoverable ? () => setHover(i) : undefined}
              onPointerLeave={hoverable ? () => setHover(null) : undefined}
              onPointerDown={hoverable ? (e) => { e.stopPropagation(); setHover(i); } : undefined}
              onPointerUp={hoverable ? () => setHover(null) : undefined}
              onPointerCancel={hoverable ? () => setHover(null) : undefined}
              style={{
                animation: wrapperAnim,
                willChange: isThrowing || isSettling ? 'transform' : 'auto',
                // The overlay wrapper is pointer-transparent; only hoverable
                // dice opt back in (so they never block board taps).
                pointerEvents: hoverable ? 'auto' : 'none',
              }}
            >
              <div style={{ animation: faceAnim }}>
                <DieFace
                  value={val}
                  used={used}
                  dead={dead}
                  isDouble={!isThrowing && isDoubles}
                  hoverable={hoverable}
                  active={activeDie === i}
                  size={size}
                />
              </div>
            </div>
          );
        })}
        {isDoubles && throwState === 'resting' && (
          <div style={{
            fontSize: 11, color: '#c8962a',
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            letterSpacing: 0.5, marginLeft: 2,
            textShadow: '0 1px 2px rgba(255,250,230,0.8)',
          }}>
            doubles!
          </div>
        )}
      </div>
      {label && (
        <div style={{
          fontSize: 10, color: '#6a4a28', fontFamily: 'Georgia, serif',
          fontStyle: 'italic', letterSpacing: 0.4,
          background: 'rgba(255,250,235,0.65)', padding: '1px 8px', borderRadius: 8,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Roll button / thinking dots / hint (below the board) ─────────────────────
export function RollControls({ phase, currentPlayer, dieMoves = {}, onRoll }) {
  const canRoll = phase === 'rolling' && currentPlayer === 'ashton';
  const canHoverHint = currentPlayer === 'ashton' && phase === 'moving' && Object.keys(dieMoves).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <style>{KEYFRAMES}</style>

      {canRoll && (
        <button
          onPointerDown={onRoll}
          style={{
            padding: '10px 28px', borderRadius: 20,
            border: '2px solid #b8843c',
            background: 'linear-gradient(135deg, #e8b45a, #c8862a)',
            color: '#fff8e7',
            fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 'bold',
            letterSpacing: 1, cursor: 'pointer',
            userSelect: 'none', touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            animation: 'rollButtonBreathe 2.2s ease-in-out infinite',
            animationFillMode: 'both',
          }}
        >
          Roll
        </button>
      )}

      {canHoverHint && (
        <div style={{ fontSize: 10.5, color: '#a07a4a', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          tap a used die to see what it moved
        </div>
      )}

      {(phase === 'rolling' || phase === 'moving') && currentPlayer === 'charlie' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 24 }}>
          <span style={{
            fontSize: 11, color: '#a07040',
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            letterSpacing: 0.3, marginRight: 2,
          }}>
            Charlie
          </span>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#b08040', flexShrink: 0,
              animation: `thinkDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              animationFillMode: 'both',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
