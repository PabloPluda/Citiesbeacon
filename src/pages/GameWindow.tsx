import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Phaser from 'phaser';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { createGameConfig } from '../game/GameConfig';
import { EventBus } from '../game/EventBus';
import { useProgressStore } from '../store/progressStore';
import { ThrowToBinScene } from '../game/scenes/ThrowToBinScene';
import { CrossingScene } from '../game/scenes/CrossingScene';
import { LightsOutScene } from '../game/scenes/LightsOutScene';
import { WaterSaverScene } from '../game/scenes/WaterSaverScene';
import { NotMyDogScene } from '../game/scenes/NotMyDogScene';
import { BikingScene } from '../game/scenes/BikingScene';
import { CityBuilderScene } from '../game/scenes/CityBuilderScene';
import { CATS as DEFAULT_CATS } from '../game/cityBuilderData';
import type { BuildItem } from '../game/cityBuilderData';
import { useAdminStore } from '../store/adminStore';

const SCENE_MAP: Record<number, any> = {
  1: ThrowToBinScene,
  2: CrossingScene,
  3: LightsOutScene,
  4: WaterSaverScene,
  5: NotMyDogScene,
  6: BikingScene,
  7: CityBuilderScene,
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

// ─── Well done overlay ────────────────────────────────────────────────────────
const MISSION_MSG: Record<number, string> = {
  1: 'The city is cleaner thanks to you! 🗑️',
  2: 'Great job walking to school and respecting the lights! 🚦',
  3: 'The city is saving energy because of you! 💡',
  4: 'Every drop counts — the city thanks you! 💧',
  5: 'Firulai is home safe! 🐕🏠',
  6: 'Using the bike is the best choice for short trips! You got exercise AND the air is cleaner thanks to you — keep it up! 🌿',
  7: 'Your city is growing! Keep earning CityCoins to build more. 🏙️',
};

function WellDoneOverlay({
  missionId, heroName, coinsEarned, totalCoins, onBackToMap, onContinue,
}: {
  missionId: number; heroName: string;
  coinsEarned: number; totalCoins: number;
  onBackToMap: () => void; onContinue: () => void;
}) {
  const [displayCoins, setDisplayCoins] = useState(totalCoins - coinsEarned);
  const msg = MISSION_MSG[missionId] ?? 'Amazing work out there!';

  useEffect(() => {
    if (coinsEarned <= 0) return;
    const start = totalCoins - coinsEarned;
    const end = totalCoins;
    const steps = Math.min(coinsEarned, 30);
    const delay = 700;
    const interval = 900 / steps;
    let count = 0;
    const t = setTimeout(() => {
      const id = setInterval(() => {
        count++;
        setDisplayCoins(Math.round(start + (end - start) * (count / steps)));
        if (count >= steps) clearInterval(id);
      }, interval);
    }, delay);
    return () => clearTimeout(t);
  }, [coinsEarned, totalCoins]);

  const MISSION_EMOJI: Record<number, string> = { 1: '🗑️', 2: '🚦', 3: '💡', 4: '💧', 5: '🐕', 6: '🚲' };

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.05, opacity: 0 }}
      transition={{ type: 'spring', bounce: 0.4 }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,20,60,0.90)', zIndex: 40, gap: 14, padding: '0 24px',
      }}
    >
      <div style={{ fontSize: '3.5rem' }}>{MISSION_EMOJI[missionId] ?? '🎉'}</div>
      <h2 style={{ fontFamily: 'Fredoka One', color: '#FFD700', fontSize: '2.4rem', textAlign: 'center', lineHeight: 1.1 }}>
        Well done{heroName ? `, ${heroName}` : ''}!
      </h2>
      <p style={{ fontFamily: 'Fredoka', color: '#CBD5E0', fontSize: '1.05rem', textAlign: 'center', lineHeight: 1.4 }}>
        {msg}
      </p>

      {coinsEarned > 0 && (
        <div style={{
          background: 'rgba(255,215,0,0.12)', border: '2px solid rgba(255,215,0,0.5)',
          borderRadius: 20, padding: '12px 28px', textAlign: 'center', marginTop: 4,
        }}>
          <div style={{ fontFamily: 'Fredoka', color: 'rgba(255,215,0,0.7)', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: 2 }}>
            CITY COINS
          </div>
          <div style={{ fontFamily: 'Fredoka One', color: '#FFD700', fontSize: '2rem', lineHeight: 1 }}>
            🪙 {displayCoins}
          </div>
          <div style={{ fontFamily: 'Fredoka', color: '#86EFAC', fontSize: '0.8rem', marginTop: 3 }}>
            +{coinsEarned} this level
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8, width: '100%', maxWidth: 300 }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onBackToMap}
          style={{
            flex: 1, fontFamily: 'Fredoka One', fontSize: '1rem',
            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
            border: '2px solid rgba(255,255,255,0.25)', borderRadius: 28,
            padding: '13px 0', cursor: 'pointer',
          }}
        >
          Map 🗺️
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onContinue}
          style={{
            flex: 2, fontFamily: 'Fredoka One', fontSize: '1.1rem',
            background: '#22C55E', color: '#fff',
            border: 'none', borderRadius: 28,
            padding: '13px 0', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
          }}
        >
          Continue! 🚀
        </motion.button>
      </div>
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
type Phase = 'playing' | 'wellDone' | 'timeUp';

