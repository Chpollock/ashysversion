import { useRef, useEffect, useState } from 'react';
import LoadingScreen from './screens/LoadingScreen.jsx';
import RoomScreen from './screens/RoomScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ShopScreen from './screens/ShopScreen.jsx';
import { useSaveState } from './state/useSaveState.js';
import { relocatePets } from './game/petSpots.js';
import instrumentalFile from './assets/ashton-song-instrumental.mp3';
import lyricsFile from './assets/ashton-song-lyrics.mp3';

// Local 'YYYY-MM-DD' date string for the daily rhythm check
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const [screen, setScreen] = useState('loading'); // 'loading' | 'room' | 'game' | 'shop'
  const [welcomeBack, setWelcomeBack] = useState(false);
  const { save, updateSave } = useSaveState();
  const audioRef = useRef(null);

  const muted = save.music.muted;
  const wantLyrics = save.music.lyricsUnlocked && save.music.lyricsEnabled;

  // Create the audio element once
  useEffect(() => {
    const audio = new Audio(wantLyrics ? lyricsFile : instrumentalFile);
    audio.loop = true;
    audio.volume = 0.35;
    audio.muted = save.music.muted;
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap track when the lyrics toggle changes, preserving playback position-ish
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = wantLyrics ? lyricsFile : instrumentalFile;
    if (!audio.src.endsWith(target.split('/').pop())) {
      const wasPlaying = !audio.paused;
      audio.src = target;
      audio.load();
      if (wasPlaying) audio.play().catch(() => {});
    }
  }, [wantLyrics]);

  // Keep mute in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // ── Daily rhythm — runs once on mount ──────────────────────────────────────
  useEffect(() => {
    const today = todayStr();
    if (save.stats.lastPlayedDate !== today) {
      const isReturning = save.stats.lastPlayedDate !== null; // not a brand-new save
      updateSave(s => ({
        ...s,
        firstWinOfDayDone: false,
        stats: { ...s.stats, gamesPlayedToday: 0, lastPlayedDate: today },
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isReturning) setWelcomeBack(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMute() {
    updateSave(s => ({ ...s, music: { ...s.music, muted: !s.music.muted } }));
  }

  // The song gift: play the lyrics track through ONCE as a focused moment —
  // background loop pauses, the song plays, then the loop quietly returns.
  function playLyricsOnce() {
    const bg = audioRef.current;
    bg?.pause();
    const song = new Audio(lyricsFile);
    song.volume = 0.55;
    const resume = () => {
      if (bg && !save.music.muted) bg.play().catch(() => {});
    };
    song.addEventListener('ended', resume, { once: true });
    song.addEventListener('error', resume, { once: true });
    song.play().catch(resume);
  }

  // Enter the room, relocating pets first (while the room is off-screen, so a pet
  // never visibly teleports). reason: 'appOpen' factors time away; 'return' is a
  // flat per-pet chance.
  function enterRoom(reason) {
    updateSave(s => {
      const { pets, pendingGifts } = relocatePets(s, reason);
      return { ...s, pets, pendingGifts };
    });
    setScreen('room');
  }

  function startMusicAndEnter() {
    // iOS requires audio.play() inside a user gesture (the loading-screen tap)
    if (audioRef.current && !save.music.muted) {
      audioRef.current.play().catch(() => {});
    }
    enterRoom('appOpen');
  }

  if (screen === 'loading') {
    return <LoadingScreen onEnter={startMusicAndEnter} audioRef={audioRef} />;
  }

  if (screen === 'room') {
    return (
      <RoomScreen
        save={save}
        updateSave={updateSave}
        muted={muted}
        onToggleMute={toggleMute}
        welcomeBack={welcomeBack}
        onEnterGame={() => { setWelcomeBack(false); setScreen('game'); }}
        onOpenShop={() => { setWelcomeBack(false); setScreen('shop'); }}
        onPlayLyricsOnce={playLyricsOnce}
      />
    );
  }

  if (screen === 'shop') {
    return (
      <ShopScreen
        save={save}
        updateSave={updateSave}
        onBack={() => enterRoom('return')}
      />
    );
  }

  // game
  return (
    <GameScreen
      save={save}
      updateSave={updateSave}
      muted={muted}
      onToggleMute={toggleMute}
      onBackToRoom={() => enterRoom('return')}
    />
  );
}
