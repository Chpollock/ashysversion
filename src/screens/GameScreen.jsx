import { useReducer, useEffect, useRef, useState } from 'react';
import BackgammonBoard from '../components/BackgammonBoard.jsx';
import Dice from '../components/Dice.jsx';
import PostGameScreen from './PostGameScreen.jsx';
import { gameReducer, createInitialState, rollDiceValues } from '../game/gameLogic.js';
import { getAIMoves } from '../game/ai.js';
import { computePayout } from '../game/economy.js';
import { pickSnippet } from '../game/events.js';
import { evaluateAchievements } from '../game/achievements.js';

const AI_THINK_MS = 1100;  // pause before Charlie's first move (he's "thinking")
const AI_MOVE_MS  = 950;   // gap between each of Charlie's moves — slow enough to follow

// ─── Move description for Charlie's toast ─────────────────────────────────────
function describeMoveForToast(move, stateBefore) {
  const { points } = stateBefore;
  const isHit = move.to !== 'off'
    && move.to !== 'bar'
    && typeof move.to === 'number'
    && points[move.to]?.player === 'ashton'
    && points[move.to]?.count === 1;

  // Use 1-indexed point numbers so they match what's printed on a real board
  const fromLabel = move.from === 'bar' ? 'bar' : String(move.from + 1);
  const toLabel   = move.to   === 'off' ? 'home' : String(move.to + 1);

  if (isHit)               return { text: `Charlie hits! ${fromLabel} → ${toLabel}`, isHit: true };
  if (move.from === 'bar') return { text: `Charlie enters bar → ${toLabel}`, isHit: false };
  if (move.to === 'off')   return { text: `Charlie bears off ${fromLabel}`, isHit: false };
  return { text: `Charlie  ${fromLabel} → ${toLabel}`, isHit: false };
}

// ─── Local sub-components ─────────────────────────────────────────────────────

function TurnBanner({ banner }) {
  if (!banner) return null;
  const isAshton = banner.variant === 'ashton';
  return (
    <>
      <style>{`
        @keyframes bannerIn {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.95); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1); }
        }
      `}</style>
      <div style={{
        position: 'absolute', top: -38, left: '50%',
        zIndex: 40, pointerEvents: 'none',
        animation: 'bannerIn 0.25s ease-out both',
        animationFillMode: 'both',
      }}>
        <div style={{
          background: isAshton
            ? 'linear-gradient(135deg, #f5c840, #d4942a)'
            : 'rgba(110,78,44,0.88)',
          color: isAshton ? '#4a2800' : '#f0dfc0',
          padding: '7px 20px', borderRadius: 20,
          fontSize: 13, fontFamily: 'Georgia, serif', fontStyle: 'italic',
          letterSpacing: 0.5, whiteSpace: 'nowrap',
          boxShadow: isAshton
            ? '0 4px 16px rgba(200,140,20,0.45)'
            : '0 4px 14px rgba(0,0,0,0.25)',
          border: isAshton ? '1px solid rgba(255,220,80,0.55)' : 'none',
        }}>
          {banner.message}
        </div>
      </div>
    </>
  );
}

