import { useState, useEffect, useRef } from 'react';

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
function DieFace({ value, used, isDouble, hoverable, active }) {
  const dots = DOT_POSITIONS[value] || DOT_POSITIONS[1];
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, position: 'relative',
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
      opacity: used && !active ? 0.5 : 1,
      transform: active ? 'translateY(-2px) scale(1.05)' : 'none',
      transition: 'opacity 0.2s, transform 0.12s, box-shadow 0.12s',
      cursor: hoverable ? 'pointer' : 'default',
    }}>
      {dots.map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute', width: 7, height: 7, borderRadius: '50%',
          background: used && !active ? 'rgba(139,109,56,0.45)' : '#7a5430',
          left: `calc(${x}% - 3.5px)`, top: `calc(${y}% - 3.5px)`,
        }} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dice({ dice, usedDice, dieMoves = {}, phase, onRoll, currentPlayer, onHoverDie }) {
  // 'idle' | 'throwing' | 'settling' | 'resting'
  const [throwState, setThrowState] = useState('idle');
  // Random faces shown DURING the throw (same length as the real dice)
  const [flyFaces, setFlyFaces] = useState([]);
  const [activeDie, setActiveDie] = useState(null); // die index currently pressed/hovered

  const timersRef    = useRef([]);
  const intervalsRef = useRef([]);
  const diceRef      = useRef(dice);
  useEffect(() => { diceRef.current = dice; }, [dice]);

  // Reset to idle on a new rolling phase
  useEffect(() => {
    if (phase === 'rolling') {
      timersRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
      timersRef.current = [];
      intervalsRef.current = [];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThrowState('idle');
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
    };
  }, [phase]);

  const canRoll   = phase === 'rolling' && currentPlayer === 'ashton';
  const isDoubles = dice.length === 4;
  const isThrowing = throwState === 'throwing';
  const isSettling = throwState === 'settling';

  function setHover(i) {
    setActiveDie(i);
    onHoverDie?.(i);
  }

  function handleRoll() {
    if (!canRoll || throwState !== 'idle') return;

    // Dispatch first — the reducer resolves the real dice (2 or 4 for doubles),
    // which arrive in the `dice` prop on the next render. We render straight from
    // that, so the count is always correct (doubles always shows four dice).
    onRoll();
    setThrowState('throwing');

    // Cycle random faces, sized to however many dice the roll produced
    const id = setInterval(() => {
      const n = diceRef.current.length || 2;
      setFlyFaces(Array.from({ length: n }, () => Math.ceil(Math.random() * 6)));
    }, 60);
    intervalsRef.current.push(id);

    const t1 = setTimeout(() => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      setThrowState('settling');
    }, 650);
    timersRef.current.push(t1);

    const t2 = setTimeout(() => setThrowState('resting'), 850);
    timersRef.current.push(t2);
  }

  // Always render one face per real die. During the throw, overlay cycling values
  // (deterministic fallback to the real die so render stays pure).
  const count = dice.length;
  const faces = Array.from({ length: count }, (_, i) =>
    isThrowing ? (flyFaces[i] ?? dice[i] ?? 1) : dice[i]
  );

  // A die is hoverable (to reveal which piece it moved) once it's been used this turn
  const canHover = currentPlayer === 'ashton' && phase === 'moving';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <style>{KEYFRAMES}</style>

      {/* Dice faces */}
      {count > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {faces.map((val, i) => {
            const used = !isThrowing && usedDice.includes(i);
            const hoverable = canHover && used && !!dieMoves[i];
            const faceAnim = isThrowing ? 'dieFaceSpin 0.65s linear both' : 'none';
            const wrapperAnim = isThrowing
              ? 'dieFlightWrapper 0.68s cubic-bezier(0.25,0.46,0.45,0.94) both'
              : isSettling
              ? 'dieSettle 0.18s ease-out both'
              : 'none';
            const wrapperDelay = isThrowing ? `${i * 90}ms` : '0ms';

            return (
              <div
                key={i}
                onPointerEnter={hoverable ? () => setHover(i) : undefined}
                onPointerLeave={hoverable ? () => setHover(null) : undefined}
                onPointerDown={hoverable ? () => setHover(i) : undefined}
                onPointerUp={hoverable ? () => setHover(null) : undefined}
                onPointerCancel={hoverable ? () => setHover(null) : undefined}
                style={{
                  animation: wrapperAnim, animationDelay: wrapperDelay,
                  willChange: isThrowing || isSettling ? 'transform' : 'auto',
                }}
              >
                <div style={{ animation: faceAnim }}>
                  <DieFace
                    value={val}
                    used={used}
                    isDouble={!isThrowing && isDoubles}
                    hoverable={hoverable}
                    active={activeDie === i}
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
            }}>
              doubles!
            </div>
          )}
        </div>
      )}

      {/* Roll button */}
      {canRoll && (
        <button
          onPointerDown={handleRoll}
          style={{
            padding: '10px 28px', borderRadius: 20,
            border: '2px solid #b8843c',
            background: 'linear-gradient(135deg, #e8b45a, #c8862a)',
            color: '#fff8e7',
            fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 'bold',
            letterSpacing: 1, cursor: 'pointer',
            userSelect: 'none', touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            animation: throwState === 'idle' ? 'rollButtonBreathe 2.2s ease-in-out infinite' : 'none',
            animationFillMode: 'both',
          }}
        >
          Roll
        </button>
      )}

      {/* Hint to mouse/press a used die */}
      {canHover && Object.keys(dieMoves).length > 0 && (
        <div style={{ fontSize: 10.5, color: '#a07a4a', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          tap a used die to see what it moved
        </div>
      )}

      {/* Charlie's animated thinking dots */}
      {phase === 'rolling' && currentPlayer === 'charlie' && (
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
