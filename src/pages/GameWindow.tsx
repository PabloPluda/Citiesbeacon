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
import { NotMyDogScene } from '../game/scenes/NotMyDogScene';

const SCENE_MAP: Record<number, any> = {
  1: ThrowToBinScene,
  2: CrossingScene,
  3: LightsOutScene,
  4: WaterSaverScene,
  5: NotMyDogScene,
};

// ─── Circular countdown timer ─────────────────────────────────────────────────
function TimerRing({ timeLeft, maxTime }: { timeLeft: number; maxTime: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
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
const LEVEL_COMPLETE_MSG: Record<number, string> = {
  1: 'You bagged all the trash! 🗑️',
  2: 'You crossed safely! 🚦',
  3: 'All lights off! 💡',
  4: 'Water saved! 💧',
  5: 'The dog is home! 🏠🐕',
};

function LevelCompleteOverlay({ level, missionId, onSeeResults }: { level: number; missionId: number; onSeeResults: () => void }) {
  const msg = LEVEL_COMPLETE_MSG[missionId] ?? 'Level complete!';
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
      <div style={{ fontSize: '4rem' }}>{missionId === 5 ? '🐕' : '🎉'}</div>
      <h2 style={{ fontFamily: 'Fredoka One', color: '#FFD700', fontSize: '2.2rem', textAlign: 'center' }}>
        Level {level} Clear!
      </h2>
      <p style={{ fontFamily: 'Fredoka', color: '#A0AEC0', fontSize: '1.1rem', textAlign: 'center' }}>
        {msg}
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
  const [timeLeft, setTimeLeft] = useState(50);
  const [maxTimeLeft, setMaxTimeLeft] = useState(50); // tracks the starting time for ring
  const [phase, setPhase] = useState<Phase>('playing');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPreLevel, setShowPreLevel] = useState(false);
  const [showCrossingPenalty, setShowCrossingPenalty] = useState(false);
  const [showCrossingTutorial, setShowCrossingTutorial] = useState(false);
  const [showCrossingPraise, setShowCrossingPraise] = useState(false);
  const [showCrossingStart, setShowCrossingStart] = useState(false);
  const [crossingStartLevel, setCrossingStartLevel] = useState(1);
  const [praiseText, setPraiseText] = useState('Well done! 🎉');

  // Dog game overlays
  const [showDogTutorial, setShowDogTutorial] = useState(false);
  const [showDogPreLevel, setShowDogPreLevel] = useState(false);
  const [dogPreLevelInfo, setDogPreLevelInfo] = useState<{ level: number; hasPuddles: boolean; hasWaterBowls: boolean; numCats: number; hasDoors: boolean } | null>(null);
  const [dogMessage, setDogMessage] = useState<string | null>(null);

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

    const onTimer = (t: number) => {
      setTimeLeft(t);
      // Capture initial timer value as maxTime for the ring
      setMaxTimeLeft(prev => t > prev ? t : prev);
    };
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
    const onCrossingPenalty = () => {
      setShowCrossingPenalty(true);
      setTimeout(() => setShowCrossingPenalty(false), 2000);
    };
    EventBus.on('show-crossing-penalty', onCrossingPenalty);
    EventBus.on('show-crossing-tutorial', () => setShowCrossingTutorial(true));
    const onCrossingStart = (data?: { level?: number }) => {
      setCrossingStartLevel(data?.level ?? 1);
      setShowCrossingStart(true);
    };
    EventBus.on('show-crossing-start', onCrossingStart);
    const onCrossingPraise = () => {
      const words = ['Well done! 🎉', 'Great job! 👏', 'Awesome! ⭐', 'Perfect! 🏆'];
      setPraiseText(words[Math.floor(Math.random() * words.length)]);
      setShowCrossingPraise(true);
      setTimeout(() => setShowCrossingPraise(false), 2000);
    };
    EventBus.on('show-crossing-praise', onCrossingPraise);

    // Dog game events
    EventBus.on('show-dog-tutorial', () => setShowDogTutorial(true));
    const onDogPreLevel = (data?: { level?: number; cfg?: { hasPuddles?: boolean; hasWaterBowls?: boolean; numCats?: number; hasDoors?: boolean } }) => {
      setDogPreLevelInfo({
        level: data?.level ?? 1,
        hasPuddles: data?.cfg?.hasPuddles ?? false,
        hasWaterBowls: data?.cfg?.hasWaterBowls ?? false,
        numCats: data?.cfg?.numCats ?? 0,
        hasDoors: data?.cfg?.hasDoors ?? false,
      });
      setShowDogPreLevel(true);
    };
    EventBus.on('show-dog-prelevel', onDogPreLevel);
    const onDogMessage = (msg: string) => {
      setDogMessage(msg);
      setTimeout(() => setDogMessage(null), 2500);
    };
    EventBus.on('show-dog-message', onDogMessage);

    return () => {
      EventBus.off('game-timer', onTimer);
      EventBus.off('game-scored-update', onScored);
      EventBus.off('game-level-complete', onLevelComplete);
      EventBus.off('game-time-up', onTimeUp);
      EventBus.off('show-tutorial', () => setShowTutorial(false));
      EventBus.off('show-pre-level', () => setShowPreLevel(false));
      EventBus.off('show-crossing-penalty', onCrossingPenalty);
      EventBus.off('show-crossing-tutorial', () => setShowCrossingTutorial(false));
      EventBus.off('show-crossing-start', onCrossingStart);
      EventBus.off('show-crossing-praise', onCrossingPraise);
      EventBus.off('show-dog-tutorial', () => setShowDogTutorial(false));
      EventBus.off('show-dog-prelevel', onDogPreLevel);
      EventBus.off('show-dog-message', onDogMessage);
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
    setTimeLeft(50);
    setMaxTimeLeft(50);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: next });
  };

  // Mission done → replay from lvl 1
  const handlePlayAgain = () => {
    levelRef.current = 1;
    setLevel(1);
    setScored('0/7');
    setTimeLeft(50);
    setMaxTimeLeft(50);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: 1 });
  };

  // Retry same level
  const handleRetry = () => {
    setScored('0/7');
    setTimeLeft(50);
    setMaxTimeLeft(50);
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

      {/* ─ Crossing START / GO overlay ────────────────────────────────────────────── */}
      {showCrossingStart && (
        <div style={{
          position: 'absolute', bottom: '16%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            background: 'rgba(15,30,60,0.82)',
            borderRadius: 22,
            padding: '14px 26px',
            textAlign: 'center',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            border: '2px solid rgba(74,222,128,0.7)',
            minWidth: 220,
          }}>
            <div style={{
              fontFamily: 'Fredoka One, cursive', fontSize: '1.1rem',
              color: '#86efac', marginBottom: 4,
            }}>
              {crossingStartLevel === 1 ? 'Walk safely to school! 🎢' : `Level ${crossingStartLevel} — Ready?`}
            </div>
            <div style={{
              fontFamily: 'Fredoka One, cursive', fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.7)', marginBottom: 14,
            }}>
              Hold screen to stop · Release to walk
            </div>
            <button
              id="btn-crossing-start"
              onClick={() => { setShowCrossingStart(false); EventBus.emit('crossing-start-done'); }}
              style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '1.2rem',
                background: '#22C55E', color: '#fff',
                border: '2px solid #4ade80', borderRadius: 28,
                padding: '13px 40px', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                letterSpacing: '0.03em',
              }}
            >Let's Go! 🚶</button>
          </div>
        </div>
      )}

      {/* ─ Crossing penalty overlay ───────────────────────────────────────── */}
      {showCrossingPenalty && (
        <div style={{
          position: 'absolute', top: '10%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60, pointerEvents: 'none',
          animation: 'penalty-slide-in 0.25s ease-out',
        }}>
          <div style={{
            background: '#FEF3C7',
            border: '3px solid #F59E0B',
            borderRadius: 20,
            padding: '14px 24px',
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            minWidth: 240,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>🚦</div>
            <div style={{
              fontFamily: 'Fredoka One, cursive',
              fontSize: '1.2rem',
              color: '#92400E',
              lineHeight: 1.3,
            }}>
              Wait for the<br/>green light! 😊
            </div>
          </div>
        </div>
      )}

      {/* ─ Crossing tutorial HTML overlay (crisp) ───────────────────────────── */}
      {showCrossingTutorial && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 65,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,18,37,0.65)',
        }}>
          <div style={{
            background: '#FFFdf5',
            borderRadius: 26, overflow: 'hidden',
            width: 'min(310px, calc(100vw - 48px))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            border: '3px solid #22C55E',
            textAlign: 'center',
          }}>
            {/* Green header */}
            <div style={{
              background: '#22C55E', padding: '12px 0',
              fontFamily: 'Fredoka One, cursive', fontSize: '1rem', color: '#fff',
            }}>City Hero Academy 🌍</div>
            {/* Body */}
            <div style={{ padding: '18px 22px 22px' }}>
              <div style={{ fontSize: '2rem', marginBottom: 6 }}>🚦</div>
              <div style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '1.5rem',
                color: '#16A34A', marginBottom: 10,
              }}>Cross Safely!</div>
              <div style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '0.95rem',
                color: '#374151', lineHeight: 1.5, marginBottom: 18,
              }}>
                🔴 <strong>Red light</strong> = hold the screen to stop!<br/>
                🟢 <strong>Green light</strong> = release to walk!<br/>
                <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Crossing on red = time penalty ⏱️</span>
              </div>
              <button
                id="btn-crossing-tutorial"
                onClick={() => { setShowCrossingTutorial(false); EventBus.emit('crossing-tutorial-done'); }}
                style={{
                  width: '100%',
                  fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                  background: '#22C55E', color: '#fff',
                  border: 'none', borderRadius: 24,
                  padding: '13px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              >Let's cross! 🚶</button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Crossing praise toast ─────────────────────────────────────────────── */}
      {showCrossingPraise && (
        <div style={{
          position: 'absolute', top: '22%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 62, pointerEvents: 'none',
          animation: 'praise-pop 0.3s ease-out',
        }}>
          <div style={{
            background: 'rgba(22, 163, 74, 0.92)',
            border: '3px solid #86efac',
            borderRadius: 22,
            padding: '12px 28px',
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              fontFamily: 'Fredoka One, cursive',
              fontSize: '1.4rem',
              color: '#fff',
            }}>{praiseText}</div>
          </div>
        </div>
      )}

      {/* ─ Dog tutorial overlay ──────────────────────────────────────────────── */}
      {showDogTutorial && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 65,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,18,37,0.65)',
        }}>
          <div style={{
            background: '#FFFdf5', borderRadius: 26, overflow: 'hidden',
            width: 'min(320px, calc(100vw - 48px))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            border: '3px solid #22C55E', textAlign: 'center',
          }}>
            <div style={{ background: '#22C55E', padding: '12px 0', fontFamily: 'Fredoka One, cursive', fontSize: '1rem', color: '#fff' }}>
              City Hero Academy 🌍
            </div>
            <div style={{ padding: '18px 22px 22px' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🐕</div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '1.5rem', color: '#16A34A', marginBottom: 10 }}>
                Not my dog, still my job!
              </div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '1rem', color: '#16A34A', marginBottom: 8 }}>
                Oh no! This dog is lost! 😮
              </div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '0.92rem', color: '#374151', lineHeight: 1.65, marginBottom: 18 }}>
                His name tag says <strong>Firulai</strong>! 🏷️<br/>
                Let's help him find his way home!<br/><br/>
                🧒 You lead the way through the maze<br/>
                🐕 Firulai will follow close behind<br/>
                🏠 Reach the owner at the end to win<br/><br/>
                <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                  👉 Swipe your finger anywhere on the screen<br/>in the direction you want to go!
                </span>
              </div>
              <button
                onClick={() => { setShowDogTutorial(false); EventBus.emit('dog-tutorial-done'); }}
                style={{
                  width: '100%', fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                  background: '#22C55E', color: '#fff', border: 'none', borderRadius: 24,
                  padding: '13px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
                }}
              >Let's go! 🐾</button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Dog pre-level overlay ─────────────────────────────────────────────── */}
      {showDogPreLevel && dogPreLevelInfo && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 65,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,18,37,0.65)',
        }}>
          <div style={{
            background: '#FFFdf5', borderRadius: 26, overflow: 'hidden',
            width: 'min(300px, calc(100vw - 48px))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            border: '3px solid #4DA6FF', textAlign: 'center',
          }}>
            <div style={{ background: '#4DA6FF', padding: '12px 0', fontFamily: 'Fredoka One, cursive', fontSize: '1rem', color: '#fff' }}>
              Level {dogPreLevelInfo.level} 🐕
            </div>
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '1.3rem', color: '#1D4ED8', marginBottom: 10 }}>
                {dogPreLevelInfo.level <= 5  ? "The maze grows! 🗺️"
                : dogPreLevelInfo.level <= 10 ? "Watch for puddles! 💦"
                : dogPreLevelInfo.level <= 15 ? "Find water for the dog! 💧"
                : "Cats and doors! 😺🔧"}
              </div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '0.88rem', color: '#374151', lineHeight: 1.5, marginBottom: 16 }}>
                {dogPreLevelInfo.hasPuddles && <span>💦 Puddles slow you down<br/></span>}
                {dogPreLevelInfo.hasWaterBowls && <span>💧 Grab water bowls for +15s<br/></span>}
                {dogPreLevelInfo.numCats > 0 && <span>😺 Cats distract your dog<br/></span>}
                {dogPreLevelInfo.hasDoors && <span>🔧 Find the lever to open doors<br/></span>}
              </div>
              <button
                onClick={() => { setShowDogPreLevel(false); EventBus.emit('dog-prelevel-done'); }}
                style={{
                  width: '100%', fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                  background: '#4DA6FF', color: '#fff', border: 'none', borderRadius: 24,
                  padding: '13px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
                }}
              >I'm ready! 🐾</button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Dog fun message toast — sits just below the HUD strip ──────────────── */}
      {dogMessage && (
        <div style={{
          position: 'absolute', top: 68, left: '50%', transform: 'translateX(-50%)',
          zIndex: 62, pointerEvents: 'none', animation: 'praise-pop 0.3s ease-out',
          width: 'max-content', maxWidth: 'calc(100vw - 24px)',
        }}>
          <div style={{
            background: 'rgba(20, 83, 45, 0.93)', border: '2px solid #4ADE80',
            borderRadius: 18, padding: '7px 20px', textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '1.05rem', color: '#fff' }}>
              {dogMessage}
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

        {/* Timer — hidden for CrossingScene (mission 2) which uses lives instead */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {mId !== 2 && <TimerRing timeLeft={timeLeft} maxTime={maxTimeLeft} />}
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
          <LevelCompleteOverlay key="lvlcomplete" level={level} missionId={mId} onSeeResults={handleSeeResults} />
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
