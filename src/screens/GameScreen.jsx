import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import BackgammonBoard from '../components/BackgammonBoard.jsx';
import Dice from '../components/Dice.jsx';
import { gameReducer, createInitialState } from '../game/gameLogic.js';
import { getAIMoves } from '../game/ai.js';
import { loadState, saveState } from '../state/saveState.js';

const AI_THINK_MS = 900;   // pause before Charlie starts moving
const AI_MOVE_MS  = 500;   // pause between each of Charlie's moves

export default function GameScreen({ audioRef }) {
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialState);
  const [appState, setAppState] = useState(loadState);
  const [showWin, setShowWin] = useState(false);
  const [muted, setMuted] = useState(false);
  const aiTimers = useRef([]);

  // Sync mute toggle to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted, audioRef]);

  // Clear all pending AI timers on unmount
  useEffect(() => () => aiTimers.current.forEach(clearTimeout), []);

  // Watch for win
  useEffect(() => {
    if (gameState.phase === 'gameover' && gameState.winner === 'ashton') {
      const updated = {
        ...appState,
        pennies: appState.pennies + 50,
        stats: {
          ...appState.stats,
          gamesPlayed: appState.stats.gamesPlayed + 1,
          gamesWon: appState.stats.gamesWon + 1,
          currentWinStreak: appState.stats.currentWinStreak + 1,
          bestWinStreak: Math.max(
            appState.stats.bestWinStreak,
            appState.stats.currentWinStreak + 1
          ),
        },
      };
      setAppState(updated);
      saveState(updated);
      setTimeout(() => setShowWin(true), 400);
    } else if (gameState.phase === 'gameover' && gameState.winner === 'charlie') {
      const updated = {
        ...appState,
        stats: {
          ...appState.stats,
          gamesPlayed: appState.stats.gamesPlayed + 1,
          currentWinStreak: 0,
        },
      };
      setAppState(updated);
      saveState(updated);
    }
  }, [gameState.phase, gameState.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI turn orchestration
  useEffect(() => {
    if (gameState.currentPlayer !== 'charlie') return;
    if (gameState.phase === 'gameover') return;

    if (gameState.phase === 'rolling') {
      // Charlie rolls automatically
      const t = setTimeout(() => dispatch({ type: 'ROLL_DICE' }), AI_THINK_MS);
      aiTimers.current.push(t);
      return () => clearTimeout(t);
    }

    if (gameState.phase === 'moving') {
      // Get Charlie's full move sequence and play them out with delays
      const moves = getAIMoves(gameState, 2);

      if (!moves.length) {
        const t = setTimeout(() => dispatch({ type: 'END_TURN' }), AI_THINK_MS);
        aiTimers.current.push(t);
        return () => clearTimeout(t);
      }

      moves.forEach((move, i) => {
        const t = setTimeout(() => {
          dispatch({ type: 'MOVE_PIECE', from: move.from, to: move.to });
        }, AI_THINK_MS + i * AI_MOVE_MS);
        aiTimers.current.push(t);
      });

      // Safety fallback: end turn if not already ended by the last MOVE_PIECE
      const endT = setTimeout(() => {
        dispatch({ type: 'END_TURN' }); // no-op if phase is already 'rolling'
      }, AI_THINK_MS + moves.length * AI_MOVE_MS + 200);
      aiTimers.current.push(endT);
    }
  }, [gameState.currentPlayer, gameState.phase, gameState.dice.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewGame() {
    aiTimers.current.forEach(clearTimeout);
    aiTimers.current = [];
    setShowWin(false);
    dispatch({ type: 'NEW_GAME' });
  }

  const isAshtonTurn = gameState.currentPlayer === 'ashton';
  const turnLabel = isAshtonTurn ? "Ashy's turn" : "Charlie's turn";

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #f5e8c8 0%, #eedcaa 50%, #e5cc90 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 8px 24px',
      boxSizing: 'border-box',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Header bar */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        padding: '0 4px',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 'normal',
          color: '#5a3a1a',
          letterSpacing: 0.5,
        }}>
          Ashy's Version
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Pennies */}
          <span style={{ fontSize: 13, color: '#8a6030' }}>
            🪙 {appState.pennies}
          </span>
          {/* Mute */}
          <button
            onPointerDown={() => setMuted(m => !m)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔉'}
          </button>
        </div>
      </div>

      {/* Turn indicator */}
      <div style={{
        fontSize: 13,
        color: isAshtonTurn ? '#7a4a20' : '#a07040',
        fontStyle: 'italic',
        marginBottom: 6,
        letterSpacing: 0.5,
        opacity: gameState.phase === 'gameover' ? 0 : 1,
      }}>
        {turnLabel}
      </div>

      {/* Board */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <BackgammonBoard
          state={gameState}
          onSelectPiece={(pt) => dispatch({ type: 'SELECT_PIECE', point: pt })}
          onMovePiece={(from, to) => dispatch({ type: 'MOVE_PIECE', from, to })}
        />
      </div>

      {/* Dice + roll button */}
      <div style={{ marginTop: 16 }}>
        <Dice
          dice={gameState.dice}
          usedDice={gameState.usedDice}
          phase={gameState.phase}
          currentPlayer={gameState.currentPlayer}
          onRoll={() => dispatch({ type: 'ROLL_DICE' })}
        />
      </div>

      {/* Win overlay */}
      {showWin && gameState.winner && (
        <WinOverlay
          winner={gameState.winner}
          penniesEarned={gameState.winner === 'ashton' ? 50 : 0}
          onPlayAgain={handleNewGame}
        />
      )}

      {/* Charlie wins — subtle message, no overlay */}
      {gameState.phase === 'gameover' && gameState.winner === 'charlie' && !showWin && (
        <div style={{
          marginTop: 20,
          textAlign: 'center',
          fontStyle: 'italic',
          color: '#8a5a30',
          fontSize: 14,
        }}>
          <p style={{ margin: '0 0 12px' }}>Charlie wins this round.</p>
          <button onPointerDown={handleNewGame} style={playAgainStyle}>
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

const playAgainStyle = {
  padding: '10px 28px',
  borderRadius: 20,
  border: '2px solid #b8843c',
  background: 'linear-gradient(135deg, #e8b45a, #c8862a)',
  color: '#fff8e7',
  fontFamily: 'Georgia, serif',
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(139,100,30,0.3)',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
};

function WinOverlay({ winner, penniesEarned, onPlayAgain }) {
  const isAshton = winner === 'ashton';
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(80,50,10,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      animation: 'fadeIn 0.4s ease',
      padding: 24,
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #fffdf0, #f5e8c0)',
        borderRadius: 24,
        padding: '36px 32px',
        textAlign: 'center',
        maxWidth: 320,
        width: '100%',
        boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        border: '2px solid #d4aa60',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {isAshton ? '✨' : '🎲'}
        </div>
        <h2 style={{
          margin: '0 0 8px',
          fontSize: 26,
          fontFamily: 'Georgia, serif',
          fontWeight: 'normal',
          color: '#5a3010',
        }}>
          {isAshton ? 'You won!' : 'Charlie wins!'}
        </h2>
        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          color: '#8a6030',
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
        }}>
          {isAshton
            ? `+${penniesEarned} pennies earned ✨`
            : 'Better luck next time!'}
        </p>
        <button onPointerDown={onPlayAgain} style={playAgainStyle}>
          Play again
        </button>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
