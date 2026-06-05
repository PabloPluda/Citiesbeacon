import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';

const FF = 'Fredoka One, cursive';
const AVATAR_KEY = 'cityhero-avatar';

// ─── Avatar options ───────────────────────────────────────────────────────────
const AVATARS = [
  { id: 'boy-light',   emoji: '👦🏻', label: 'Boy'  },
  { id: 'boy-medium',  emoji: '👦🏽', label: 'Boy'  },
  { id: 'boy-dark',    emoji: '👦🏿', label: 'Boy'  },
  { id: 'girl-light',  emoji: '👧🏻', label: 'Girl' },
  { id: 'girl-medium', emoji: '👧🏽', label: 'Girl' },
  { id: 'girl-dark',   emoji: '👧🏿', label: 'Girl' },
];

// ─── Games list ───────────────────────────────────────────────────────────────
const GAMES = [
  { id: 1, icon: '🗑️', title: 'Keeping Clean'  },
  { id: 2, icon: '🚶', title: 'Safe Crossing'  },
  { id: 3, icon: '💡', title: 'Save Energy'    },
  { id: 4, icon: '💧', title: 'Water Saver'    },
  { id: 5, icon: '🐕', title: 'Not My Dog'     },
  { id: 6, icon: '🚲', title: 'Biking'         },
  { id: 7, icon: '🏙️', title: 'City Builder'  },
  { id: 8, icon: '♻️', title: 'Recycling'      },
];

const DIPLOMA_LEVELS = [
  { label: 'Bronze', emoji: '🥉', bgOn: '#CD7F32', bgOff: '#E2E8F0' },
  { label: 'Silver', emoji: '🥈', bgOn: '#94A3B8', bgOff: '#E2E8F0' },
  { label: 'Gold',   emoji: '🥇', bgOn: '#F59E0B', bgOff: '#E2E8F0' },
];

