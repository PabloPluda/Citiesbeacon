import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { createGameConfig } from '../game/GameConfig';
import { EventBus } from '../game/EventBus';
import { useProgressStore } from '../store/progressStore';
import PuzzleReveal from '../components/PuzzleReveal';
import { ThrowToBinScene } from '../game/scenes/ThrowToBinScene';
import { CrossingScene } from '../game/scenes/CrossingScene';
import { LightsOutScene } from '../game/scenes/LightsOutScene';
import { WaterSaverScene } from '../game/scenes/WaterSaverScene';

const SCENE_MAP: Record<number, any> = {
  1: ThrowToBinScene,
  2: CrossingScene,
  3: LightsOutScene,
  4: WaterSaverScene
};

// ─── Circular countdown timer ─────────────────────────────────────────────────
function TimerRing({ timeLeft }: { timeLeft: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  // Maximum time can be technically more than 35 due to +2s, so we clamp for the circle
  const maxTime = 35;
  const offset = circ * (1 - Math.min(1, timeLeft / maxTime));
  const color = timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#22C55E';
  return (
    <div style={{ position: 'relative', width: 60, height: 60 }}>
      <svg width={60} height={60} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={30} cy={30} r={r} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth={5} />
        <circle
          cx={30} cy={30} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'Fredoka One', fontSize: '1.1rem',
        textShadow: '1px 1px 3px black',
      }}>
        {timeLeft}
      </div>
    </div>
  );
}

// ─── Level-complete overlay ───────────────────────────────────────────────────
function LevelCompleteOverlay({ level, onSeeResults }: { level: number; onSeeResults: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.1, opacity: 0 }}
      transition={{ type: 'spring', bounce: 0.45 }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,20,60,0.88)', zIndex: 40, gap: 16,
      }}
    >
      <div style={{ fontSize: '4rem' }}>🎉</div>
      <h2 style={{ fontFamily: 'Fredoka One', color: '#FFD700', fontSize: '2.2rem', textAlign: 'center' }}>
        Level {level} Clear!
      </h2>
      <p style={{ fontFamily: 'Fredoka', color: '#A0AEC0', fontSize: '1.1rem' }}>
        You bagged all 7 pieces of trash!
      </p>
      <motion.button
        whileTap={{ scale: 0.93 }}
        className="btn btn-primary"
        onClick={onSeeResults}
        style={{ marginTop: 12, fontSize: '1.1rem', padding: '14px 28px' }}
      >
        See Your Puzzle! 🧩
      </motion.button>
    </motion.div>
  );
}

// ─── Time-up overlay ──────────────────────────────────────────────────────────
function TimeUpOverlay({ scored, onRetry, onQuit }: { scored: string; onRetry: () => void; onQuit: () => void }) {
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,20,60,0.88)', zIndex: 40, gap: 16,
      }}
    >
      <div style={{ fontSize: '3.5rem' }}>⏰</div>
      <h2 style={{ fontFamily: 'Fredoka One', color: '#EF4444', fontSize: '2rem' }}>Time's Up!</h2>
      <p style={{ fontFamily: 'Fredoka', color: '#A0AEC0', fontSize: '1.1rem' }}>
        You got {scored} / 7 pieces. So close!
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <motion.button whileTap={{ scale: 0.93 }} className="btn btn-primary" onClick={onRetry}
          style={{ fontSize: '1rem', padding: '12px 22px' }}>
          Try Again! 💪
        </motion.button>
        <motion.button whileTap={{ scale: 0.93 }} className="btn"
          onClick={onQuit}
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem', padding: '12px 22px' }}>
          Quit
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Main GameWindow ──────────────────────────────────────────────────────────
type Phase = 'playing' | 'levelComplete' | 'timeUp' | 'puzzleReveal';

