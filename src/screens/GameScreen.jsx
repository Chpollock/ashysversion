import { useReducer, useEffect, useRef, useState, useMemo } from 'react';
import BackgammonBoard from '../components/BackgammonBoard.jsx';
import { DiceFaces, RollControls } from '../components/Dice.jsx';
import OpponentPicker from '../components/OpponentPicker.jsx';
import PostGameScreen from './PostGameScreen.jsx';
import { gameReducer, createInitialState, rollDiceValues, rollOpeningValues, moveRestriction, allLegalMoves, pipCount } from '../game/gameLogic.js';
import { getAIMoves } from '../game/ai.js';
import { AI_TIERS, AI_STYLES, TIER_BY_ID, STYLE_BY_ID } from '../game/aiOpponents.js';
import { computePayout, isMeaningfulAbandon, ECONOMY } from '../game/economy.js';
import { computeGameBonuses } from '../game/gameBonuses.js';
import { pickSnippet, EV } from '../game/events.js';
import { evaluateAchievements } from '../game/achievements.js';
import { pickCharlieLine } from '../game/charlieSpeech.js';

const AI_ROLL_MS  = 900;   // pause before Charlie picks up the dice
const AI_THINK_MS = 1700;  // pause after the roll while he "thinks" about his moves
const AI_MOVE_MS  = 1250;  // gap between each of Charlie's moves — slow enough to follow

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

const pipPill = {
  fontSize: 12, color: '#8a6030', fontFamily: 'Georgia, serif',
  background: 'rgba(255,250,235,0.6)', border: '1px solid rgba(150,110,60,0.3)',
  borderRadius: 10, padding: '2px 10px', letterSpacing: 0.3,
};