export default function GameWindow() {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const location = useLocation();
  const mId = parseInt(missionId || '1', 10);

  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { completeLevel, getHighestLevel, addCityCoins, cityCoins } = useProgressStore();
  const builderCats = useAdminStore(s => s.builderCats);
  const CATS = builderCats ?? DEFAULT_CATS;

  const forcedLevel = (location.state as { startLevel?: number } | null)?.startLevel;
  const highest = getHighestLevel(mId);
  const initial = forcedLevel ?? (highest >= 20 ? 20 : highest + 1);

  const levelRef = useRef(initial);
  const [level, setLevel] = useState(initial);
  const [scored, setScored] = useState('0/7');
  const [timeLeft, setTimeLeft] = useState(50);
  const [maxTimeLeft, setMaxTimeLeft] = useState(50); // tracks the starting time for ring
  const [phase, setPhase] = useState<Phase>('playing');
  const [levelCoins, setLevelCoins] = useState(0);
  const [heroName] = useState(() => localStorage.getItem('cityhero-hero-name') || '');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPreLevel, setShowPreLevel] = useState(false);
  const [showCrossingPenalty, setShowCrossingPenalty] = useState(false);
  const [crossingPenaltyMsg, setCrossingPenaltyMsg] = useState('Wait for the green light! 😊');
  const [showCrossingTutorial, setShowCrossingTutorial] = useState(false);
  const [showCrossingPraise, setShowCrossingPraise] = useState(false);
  const [showCrossingStart, setShowCrossingStart] = useState(false);
  const [crossingStartLevel, setCrossingStartLevel] = useState(1);
  const [praiseText, setPraiseText] = useState('Well done! 🎉');

  // CityBuilder overlays
  const [cbCat, setCbCat] = useState(-1);
  const [cbItem, setCbItem] = useState<BuildItem | null>(null);
  const [cbPreview, setCbPreview] = useState(false);
  const [cbPlacedLabel, setCbPlacedLabel] = useState<string | null>(null);
  const [cbDemolish, setCbDemolish] = useState(false);
  const [cbDemolishLabel, setCbDemolishLabel] = useState<string | null>(null);

  // Dog game overlays
  const [showDogTutorial, setShowDogTutorial] = useState(false);
  const [showDogPreLevel, setShowDogPreLevel] = useState(false);
  const [dogPreLevelInfo, setDogPreLevelInfo] = useState<{ level: number; hasPuddles: boolean; hasWaterBowls: boolean; numCats: number; hasDoors: boolean } | null>(null);
  const [dogMessage, setDogMessage] = useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      const SceneClass = SCENE_MAP[mId] || ThrowToBinScene;
      const game = new Phaser.Game(createGameConfig(containerRef.current, SceneClass));
      // Pass forced level via game registry so scene init() picks it up on first boot
      if (forcedLevel) game.registry.set('startLevel', forcedLevel);
      gameRef.current = game;
    }

    const onTimer = (t: number) => {
      setTimeLeft(t);
      // Capture initial timer value as maxTime for the ring
      setMaxTimeLeft(prev => t > prev ? t : prev);
    };
    const onScored = (n: string | number) => setScored(String(n));

    const onLevelComplete = (payload: number | { level: number; coinsEarned?: number }) => {
      const completedLevel = typeof payload === 'number' ? payload : payload.level;
      const coins = typeof payload === 'object' ? (payload.coinsEarned ?? 0) : 0;
      levelRef.current = completedLevel;
      completeLevel(mId, completedLevel);
      if (coins > 0) addCityCoins(coins);
      setLevelCoins(coins);
      setPhase('wellDone');
    };
    const onTimeUp = () => setPhase('timeUp');

    EventBus.on('game-timer', onTimer);
    EventBus.on('game-scored-update', onScored);
    EventBus.on('game-level-complete', onLevelComplete);
    EventBus.on('game-time-up', onTimeUp);
    EventBus.on('show-tutorial', () => setShowTutorial(true));
    EventBus.on('show-pre-level', () => setShowPreLevel(true));
    const onCrossingPenalty = (reason?: string) => {
      setCrossingPenaltyMsg(reason === 'obstacle'
        ? 'Pay more attention walking in the street! 👀'
        : 'Wait for the green light! 😊');
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

    const onCBPreview    = (ready: boolean) => setCbPreview(ready);
    const onCBPlaced     = (data: { label: string }) => {
      setCbPlacedLabel(data.label);
      setTimeout(() => setCbPlacedLabel(null), 2500);
    };
    const onDemolishPrev = (data: { label: string } | null) => setCbDemolishLabel(data?.label ?? null);
    const onDemolishDone = () => { setCbDemolish(false); setCbDemolishLabel(null); };
    EventBus.on('citybuilder-preview-ready',     onCBPreview);
    EventBus.on('citybuilder-placed',            onCBPlaced);
    EventBus.on('citybuilder-demolish-preview',  onDemolishPrev);
    EventBus.on('citybuilder-demolish-done',     onDemolishDone);

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
      EventBus.off('citybuilder-preview-ready',    onCBPreview);
      EventBus.off('citybuilder-placed',           onCBPlaced);
      EventBus.off('citybuilder-demolish-preview', onDemolishPrev);
      EventBus.off('citybuilder-demolish-done',    onDemolishDone);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [mId]);  // eslint-disable-line

  // From well done: go to next level
  const handleNextLevel = () => {
    const next = Math.min(levelRef.current + 1, 20);
    levelRef.current = next;
    setLevel(next);
    setScored('0/7');
    setTimeLeft(50);
    setMaxTimeLeft(50);
    setLevelCoins(0);
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
    setLevelCoins(0);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: 1 });
  };

  // Retry same level
  const handleRetry = () => {
    setScored('0/7');
    setTimeLeft(50);
    setMaxTimeLeft(50);
    setLevelCoins(0);
    setPhase('playing');
    EventBus.emit('restart-scene', { level: levelRef.current });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {/* Phaser canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />

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
          textAlign: 'center',
          animation: 'penalty-slide-in 0.25s ease-out',
        }}>
          <div style={{ fontSize: '2rem', lineHeight: 1 }}>🚦</div>
          <div style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '1.3rem',
            color: '#FDE68A',
            textShadow: '0 1px 6px rgba(0,0,0,1), 0 2px 12px rgba(0,0,0,0.9)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
          }}>
            {crossingPenaltyMsg}
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

        {/* Timer — hidden for CrossingScene (2), LightsOutScene (3), CityBuilder (7) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {mId !== 2 && mId !== 3 && mId !== 7 && <TimerRing timeLeft={timeLeft} maxTime={maxTimeLeft} />}
          {mId === 7 && (
            <img src="/Logo_CHA_header.png?v=2" alt="CityHero Academy"
              style={{ height: 34, display: 'block', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.45))' }} />
          )}
        </div>

        {/* Scored — hidden for LightsOutScene (3) and CityBuilder (7) */}
        {mId !== 3 && mId !== 7 && (
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
        )}
        {mId === 7 && (
          <div style={{
            background: 'rgba(255,215,0,0.15)', border: '2px solid rgba(255,215,0,0.5)',
            borderRadius: 20, padding: '5px 12px', textAlign: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)', pointerEvents: 'none',
          }}>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.2rem', color: '#FFD700', lineHeight: 1 }}>
              🪙 {cityCoins}
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: '0.6rem', color: 'rgba(255,215,0,0.7)' }}>COINS</div>
          </div>
        )}
      </div>

      {/* ─ CityBuilder menu overlay ───────────────────────────────────────────── */}
      {mId === 7 && (
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0,
          zIndex: 62, pointerEvents: 'none',
        }}>
          {/* Category bar */}
          <div style={{
            display: 'flex', background: 'rgba(15,23,42,0.97)',
            borderBottom: '1px solid rgba(71,85,105,0.8)',
            pointerEvents: 'auto',
          }}>
            {CATS.map((cat, i) => {
              const isActive = cbCat === i;
              return (
                <button key={cat.label} onClick={() => {
                  const next = cbCat === i ? -1 : i;
                  setCbCat(next);
                  setCbDemolish(false);
                  setCbDemolishLabel(null);
                  EventBus.emit('citybuilder-demolish-mode', false);
                  if (next < 0) { setCbItem(null); EventBus.emit('citybuilder-select', null); }
                }} style={{
                  flex: 1, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(34,197,94,0.2)' : 'transparent',
                  borderBottom: isActive ? '2px solid #22C55E' : '2px solid transparent',
                  padding: '8px 4px 6px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{
                    fontFamily: 'Fredoka One', fontSize: '0.65rem',
                    color: isActive ? '#4ADE80' : '#94A3B8',
                  }}>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subcategory bar (conditional) */}
          {cbCat >= 0 && (
            <div style={{
              display: 'flex',
              background: 'rgba(8,12,26,0.97)',
              borderBottom: '1px solid rgba(51,65,85,0.8)',
              padding: '6px 8px',
              gap: 6, flexWrap: 'nowrap', overflowX: 'auto',
              pointerEvents: 'auto',
            }}>
              {CATS[cbCat].items.map(item => {
                const canAfford = cityCoins >= item.cost;
                const isSel     = cbItem?.key === item.key;
                return (
                  <button key={item.key} onClick={() => {
                    const next = isSel ? null : item;
                    setCbItem(next);
                    if (!next) setCbPreview(false);
                    EventBus.emit('citybuilder-select', next);
                  }} style={{
                    flex: '0 0 auto',
                    border: isSel ? '2px solid #4ADE80' : '2px solid transparent',
                    borderRadius: 12,
                    background: isSel ? 'rgba(34,197,94,0.2)' : 'rgba(30,41,59,0.9)',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    padding: '6px 10px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    opacity: canAfford ? 1 : 0.45,
                    minWidth: 68,
                  }}>
                    <img
                      src={`/Builder/${item.file}.png`}
                      alt={item.label}
                      style={{ width: 44, height: 44, objectFit: 'contain' }}
                    />
                    <span style={{ fontFamily: 'Fredoka One', fontSize: '0.65rem', color: '#E2E8F0', textAlign: 'center', lineHeight: 1.2 }}>
                      {item.label}
                    </span>
                    <span style={{ fontFamily: 'Fredoka One', fontSize: '0.6rem', color: canAfford ? '#FCD34D' : '#6B7280' }}>
                      🪙{item.cost}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Demolish button — standalone, always below the bars */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 10px 0', pointerEvents: 'none' }}>
            <button
              onClick={() => {
                const next = !cbDemolish;
                setCbDemolish(next);
                setCbDemolishLabel(null);
                if (next) { setCbCat(-1); setCbItem(null); setCbPreview(false); EventBus.emit('citybuilder-select', null); }
                EventBus.emit('citybuilder-demolish-mode', next);
              }}
              style={{
                width: 46, height: 46, borderRadius: '50%',
                border: cbDemolish ? '2px solid #FCA5A5' : '2px solid rgba(255,255,255,0.25)',
                background: cbDemolish ? 'rgba(239,68,68,0.88)' : 'rgba(15,23,42,0.75)',
                fontSize: '1.5rem', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: cbDemolish ? '0 0 14px rgba(239,68,68,0.6)' : '0 2px 10px rgba(0,0,0,0.5)',
                pointerEvents: 'auto',
              }}
            >🚜</button>
          </div>

          {/* Placement celebration toast */}
          {cbPlacedLabel && (
            <div style={{
              display: 'flex', justifyContent: 'center',
              padding: '6px 12px 0',
              pointerEvents: 'none',
              animation: 'praise-pop 0.3s ease-out',
            }}>
              <div style={{
                background: 'rgba(22,163,74,0.95)',
                border: '2px solid #4ADE80',
                borderRadius: 18,
                padding: '8px 22px',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
              }}>
                <span style={{ fontSize: '1.3rem' }}>🎉</span>
                <span style={{ fontFamily: 'Fredoka One', fontSize: '1.05rem', color: '#fff' }}>
                  New {cbPlacedLabel} in the city!
                </span>
                <span style={{ fontSize: '1.3rem' }}>🎉</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─ CityBuilder confirm/cancel (placement & demolish) ────────────────── */}
      {mId === 7 && (cbPreview || !!cbDemolishLabel) && (
        <div style={{
          position: 'absolute', bottom: 80, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 65, pointerEvents: 'auto',
        }}>
          {cbDemolishLabel && (
            <div style={{
              background: 'rgba(20,10,10,0.82)',
              border: '1px solid rgba(252,165,165,0.4)',
              borderRadius: 16, padding: '8px 22px',
              fontFamily: 'Fredoka One', fontSize: '0.95rem', color: '#FCA5A5',
              textAlign: 'center',
            }}>
              Remove {cbDemolishLabel} from the city?
            </div>
          )}
          <div style={{ display: 'flex', gap: 14 }}>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => {
                if (cbDemolishLabel) {
                  EventBus.emit('citybuilder-demolish-cancel');
                } else {
                  EventBus.emit('citybuilder-cancel');
                  setCbPreview(false);
                  setCbItem(null);
                }
              }}
              style={{
                fontFamily: 'Fredoka One', fontSize: '1rem',
                background: 'rgba(239,68,68,0.92)', color: '#fff',
                border: '2px solid rgba(252,165,165,0.5)', borderRadius: 28,
                padding: '13px 28px', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(239,68,68,0.45)',
              }}>✗ Cancel</motion.button>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => {
                if (cbDemolishLabel) {
                  EventBus.emit('citybuilder-demolish-confirm');
                  setCbDemolishLabel(null);
                } else {
                  EventBus.emit('citybuilder-confirm');
                  setCbPreview(false);
                }
              }}
              style={{
                fontFamily: 'Fredoka One', fontSize: '1rem',
                background: cbDemolishLabel ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)',
                color: '#fff',
                border: `2px solid ${cbDemolishLabel ? 'rgba(252,165,165,0.5)' : 'rgba(134,239,172,0.5)'}`,
                borderRadius: 28,
                padding: '13px 28px', cursor: 'pointer',
                boxShadow: cbDemolishLabel ? '0 4px 16px rgba(239,68,68,0.45)' : '0 4px 16px rgba(34,197,94,0.45)',
              }}>
              {cbDemolishLabel ? '🗑️ Remove' : '✓ Place it!'}
            </motion.button>
          </div>
        </div>
      )}

      {/* ─ Overlays ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'wellDone' && (
          <WellDoneOverlay
            key="welldone"
            missionId={mId}
            heroName={heroName}
            coinsEarned={levelCoins}
            totalCoins={cityCoins}
            onBackToMap={() => navigate('/map')}
            onContinue={level >= 20 ? handlePlayAgain : handleNextLevel}
          />
        )}
        {phase === 'timeUp' && (
          <TimeUpOverlay key="timeup" scored={scored} onRetry={handleRetry} onQuit={() => navigate('/map')} />
        )}
      </AnimatePresence>
    </div>
  );
}
