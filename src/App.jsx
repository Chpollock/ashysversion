import { useState, useRef, useEffect } from 'react';
import LoadingScreen from './screens/LoadingScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import musicFile from './assets/theme-music.mp3';

export default function App() {
  const [screen, setScreen] = useState('loading'); // 'loading' | 'game'
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(musicFile);
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  function handleEnterGame() {
    setScreen('game');
  }

  if (screen === 'loading') {
    return <LoadingScreen onEnter={handleEnterGame} audioRef={audioRef} />;
  }

  return <GameScreen audioRef={audioRef} />;
}
