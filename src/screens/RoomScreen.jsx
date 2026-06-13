import { useState, useEffect, useRef } from 'react';
import {
  PROJECTS, nextProject, beginProject, roomImageForState, boardHotspotForState,
  BAKED_PETS_UP_TO, TYPE_TRAY, TRAY_UNLOCK_INDEX, SONG_GIFT, JAR_FULL_AT, formatDuration,
} from '../game/roomStates.js';
import { PETS, PET_ARRIVALS, getSpot } from '../game/petSpots.js';
import { ACHIEVEMENTS, trinketEmoji } from '../game/achievements.js';
import { AI_TIERS } from '../game/aiOpponents.js';
import { hasSavedGame, clearGame } from '../state/gameSession.js';
import { exportSave, importSave } from '../state/saveState.js';
import { CHANGELOG } from '../game/changelog.js';

const PET_TAP_COOLDOWN_MS = 1200;
const ROOM_ASPECT = 1450 / 1085; // room images are landscape; portrait phones crop the sides

export default function RoomScreen({
  save, updateSave, onEnterGame, onOpenShop, onPlayLyricsOnce,
  muted, onToggleMute, welcomeBack,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [projectCardOpen, setProjectCardOpen] = useState(false);
  const [revealFlash, setRevealFlash] = useState(false);
  const [revealTransition, setRevealTransition] = useState(null); // { from(img), key } during crossfade
  const [revealLine, setRevealLine] = useState(null);     // { text, key }
  const [arrival, setArrival] = useState(null);           // { name, line, key }
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayDetail, setTrayDetail] = useState(null);     // achievement id
  const [statsOpen, setStatsOpen] = useState(false);
  const [resumeGame] = useState(() => hasSavedGame());    // a game waits mid-play
  // Keepsake (save backup) state, inside the Record Book
  const [backupCode, setBackupCode] = useState(null);     // shown code + 'copied' note
  const [copied, setCopied] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [pendingRestore, setPendingRestore] = useState(null); // parsed state awaiting confirm
  const [restoreMsg, setRestoreMsg] = useState(null);     // { ok, text }
  const [changelogOpen, setChangelogOpen] = useState(false);
  // Room panning: which third of the room is shown (-1 left, 0 center, 1 right)
  const [roomView, setRoomView] = useState(0);
  const [roomOverflow, setRoomOverflow] = useState(
    () => Math.max(0, window.innerHeight * ROOM_ASPECT - window.innerWidth),
  );
  const [songCardOpen, setSongCardOpen] = useState(false);
  const [petReactions, setPetReactions] = useState({});   // { petId: { emoji, key } }
  const [showWelcome, setShowWelcome] = useState(welcomeBack);
  const [coinDrop, setCoinDrop] = useState(null);         // key, retriggers the coin anim
  const petTapCooldown = useRef({});                      // { petId: lastTapTs }
  const prevPenniesRef = useRef(save.pennies);

  const roomStateIndex = save.roomStateIndex ?? 0;
  const project = nextProject(save);
  const active = save.activeProject;
  const building = !!active && project && active.id === project.id && now < active.completesAt;
  const ready = !!active && project && active.id === project.id && now >= active.completesAt;
  const board = boardHotspotForState(roomStateIndex);

  // Panning: how far the room can scroll, and the current shift.
  const canPan = roomOverflow > 6;
  const objectPos = `${50 + roomView * 50}% 50%`;          // image content offset
  const panPx = -roomView * (roomOverflow / 2);            // overlays move with it

  // Tick once a second so build timers and pet arrivals flip live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fade out the welcome-back moment after a beat
  useEffect(() => {
    if (!welcomeBack) return;
    const t = setTimeout(() => setShowWelcome(false), 2600);
    return () => clearTimeout(t);
  }, [welcomeBack]);

  // Recompute how much room is cropped when the viewport changes
  useEffect(() => {
    const onResize = () => setRoomOverflow(Math.max(0, window.innerHeight * ROOM_ASPECT - window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Coin-drop animation whenever Pennies tick up while the room is visible
  useEffect(() => {
    if (save.pennies > prevPenniesRef.current) {
      const t = setTimeout(() => setCoinDrop(Date.now()), 0);
      prevPenniesRef.current = save.pennies;
      return () => clearTimeout(t);
    }
    prevPenniesRef.current = save.pennies;
  }, [save.pennies]);

  // ── Pet arrivals: timer done → the pet walks in with a small moment ────────
  useEffect(() => {
    for (const petId of Object.keys(PET_ARRIVALS)) {
      const p = save.pets[petId];
      if (!p?.arrivesAt || p.unlocked || now < p.arrivesAt) continue;
      const def = PETS[petId];
      updateSave(s => ({
        ...s,
        pets: {
          ...s.pets,
          [petId]: { ...s.pets[petId], unlocked: true, welcomed: true, arrivesAt: null, spotId: def.homeSpot, away: false },
        },
      }));
      const t = setTimeout(() => setArrival({
        name: def.name, line: PET_ARRIVALS[petId].arrivalLine, key: Date.now(),
      }), 300);
      return () => clearTimeout(t);
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss the arrival card
  useEffect(() => {
    if (!arrival) return;
    const t = setTimeout(() => setArrival(null), 5200);
    return () => clearTimeout(t);
  }, [arrival]);

  // ── Project actions ─────────────────────────────────────────────────────────
  function handleBeginProject() {
    if (!project || active || save.pennies < project.cost) return;
    updateSave(s => beginProject(s, project));
    setProjectCardOpen(false);
  }

  // She taps the finished work — a slow, warm crossfade from the old room to
  // the new one, then the reveal line.
  function handleReveal() {
    if (!ready || !project) return;
    const fromImage = roomImageForState(roomStateIndex);
    setRevealTransition({ from: fromImage, key: Date.now() });
    setRevealFlash(true);
    updateSave(s => ({ ...s, roomStateIndex: s.roomStateIndex + 1, activeProject: null }));
    setTimeout(() => setRevealLine({ text: project.revealLine, key: Date.now() }), 1000);
    setTimeout(() => setRevealFlash(false), 2300);
    setTimeout(() => setRevealTransition(null), 2300);
  }

  useEffect(() => {
    if (!revealLine) return;
    const t = setTimeout(() => setRevealLine(null), 4200);
    return () => clearTimeout(t);
  }, [revealLine]);

  // ── The song gift ───────────────────────────────────────────────────────────
  const roomFinished = roomStateIndex >= PROJECTS.length;
  function openSongGift() {
    setSongCardOpen(true);
    if (!save.music.lyricsUnlocked) {
      updateSave(s => ({ ...s, music: { ...s.music, lyricsUnlocked: true } }));
    }
    onPlayLyricsOnce?.();
  }

  // ── Pets ────────────────────────────────────────────────────────────────────
  function tapPet(petId) {
    // Deferred a tick so the impure bits (time, randomness) run strictly in
    // event-time, never during a render pass.
    setTimeout(() => {
      const ts = Date.now();
      const last = petTapCooldown.current[petId] || 0;
      if (ts - last < PET_TAP_COOLDOWN_MS) return;
      petTapCooldown.current[petId] = ts;
      const reactions = PETS[petId].tapReactions;
      const emoji = reactions[Math.floor(Math.random() * reactions.length)];
      setPetReactions(r => ({ ...r, [petId]: { emoji, key: ts } }));
      setTimeout(() => {
        setPetReactions(r => {
          const next = { ...r };
          delete next[petId];
          return next;
        });
      }, 1100);
    }, 0);
  }

  function collectGift(gift) {
    updateSave(s => ({
      ...s,
      pennies: s.pennies + gift.amount,
      stats: { ...s.stats, totalPenniesEarned: s.stats.totalPenniesEarned + gift.amount },
      pendingGifts: s.pendingGifts.filter(g => g.id !== gift.id),
    }));
  }

  // ── Keepsake: backup & restore ──────────────────────────────────────────────
  function makeBackup() {
    const code = exportSave(save);
    setBackupCode(code);
    setCopied(false);
    navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {});
  }

  function tryRestore() {
    const res = importSave(restoreText);
    if (!res.ok) {
      setPendingRestore(null);
      setRestoreMsg({ ok: false, text: res.error });
      return;
    }
    setRestoreMsg(null);
    setPendingRestore(res.state); // hold for the confirm step (it overwrites progress)
  }

  function confirmRestore() {
    const next = pendingRestore;
    setPendingRestore(null);
    updateSave(() => next);
    clearGame(); // don't resume a match that doesn't belong to the restored progress
    setRestoreText('');
    setRestoreOpen(false);
    setRestoreMsg({ ok: true, text: 'Restored ✨' });
  }

  // Reset the Keepsake UI whenever the Record Book closes
  function closeStats() {
    setStatsOpen(false);
    setBackupCode(null); setCopied(false);
    setRestoreOpen(false); setRestoreText('');
    setPendingRestore(null); setRestoreMsg(null);
    setChangelogOpen(false);
  }

  // Pets currently visible. Boombox is painted into the early room images, so
  // his overlay only renders once the room moves past BAKED_PETS_UP_TO.
  const visiblePets = Object.keys(PETS)
    .map(petId => {
      if (petId === 'boombox' && roomStateIndex <= BAKED_PETS_UP_TO) return null;
      const st = save.pets[petId];
      if (!st?.unlocked || st.away || !st.spotId) return null;
      const def = PETS[petId];
      const spot = getSpot(petId, st.spotId);
      if (!spot) return null;
      return { petId, def, spot };
    })
    .filter(Boolean);

  const unlockedAch = save.achievements.unlocked ?? {};
  const jarFill = Math.min(1, save.pennies / JAR_FULL_AT);

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      fontFamily: 'Georgia, serif', background: '#2a2018',
    }}>
      <style>{`
        @keyframes boardGlow { 0%,100% { box-shadow: 0 0 0 2px rgba(245,210,120,0.12), 0 0 18px rgba(245,210,120,0.1); } 50% { box-shadow: 0 0 0 2px rgba(245,210,120,0.3), 0 0 26px rgba(245,210,120,0.25); } }
        @keyframes hintMote { 0%,100% { opacity: 0.25; transform: translateY(0) scale(0.85); } 50% { opacity: 0.8; transform: translateY(-7px) scale(1.05); } }
        @keyframes buildPulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }
        @keyframes readyGlow { 0%,100% { box-shadow: 0 0 14px 4px rgba(245,200,80,0.45); opacity: 0.85; } 50% { box-shadow: 0 0 26px 9px rgba(245,200,80,0.8); opacity: 1; } }
        @keyframes revealFlash { 0% { opacity: 0; } 40% { opacity: 0.6; } 100% { opacity: 0; } }
        @keyframes crossFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes bustlerCarry { 0% { transform: translateX(-11px); } 48% { transform: translateX(11px) translateY(-1px); } 52% { transform: translateX(11px) scaleX(-1); } 98% { transform: translateX(-11px) scaleX(-1) translateY(-1px); } 100% { transform: translateX(-11px); } }
        @keyframes bustlerInspect { 0%,100% { transform: rotate(0deg); } 30% { transform: rotate(-10deg) translateY(-1px); } 60% { transform: rotate(9deg); } }
        @keyframes dustPuff { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 30% { opacity: 0.95; } 100% { opacity: 0; transform: translate(var(--dx), -14px) scale(1.5); } }
        @keyframes bustlerDance { 0%,100% { transform: rotate(-12deg) translateY(0); } 25% { transform: rotate(0deg) translateY(-5px); } 50% { transform: rotate(12deg) translateY(0); } 75% { transform: rotate(0deg) translateY(-5px); } }
        @keyframes bustlerProud { 0%,100% { transform: scale(1.1) rotate(-2deg); } 50% { transform: scale(1.18) rotate(2deg) translateY(-2px); } }
        @keyframes revealLineIn { 0% { opacity: 0; transform: translate(-50%,8px); } 100% { opacity: 1; transform: translate(-50%,0); } }
        @keyframes coinFall { 0% { opacity: 0; transform: translateY(-26px) rotate(-30deg); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(8px) rotate(12deg); } }
        @keyframes floatHeart { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-46px) scale(1.1); } }
        @keyframes giftBob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-6px); } }
        @keyframes welcomeIn { 0% { opacity: 0; transform: translate(-50%, -8px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes petBreathe { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.015); } }
        @keyframes petTapPop { 0% { opacity: 0; transform: translate(-50%,0) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-40px) scale(1.1); } }
        @keyframes presentGlow { 0%,100% { filter: drop-shadow(0 0 6px rgba(245,200,80,0.6)); } 50% { filter: drop-shadow(0 0 14px rgba(245,200,80,0.95)); } }
        @keyframes arriveSparkle { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.5); } 40% { opacity: 1; transform: translate(-50%,-50%) scale(1.25); } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.6); } }
        @keyframes cardIn { 0% { opacity: 0; transform: translateY(10px) scale(0.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Room — the image IS the room state. objectPosition pans which third
          of the (landscape) room shows on a portrait phone. */}
      <img src={roomImageForState(roomStateIndex)} alt="living room" draggable={false}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: objectPos,
          display: 'block', transition: 'object-position 0.45s ease',
        }} />

      {/* During a reveal, the OLD room slowly fades away over the new one */}
      {revealTransition && (
        <img key={revealTransition.key} src={revealTransition.from} alt="" draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: objectPos, zIndex: 2, pointerEvents: 'none',
            animation: 'crossFadeOut 2.2s ease-in-out both',
          }} />
      )}

      {/* All the room's diegetic overlays live in one layer that slides in sync
          with the image when she pans left/right. */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: `translateX(${panPx}px)`,
        transition: 'transform 0.45s ease',
      }}>

      {/* The board — the way into the game, once it exists. Before the first
          project (Draw the Board) there IS no board yet, so tapping the box
          opens that project instead. */}
      <div
        onPointerDown={roomStateIndex >= 1 ? onEnterGame : () => setProjectCardOpen(true)}
        style={{
          position: 'absolute',
          left: `${board.x}%`, top: `${board.y}%`, width: `${board.w}%`, height: `${board.h}%`,
          cursor: 'pointer', zIndex: 6, borderRadius: 14,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          animation: roomStateIndex >= 1 ? 'boardGlow 3.2s ease-in-out infinite' : 'none',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        {roomStateIndex >= 1 && (
          <span style={{
            marginBottom: 6, fontSize: 12, color: '#fff8e0',
            background: 'rgba(60,35,10,0.6)', padding: '3px 10px', borderRadius: 12,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>{resumeGame ? 'Resume ▸' : 'Play ▸'}</span>
        )}
      </div>

      {/* ── The next project's marker — always obvious what's next ── */}
      {project && !ready && !building && (
        <div onPointerDown={() => setProjectCardOpen(true)} style={{
          position: 'absolute', left: `${project.hintPos.x}%`, top: `${project.hintPos.y}%`,
          transform: 'translate(-50%,-50%)', zIndex: 7, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }} aria-label={`Hint: ${project.name}`}>
          {/* warm glowing spot with drifting motes */}
          <div style={{
            position: 'relative', width: 46, height: 46,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,238,180,0.75), rgba(245,205,100,0.3) 60%, transparent 72%)',
            animation: 'readyGlow 2.2s ease-in-out infinite',
          }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                position: 'absolute',
                left: `${20 + i * 24}%`, top: `${28 + (i % 2) * 30}%`,
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(255,245,210,0.95)',
                animation: `hintMote ${2.2 + i * 0.5}s ease-in-out ${i * 0.4}s infinite`,
              }} />
            ))}
            <span style={{ fontSize: 18, animation: 'hintMote 2.8s ease-in-out infinite' }}>✨</span>
          </div>
          {/* the next thing, by name */}
          <span style={{
            fontSize: 11.5, color: '#fff8e0', whiteSpace: 'nowrap',
            background: 'rgba(60,35,10,0.7)', padding: '3px 11px', borderRadius: 12,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)', fontStyle: 'italic',
            animation: 'giftBob 2.4s ease-in-out infinite',
          }}>
            ✎ {project.name}
          </span>
        </div>
      )}

      {project && building && (
        <div onPointerDown={() => setProjectCardOpen(true)} style={{
          position: 'absolute', left: `${project.hintPos.x}%`, top: `${project.hintPos.y}%`,
          transform: 'translate(-50%,-50%)', zIndex: 7, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
          <Bustler
            mode="working"
            progress={Math.min(1, Math.max(0, 1 - (active.completesAt - now) / project.durationMs))}
          />
          <span style={{
            fontSize: 11, color: '#fff8e0', whiteSpace: 'nowrap',
            background: 'rgba(60,35,10,0.7)', padding: '2px 10px', borderRadius: 12,
            fontStyle: 'italic', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            {formatDuration(Math.max(1000, active.completesAt - now))}…
          </span>
        </div>
      )}

      {project && ready && (
        <div onPointerDown={handleReveal} style={{
          position: 'absolute', left: `${project.hintPos.x}%`, top: `${project.hintPos.y}%`,
          transform: 'translate(-50%,-50%)', zIndex: 7, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }} aria-label="Reveal">
          <Bustler mode="proud" />
          <span style={{
            fontSize: 11.5, color: '#fff8e0', whiteSpace: 'nowrap', fontWeight: 'bold',
            background: 'rgba(140,90,20,0.85)', padding: '3px 11px', borderRadius: 12,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            animation: 'giftBob 1.6s ease-in-out infinite',
          }}>
            {project.name} — ready ✨
          </span>
        </div>
      )}

      {/* Type tray — achievements viewer, once the gallery wall is complete */}
      {roomStateIndex >= TRAY_UNLOCK_INDEX && (
        <div onPointerDown={() => setTrayOpen(true)} style={{
          position: 'absolute',
          left: `${TYPE_TRAY.hotspot.x}%`, top: `${TYPE_TRAY.hotspot.y}%`,
          width: `${TYPE_TRAY.hotspot.w}%`, height: `${TYPE_TRAY.hotspot.h}%`,
          zIndex: 6, cursor: 'pointer', borderRadius: 8,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }} aria-label="Achievements tray" />
      )}

      {/* The song gift — a present on the record player, once the room is home */}
      {roomFinished && (
        <div onPointerDown={openSongGift} style={{
          position: 'absolute',
          left: `${SONG_GIFT.hotspot.x}%`, top: `${SONG_GIFT.hotspot.y}%`,
          transform: 'translate(-50%,-50%)', zIndex: 7, cursor: 'pointer',
          fontSize: save.music.lyricsUnlocked ? 20 : 28,
          animation: 'presentGlow 2.2s ease-in-out infinite',
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} aria-label="A present">
          {save.music.lyricsUnlocked ? '💝' : '🎁'}
        </div>
      )}

      {/* Pets */}
      {visiblePets.map(({ petId, def, spot }) => (
        <Pet key={petId} def={def} spot={spot}
          reaction={petReactions[petId]} onTap={() => tapPet(petId)} />
      ))}

      {/* Arrival sparkle over the new pet's spot */}
      {arrival && (
        <div key={arrival.key} style={{
          position: 'absolute', left: '50%', top: '55%', zIndex: 24,
          fontSize: 44, pointerEvents: 'none',
          animation: 'arriveSparkle 1.4s ease-out both',
        }}>✨</div>
      )}

      {/* Pending gifts */}
      {save.pendingGifts.map(gift => {
        const pos = gift.position || { x: 50, y: 70 };
        return (
          <div key={gift.id} onPointerDown={() => collectGift(gift)} style={{
            position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
            transform: 'translate(-50%, 0)',
            zIndex: (gift.zOrder ?? 6) + 1, cursor: 'pointer',
            animation: 'giftBob 1.6s ease-in-out infinite',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            fontSize: 26, filter: 'drop-shadow(0 0 8px rgba(245,200,80,0.9))',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🎁</div>
        );
      })}

      </div>{/* end room overlay layer */}

      {/* Look around — pan the room left/right to see the whole thing */}
      {canPan && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 'calc(16px + env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)', zIndex: 22, display: 'flex', gap: 14,
        }}>
          <button onPointerDown={() => setRoomView(v => Math.max(-1, v - 1))}
            disabled={roomView <= -1} style={panBtn(roomView <= -1)} aria-label="Look left">‹</button>
          <button onPointerDown={() => setRoomView(v => Math.min(1, v + 1))}
            disabled={roomView >= 1} style={panBtn(roomView >= 1)} aria-label="Look right">›</button>
        </div>
      )}

      {/* ── HUD ── */}
      {/* Penny jar — top-left, fills as Pennies accumulate */}
      <div style={{
        position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', left: 10, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{ position: 'relative', width: 34, height: 42 }}>
          {/* Jar (placeholder art: CSS jar) */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '6px 6px 14px 14px',
            border: '2.5px solid rgba(120,85,40,0.75)',
            background: 'rgba(255,250,238,0.35)', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${Math.round(jarFill * 100)}%`,
              background: 'linear-gradient(180deg, #f2c75c, #d49a2e)',
              transition: 'height 0.6s ease',
            }} />
          </div>
          {/* Lid */}
          <div style={{
            position: 'absolute', top: -4, left: 3, right: 3, height: 6,
            borderRadius: 3, background: 'rgba(120,85,40,0.85)',
          }} />
          {/* Coin drop on earnings */}
          {coinDrop && (
            <span key={coinDrop} style={{
              position: 'absolute', top: -2, left: '50%', marginLeft: -8,
              fontSize: 16, pointerEvents: 'none',
              animation: 'coinFall 0.8s ease-in both',
            }}>🪙</span>
          )}
        </div>
        <span style={{
          fontSize: 15, color: '#5a3a1a', fontWeight: 'bold',
          background: 'rgba(255,240,200,0.9)', borderRadius: 14, padding: '4px 11px',
          border: '1px solid rgba(180,140,70,0.5)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>{save.pennies}</span>
      </div>

      {/* Controls — top-right */}
      <div style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 10, zIndex: 20, display: 'flex', gap: 8 }}>
        {save.music.lyricsUnlocked && (
          <button
            onPointerDown={() => updateSave(s => ({ ...s, music: { ...s.music, lyricsEnabled: !s.music.lyricsEnabled } }))}
            style={hudBtn}
            aria-label={save.music.lyricsEnabled ? 'Switch to instrumental' : 'Switch to lyrics'}
          >
            {save.music.lyricsEnabled ? '🎤' : '🎼'}
          </button>
        )}
        <button onPointerDown={() => setStatsOpen(true)} style={hudBtn} aria-label="Record book">📖</button>
        <button onPointerDown={onToggleMute} style={hudBtn} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔉'}
        </button>
        <button onPointerDown={onOpenShop} style={hudBtn} aria-label="Shop">🛍️</button>
      </div>

      {/* Welcome back moment */}
      {showWelcome && (
        <div style={{
          position: 'absolute', top: 'calc(64px + env(safe-area-inset-top))', left: '50%', zIndex: 25,
          animation: 'welcomeIn 0.5s ease-out', pointerEvents: 'none',
          background: 'rgba(60,40,15,0.82)', color: '#ffeec8',
          padding: '8px 18px', borderRadius: 18, fontStyle: 'italic', fontSize: 14,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
        }}>
          The room is glad to see you ✨
        </div>
      )}

      {/* Reveal wash — a soft warm glow that rises and settles with the fade */}
      {revealFlash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 28, pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(255,240,190,0.85), rgba(245,205,110,0.4))',
          animation: 'revealFlash 2.3s ease-in-out both',
        }} />
      )}

      {/* Reveal line */}
      {revealLine && (
        <div key={revealLine.key} style={{
          position: 'absolute', bottom: '12%', left: '50%', zIndex: 29,
          animation: 'revealLineIn 0.5s ease-out both', pointerEvents: 'none',
          background: 'rgba(50,32,12,0.88)', color: '#ffeec8',
          padding: '10px 22px', borderRadius: 20, fontStyle: 'italic', fontSize: 15,
          boxShadow: '0 4px 18px rgba(0,0,0,0.4)', maxWidth: '82%', textAlign: 'center',
        }}>
          {revealLine.text}
        </div>
      )}

      {/* Pet arrival card */}
      {arrival && (
        <div key={`card-${arrival.key}`} style={{
          position: 'absolute', bottom: '18%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 29, animation: 'cardIn 0.4s ease-out both', pointerEvents: 'none',
          background: 'linear-gradient(160deg,#fffdf2,#f3e6c4)', color: '#6a4a28',
          border: '2px solid #d4aa60', borderRadius: 18, padding: '12px 20px',
          fontSize: 14, fontStyle: 'italic', maxWidth: '80%', textAlign: 'center',
          boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 17, fontStyle: 'normal', marginBottom: 4 }}>
            {arrival.name} is home 🐾
          </div>
          {arrival.line}
        </div>
      )}

      {/* ── Project card modal ── */}
      {projectCardOpen && project && (
        <Modal onClose={() => setProjectCardOpen(false)}>
          <h3 style={{ margin: '0 0 6px', fontWeight: 'normal', color: '#5a3a1a', fontSize: 21 }}>{project.name}</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#8a6f50', fontStyle: 'italic', lineHeight: 1.45 }}>
            {project.teaser}
          </p>
          {building ? (
            <div style={{ fontSize: 13.5, color: '#7a5430' }}>
              🧰 Underway — ready in {formatDuration(Math.max(0, active.completesAt - now))}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: save.pennies >= project.cost ? '#7a5430' : 'rgba(140,110,70,0.55)', marginBottom: 16 }}>
                🪙 {project.cost} &nbsp;·&nbsp; takes {formatDuration(project.durationMs)}
              </div>
              <button
                onPointerDown={handleBeginProject}
                disabled={save.pennies < project.cost}
                style={{
                  padding: '10px 24px', borderRadius: 16,
                  border: '2px solid ' + (save.pennies >= project.cost ? '#b8843c' : 'rgba(150,110,60,0.25)'),
                  background: save.pennies >= project.cost ? 'linear-gradient(135deg,#e8b45a,#c8862a)' : 'transparent',
                  color: save.pennies >= project.cost ? '#fff8e7' : 'rgba(140,110,70,0.55)',
                  fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold',
                  cursor: save.pennies >= project.cost ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                }}
              >
                {save.pennies >= project.cost ? 'Let’s do it' : 'A few more Pennies first'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ── Achievements tray viewer ── */}
      {trayOpen && (
        <Modal onClose={() => { setTrayOpen(false); setTrayDetail(null); }} wide>
          <h3 style={{ margin: '0 0 2px', fontWeight: 'normal', color: '#5a3a1a', fontSize: 20 }}>The Type Tray</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#8a6f50', fontStyle: 'italic' }}>
            Every little thing you’ve done, kept safe.
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7,
            maxHeight: '40dvh', overflowY: 'auto', padding: 2,
          }}>
            {ACHIEVEMENTS.map(a => {
              const at = unlockedAch[a.id];
              return (
                <button key={a.id}
                  onPointerDown={() => at && setTrayDetail(a.id)}
                  style={{
                    aspectRatio: '1', borderRadius: 10,
                    border: '1.5px solid ' + (at ? '#cfa050' : 'rgba(150,110,60,0.2)'),
                    background: at ? 'linear-gradient(135deg,#fff6dc,#f3e2ac)' : 'rgba(180,150,100,0.12)',
                    fontSize: 20, cursor: at ? 'pointer' : 'default',
                    opacity: at ? 1 : 0.5,
                    filter: at ? 'none' : 'grayscale(1) blur(0.4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                  }}
                  aria-label={at ? a.name : 'Locked'}
                >
                  {at ? trinketEmoji(a) : '·'}
                </button>
              );
            })}
          </div>
          {trayDetail && (() => {
            const a = ACHIEVEMENTS.find(x => x.id === trayDetail);
            const at = unlockedAch[trayDetail];
            return (
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 14, textAlign: 'left',
                background: 'linear-gradient(135deg,#fff6dc,#f6e2a8)', border: '1.5px solid #d8b256',
                animation: 'cardIn 0.3s ease-out both',
              }}>
                <div style={{ fontSize: 14, color: '#6a4310', fontWeight: 'bold' }}>{trinketEmoji(a)} {a.name}</div>
                <div style={{ fontSize: 12, color: '#8a6a40', fontStyle: 'italic', margin: '3px 0' }}>{a.description}</div>
                <div style={{ fontSize: 11, color: '#a07a40' }}>
                  earned {new Date(at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── The record book (stats) ── */}
      {statsOpen && (() => {
        const st = save.stats;
        const losses = st.gamesPlayed - st.gamesWon;
        const winRate = st.gamesPlayed > 0 ? Math.round((st.gamesWon / st.gamesPlayed) * 100) : 0;
        const achCount = Object.keys(unlockedAch).length;
        return (
          <Modal onClose={closeStats} wide>
            <h3 style={{ margin: '0 0 2px', fontWeight: 'normal', color: '#5a3a1a', fontSize: 20 }}>The Record Book</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#8a6f50', fontStyle: 'italic' }}>
              Every game counts. Especially the silly ones.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, textAlign: 'left' }}>
              <StatRow label="Record" value={`${st.gamesWon}–${losses}`} />
              <StatRow label="Win rate" value={st.gamesPlayed > 0 ? `${winRate}%` : '—'} />
              <StatRow label="Games played" value={st.gamesPlayed} />
              <StatRow label="Current streak" value={st.currentWinStreak} />
              <StatRow label="Best streak" value={st.bestWinStreak} />
              <StatRow label="Today" value={st.gamesPlayedToday} />
              <StatRow label="Pennies earned (ever)" value={`🪙 ${st.totalPenniesEarned}`} />
              <StatRow label="Achievements" value={`${achCount} / ${ACHIEVEMENTS.length}`} />
            </div>

            <div style={{
              margin: '14px 0 6px', fontSize: 12, color: '#a07a40',
              fontStyle: 'italic', letterSpacing: 0.5, textAlign: 'left',
            }}>
              vs each Charlie
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {AI_TIERS.map(t => {
                const w = st.winsByTier?.[t.id] ?? 0;
                const g = st.gamesByTier?.[t.id] ?? 0;
                return (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,250,235,0.6)', border: '1px solid rgba(150,110,60,0.25)',
                    borderRadius: 10, padding: '5px 12px',
                  }}>
                    <span style={{ fontSize: 13, color: '#5a3a1a' }}>{t.emoji} {t.name}</span>
                    <span style={{ fontSize: 12.5, color: '#8a6030' }}>
                      {g > 0 ? `${w}–${Math.max(0, g - w)}` : 'not yet played'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Keepsake: back up & restore this little world ── */}
            <div style={{
              margin: '16px 0 6px', fontSize: 12, color: '#a07a40',
              fontStyle: 'italic', letterSpacing: 0.5, textAlign: 'left',
            }}>
              keepsake
            </div>

            <div style={{ textAlign: 'left' }}>
              <button onPointerDown={makeBackup} style={keepsakeBtn}>
                💾 Copy a backup
              </button>
              <button onPointerDown={() => { setRestoreOpen(o => !o); setRestoreMsg(null); }} style={{ ...keepsakeBtn, marginLeft: 8 }}>
                ↩ Restore
              </button>

              {/* The backup code — always shown for manual copy (clipboard is best-effort) */}
              {backupCode && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#8a6f50', fontStyle: 'italic', marginBottom: 4 }}>
                    {copied ? 'Copied ✓ — paste it somewhere safe (Notes, a text to yourself).'
                            : 'Select all and copy this — keep it somewhere safe.'}
                  </div>
                  <textarea readOnly value={backupCode}
                    onFocus={e => e.target.select()}
                    onPointerUp={e => e.target.select()}
                    style={keepsakeBox} />
                </div>
              )}

              {/* Restore: paste a code → confirm → overwrite */}
              {restoreOpen && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#8a6f50', fontStyle: 'italic', marginBottom: 4 }}>
                    Paste a backup code to bring that world back.
                  </div>
                  <textarea value={restoreText} onChange={e => setRestoreText(e.target.value)}
                    placeholder="ASHY1-…" style={keepsakeBox} />
                  <button onPointerDown={tryRestore} style={{ ...keepsakeBtn, marginTop: 6 }}>
                    Restore from this code
                  </button>
                </div>
              )}

              {restoreMsg && (
                <div style={{
                  marginTop: 8, fontSize: 12,
                  color: restoreMsg.ok ? '#6a8a4a' : '#a85a30', fontStyle: 'italic',
                }}>
                  {restoreMsg.text}
                </div>
              )}
            </div>

            {/* ── What's new ── */}
            <div style={{
              margin: '16px 0 6px', fontSize: 12, color: '#a07a40',
              fontStyle: 'italic', letterSpacing: 0.5, textAlign: 'left',
            }}>
              <button onPointerDown={() => setChangelogOpen(o => !o)} style={{
                ...keepsakeBtn, background: 'rgba(255,250,235,0.6)', color: '#7a5430',
                border: '1.5px solid rgba(150,110,60,0.35)',
              }}>
                ✨ what’s new {changelogOpen ? '▾' : '▸'}
              </button>
            </div>
            {changelogOpen && (
              <div style={{ textAlign: 'left' }}>
                {CHANGELOG.map(drop => (
                  <div key={drop.title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, color: '#5a3a1a', fontWeight: 'bold', marginBottom: 3 }}>{drop.title}</div>
                    {drop.notes.map((note, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#7a5430', fontStyle: 'italic', lineHeight: 1.45, marginBottom: 2 }}>
                        • {note}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* ── Restore confirm (overwrites current progress) ── */}
      {pendingRestore && (
        <Modal onClose={() => setPendingRestore(null)}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>↩</div>
          <h3 style={{ margin: '0 0 8px', fontWeight: 'normal', color: '#5a3a1a', fontSize: 19 }}>
            Bring this world back?
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#8a6f50', fontStyle: 'italic', lineHeight: 1.45 }}>
            This replaces everything here right now with the backup:
          </p>
          <div style={{
            margin: '0 0 16px', fontSize: 13.5, color: '#6a4310',
            background: 'rgba(255,250,235,0.7)', border: '1px solid rgba(150,110,60,0.3)',
            borderRadius: 12, padding: '8px 12px',
          }}>
            🪙 {pendingRestore.pennies} · room {pendingRestore.roomStateIndex}/{PROJECTS.length} · {pendingRestore.stats.gamesWon} wins
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onPointerDown={() => setPendingRestore(null)} style={{
              padding: '9px 18px', borderRadius: 14,
              border: '1.5px solid rgba(120,80,40,0.4)', background: 'rgba(120,80,40,0.1)',
              color: '#7a5430', fontFamily: 'Georgia, serif', fontSize: 13,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>
              Keep what I have
            </button>
            <button onPointerDown={confirmRestore} style={{
              padding: '9px 18px', borderRadius: 14,
              border: '2px solid #b8843c', background: 'linear-gradient(135deg,#e8b45a,#c8862a)',
              color: '#fff8e7', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>
              Restore
            </button>
          </div>
        </Modal>
      )}

      {/* ── Song gift card ── */}
      {songCardOpen && (
        <Modal onClose={() => setSongCardOpen(false)}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>💝</div>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: '#6a4a28', lineHeight: 1.55 }}>
            {SONG_GIFT.cardText}
          </p>
          <div style={{ fontSize: 12, color: '#a07a40', fontStyle: 'italic' }}>♪ now playing ♪</div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Modal({ children, onClose, wide = false }) {
  return (
    <div onPointerDown={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'rgba(30,20,10,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onPointerDown={e => e.stopPropagation()} style={{
        background: 'linear-gradient(160deg,#fffdf2,#f3e6c4)',
        borderRadius: 20, padding: '24px 26px', maxWidth: wide ? 380 : 300, width: '100%',
        textAlign: 'center', border: '2px solid #d4aa60', boxShadow: '0 8px 36px rgba(0,0,0,0.4)',
        animation: 'cardIn 0.3s ease-out both',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── The Bustler ───────────────────────────────────────────────────────────────
// A small hard worker who appears wherever a project is underway. He carries
// things, inspects things, kicks up a great deal of dust, and — as it settles —
// is caught dancing. When the work is done he stands there. Proud.
// While he works, a light-grey ring shows the project's overall progress.

const BUSTLER_PHASES = [
  { id: 'carry', ms: 2800 },
  { id: 'inspect', ms: 2200 },
  { id: 'dust', ms: 2400 },
  { id: 'dance', ms: 2600 },
];

function Bustler({ mode, progress = 0 }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (mode !== 'working') return;
    let idx = 0;
    let t;
    const advance = () => {
      idx = (idx + 1) % BUSTLER_PHASES.length;
      setPhase(idx);
      t = setTimeout(advance, BUSTLER_PHASES[idx].ms);
    };
    t = setTimeout(advance, BUSTLER_PHASES[0].ms);
    return () => clearTimeout(t);
  }, [mode]);

  const p = BUSTLER_PHASES[phase].id;
  const R = 27;
  const C = 2 * Math.PI * R;

  return (
    <div style={{ position: 'relative', width: 62, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Overall progress — light grey ring */}
      {mode === 'working' && (
        <svg width="62" height="62" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="31" cy="31" r={R} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" />
          <circle cx="31" cy="31" r={R} fill="none" stroke="rgba(218,218,212,0.95)" strokeWidth="3.5"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={(1 - progress) * C}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
      )}

      {mode === 'proud' ? (
        <>
          <span style={{
            fontSize: 26, animation: 'bustlerProud 1.8s ease-in-out infinite',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4)) drop-shadow(0 0 10px rgba(245,200,80,0.7))',
          }}>🧑‍🔧</span>
          <span style={{ position: 'absolute', left: 2, top: 8, fontSize: 12, animation: 'hintMote 2s ease-in-out infinite' }}>✨</span>
          <span style={{ position: 'absolute', right: 2, top: 14, fontSize: 11, animation: 'hintMote 2.5s ease-in-out 0.5s infinite' }}>✨</span>
        </>
      ) : (
        <>
          {/* The worker himself, busy at his current task */}
          <span style={{
            fontSize: 23,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
            opacity: p === 'dust' ? 0.3 : 1,
            transition: 'opacity 0.5s',
            animation: p === 'carry' ? 'bustlerCarry 2.8s linear infinite'
              : p === 'inspect' ? 'bustlerInspect 2.2s ease-in-out infinite'
              : p === 'dance' ? 'bustlerDance 1.3s ease-in-out infinite'
              : 'none',
          }}>
            {p === 'dance' ? '🕺' : '🧑‍🔧'}
          </span>

          {/* What he's hauling / pondering */}
          {p === 'carry' && (
            <span style={{ position: 'absolute', bottom: 12, fontSize: 12, animation: 'bustlerCarry 2.8s linear infinite' }}>📦</span>
          )}
          {p === 'inspect' && (
            <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 11, animation: 'hintMote 2.2s ease-in-out infinite' }}>🤔</span>
          )}

          {/* The dust — billowing during 'dust', settling as he dances */}
          {(p === 'dust' || p === 'dance') && [0, 1, 2].map(i => (
            <span key={`${p}-${i}`} style={{
              position: 'absolute',
              left: `${16 + i * 22}%`, bottom: `${14 + (i % 2) * 16}%`,
              fontSize: p === 'dust' ? 15 : 10,
              '--dx': `${(i - 1) * 12}px`,
              animation: `dustPuff ${1.1 + i * 0.3}s ease-out ${i * 0.25}s infinite`,
              opacity: p === 'dance' ? 0.4 : 1,
            }}>💨</span>
          ))}
        </>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,250,235,0.6)', border: '1px solid rgba(150,110,60,0.25)',
      borderRadius: 10, padding: '6px 11px',
    }}>
      <div style={{ fontSize: 10.5, color: '#a07a40', fontStyle: 'italic' }}>{label}</div>
      <div style={{ fontSize: 15, color: '#5a3a1a', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

// A pet at a spot. Shows its pose image, or a clearly-marked placeholder when the
// art doesn't exist yet. Gentle breathing loop = "alive". Tap → heart + reaction.
function Pet({ def, spot, reaction, onTap }) {
  const size = 12; // % of room width — ≥44px even on small phones
  return (
    <div
      onPointerDown={onTap}
      style={{
        position: 'absolute', left: `${spot.position.x}%`, top: `${spot.position.y}%`,
        width: `${size}%`, paddingTop: `${size}%`,
        transform: 'translate(-50%,-50%)',
        zIndex: spot.zOrder ?? 6, cursor: 'pointer',
        animation: 'petBreathe 4s ease-in-out infinite',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}
    >
      {spot.pose ? (
        <img src={spot.pose} alt={def.name} draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))',
        }} />
      ) : (
        // Clearly-marked placeholder — replace by setting `pose` on the spot in petSpots.js
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: def.placeholderColor,
          border: '2px dashed rgba(255,255,255,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{def.emoji}</span>
          <span style={{ fontSize: 8, color: 'rgba(40,25,10,0.8)', marginTop: 1 }}>{def.name}</span>
        </div>
      )}

      {/* Tap reaction */}
      {reaction && (
        <div key={reaction.key} style={{
          position: 'absolute', top: -6, left: '50%',
          fontSize: 20, pointerEvents: 'none',
          animation: 'petTapPop 1.1s ease-out forwards',
        }}>
          {reaction.emoji}
        </div>
      )}
    </div>
  );
}

const hudBtn = {
  background: 'rgba(255,240,200,0.9)', border: '1px solid rgba(180,140,70,0.5)',
  borderRadius: 14, padding: '5px 10px', fontSize: 16, lineHeight: 1, cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  minWidth: 44, minHeight: 44, // comfortable thumb target
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

function panBtn(disabled) {
  return {
    width: 48, height: 48, borderRadius: 24,
    border: '1.5px solid rgba(180,140,70,0.6)',
    background: 'rgba(255,245,225,0.92)',
    color: '#7a5430', fontSize: 24, lineHeight: 1, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  };
}

const keepsakeBtn = {
  padding: '8px 14px', borderRadius: 12,
  border: '1.5px solid #b8843c', background: 'linear-gradient(135deg,#e8b45a,#c8862a)',
  color: '#fff8e7', fontFamily: 'Georgia, serif', fontSize: 12.5, fontWeight: 'bold',
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
};

const keepsakeBox = {
  width: '100%', minHeight: 56, boxSizing: 'border-box', resize: 'none',
  borderRadius: 10, border: '1px solid rgba(150,110,60,0.4)',
  background: 'rgba(255,250,238,0.85)', color: '#6a4a28',
  fontFamily: 'monospace', fontSize: 11, padding: '7px 9px', lineHeight: 1.4,
  wordBreak: 'break-all', WebkitTapHighlightColor: 'transparent',
};
