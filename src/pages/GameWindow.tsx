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
import { useUserStore } from '../store/userStore';

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
  const profile  = useUserStore(s => s.profile);
  const heroName = profile?.username || localStorage.getItem('cityhero-hero-name') || '';
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

  // Mission 1 (ThrowToBin) tutorial + game-over overlays
  const [m1Tutorial, setM1Tutorial] = useState(false);
  const [m1TutorialPos, setM1TutorialPos] = useState<{ binX: number; binY: number; trashX: number; trashY: number } | null>(null);
  const m1TutorialDoneRef = useRef(false);
  const [m1Over, setM1Over] = useState(false);
  const [m1Data, setM1Data] = useState<{
    scored: number; wasNewRecord: boolean; prevBest: number;
    coinsEarned: number; totalCoins: number;
  } | null>(null);

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

    const onM1Over = (data: typeof m1Data) => { setM1Data(data); setM1Over(true); };
    EventBus.on('game-over-m1', onM1Over);

    const onM1Tutorial = (pos?: { binX: number; binY: number; trashX: number; trashY: number }) => {
      if (m1TutorialDoneRef.current) {
        EventBus.emit('m1-tutorial-done');
      } else {
        if (pos) setM1TutorialPos(pos);
        setM1Tutorial(true);
      }
    };
    EventBus.on('show-m1-tutorial', onM1Tutorial);

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
      EventBus.off('game-over-m1', onM1Over);
      EventBus.off('show-m1-tutorial', onM1Tutorial);
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

      {/* ─ Mission 1 tutorial ───────────────────────────────────────────── */}
      {m1Tutorial && (
        <M1TutorialOverlay
          heroName={heroName}
          pos={m1TutorialPos}
          onStart={() => {
            m1TutorialDoneRef.current = true;
            setM1Tutorial(false);
            EventBus.emit('m1-tutorial-done');
          }}
        />
      )}

      {/* ─ Mission 1 game-over overlay ───────────────────────────────────── */}
      {m1Over && m1Data && (
        <M1GameOverOverlay
          data={m1Data}
          onRetry={() => {
            setM1Over(false); setM1Data(null);
            EventBus.emit('restart-scene', { level: 1 });
          }}
          onMap={() => navigate('/map')}
        />
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

        {/* Timer — hidden for ThrowToBin (1), CrossingScene (2), LightsOutScene (3), CityBuilder (7) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {mId !== 1 && mId !== 2 && mId !== 3 && mId !== 7 && <TimerRing timeLeft={timeLeft} maxTime={maxTimeLeft} />}
          {mId === 7 && (
            <img src="/Logo_CHA_header.png?v=2" alt="CityHero Academy"
              style={{ height: 34, display: 'block', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.45))' }} />
          )}
        </div>

        {/* Scored — hidden for ThrowToBin (1), LightsOutScene (3) and CityBuilder (7) */}
        {mId !== 1 && mId !== 3 && mId !== 7 && (
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

// ─── Mission 1 game-over overlay ─────────────────────────────────────────────

function M1GameOverOverlay({
  data,
  onRetry,
  onMap,
}: {
  data: { scored: number; wasNewRecord: boolean; prevBest: number; coinsEarned: number; totalCoins: number };
  onRetry: () => void;
  onMap: () => void;
}) {
  const { scored, wasNewRecord, coinsEarned, totalCoins } = data;
  const coinsBeforeGame = totalCoins - coinsEarned;

  // 0 = title only | 1 = + earned appears | 2 = counter running | 3 = buttons appear
  const [phase, setPhase] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(coinsBeforeGame);

  // Phase progression timers
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    const t2 = setTimeout(() => setPhase(2), 1000);
    return () => clearTimeout(t2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const duration = 900;
    const start = coinsBeforeGame;
    const end = totalCoins;
    const startTime = Date.now();
    const raf = { id: 0 };
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayCoins(Math.round(start + (end - start) * eased));
      if (t < 1) { raf.id = requestAnimationFrame(tick); }
    };
    raf.id = requestAnimationFrame(tick);
    const t3 = setTimeout(() => setPhase(3), duration + 1000);
    return () => { cancelAnimationFrame(raf.id); clearTimeout(t3); };
  }, [phase, coinsBeforeGame, totalCoins]);

  let emoji: string, title: string, titleColor: string, message: string, cardBg: string, cardBorder: string;
  if (wasNewRecord) {
    emoji = '🏆'; title = 'Congratulations!!'; titleColor = '#F59E0B';
    message = "You broke your own record! Great work keeping the city clean! 🌟";
    cardBg = 'linear-gradient(160deg,#1C1200 0%,#2D1E00 60%,#1A1200 100%)';
    cardBorder = '2.5px solid #F59E0B';
  } else if (scored >= 5) {
    emoji = '🌿'; title = 'Well done!'; titleColor = '#22C55E';
    message = "Thanks to you the city is cleaner! Try again to beat your record!";
    cardBg = 'linear-gradient(160deg,#071225 0%,#0D2210 60%,#071225 100%)';
    cardBorder = '2.5px solid #22C55E';
  } else {
    emoji = '😅'; title = 'Nice try!'; titleColor = '#FB923C';
    message = "We can do better! Every piece of trash counts 🌱";
    cardBg = 'linear-gradient(160deg,#1A0E00 0%,#251200 60%,#1A0E00 100%)';
    cardBorder = '2.5px solid #FB923C';
  }

  const btnColor = titleColor === '#22C55E'
    ? 'linear-gradient(135deg,#22C55E,#15803D)'
    : titleColor === '#F59E0B'
    ? 'linear-gradient(135deg,#F59E0B,#B45309)'
    : 'linear-gradient(135deg,#FB923C,#C2410C)';

  return (
    <motion.div
      key="m1-gameover"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(4,10,20,0.88)',
      }}
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 20 }}
        style={{
          background: cardBg, border: cardBorder, borderRadius: 28,
          width: 'min(340px, calc(100vw - 40px))',
          padding: '28px 24px 24px', textAlign: 'center',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Emoji + Title + Message */}
        <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: 8 }}>
          {emoji}{wasNewRecord ? ' 🎉' : ''}
        </div>
        <div style={{
          fontFamily: 'Fredoka One, cursive', fontSize: '2rem',
          color: titleColor, marginBottom: 8,
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}>{title}</div>
        <div style={{
          fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
          color: 'rgba(255,255,255,0.82)', lineHeight: 1.45, marginBottom: 22,
        }}>{message}</div>

        {/* Phase 1: coins earned — big pop-in */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              key="earned"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, marginBottom: 20,
              }}
            >
              <span style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '3.8rem', lineHeight: 1,
                color: '#4ADE80',
                textShadow: '0 0 24px rgba(74,222,128,0.6), 0 3px 0 #14532D',
                letterSpacing: '-0.02em',
              }}>+{coinsEarned}</span>
              <span style={{ fontSize: '2.8rem', lineHeight: 1 }}>🪙</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 2: total coins counter */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              key="total"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginBottom: 24,
              }}
            >
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>🪙</span>
              <span style={{
                fontFamily: 'Fredoka One, cursive', fontSize: '3rem', lineHeight: 1,
                color: '#FFD700',
                textShadow: '0 0 20px rgba(255,215,0,0.5), 0 3px 0 #92400E',
              }}>{displayCoins}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 3: buttons */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              style={{ display: 'flex', gap: 12 }}
            >
              <button onClick={onMap} style={{
                flex: 1, fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 20, padding: '13px 8px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
              }}>🗺️ Map</button>
              <button onClick={onRetry} style={{
                flex: 2, fontFamily: 'Fredoka One, cursive', fontSize: '1rem',
                background: btnColor, border: 'none',
                borderRadius: 20, padding: '13px 8px',
                color: '#fff', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }}>🔄 Play Again</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Mission 1 Tutorial Overlay ───────────────────────────────────────────────
