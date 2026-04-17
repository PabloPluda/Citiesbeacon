import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';

const HERO_NAME_KEY = 'cityhero-hero-name';
const FF = 'Fredoka One, cursive';

const SCRAPBOOK = [
  { id: 1, title: 'The Golden Broom',     emoji: '🧹', from: '#FDE68A', to: '#F59E0B', accent: '#D97706', dark: '#92400E' },
  { id: 2, title: 'Safety Guardian',       emoji: '🚦', from: '#A7F3D0', to: '#10B981', accent: '#059669', dark: '#064E3B' },
  { id: 3, title: 'Planet Brightener',     emoji: '💡', from: '#FED7AA', to: '#F97316', accent: '#EA580C', dark: '#7C2D12' },
  { id: 4, title: 'Blue River Protector',  emoji: '💧', from: '#BAE6FD', to: '#0EA5E9', accent: '#0284C7', dark: '#0C4A6E' },
  { id: 5, title: "Sparky's Best Friend",  emoji: '🐕', from: '#FBCFE8', to: '#EC4899', accent: '#DB2777', dark: '#831843' },
];

export default function Profile() {
  const { highestLevel, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();

  const heroName         = localStorage.getItem(HERO_NAME_KEY) || 'CityHero';
  const missionsMastered = SCRAPBOOK.filter(m => (highestLevel[m.id] || 0) >= 12).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#EEF2FF' }}>

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center px-6 pt-10 pb-16 space-y-3 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg,#1E3A8A 0%,#4F46E5 50%,#7C3AED 100%)' }}
      >
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.55, duration: 0.6 }}
          className="relative"
        >
          <div
            className="absolute -inset-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(253,224,71,0.45) 0%, transparent 70%)' }}
          />
          <div
            className="relative w-24 h-24 rounded-full border-4 border-white flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#FFD93D 0%,#FF8C42 100%)',
              fontSize: '3.2rem',
              boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            }}
          >
            👦
          </div>
        </motion.div>

        {/* Name */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-3xl text-white font-bold text-center"
          style={{ fontFamily: FF, textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        >
          {heroName}
        </motion.h2>

        {/* Rank badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
          className="rounded-full px-5 py-2"
          style={{ background: '#FCD34D', boxShadow: '0 4px 0 #D97706' }}
        >
          <span className="font-bold text-sm" style={{ fontFamily: FF, color: '#78350F' }}>{rank}</span>
        </motion.div>
      </div>

      {/* ── Slide-up white content ───────────────────────────────────── */}
      <div
        className="flex-1 px-4 pt-6 pb-10 space-y-5"
        style={{
          background: '#EEF2FF',
          borderTopLeftRadius: '32px',
          borderTopRightRadius: '32px',
          marginTop: '-28px',
          boxShadow: '0 -6px 24px rgba(79,70,229,0.18)',
        }}
      >
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* CP */}
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
            className="rounded-3xl p-4 text-center space-y-1 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', boxShadow: '0 4px 0 #FCD34D, 0 8px 20px rgba(245,158,11,0.2)' }}
          >
            <div className="text-4xl">⭐</div>
            <div className="text-3xl font-bold" style={{ fontFamily: FF, color: '#D97706' }}>
              {currentCP}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#92400E' }}>
              Hero Points
            </div>
          </motion.div>

          {/* Mastered */}
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}
            className="rounded-3xl p-4 text-center space-y-1"
            style={{ background: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', boxShadow: '0 4px 0 #8B5CF6, 0 8px 20px rgba(109,40,217,0.2)' }}
          >
            <div className="text-4xl">🏆</div>
            <div className="text-3xl font-bold" style={{ fontFamily: FF, color: '#6D28D9' }}>
              {missionsMastered}
              <span className="text-base font-semibold" style={{ color: '#A78BFA' }}>/5</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4C1D95' }}>
              Mastered
            </div>
          </motion.div>
        </div>

        {/* ── Rank progress ── */}
        <motion.div
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-3xl p-4 space-y-2"
          style={{ background: '#FFFFFF', boxShadow: '0 4px 16px rgba(79,70,229,0.12)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Rank Progress</span>
            <span className="text-xs font-bold" style={{ color: '#6D28D9' }}>
              {progress >= 100 ? '👑 MAX RANK!' : `${Math.round(progress)}%`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">{rank.split(' ')[0]}</span>
            <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#E0E7FF' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.3, ease: 'easeOut', delay: 0.5 }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#6366F1,#7C3AED)' }}
              />
            </div>
            <span className="text-base">{progress >= 100 ? '👑' : nextRank.split(' ')[0]}</span>
          </div>
          <p className="text-xs text-right font-semibold" style={{ color: '#94A3B8' }}>
            {progress >= 100
              ? 'You reached the top! 🎉'
              : `${currentCP} / ${nextCP} CP  ·  Next: ${nextRank}`}
          </p>
        </motion.div>

        {/* ── Gallery ── */}
        <div className="space-y-4">
          <h3
            className="text-xl font-bold text-center"
            style={{ fontFamily: FF, color: '#4338CA' }}
          >
            🖼️ City Hero Gallery
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {SCRAPBOOK.map((m, idx) => {
              const lvl        = highestLevel[m.id] || 0;
              const isUnlocked = lvl >= 12;
              const isLast     = idx === SCRAPBOOK.length - 1;

              const frame = (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08 * idx, type: 'spring', bounce: 0.3 }}
                  className="flex flex-col rounded-3xl overflow-hidden"
                  style={{
                    background: '#FFFFFF',
                    boxShadow: isUnlocked
                      ? `0 6px 0 ${m.dark}, 0 10px 28px rgba(0,0,0,0.14)`
                      : '0 4px 0 #CBD5E1, 0 8px 20px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Photo */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      aspectRatio: '1/1',
                      background: `linear-gradient(135deg,${m.from},${m.to})`,
                      fontSize: '3.2rem',
                      filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.7)',
                    }}
                  >
                    {m.emoji}

                    {/* Locked overlay */}
                    {!isUnlocked && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                        style={{ background: 'rgba(15,10,40,0.65)' }}
                      >
                        <span className="text-3xl">🔒</span>
                        <span
                          className="font-bold tracking-widest"
                          style={{ fontFamily: FF, color: '#FFF', fontSize: '0.65rem' }}
                        >
                          LOCKED
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.6rem', fontWeight: 600 }}>
                          Reach Level 12
                        </span>
                      </div>
                    )}

                    {/* Unlocked tick */}
                    {isUnlocked && (
                      <div
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                        style={{ background: '#22C55E' }}
                      >
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  <div className="px-3 pt-2.5 pb-3 text-center space-y-0.5">
                    <p
                      className="font-bold leading-tight text-sm"
                      style={{ fontFamily: FF, color: isUnlocked ? m.accent : '#9CA3AF' }}
                    >
                      {m.title}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: '#CBD5E1' }}>
                      {lvl > 0 ? `Level ${lvl}` : '— not started —'}
                    </p>
                  </div>
                </motion.div>
              );

              if (isLast) {
                return (
                  <div key={m.id} className="col-span-2 flex justify-center">
                    <div style={{ width: 'calc(50% - 8px)' }}>{frame}</div>
                  </div>
                );
              }
              return frame;
            })}
          </div>

          <p className="text-center text-xs font-semibold" style={{ color: '#A5B4FC' }}>
            🌈 Reach Level 12 in each mission to unlock its photo!
          </p>
        </div>
      </div>
    </div>
  );
}