function MoveToast({ toast }) {
  if (!toast) return null;
  return (
    <>
      <style>{`
        @keyframes toastPop {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.88) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) scale(1)    translateY(0); }
        }
      `}</style>
      <div style={{
        position: 'absolute', bottom: -40, left: '50%',
        zIndex: 40, pointerEvents: 'none',
        animation: 'toastPop 0.2s ease-out both',
      }}>
        <div style={{
          background: toast.isHit ? 'rgba(175,55,18,0.9)' : 'rgba(72,48,22,0.85)',
          color: toast.isHit ? '#ffe0cc' : '#f5e8cc',
          padding: '6px 14px', borderRadius: 16,
          fontSize: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic',
          letterSpacing: 0.3, whiteSpace: 'nowrap',
          boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
        }}>
          {toast.text}
        </div>
      </div>
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GameScreen({ save, updateSave, muted, onToggleMute, onBackToRoom }) {
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialState);

  // Post-game summary (null until a game settles)
  const [summary, setSummary] = useState(null);
  const settledRef = useRef(false);

  // Turn banner: { message, variant } | null
  const [banner, setBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  // Charlie move toast: { text, isHit } | null
  const [moveToast, setMoveToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Point flash for Charlie's landing (brief, bright — the move happening NOW)
  const [flashPoint, setFlashPoint] = useState(null);
  const flashTimerRef = useRef(null);

  // Persistent trail: every point Charlie moved a piece TO this turn.
  const [charlieTrail, setCharlieTrail] = useState([]);

  // Which die index Ashton is currently hovering/pressing (to reveal its move)
  const [hoverDie, setHoverDie] = useState(null);

  const aiTimers = useRef([]);

  // Ref so AI closures always read the latest game state for move descriptions
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    aiTimers.current.forEach(clearTimeout);
    clearTimeout(bannerTimerRef.current);
    clearTimeout(toastTimerRef.current);
    clearTimeout(flashTimerRef.current);
  }, []);

  // ── Turn announcement banner ──────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase !== 'rolling' || gameState.phase === 'gameover') return;
    clearTimeout(bannerTimerRef.current);

    const next = gameState.currentPlayer === 'ashton'
      ? { message: 'Your turn!', variant: 'ashton' }
      : { message: "Charlie's thinking…", variant: 'charlie' };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBanner(next);

    bannerTimerRef.current = setTimeout(() => setBanner(null), 1800);
  }, [gameState.currentPlayer, gameState.phase]);

  // ── Clear Charlie's trail once Ashton actually rolls (starts her move phase) ──
  useEffect(() => {
    if (gameState.currentPlayer === 'ashton' && gameState.phase === 'moving') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharlieTrail([]);
    }
  }, [gameState.currentPlayer, gameState.phase]);

  // ── Game settle: economy + achievements, computed exactly once ──────────────
  useEffect(() => {
    if (gameState.phase !== 'gameover') { settledRef.current = false; return; }
    if (settledRef.current) return;
    settledRef.current = true;

    const won = gameState.winner === 'ashton';
    const result = won ? 'win' : 'loss';
    const isFirstWinOfDay = won && !save.firstWinOfDayDone;
    const newStreak = won ? save.stats.currentWinStreak + 1 : 0;
    const payout = computePayout({ won, isFirstWinOfDay, winStreak: newStreak });

    const statsAfter = {
      ...save.stats,
      gamesPlayed: save.stats.gamesPlayed + 1,
      gamesWon: save.stats.gamesWon + (won ? 1 : 0),
      currentWinStreak: newStreak,
      bestWinStreak: Math.max(save.stats.bestWinStreak, newStreak),
      gamesPlayedToday: save.stats.gamesPlayedToday + 1,
    };

    const ctx = {
      result,
      eventLog: gameState.eventLog,
      pipStats: gameState.pipStats,
      statsAfter,
      isFirstWinOfDay,
      save,
    };
    const newly = evaluateAchievements(ctx, save.achievements.unlocked);
    const achReward = newly.reduce((sum, a) => sum + a.reward, 0);
    const totalEarned = payout.total + achReward;

    updateSave(s => ({
      ...s,
      pennies: s.pennies + totalEarned,
      stats: { ...statsAfter, totalPenniesEarned: s.stats.totalPenniesEarned + totalEarned },
      firstWinOfDayDone: s.firstWinOfDayDone || isFirstWinOfDay,
      achievements: {
        ...s.achievements,
        unlocked: [...s.achievements.unlocked, ...newly.map(a => a.id)],
      },
    }));

    const snippet = pickSnippet(gameState.eventLog, result);
    setTimeout(() => {
      setSummary({ result, payout, snippet, newAchievements: newly, isFirstWinOfDay });
    }, 500);
  }, [gameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI turn orchestration ─────────────────────────────────────────────────
  // Each effect run owns its own timer list and clears it on cleanup, so React
  // StrictMode's mount→unmount→mount in dev can't leave duplicate timers running
  // (which would double-dispatch Charlie's moves).
  useEffect(() => {
    if (gameState.currentPlayer !== 'charlie') return;
    if (gameState.phase === 'gameover') return;

    const timers = [];
    const schedule = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

    if (gameState.phase === 'rolling') {
      schedule(() => dispatch({ type: 'ROLL_DICE', dice: rollDiceValues() }), AI_THINK_MS);
      return () => timers.forEach(clearTimeout);
    }

    // moving
    const moves = getAIMoves(gameState, 2);
    if (!moves.length) {
      schedule(() => dispatch({ type: 'END_TURN' }), AI_THINK_MS);
      return () => timers.forEach(clearTimeout);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCharlieTrail([]); // fresh trail for this turn

    moves.forEach((move, i) => {
      schedule(() => {
        const toast = describeMoveForToast(move, gameStateRef.current);
        clearTimeout(toastTimerRef.current);
        setMoveToast(toast);
        toastTimerRef.current = setTimeout(() => setMoveToast(null), 1600);

        if (typeof move.to === 'number') {
          clearTimeout(flashTimerRef.current);
          setFlashPoint(move.to);
          flashTimerRef.current = setTimeout(() => setFlashPoint(null), 1100);
        }

        // Trail follows the piece (handles a piece moved more than once on doubles)
        setCharlieTrail(prev => {
          const next = prev.filter(p => p !== move.from);
          if (typeof move.to === 'number' && !next.includes(move.to)) next.push(move.to);
          return next;
        });

        dispatch({ type: 'MOVE_PIECE', from: move.from, to: move.to });
      }, AI_THINK_MS + i * AI_MOVE_MS);
    });

    // Safety: end the turn if the last move didn't already (no-op if it did)
    schedule(() => dispatch({ type: 'END_TURN' }), AI_THINK_MS + moves.length * AI_MOVE_MS + 200);

    return () => timers.forEach(clearTimeout);
  }, [gameState.currentPlayer, gameState.phase, gameState.dice.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewGame() {
    aiTimers.current.forEach(clearTimeout);
    aiTimers.current = [];
    settledRef.current = false;
    setSummary(null);
    setBanner(null);
    setMoveToast(null);
    setFlashPoint(null);
    setCharlieTrail([]);
    dispatch({ type: 'NEW_GAME' });
  }

  function handleBackToRoom() {
    aiTimers.current.forEach(clearTimeout);
    aiTimers.current = [];
    onBackToRoom();
  }

  // Point to highlight when hovering a used die (the destination it moved to)
  const hoverMove = hoverDie != null ? gameState.dieMoves[hoverDie] : null;
  const hoverPoint = hoverMove && typeof hoverMove.to === 'number' ? hoverMove.to : null;

  const isAshtonTurn = gameState.currentPlayer === 'ashton';
  const showUndo = gameState.phase === 'moving'
    && isAshtonTurn
    && gameState.usedDice.length > 0
    && !!gameState.turnStartSnapshot;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #f5e8c8 0%, #eedcaa 50%, #e5cc90 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 8px 24px', boxSizing: 'border-box', fontFamily: 'Georgia, serif',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, padding: '0 4px',
      }}>
        <button onPointerDown={handleBackToRoom} style={{
          background: 'rgba(255,250,235,0.5)', border: '1px solid rgba(150,110,60,0.3)',
          borderRadius: 12, padding: '4px 10px', color: '#7a5430',
          fontFamily: 'Georgia, serif', fontSize: 12, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }} aria-label="Back to room">‹ Room</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#8a6030' }}>🪙 {save.pennies}</span>
          <button
            onPointerDown={onToggleMute}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔉'}
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <BackgammonBoard
          state={gameState}
          boardId={save.boards.equipped}
          pieceSet={save.pieceSets.equipped}
          flashPoint={flashPoint}
          charlieTrail={charlieTrail}
          hoverPoint={hoverPoint}
          onSelectPiece={(pt) => dispatch({ type: 'SELECT_PIECE', point: pt })}
          onMovePath={(steps) => dispatch({ type: 'MOVE_PATH', steps })}
        />
      </div>

      {/* Dice area — relative so the banner and toast can position against it */}
      <div style={{ marginTop: 16, position: 'relative' }}>
        <TurnBanner banner={banner} />
        <Dice
          dice={gameState.dice}
          usedDice={gameState.usedDice}
          dieMoves={gameState.dieMoves}
          phase={gameState.phase}
          currentPlayer={gameState.currentPlayer}
          onRoll={() => dispatch({ type: 'ROLL_DICE', dice: rollDiceValues() })}
          onHoverDie={setHoverDie}
        />
        <MoveToast toast={moveToast} />
      </div>

      {/* Undo button */}
      {showUndo && (
        <button
          onPointerDown={() => dispatch({ type: 'UNDO' })}
          style={{
            marginTop: 10,
            padding: '6px 18px', borderRadius: 14,
            border: '1.5px solid rgba(120,80,40,0.35)',
            background: 'rgba(120,80,40,0.1)',
            color: '#8a6030',
            fontFamily: 'Georgia, serif', fontSize: 13,
            cursor: 'pointer', letterSpacing: 0.3,
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          ↩ Undo
        </button>
      )}

      {/* Post-game */}
      <PostGameScreen
        summary={summary}
        onPlayAgain={handleNewGame}
        onBackToRoom={handleBackToRoom}
      />
    </div>
  );
}