function M1TutorialOverlay({
  heroName, pos, onStart,
}: {
  heroName: string;
  pos: { binX: number; binY: number; trashX: number; trashY: number } | null;
  onStart: () => void;
}) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const trashX = pos?.trashX ?? W * 0.28;
  const trashY = pos?.trashY ?? H * 0.76;
  const binX   = pos?.binX   ?? W * 0.50;
  const binY   = pos?.binY   ?? 230;

  // Pull-back: short drag opposite to the trash→bin direction
  const dx  = binX - trashX;
  const dy  = binY - trashY;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  const pullDx = -(dx / mag) * 55;
  const pullDy = -(dy / mag) * 55;

  // Parabolic arc: sample 6 points from pullback to bin
  // y(s) = pullDy + throwDy*s  −  peakAbove * 4 * s * (1-s)
  // peakAbove shifts the arc above the straight pullback→bin line
  const throwDx  = dx - pullDx;
  const throwDy  = (dy + 12) - pullDy;
  const peakAbove = 280;
  const arc = (s: number) => ({
    x: pullDx + throwDx * s,
    y: pullDy + throwDy * s - peakAbove * 4 * s * (1 - s),
  });
  // 6 arc points at s = 1/6, 2/6, … 6/6
  const arcPts = [1, 2, 3, 4, 5, 6].map(i => arc(i / 6));

  // Full throw keyframe arrays (9 points: idle → pullback → hold → 6 arc pts)
  const KFX  = [0, pullDx, pullDx, ...arcPts.map(p => p.x)];
  const KFY  = [0, pullDy, pullDy, ...arcPts.map(p => p.y)];
  const KFR  = [0, -18, -18, -8, 20, 55, 95, 135, 165]; // slight rotation
  const KFO  = [1,  1,    1,  1,  1,  1,  1,  1,  0.85];
  // times: 0→pullback 18%, hold 28%, then arc 28-100%
  const KFT  = [0, 0.18, 0.28, 0.417, 0.533, 0.65, 0.767, 0.883, 1.0];
  // ease: easeOut for pullback snap, linear for physics-encoded arc
  const KFE  = ['easeOut', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear'];

  // Finger follows same path but stays at pullback after throw starts, then fades
  const FKX  = [0, pullDx, pullDx, ...Array(6).fill(pullDx) as number[]];
  const FKY  = [0, pullDy, pullDy, ...Array(6).fill(pullDy) as number[]];
  const FKO  = [1,  1,     1,      0, 0, 0, 0, 0, 0]; // fades out the moment throw starts

  // 3 phases: 0=idle (1.2s), 1=throw (2.5s), 2=in-bin+pause (1.2s)
  const [gPhase, setGPhase] = useState(0);
  useEffect(() => {
    let mounted = true;
    const cycle = () => {
      if (!mounted) return;
      setGPhase(0);
      setTimeout(() => { if (!mounted) return; setGPhase(1);
      setTimeout(() => { if (!mounted) return; setGPhase(2);
      setTimeout(() => { if (mounted) cycle(); }, 1200);
      }, 2500); }, 1200);
    };
    const t = setTimeout(cycle, 600);
    return () => { mounted = false; clearTimeout(t); };
  }, []); // eslint-disable-line

  const throwTransition = { duration: 2.5, times: KFT, ease: KFE as any };
  const spring = { type: 'spring' as const, stiffness: 200, damping: 22 };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 85,
        background: 'rgba(0,0,0,0.70)',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Top message card ──────────────────────────────────── */}
      <motion.div
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{
          position: 'absolute',
          top: 12, left: 14, right: 14,
          background: 'rgba(0,10,24,0.85)',
          border: '1.5px solid rgba(255,255,255,0.10)',
          borderRadius: 22,
          padding: '14px 20px 12px',
          textAlign: 'center',
        }}
      >
        <div style={{
          fontFamily: 'Fredoka One, cursive', fontSize: '1.65rem',
          color: '#4ADE80', marginBottom: 6,
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}>
          Hi, {heroName || 'Hero'}! 👋
        </div>
        <div style={{
          fontFamily: 'Fredoka One, cursive', fontSize: '1.0rem',
          color: 'rgba(255,255,255,0.90)', lineHeight: 1.5,
        }}>
          Thanks for helping keep the streets clean of trash!
        </div>
      </motion.div>

      {/* ── Glow ring at idle trash position (phase 0 only) ───── */}
      <motion.div
        animate={{ opacity: gPhase === 0 ? 0.55 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'absolute',
          left: trashX - 32, top: trashY - 32,
          width: 64, height: 64,
          borderRadius: '50%',
          border: '2.5px solid #4ADE80',
          boxShadow: '0 0 14px rgba(74,222,128,0.65)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Ghost trash SVG — full parabolic arc ──────────────── */}
      <motion.img
        src="/trash/banana_peel.svg"
        animate={
          gPhase === 1
            ? { x: KFX, y: KFY, rotate: KFR, opacity: KFO }
            : gPhase === 2
            ? { x: dx, y: dy + 20, rotate: 170, opacity: 0 }
            : { x: 0, y: 0, rotate: 0, opacity: 1 }
        }
        transition={gPhase === 1 ? throwTransition : gPhase === 2 ? { duration: 0.14 } : spring}
        style={{
          position: 'absolute',
          left: trashX - 22, top: trashY - 22,
          width: 44, height: 44,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.75))',
        }}
      />

      {/* ── Finger — holds trash, snaps off at launch ─────────── */}
      <motion.div
        animate={
          gPhase === 1
            ? { x: FKX, y: FKY, opacity: FKO }
            : gPhase === 2
            ? { x: 0, y: 0, opacity: 0 }
            : { x: 0, y: 0, opacity: 1 }
        }
        transition={gPhase === 1 ? throwTransition : gPhase === 2 ? { duration: 0 } : spring}
        style={{
          position: 'absolute',
          left: trashX - 10, top: trashY + 8,
          fontSize: '2.1rem', lineHeight: 1,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
        }}
      >👆</motion.div>

      {/* ── Warning — vertically centered on screen ───────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.44, type: 'spring', stiffness: 220, damping: 18 }}
        style={{
          position: 'absolute',
          top: '52%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          fontFamily: 'Fredoka One, cursive', fontSize: '1.18rem',
          color: '#FDE68A',
          background: 'rgba(0,0,0,0.68)',
          border: '1.5px solid rgba(253,230,138,0.32)',
          borderRadius: 20,
          padding: '12px 26px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
          letterSpacing: '0.01em',
          lineHeight: 1.4,
        }}>
          ⚠️ Keep the floor with less than 10 items!
        </div>
      </motion.div>

      {/* ── Let's play button ──────────────────────────────────── */}
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.52 }}
        style={{ position: 'absolute', bottom: 44, left: 20, right: 20, textAlign: 'center' }}
      >
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onStart}
          style={{
            fontFamily: 'Fredoka One, cursive', fontSize: '1.45rem',
            background: 'linear-gradient(135deg,#22C55E,#15803D)',
            border: 'none', borderRadius: 99,
            padding: '15px 56px', color: '#fff', cursor: 'pointer',
            boxShadow: '0 6px 0 #14532D, 0 8px 28px rgba(21,128,61,0.5)',
            letterSpacing: '0.03em',
          }}
        >
          Let's play!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