const debugBtn = {
  padding: '4px 12px', borderRadius: 10,
  border: '1px dashed rgba(120,80,40,0.5)', background: 'transparent',
  color: '#8a6030', fontFamily: 'Georgia, serif', fontSize: 11,
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
};

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

  // Opponent picker — only available before the opening roll
  const [pickerOpen, setPickerOpen] = useState(false);

  // Charlie's table talk: { text, key } | null, shown in a bubble by his name
  const [speech, setSpeech] = useState(null);
  const speechTimerRef = useRef(null);
  const speechCooldownRef = useRef(0);
  const seenEventsRef = useRef(0);

  // One-shot richer banner for the opening roll result
  const openingBannerRef = useRef(null);

  // Delayed reveal of the post-game summary
  const summaryTimerRef = useRef(null);

  // Ref so AI closures always read the latest game state for move descriptions
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    clearTimeout(bannerTimerRef.current);
    clearTimeout(toastTimerRef.current);
    clearTimeout(flashTimerRef.current);
    clearTimeout(summaryTimerRef.current);
    clearTimeout(speechTimerRef.current);
  }, []);

  // ── Charlie's table talk ──────────────────────────────────────────────────
  // Occasionally speaks when something dramatic happens. Probability + a
  // cooldown keep him from narrating every move. Deferred a beat so the
  // bubble lands just after the action it reacts to.
  function maybeSay(event, chance) {
    const now = Date.now();
    if (now - speechCooldownRef.current < 6000) return;
    if (Math.random() > chance) return;
    const line = pickCharlieLine(event, {
      tier: save.opponents?.tier ?? 'sleepy',
      style: save.opponents?.style ?? 'balanced',
    });
    if (!line) return;
    speechCooldownRef.current = now;
    clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeech({ text: line, key: now });
      speechTimerRef.current = setTimeout(() => setSpeech(null), 3200);
    }, 350);
  }

  // Watch the game's event log for moments worth a comment
  useEffect(() => {
    const log = gameState.eventLog;
    if (log.length < seenEventsRef.current) seenEventsRef.current = 0; // new game
    const fresh = log.slice(seenEventsRef.current);
    seenEventsRef.current = log.length;

    for (const ev of fresh) {
      if (ev.type === EV.BLOT_HIT && ev.player === 'charlie') maybeSay('charlie-hit', 0.55);
      else if (ev.type === EV.BLOT_HIT && ev.player === 'ashton') maybeSay('charlie-got-hit', 0.6);
      else if (ev.type === EV.DOUBLES_ROLLED && ev.player === 'charlie') maybeSay('charlie-doubles', 0.45);
      else if (ev.type === EV.DOUBLES_ROLLED && ev.player === 'ashton') maybeSay('player-doubles', 0.45);
    }
  }, [gameState.eventLog.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Turn announcement banner ──────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase !== 'rolling') return;
    clearTimeout(bannerTimerRef.current);

    // The opening roll sets a one-shot richer message ("You rolled 5, Charlie 3…")
    const opening = openingBannerRef.current;
    openingBannerRef.current = null;

    const next = opening ?? (gameState.currentPlayer === 'ashton'
      ? { message: 'Your turn!', variant: 'ashton' }
      : { message: "Charlie's turn", variant: 'charlie' });
    setBanner(next);

    bannerTimerRef.current = setTimeout(() => setBanner(null), opening ? 2600 : 1800);
  }, [gameState.currentPlayer, gameState.phase]);

  // ── "Charlie's thinking…" only once he's actually rolled ─────────────────────
  // Slightly delayed so it appears while the dice settle and he ponders.
  useEffect(() => {
    if (gameState.phase !== 'moving' || gameState.currentPlayer !== 'charlie') return;
    const t = setTimeout(() => {
      clearTimeout(bannerTimerRef.current);
      setBanner({ message: "Charlie's thinking…", variant: 'charlie' });
      bannerTimerRef.current = setTimeout(() => setBanner(null), 1600);
    }, 700);
    return () => clearTimeout(t);
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
    const tierId = save.opponents?.tier ?? 'sleepy';
    const tier = TIER_BY_ID[tierId] ?? TIER_BY_ID.sleepy;
    const payout = computePayout({
      result, isFirstWinOfDay, winStreak: newStreak,
      tierMultiplier: tier.rewardMultiplier,
    });

    // Repeatable per-game bonuses for this game's notable moments
    const bonuses = computeGameBonuses({
      eventLog: gameState.eventLog,
      result,
      pipStats: gameState.pipStats,
    });
    const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);

    const statsAfter = {
      ...save.stats,
      gamesPlayed: save.stats.gamesPlayed + 1,
      gamesWon: save.stats.gamesWon + (won ? 1 : 0),
      currentWinStreak: newStreak,
      bestWinStreak: Math.max(save.stats.bestWinStreak, newStreak),
      gamesPlayedToday: save.stats.gamesPlayedToday + 1,
      winsByTier: won
        ? { ...save.stats.winsByTier, [tier.id]: (save.stats.winsByTier?.[tier.id] ?? 0) + 1 }
        : save.stats.winsByTier ?? {},
    };

    // New rivals/styles unlocked by crossing a win threshold this game
    const celebrated = save.opponents?.celebrated ?? [];
    const newOpponents = [...AI_TIERS, ...AI_STYLES].filter(o =>
      o.unlockWins > 0
      && statsAfter.gamesWon >= o.unlockWins
      && save.stats.gamesWon < o.unlockWins
      && !celebrated.includes(o.id)
    );

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
    const totalEarned = payout.total + achReward + bonusTotal;
    const unlockedAt = Date.now();

    updateSave(s => ({
      ...s,
      pennies: s.pennies + totalEarned,
      stats: { ...statsAfter, totalPenniesEarned: s.stats.totalPenniesEarned + totalEarned },
      firstWinOfDayDone: s.firstWinOfDayDone || isFirstWinOfDay,
      achievements: {
        ...s.achievements,
        unlocked: {
          ...s.achievements.unlocked,
          ...Object.fromEntries(newly.map(a => [a.id, unlockedAt])),
        },
      },
      opponents: {
        ...(s.opponents ?? { tier: 'sleepy', style: 'balanced', celebrated: [] }),
        celebrated: [...celebrated, ...newOpponents.map(o => o.id)],
      },
    }));

    const snippet = pickSnippet(gameState.eventLog, result);
    clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => {
      setSummary({ result, payout, bonuses, snippet, newAchievements: newly, isFirstWinOfDay, tier, newOpponents });
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
      schedule(() => dispatch({ type: 'ROLL_DICE', dice: rollDiceValues() }), AI_ROLL_MS);
      return () => timers.forEach(clearTimeout);
    }

    // moving
    const moves = getAIMoves(gameState, {
      tier: save.opponents?.tier ?? 'sleepy',
      style: save.opponents?.style ?? 'balanced',
    });
    if (!moves.length) {
      maybeSay('charlie-stuck', 0.7);
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
    clearTimeout(summaryTimerRef.current);
    settledRef.current = false;
    openingBannerRef.current = null;
    setSummary(null);
    setBanner(null);
    setMoveToast(null);
    setFlashPoint(null);
    setCharlieTrail([]);
    dispatch({ type: 'NEW_GAME' });
  }

  function handleBackToRoom() {
    // Leaving mid-game: a small consolation if real progress was made (and the
    // streak ends), nothing if she only peeked. Finished games settle normally.
    if (gameState.phase !== 'gameover' && gameState.phase !== 'opening' && gameState.rollId > 0) {
      const meaningful = isMeaningfulAbandon(gameState);
      const amount = meaningful ? ECONOMY.ABANDONED_PROGRESS : ECONOMY.ABANDONED_EARLY;
      if (meaningful) {
        updateSave(s => ({
          ...s,
          pennies: s.pennies + amount,
          stats: {
            ...s.stats,
            totalPenniesEarned: s.stats.totalPenniesEarned + amount,
            currentWinStreak: 0,
          },
        }));
      }
    }
    onBackToRoom();
  }

  // Opening roll: each side rolls one die, higher goes first (ties rerolled)
  function handleOpeningRoll() {
    setPickerOpen(false);
    const { ashtonDie, charlieDie } = rollOpeningValues();
    const youStart = ashtonDie > charlieDie;
    openingBannerRef.current = youStart
      ? { message: `You rolled ${ashtonDie}, Charlie ${charlieDie} — you're up!`, variant: 'ashton' }
      : { message: `You rolled ${ashtonDie}, Charlie ${charlieDie} — Charlie starts`, variant: 'charlie' };
    dispatch({ type: 'OPENING_ROLL', ashtonDie, charlieDie });
  }

  // Ashton tapped a checker that can't move — explain why, gently.
  function handleBlockedTap() {
    const reason = moveRestriction(gameState);
    const text = reason === 'use-both'
      ? 'Both dice want to play — this one has to sit tight.'
      : reason === 'use-larger'
      ? 'When only one die fits, it has to be the bigger one.'
      : 'That one’s stuck for now.';
    clearTimeout(toastTimerRef.current);
    setMoveToast({ text, isHit: false });
    toastTimerRef.current = setTimeout(() => setMoveToast(null), 2000);
  }

  // Point to highlight when hovering a used die (the destination it moved to)
  const hoverMove = hoverDie != null ? gameState.dieMoves[hoverDie] : null;
  const hoverPoint = hoverMove && typeof hoverMove.to === 'number' ? hoverMove.to : null;

  const isAshtonTurn = gameState.currentPlayer === 'ashton';
  const showUndo = gameState.phase === 'moving'
    && isAshtonTurn
    && gameState.usedDice.length > 0
    && !!gameState.turnStartSnapshot;

  // Ashton's turn only ends when she says so — but only once nothing's left to play
  const movesRemain = useMemo(
    () => gameState.phase === 'moving' && allLegalMoves(gameState).length > 0,
    [gameState],
  );
  const showEndTurn = gameState.phase === 'moving' && isAshtonTurn && !movesRemain;
  const rolledNoMoves = showEndTurn && gameState.usedDice.length === 0;

  // Charlie enjoys it when your roll leaves you nowhere to go
  useEffect(() => {
    if (rolledNoMoves) maybeSay('player-stuck', 0.65);
  }, [rolledNoMoves]); // eslint-disable-line react-hooks/exhaustive-deps

  // Equipped opponent (chip + picker), with safe fallbacks for older saves
  const equippedTier = TIER_BY_ID[save.opponents?.tier] ?? TIER_BY_ID.sleepy;
  const equippedStyle = STYLE_BY_ID[save.opponents?.style] ?? STYLE_BY_ID.balanced;
  const showOpponentChip = gameState.phase === 'opening';

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

      {/* Charlie's row: who you're playing (picker before the opening roll),
          his speech bubble, and his pip count */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, padding: '0 6px', position: 'relative',
      }}>
        <style>{`
          @keyframes speechIn {
            0%   { opacity: 0; transform: translateY(-5px) scale(0.92); }
            100% { opacity: 1; transform: translateY(0)    scale(1); }
          }
        `}</style>
        {showOpponentChip ? (
          <button
            onPointerDown={() => setPickerOpen(true)}
            style={{
              padding: '6px 16px', borderRadius: 16,
              border: '1.5px solid rgba(150,110,60,0.35)',
              background: 'rgba(255,250,235,0.6)',
              color: '#5a3a18', fontFamily: 'Georgia, serif', fontSize: 16,
              fontStyle: 'italic', cursor: 'pointer', letterSpacing: 0.3,
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
            aria-label="Choose opponent"
          >
            vs {equippedTier.emoji} {equippedTier.name} · {equippedStyle.emoji} {equippedStyle.name} ▾
          </button>
        ) : (
          <span style={{
            fontSize: 18, color: '#5a3a18', fontStyle: 'italic',
            letterSpacing: 0.4, fontWeight: 'bold',
          }}>
            {equippedTier.emoji} {equippedTier.name}
            {equippedStyle.id !== 'balanced' ? (
              <span style={{ fontSize: 13, fontWeight: 'normal', color: '#8a6030' }}> · {equippedStyle.name}</span>
            ) : null}
          </span>
        )}
        <span style={pipPill}>{pipCount(gameState, 'charlie')} pips</span>

        {/* Speech bubble — pops up under his name */}
        {speech && (
          <div key={speech.key} style={{
            position: 'absolute', top: '100%', left: 8, marginTop: 4,
            zIndex: 45, pointerEvents: 'none',
            background: 'linear-gradient(160deg,#fffdf2,#f6ecd2)',
            border: '1.5px solid #d4aa60',
            borderRadius: '4px 14px 14px 14px',
            padding: '7px 13px', maxWidth: 250,
            fontSize: 13, fontFamily: 'Georgia, serif', fontStyle: 'italic',
            color: '#6a4310', lineHeight: 1.35,
            boxShadow: '0 4px 14px rgba(90,50,10,0.3)',
            animation: 'speechIn 0.22s ease-out both',
          }}>
            {speech.text}
          </div>
        )}
      </div>

      {/* Board — the dice rest on each player's half, like a real game */}
      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>
        <BackgammonBoard
          state={gameState}
          boardId={save.boards.equipped}
          pieceSet={save.pieceSets.equipped}
          flashPoint={flashPoint}
          charlieTrail={charlieTrail}
          hoverPoint={hoverPoint}
          onSelectPiece={(pt) => dispatch({ type: 'SELECT_PIECE', point: pt })}
          onMovePath={(steps) => dispatch({ type: 'MOVE_PATH', steps })}
          onBlockedTap={handleBlockedTap}
        />

        {gameState.dice.length > 0 && gameState.diceOwner === 'opening' ? (
          <>
            {/* Opening roll: one die per player, on their own half */}
            <div style={{ position: 'absolute', left: '27%', top: '45%', transform: 'translate(-50%,-50%)', zIndex: 30, pointerEvents: 'none' }}>
              <DiceFaces dice={[gameState.dice[1]]} usedDice={[]} phase={gameState.phase}
                currentPlayer={gameState.currentPlayer} rollId={gameState.rollId} size={36} label="Charlie" />
            </div>
            <div style={{ position: 'absolute', left: '73%', top: '45%', transform: 'translate(-50%,-50%)', zIndex: 30, pointerEvents: 'none' }}>
              <DiceFaces dice={[gameState.dice[0]]} usedDice={[]} phase={gameState.phase}
                currentPlayer={gameState.currentPlayer} rollId={gameState.rollId} size={36} label="you" />
            </div>
          </>
        ) : gameState.dice.length > 0 && (
          <div style={{
            position: 'absolute',
            left: gameState.diceOwner === 'charlie' ? '27%' : '73%',
            top: '45%', transform: 'translate(-50%,-50%)',
            zIndex: 30, pointerEvents: 'none',
            transition: 'left 0.3s ease',
          }}>
            <DiceFaces
              dice={gameState.dice}
              usedDice={gameState.usedDice}
              dieMoves={gameState.dieMoves}
              phase={gameState.phase}
              currentPlayer={gameState.currentPlayer}
              rollId={gameState.rollId}
              onHoverDie={setHoverDie}
              size={36}
            />
          </div>
        )}
      </div>

      {/* Ashton's row: her pip count, on her side */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 6, padding: '0 6px',
      }}>
        <span style={{ fontSize: 13.5, color: '#6a4a28', fontStyle: 'italic', letterSpacing: 0.3 }}>you</span>
        <span style={pipPill}>{pipCount(gameState, 'ashton')} pips</span>
      </div>

      {/* Controls area — relative so the banner and toast can position against it */}
      <div style={{ marginTop: 10, position: 'relative', minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <TurnBanner banner={banner} />
        <RollControls
          phase={gameState.phase}
          currentPlayer={gameState.currentPlayer}
          dieMoves={gameState.dieMoves}
          onRoll={() => dispatch({ type: 'ROLL_DICE', dice: rollDiceValues() })}
        />
        {gameState.phase === 'opening' && (
          <button
            onPointerDown={handleOpeningRoll}
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
            Roll for first turn
          </button>
        )}
        <MoveToast toast={moveToast} />
      </div>

      {/* Turn controls: Undo + End turn (Ashton's turn never ends by itself) */}
      {(showUndo || showEndTurn) && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          {showUndo && (
            <button
              onPointerDown={() => dispatch({ type: 'UNDO' })}
              style={{
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
          {showEndTurn && (
            <button
              onPointerDown={() => dispatch({ type: 'END_TURN' })}
              style={{
                padding: '6px 20px', borderRadius: 14,
                border: '2px solid #b8843c',
                background: 'linear-gradient(135deg,#e8b45a,#c8862a)',
                color: '#fff8e7',
                fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold',
                cursor: 'pointer', letterSpacing: 0.3,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              End turn ✓
            </button>
          )}
          {rolledNoMoves && (
            <span style={{ fontSize: 12, color: '#a07a40', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              no moves this time
            </span>
          )}
        </div>
      )}

      {/* Dev-only: preview the rewards screen without playing a whole game.
          Note: it pays out + counts stats like a real game. Stripped from builds. */}
      {import.meta.env.DEV && gameState.phase !== 'gameover' && (
        <div style={{ marginTop: 18, display: 'flex', gap: 8, opacity: 0.55 }}>
          <button onPointerDown={() => dispatch({ type: 'DEBUG_END_GAME', winner: 'ashton' })} style={debugBtn}>
            🧪 test win
          </button>
          <button onPointerDown={() => dispatch({ type: 'DEBUG_END_GAME', winner: 'charlie' })} style={debugBtn}>
            🧪 test loss
          </button>
        </div>
      )}

      {/* Opponent picker overlay */}
      {pickerOpen && (
        <OpponentPicker
          gamesWon={save.stats.gamesWon}
          tier={equippedTier.id}
          style={equippedStyle.id}
          onPick={(patch) => updateSave(s => ({
            ...s,
            opponents: {
              ...(s.opponents ?? { tier: 'sleepy', style: 'balanced', celebrated: [] }),
              ...patch,
            },
          }))}
          onClose={() => setPickerOpen(false)}
        />
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
