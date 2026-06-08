import { useState, useEffect } from 'react';

const DOT_POSITIONS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DieFace({ value, used, rolling, isDouble }) {
  const dots = DOT_POSITIONS[value] || DOT_POSITIONS[1];
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: used
          ? 'rgba(139,109,56,0.25)'
          : isDouble
          ? 'linear-gradient(135deg, #fff8e7, #ffe4a0)'
          : 'linear-gradient(135deg, #fffdf5, #f5e9c8)',
        border: used
          ? '2px solid rgba(139,109,56,0.2)'
          : isDouble
          ? '2px solid #c8962a'
          : '2px solid #d4aa60',
        boxShadow: used
          ? 'none'
          : isDouble
          ? '0 2px 8px rgba(200,150,42,0.4), inset 0 1px 0 rgba(255,255,255,0.8)'
          : '0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
        position: 'relative',
        transition: 'all 0.2s',
        transform: rolling ? 'rotate(var(--spin, 0deg))' : 'none',
        opacity: used ? 0.45 : 1,
        flexShrink: 0,
      }}
    >
      {dots.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: used ? 'rgba(139,109,56,0.4)' : '#7a5430',
            left: `calc(${x}% - 3.5px)`,
            top: `calc(${y}% - 3.5px)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Dice({ dice, usedDice, phase, onRoll, currentPlayer }) {
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState(dice);
  const [spinAngles, setSpinAngles] = useState([]);

  useEffect(() => {
    if (dice.length > 0) setDisplayDice(dice);
  }, [dice]);

  const isDoubles = dice.length === 4;
  const canRoll = phase === 'rolling' && currentPlayer === 'ashton';

  function handleRoll() {
    if (!canRoll || rolling) return;
    setRolling(true);
    // Randomize spin angles for animation
    setSpinAngles([
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
    ]);
    setTimeout(() => {
      setRolling(false);
      onRoll();
    }, 600);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Dice faces */}
      {displayDice.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {displayDice.map((val, i) => (
            <div
              key={i}
              style={{ '--spin': `${spinAngles[i] || 0}deg` }}
            >
              <DieFace
                value={val}
                used={usedDice.includes(i)}
                rolling={rolling}
                isDouble={isDoubles}
              />
            </div>
          ))}
          {isDoubles && !rolling && (
            <div style={{
              fontSize: 11,
              color: '#c8962a',
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              letterSpacing: 0.5,
              marginLeft: 2,
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
            padding: '10px 28px',
            borderRadius: 20,
            border: '2px solid #b8843c',
            background: rolling
              ? 'linear-gradient(135deg, #c8962a, #a0721e)'
              : 'linear-gradient(135deg, #e8b45a, #c8862a)',
            color: '#fff8e7',
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fontWeight: 'bold',
            letterSpacing: 1,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(139,100,30,0.35), inset 0 1px 0 rgba(255,255,220,0.4)',
            transform: rolling ? 'scale(0.96)' : 'scale(1)',
            transition: 'all 0.15s',
            userSelect: 'none',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {rolling ? '...' : 'Roll'}
        </button>
      )}

      {/* Waiting indicator during Charlie's turn */}
      {phase === 'rolling' && currentPlayer === 'charlie' && (
        <div style={{
          fontSize: 13,
          color: '#a07040',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          opacity: 0.7,
        }}>
          Charlie is thinking...
        </div>
      )}
    </div>
  );
}
