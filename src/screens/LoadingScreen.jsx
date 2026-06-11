import { useEffect, useState } from 'react';
import houseImg from '../assets/loading-house.png';

export default function LoadingScreen({ onEnter, audioRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in after mount
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleTap() {
    // iOS requires audio.play() inside a user gesture
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    onEnter();
  }

  return (
    <div
      onPointerDown={handleTap}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
        userSelect: 'none',
        overflow: 'hidden',
        background: '#1a1008',
      }}
    >
      {/* House image fills screen */}
      <img
        src={houseImg}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
        }}
      />

      {/* Title — placed in the warm sky area */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(32px, 9vw, 52px)',
            fontWeight: 'normal',
            color: '#fff8e7',
            textShadow: '0 2px 24px rgba(80,40,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
            letterSpacing: 2,
            lineHeight: 1.2,
          }}
        >
          Ashy's Version
        </h1>
      </div>

      {/* Tap to enter prompt */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          animation: 'loadingPulse 2.2s ease-in-out infinite',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(14px, 4vw, 18px)',
            color: 'rgba(255,248,231,0.85)',
            letterSpacing: 3,
            textTransform: 'uppercase',
            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
          }}
        >
          tap to enter
        </p>
      </div>

      {/* Credit */}
      <div
        style={{
          position: 'absolute',
          bottom: '5%',
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(11px, 3vw, 13px)',
            color: 'rgba(255,248,231,0.55)',
            fontStyle: 'italic',
            letterSpacing: 0.5,
          }}
        >
          Designed by Player 2. Because she's Player 1.
        </p>
      </div>

      <style>{`
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
