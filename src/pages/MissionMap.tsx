import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';
import { useAdminStore, DEFAULT_MISSION_CONFIG } from '../store/adminStore';

const MISSION_IDS = DEFAULT_MISSION_CONFIG.map(m => m.id);

export default function MissionMap() {
  const navigate            = useNavigate();
  const { getHighestLevel } = useProgressStore();
  const getEffectiveMission = useAdminStore(s => s.getEffectiveMission);

  const MISSIONS = MISSION_IDS.map(id => ({ id, ...getEffectiveMission(id) }));

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: 'url(/Background_map.png) center/cover no-repeat #1a2a4a',
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
        {MISSIONS.map((mission) => {
          const highestLevel = getHighestLevel(mission.id);
          const nextLevel    = Math.min(20, Math.max(1, highestLevel + 1));

          return (
            <MissionCard
              key={mission.id}
              id={mission.id}
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

function MissionCard({ id, onPlay }: { id: number; onPlay: () => void }) {
  // Width = 100vw - 80px (same as before), height = width * 3/2  (2:3 ratio)
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
        backgroundImage: `url(/missions/mission_${id}.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1E3A5F',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      }}
    >
      {/* Subtle gradient just at the very bottom for the button */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 100,
        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Play button — bottom right */}
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
