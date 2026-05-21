import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';
import { useAdminStore, DEFAULT_MISSION_CONFIG } from '../store/adminStore';
import { useUserStore } from '../store/userStore';

// Mission 4 (Water Saver) hidden until ready
const MISSION_IDS = DEFAULT_MISSION_CONFIG.map(m => m.id).filter(id => id !== 4);

// Explicit image filename per mission ID (files live in public/missions/)
const MISSION_IMAGE: Record<number, string> = {
  1: 'mission_1',
  2: 'mission_2',
  3: 'mission_3',
  5: 'mission_4',
  6: 'mission_5',
  8: 'mission_6',
  7: 'citybuilder',
};

export default function MissionMap() {
  const navigate            = useNavigate();
  const { getHighestLevel } = useProgressStore();
  const getEffectiveMission = useAdminStore(s => s.getEffectiveMission);
  const { isNewUser, clearNewUser, profile, streakReward, clearStreakReward } = useUserStore();

  const MISSIONS = MISSION_IDS.map(id => ({ id, ...getEffectiveMission(id) }));

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: 'url(/background_map.jpg) center/cover no-repeat #1a2a4a',
    }}>

      {/* ── Horizontal scroll strip ────────────────────────────────────────── */}
      <div
        className="hide-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: 24,
          paddingLeft: 24,
          gap: 16,
          scrollbarWidth: 'none' as never,
        }}
      >
        {MISSIONS.map((mission, idx) => {
          const highestLevel = getHighestLevel(mission.id);
          const nextLevel    = Math.min(20, Math.max(1, highestLevel + 1));

          return (
            <MissionCard
              key={mission.id}
              imageFile={MISSION_IMAGE[mission.id] ?? `mission_${idx + 1}`}
              onPlay={() => navigate(`/game/${mission.id}`, { state: { startLevel: nextLevel } })}
            />
          );
        })}

        {/* trailing spacer so last card can fully snap */}
        <div style={{ flexShrink: 0, width: 24 }} />
      </div>

      {/* ── Welcome overlay (new users only) ──────────────────────────────── */}
      <AnimatePresence>
        {isNewUser && (
          <WelcomeOverlay
            username={profile?.username ?? 'Hero'}
            onGoToMissions={clearNewUser}
            onCityBuilder={() => { clearNewUser(); navigate('/game/7'); }}
          />
        )}
      </AnimatePresence>

      {/* ── Daily streak overlay (returning users, once per day) ───────────── */}
      <AnimatePresence>
        {!isNewUser && streakReward && (
          <DailyStreakOverlay
            username={profile?.username ?? 'Hero'}
            streakDays={streakReward.streakDays}
            coinsEarned={streakReward.coinsEarned}
            totalCoins={streakReward.totalCoins}
            onGoToMissions={clearStreakReward}
            onCityBuilder={() => { clearStreakReward(); navigate('/game/7'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function MissionCard({ imageFile, onPlay }: { imageFile: string; onPlay: () => void }) {
  const w = 'calc(100vw - 80px)';
  const h = 'calc((100vw - 80px) * 1.5)';

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        flexShrink: 0,
        scrollSnapAlign: 'start',
        width: w,
        height: h,
        maxHeight: 'calc(100vh - 100px)',
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative',
        backgroundImage: `url(/missions/${imageFile}.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1E3A5F',
        border: '1.5px solid rgba(0,0,0,0.7)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 100,
        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        pointerEvents: 'none',
      }} />

      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={onPlay}
        style={{
          position: 'absolute',
          bottom: 18,
          right: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'linear-gradient(135deg, #22C55E, #15803D)',
          border: 'none',
          borderRadius: 99,
          padding: '12px 22px',
          color: '#fff',
          fontFamily: 'Fredoka One, cursive',
          fontSize: '1rem',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: '0 6px 0 #14532D, 0 8px 24px rgba(21,128,61,0.5)',
        }}
      >
        <Play size={18} fill="white" strokeWidth={0} />
        PLAY NOW
      </motion.button>
    </motion.div>
  );
}

// ─── Daily Streak Overlay ─────────────────────────────────────────────────────

function DailyStreakOverlay({
  username,
  streakDays,
  coinsEarned,
  totalCoins,
  onGoToMissions,
  onCityBuilder,
}: {
  username: string;
  streakDays: number;
  coinsEarned: number;
  totalCoins: number;
  onGoToMissions: () => void;
  onCityBuilder: () => void;
}) {
  const [displayCoins, setDisplayCoins] = useState(totalCoins - coinsEarned);

  useEffect(() => {
    const from = totalCoins - coinsEarned;
    const to   = totalCoins;
    const DURATION = 1600;
    let startTime: number | null = null;
    let raf: number;

    const delay = setTimeout(() => {
      const tick = (now: number) => {
        if (!startTime) startTime = now;
        const t = Math.min((now - startTime) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayCoins(Math.round(from + eased * (to - from)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 500);

    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, [totalCoins, coinsEarned]);

  const streakEmoji = streakDays >= 7 ? '🔥🔥🔥' : streakDays >= 5 ? '🔥🔥' : '🔥';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '24px 20px',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{
          background: 'linear-gradient(160deg, #0f2d5e 0%, #1a4a8a 60%, #0d3b6e 100%)',
          borderRadius: 28,
          padding: '28px 24px 24px',
          maxWidth: 380, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, textAlign: 'center',
        }}
      >
        {/* Governor image */}
        <div style={{
          width: 130, height: 130, borderRadius: 16, overflow: 'hidden',
          border: '3px solid rgba(255,165,0,0.7)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          background: 'rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <img src="/gobernor.jpg" alt="Governor"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Streak badge */}
        <div style={{
          background: 'rgba(255,100,0,0.18)',
          border: '1.5px solid rgba(255,140,0,0.45)',
          borderRadius: 99, padding: '5px 18px',
          fontFamily: 'Fredoka One, cursive',
          fontSize: '1.05rem', color: '#FFA500',
          letterSpacing: '0.03em',
        }}>
          {streakEmoji} {streakDays} days in a row!
        </div>

        {/* Message */}
        <div style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '0.92rem',
          color: 'rgba(255,255,255,0.88)',
          lineHeight: 1.55,
        }}>
          Great to see you again,{' '}
          <strong style={{ color: '#7DD3FC' }}>{username}</strong>!{' '}
          {streakDays} days in a row — that makes you a true city hero!{' '}
          Accept{' '}
          <strong style={{ color: '#FFD700' }}>+{coinsEarned} CityCoins</strong>{' '}
          as a thank you from the Governor. Keep it up!
        </div>

        {/* Coin counter */}
        <motion.div
          animate={displayCoins === totalCoins ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 0.35 }}
          style={{
            background: 'rgba(0,0,0,0.35)', borderRadius: 99,
            padding: '10px 28px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: '1.5px solid rgba(255,215,0,0.35)',
          }}
        >
          <span style={{ fontSize: 26 }}>🪙</span>
          <span style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '2rem', color: '#FFD700',
            letterSpacing: '0.04em', minWidth: 56,
          }}>
            {displayCoins.toLocaleString()}
          </span>
          <span style={{
            fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.6)', alignSelf: 'flex-end', paddingBottom: 4,
          }}>
            CityCoins
          </span>
        </motion.div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 4 }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onGoToMissions}
            style={{
              flex: 1, padding: '13px 8px',
              border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 14,
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              fontFamily: 'Fredoka One, cursive', fontSize: '0.95rem',
              cursor: 'pointer', letterSpacing: '0.02em',
            }}
          >
            🗺️ Go to Missions
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCityBuilder}
            style={{
              flex: 1, padding: '13px 8px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(135deg, #22C55E, #15803D)',
              boxShadow: '0 4px 0 #14532D', color: '#fff',
              fontFamily: 'Fredoka One, cursive', fontSize: '0.95rem',
              cursor: 'pointer', letterSpacing: '0.02em',
            }}
          >
            🏙️ City Builder
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Welcome Overlay ──────────────────────────────────────────────────────────

function WelcomeOverlay({
  username,
  onGoToMissions,
  onCityBuilder,
}: {
  username: string;
  onGoToMissions: () => void;
  onCityBuilder: () => void;
}) {
  const [coins, setCoins] = useState(0);

  // Animate coin counter 0 → 500 over ~1.8 s, starting after a short delay
  useEffect(() => {
    const TARGET = 500;
    const DURATION = 1800;
    let startTime: number | null = null;
    let raf: number;

    const delay = setTimeout(() => {
      const tick = (now: number) => {
        if (!startTime) startTime = now;
        const t = Math.min((now - startTime) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setCoins(Math.round(eased * TARGET));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 600);

    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '24px 20px',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{
          background: 'linear-gradient(160deg, #0f2d5e 0%, #1a4a8a 60%, #0d3b6e 100%)',
          borderRadius: 28,
          padding: '28px 24px 24px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        {/* Governor image / placeholder */}
        <div style={{
          width: 130,
          height: 130,
          borderRadius: 16,
          overflow: 'hidden',
          border: '3px solid rgba(255,215,0,0.6)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          background: 'rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <img src="/gobernor.jpg" alt="Governor"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Title */}
        <div>
          <div style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '1.35rem',
            color: '#FFD700',
            letterSpacing: '0.02em',
            lineHeight: 1.2,
            marginBottom: 8,
          }}>
            A Message from the Governor
          </div>
          <div style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '0.92rem',
            color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.55,
          }}>
            Hello <strong style={{ color: '#7DD3FC' }}>{username}</strong>!{' '}
            I'm the Governor of this city, and I want to personally thank you
            for joining our mission to improve people's behavior and build a
            friendlier, more sustainable city for everyone.{' '}
            Please accept these <strong style={{ color: '#FFD700' }}>500 CityCoins</strong>{' '}
            to start building the city of your dreams!
          </div>
        </div>

        {/* Coin counter */}
        <motion.div
          animate={coins === 500 ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 0.35 }}
          style={{
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 99,
            padding: '10px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: '1.5px solid rgba(255,215,0,0.35)',
          }}
        >
          <span style={{ fontSize: 26 }}>🪙</span>
          <span style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '2rem',
            color: '#FFD700',
            letterSpacing: '0.04em',
            minWidth: 56,
          }}>
            {coins.toLocaleString()}
          </span>
          <span style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.6)',
            alignSelf: 'flex-end',
            paddingBottom: 4,
          }}>
            CityCoins
          </span>
        </motion.div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 4 }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onGoToMissions}
            style={{
              flex: 1,
              padding: '13px 8px',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontFamily: 'Fredoka One, cursive',
              fontSize: '0.95rem',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            🗺️ Go to Missions
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCityBuilder}
            style={{
              flex: 1,
              padding: '13px 8px',
              border: 'none',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #22C55E, #15803D)',
              boxShadow: '0 4px 0 #14532D',
              color: '#fff',
              fontFamily: 'Fredoka One, cursive',
              fontSize: '0.95rem',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            🏙️ City Builder
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
