import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';
import { useAdminStore, DEFAULT_MISSION_CONFIG } from '../store/adminStore';

const MISSION_IDS = DEFAULT_MISSION_CONFIG.map(m => m.id);

export default function MissionMap() {
  const navigate   = useNavigate();
  const { getHighestLevel } = useProgressStore();
  const getEffectiveMission = useAdminStore(s => s.getEffectiveMission);

  const MISSIONS = MISSION_IDS.map(id => ({
    id,
    ...getEffectiveMission(id),
  }));

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'url(/Background_map.jpg) center/cover no-repeat #1a2a4a',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 20px',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
      }}>
        <img
          src="/Logo_CHA_header.png?v=2"
          alt="CityHero Academy"
          style={{ height: 44, display: 'block' }}
        />
      </header>

      {/* ── Scroll strip ───────────────────────────────────────────────────── */}
      <div className="hide-scrollbar" style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollPaddingLeft: 24,
        WebkitOverflowScrolling: 'touch' as never,
        paddingLeft: 24,
        paddingTop: 0,
        paddingBottom: 0,
        gap: 16,
        scrollbarWidth: 'none' as never,
      }}>

        {MISSIONS.map((mission) => {
          const highestLevel = getHighestLevel(mission.id);
          const nextLevel    = Math.min(20, Math.max(1, highestLevel + 1));

          return (
            <MissionCard
              key={mission.id}
              id={mission.id}
              title={mission.title}
              nextLevel={nextLevel}
              onPlay={() => navigate(`/game/${mission.id}`, { state: { startLevel: nextLevel } })}
            />
          );
        })}

        {/* trailing spacer so last card can fully snap */}
        <div style={{ flexShrink: 0, width: 24 }} />
      </div>

    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function MissionCard({
  id, title, onPlay,
}: {
  id: number;
  title: string;
  nextLevel: number;
  onPlay: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        flexShrink: 0,
        scrollSnapAlign: 'start',
        // Square: same as width. We use a CSS var trick via calc.
        width:  'calc(100vw - 80px)',
        height: 'calc(100vw - 80px)',
        maxHeight: 'calc(100vh - 160px)',
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative',
        backgroundImage: `url(/missions/mission_${id}.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1E3A5F',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      }}
    >
      {/* Bottom gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Mission label + title */}
      <div style={{
        position: 'absolute',
        bottom: 70,
        left: 22,
        right: 22,
      }}>
        <div style={{
          fontFamily: 'Fredoka One, cursive',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.65)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Mission {id}
        </div>
        <div style={{
          fontFamily: 'Fredoka One, cursive',
          fontSize: 'clamp(1.3rem,5vw,1.7rem)',
          color: '#fff',
          lineHeight: 1.2,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {title}
        </div>
      </div>

      {/* Play button */}
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