export default function GameWindow() {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const mId = parseInt(missionId || '1', 10);

  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { completeLevel, getHighestLevel } = useProgressStore();
  
  // Calculate initial level to jump right in
  const highest = getHighestLevel(mId);
  const initial = highest >= 20 ? 20 : highest + 1; // Play next uncompleted level or max

  const levelRef = useRef(initial);
  const [level, setLevel] = useState(initial);
  const [scored, setScored] = useState('0/7');
  const [timeLeft, setTimeLeft] = useState(35);
  const [phase, setPhase] = useState<Phase>('playing');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPreLevel, setShowPreLevel] = useState(false);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      const SceneClass = SCENE_MAP[mId] || ThrowToBinScene;
      gameRef.current = new Phaser.Game(createGameConfig(containerRef.current, SceneClass));
    }

    // Inject level data into Phaser the very first time it loads
    const onSceneReady = () => {
       if (levelRef.current > 1) {
         EventBus.emit('restart-scene', { level: levelRef.current });
       }
    };
    EventBus.once('current-scene-ready', onSceneReady);

    const onTimer = (t: number) => setTimeLeft(t);
    const onScored = (n: string | number) => setScored(String(n));

    const onLevelComplete = (completedLevel: number) => {
      completeLevel(mId, completedLevel);
      setPhase('levelComplete');
    };
    const onTimeUp = () => setPhase('timeUp');

    EventBus.on('game-timer', onTimer);
    EventBus.on('game-scored-update', onScored);
    EventBus.on('game-level-complete', onLevelComplete);
    EventBus.on('game-time-up', onTimeUp);
    EventBus.on('show-tutorial', () => setShowTutorial(true));
    EventBus.on('show-pre-level', () => setShowPreLevel(true));

    return () => {
      EventBus.off('game-timer', onTimer);
      EventBus.off('game-scored-update', onScored);
      EventBus.off('game-level-complete', onLevelComplete);
      EventBus.off('game-time-up', onTimeUp);
      EventBus.off('show-tutorial', () => setShowTutorial(false));
      EventBus.off('show-pre-level', () => setShowPreLevel(false));
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [mId]);  // eslint-disable-line

  // After level complete, show puzzle
  const handleSeeResults = () => setPhase('puzzleReveal');

  // From puzzle: go to next level
  const handleNextLevel = () => {
    const next = levelRef.current + 1;
    levelRef.current = next;
    setLevel(next);
    setScored('0/7');
    setTimeLeft(35);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: next });
  };

  // Mission done → replay from lvl 1
  const handlePlayAgain = () => {
    levelRef.current = 1;
    setLevel(1);
    setScored('0/7');
    setTimeLeft(35);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: 1 });
  };

  // Retry same level
  const handleRetry = () => {
    setScored('0/7');
    setTimeLeft(35);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: levelRef.current });
  };

  const isMissionComplete = level >= 20 && phase === 'puzzleReveal';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {/* Phaser canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ─ Tutorial HTML overlay (crisp native text) ──────────────────── */}
      {showTutorial && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 45,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', pointerEvents: 'none',
        }}>
          {/* Title + subtitle — positioned to sit just above the animation area */}
          <div style={{
            position: 'absolute', top: '32%', width: '100%',
            textAlign: 'center', padding: '0 24px', pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: 'Fredoka One, cursive', fontSize: '1.8rem',
              color: '#22C55E', textShadow: '0 2px 8px rgba(0,0,0,0.8)', marginBottom: 8,
            }}>Stretch &amp; Release!</div>
            <div style={{
              fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
              color: '#fff', textShadow: '0 1px 5px rgba(0,0,0,0.9)', lineHeight: 1.4,
            }}>Pull it back like a slingshot,<br/>then let go to launch it in the bin!</div>
          </div>
          {/* Got it button — sits below the animation */}
          <button
            id="btn-got-it"
            onClick={() => { setShowTutorial(false); EventBus.emit('tutorial-done'); }}
            style={{
              position: 'absolute', bottom: '12%',
              pointerEvents: 'auto',
              fontFamily: 'Fredoka One, cursive', fontSize: '1.25rem',
              background: '#22C55E', color: '#fff',
              border: '3px solid #166534', borderRadius: 32,
              padding: '14px 40px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              cursor: 'pointer', letterSpacing: '0.02em',
            }}
          >Got it! 👍</button>
        </div>
      )}

      {/* ─ Pre-level HTML overlay ─────────────────────────────────────── */}
      {showPreLevel && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 55,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,18,37,0.58)',
        }}>
          <div style={{
            background: '#FFFdf5',
            borderRadius: 26, overflow: 'hidden',
            width: 'min(340px, calc(100vw - 48px))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '3px solid #22C55E',
            textAlign: 'center',
          }}>
            {/* Green top bar */}
            <div style={{
              background: '#22C55E', padding: '14px 0',
              fontFamily: 'Fredoka One, cursive', fontSize: '1rem', color: '#fff',
            }}>City Hero Academy 🌍</div>
            {/* Content */}
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 4 }}>😮</div>
              <div style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '2rem',
                color: '#F59E0B', marginBottom: 6,
              }}>Uh Oh!</div>
              <div style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '1.1rem',
                color: '#374151', marginBottom: 20, lineHeight: 1.4,
              }}>Now the bin is<br/>a bit smaller!</div>
              <button
                id="btn-pre-level"
                onClick={() => { setShowPreLevel(false); EventBus.emit('pre-level-done'); }}
                style={{
                  width: '100%',
                  fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                  background: '#22C55E', color: '#fff',
                  border: 'none', borderRadius: 24,
                  padding: '14px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              >Let's keep the street clean! 🧹</button>
            </div>
          </div>
        </div>
      )}

      {/* ─ HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        {/* Back */}
        <button
          id="btn-back"
          onClick={() => navigate('/map')}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(255,255,255,0.92)', border: 'none',
            borderRadius: '50%', width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)', cursor: 'pointer',
          }}
        >
          <ChevronLeft size={24} color="var(--primary)" />
        </button>

        {/* Timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <TimerRing timeLeft={timeLeft} />
          <span style={{
            fontFamily: 'Fredoka One', fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)',
            textShadow: '1px 1px 2px black', letterSpacing: '0.05em',
          }}>
            LVL {level}/20
          </span>
        </div>

        {/* Scored */}
        <div style={{
          background: 'rgba(255,255,255,0.92)', borderRadius: 20,
          padding: '6px 14px', textAlign: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.5rem', color: 'var(--primary)', lineHeight: 1 }}>
            {scored}
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: '0.65rem', color: '#999' }}>SCORED</div>
        </div>
      </div>

      {/* ─ Overlays ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'levelComplete' && (
          <LevelCompleteOverlay key="lvlcomplete" level={level} onSeeResults={handleSeeResults} />
        )}
        {phase === 'timeUp' && (
          <TimeUpOverlay key="timeup" scored={scored} onRetry={handleRetry} onQuit={() => navigate('/map')} />
        )}
        {phase === 'puzzleReveal' && (
          <PuzzleReveal
            key="puzzle"
            missionId={mId}
            currentLevel={level}
            isMissionComplete={isMissionComplete}
            onNextLevel={handleNextLevel}
            onPlayAgain={handlePlayAgain}
            onQuit={() => navigate('/map')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