// ─── Avatar Picker ────────────────────────────────────────────────────────────
function AvatarPicker({
  current, onSelect, onClose,
}: {
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,10,40,0.75)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        exit={{ y: 200 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: '#fff',
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          padding: '24px 20px 40px',
        }}
      >
        <h3 style={{ fontFamily: FF, fontSize: '1.2rem', color: '#1E293B', textAlign: 'center', margin: '0 0 20px' }}>
          Choose your avatar
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {AVATARS.map(av => (
            <button
              key={av.id}
              onClick={() => { onSelect(av.id); onClose(); }}
              style={{
                border: current === av.id ? '3px solid #6366F1' : '3px solid transparent',
                borderRadius: 20, background: current === av.id ? '#EDE9FE' : '#F8FAFC',
                padding: '14px 0', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: '2.8rem' }}>{av.emoji}</span>
              <span style={{ fontFamily: FF, fontSize: '0.75rem', color: '#64748B' }}>{av.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Diploma Badge ────────────────────────────────────────────────────────────
function DiplomaRow({ missionId, score }: { missionId: number; score: number }) {
  const getDiplomaThresholds = useAdminStore(s => s.getDiplomaThresholds);
  const thresholds = getDiplomaThresholds(missionId);

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {DIPLOMA_LEVELS.map((lvl, i) => {
        const earned = score >= thresholds[i];
        return (
          <div
            key={lvl.label}
            title={earned ? `${lvl.label} — ${score} / ${thresholds[i]}` : `Need ${thresholds[i]} pts for ${lvl.label}`}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: earned ? lvl.bgOn : lvl.bgOff,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
              filter: earned ? 'none' : 'grayscale(1)',
              opacity: earned ? 1 : 0.4,
              transition: 'all 0.2s',
            }}
          >
            {lvl.emoji}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Profile ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { cityCoins, highScores, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();
  const { signOut, profile } = useUserStore();

  const heroName = profile?.username || localStorage.getItem('cityhero-hero-name') || 'CityHero';

  const [avatarId, setAvatarId] = useState(
    () => localStorage.getItem(AVATAR_KEY) || 'boy-light'
  );
  const [showPicker, setShowPicker] = useState(false);

  const selectAvatar = (id: string) => {
    setAvatarId(id);
    localStorage.setItem(AVATAR_KEY, id);
  };

  const avatarEmoji = AVATARS.find(a => a.id === avatarId)?.emoji ?? '👦🏻';

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#EEF2FF' }}>

      {/* ── Banner ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg,#1E3A8A 0%,#4F46E5 50%,#7C3AED 100%)',
        paddingTop: 48, paddingBottom: 56,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {/* Avatar (editable) */}
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
          style={{ position: 'relative' }}
        >
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            border: '4px solid white',
            background: 'linear-gradient(135deg,#FFD93D,#FF8C42)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '3.2rem',
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
            onClick={() => setShowPicker(true)}
          >
            {avatarEmoji}
          </div>
          {/* Edit pencil */}
          <button
            onClick={() => setShowPicker(true)}
            style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 28, height: 28, borderRadius: '50%',
              background: '#F6C90E', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >✏️</button>
        </motion.div>

        {/* Name */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontFamily: FF, fontSize: '1.9rem', color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        >
          {heroName}
        </motion.h2>

        {/* Rank badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
          style={{ background: '#FCD34D', borderRadius: 999, padding: '6px 18px', boxShadow: '0 4px 0 #D97706' }}
        >
          <span style={{ fontFamily: FF, fontSize: '0.85rem', color: '#78350F' }}>{rank}</span>
        </motion.div>
      </div>

      {/* ── White card area ───────────────────────────────────────────────── */}
      <div style={{
        background: '#EEF2FF',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        marginTop: -28,
        padding: '24px 16px 32px',
        boxShadow: '0 -6px 24px rgba(79,70,229,0.18)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* ── Coins + Progress ─────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          style={{
            background: '#fff', borderRadius: 24, padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(79,70,229,0.10)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          {/* City Coins */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
              border: '3px solid #FCD34D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: '0 3px 0 #FCD34D',
            }}>🪙</div>
            <div>
              <div style={{ fontFamily: FF, fontSize: '1.6rem', color: '#D97706', lineHeight: 1 }}>
                {cityCoins}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                City Coins
              </div>
            </div>
          </div>

          {/* Hero progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hero Path
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6D28D9' }}>
                {progress >= 100 ? '👑 MAX!' : `${Math.round(progress)}%`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1rem' }}>{rank.split(' ')[0]}</span>
              <div style={{ flex: 1, height: 14, borderRadius: 999, background: '#E0E7FF', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                  style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#6366F1,#7C3AED)' }}
                />
              </div>
              <span style={{ fontSize: '1rem' }}>{progress >= 100 ? '👑' : nextRank.split(' ')[0]}</span>
            </div>
            <p style={{ fontSize: '0.7rem', textAlign: 'right', color: '#94A3B8', fontWeight: 600, margin: 0 }}>
              {progress >= 100 ? '🎉 Max rank reached!' : `${currentCP} / ${nextCP} CP · Next: ${nextRank}`}
            </p>
          </div>
        </motion.div>

        {/* ── Games & Diplomas ──────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <h3 style={{ fontFamily: FF, fontSize: '1.15rem', color: '#4338CA', margin: 0, paddingLeft: 4 }}>
            🏅 My Scores & Diplomas
          </h3>

          {GAMES.map((g, i) => {
            const score = highScores[g.id] ?? 0;
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                style={{
                  background: '#fff', borderRadius: 18, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '0 2px 10px rgba(79,70,229,0.08)',
                }}
              >
                <span style={{ fontSize: '1.6rem', width: 32, textAlign: 'center' }}>{g.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FF, fontSize: '0.9rem', color: '#1E293B', lineHeight: 1.2 }}>
                    {g.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                    Best score: <span style={{ color: score > 0 ? '#6D28D9' : '#CBD5E1' }}>{score > 0 ? score : '—'}</span>
                  </div>
                </div>
                <DiplomaRow missionId={g.id} score={score} />
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Logout ───────────────────────────────────────────────────── */}
        <button
          onClick={() => signOut()}
          style={{
            width: '100%', padding: '14px 0', marginTop: 8,
            background: 'transparent', border: '1.5px solid #CBD5E1',
            borderRadius: 16, cursor: 'pointer',
            fontFamily: FF, fontSize: 16, color: '#94A3B8',
          }}
        >
          Log Out
        </button>
      </div>

      {/* ── Avatar picker modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showPicker && (
          <AvatarPicker
            current={avatarId}
            onSelect={selectAvatar}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
