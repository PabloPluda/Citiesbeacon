import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';

const HERO_NAME_KEY = 'cityhero-hero-name';

const SCRAPBOOK = [
  { id: 1, title: 'The Golden Broom',     emoji: '🧹', bg: 'from-amber-300 to-yellow-400',  accent: '#D97706' },
  { id: 2, title: 'Safety Guardian',       emoji: '🚦', bg: 'from-emerald-300 to-green-500', accent: '#059669' },
  { id: 3, title: 'Planet Brightener',     emoji: '💡', bg: 'from-orange-300 to-amber-500',  accent: '#EA580C' },
  { id: 4, title: 'Blue River Protector',  emoji: '💧', bg: 'from-sky-300 to-blue-500',      accent: '#0284C7' },
  { id: 5, title: "Sparky's Best Friend",  emoji: '🐕', bg: 'from-pink-300 to-rose-500',     accent: '#DB2777' },
];

// Slight tilt per frame — makes gallery feel handmade
const ROTATIONS = [-2, 1.5, -1.2, 2, 0];

const STAT_CARDS = [
  {
    emoji: '⭐',
    label: 'Hero Points (CP)',
    colorText: '#D97706',
    colorLight: '#FFFBEB',
    gradFrom: '#F59E0B',
    gradTo: '#F97316',
  },
  {
    emoji: '🏆',
    label: 'Missions Mastered',
    colorText: '#7C3AED',
    colorLight: '#F5F3FF',
    gradFrom: '#8B5CF6',
    gradTo: '#6366F1',
  },
];

export default function Profile() {
  const { highestLevel, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();

  const heroName         = localStorage.getItem(HERO_NAME_KEY) || 'CityHero';
  const missionsMastered = SCRAPBOOK.filter(m => (highestLevel[m.id] || 0) >= 12).length;
  const statValues       = [currentCP, `${missionsMastered}/5`];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#EEEEFF' }}>

      {/* ── Header banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden flex flex-col items-center pt-10 pb-24 px-6"
        style={{ background: 'linear-gradient(150deg, #3730A3 0%, #7C3AED 50%, #C026D3 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-white/10 translate-x-16 -translate-y-16" />
        <div className="absolute bottom-6 left-0 w-32 h-32 rounded-full bg-white/10 -translate-x-12" />
        <div className="absolute top-16 left-8 w-10 h-10 rounded-full bg-yellow-300/30" />
        <div className="absolute top-8 right-24 w-5 h-5 rounded-full bg-pink-300/40" />

        {/* Avatar with animated ring */}
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.7 }}
          className="relative mb-4 z-10"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.55, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="absolute rounded-full border-[4px] border-yellow-300/70"
            style={{ inset: '-14px' }}
          />
          <div
            className="w-28 h-28 rounded-full border-[5px] border-white shadow-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)',
              fontSize: '3.8rem',
            }}
          >
            👦
          </div>
        </motion.div>

        {/* Hero name */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-4xl text-white font-bold drop-shadow-lg mb-3 z-10"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          {heroName}
        </motion.h2>

        {/* Rank badge — glass pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-2 rounded-full px-5 py-2 border border-white/30 z-10"
          style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
        >
          <span className="text-base">{rank.split(' ')[0]}</span>
          <span
            className="text-white font-bold text-sm"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            {rank.split(' ').slice(1).join(' ')}
          </span>
        </motion.div>
      </div>

      {/* ── Content — overlaps banner ─────────────────────────────── */}
      <div
        className="relative rounded-t-[40px] -mt-14 px-4 pt-5 pb-8 flex-1 flex flex-col gap-4"
        style={{ background: '#EEEEFF' }}
      >

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {STAT_CARDS.map((card, i) => (
            <motion.div
              key={i}
              initial={{ y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="relative overflow-hidden rounded-3xl p-5 shadow-[0_6px_24px_rgba(0,0,0,0.10)]"
              style={{ background: card.colorLight }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 inset-x-0 h-1.5 rounded-t-3xl"
                style={{ background: `linear-gradient(90deg, ${card.gradFrom}, ${card.gradTo})` }}
              />
              {/* Icon bubble */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ background: `${card.gradFrom}28` }}
              >
                {card.emoji}
              </div>
              {/* Value */}
              <div
                className="text-3xl font-bold leading-none mb-1.5"
                style={{ fontFamily: 'Fredoka One, cursive', color: card.colorText }}
              >
                {statValues[i]}
              </div>
              {/* Label */}
              <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                {card.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Rank XP bar ────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-3xl p-4 shadow-[0_4px_18px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span
              className="text-xs font-bold uppercase tracking-wider text-indigo-400"
            >
              Rank Progress
            </span>
            <span className="text-xs font-bold text-purple-500">
              {progress >= 100 ? '👑 MAX RANK!' : `${Math.round(progress)}%`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-lg flex-shrink-0">{rank.split(' ')[0]}</span>
            <div className="flex-1 h-4 bg-indigo-50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.3, ease: 'easeOut', delay: 0.4 }}
                className="h-full rounded-full relative overflow-hidden"
                style={{ background: 'linear-gradient(90deg, #4F46E5, #C026D3)' }}
              >
                {/* Shimmer sweep */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'linear', delay: 1.8 }}
                  className="absolute inset-y-0 w-1/3 bg-white/30"
                  style={{ transform: 'skewX(-16deg)' }}
                />
              </motion.div>
            </div>
            <span className="text-lg flex-shrink-0">
              {progress >= 100 ? '👑' : nextRank.split(' ')[0]}
            </span>
          </div>

          <p className="text-right text-[10px] text-gray-400 mt-1.5 font-semibold">
            {progress >= 100
              ? 'You reached the top! 🎉'
              : `${currentCP} / ${nextCP} CP — Next: ${nextRank.split(' ').slice(1).join(' ')}`}
          </p>
        </motion.div>

        {/* ── Gallery section ────────────────────────────────────── */}
        <div>
          {/* Section divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #C4B5FD)' }} />
            <h3
              className="text-sm font-bold text-purple-500 whitespace-nowrap"
              style={{ fontFamily: 'Fredoka One, cursive', letterSpacing: '0.08em' }}
            >
              🖼️ CITY HERO GALLERY
            </h3>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, #C4B5FD)' }} />
          </div>

          {/* Frames grid */}
          <div className="grid grid-cols-2 gap-5">
            {SCRAPBOOK.map((mission, idx) => {
              const lvl        = highestLevel[mission.id] || 0;
              const isUnlocked = lvl >= 12;
              const isLast     = idx === SCRAPBOOK.length - 1;

              const frame = (
                <motion.div
                  key={mission.id}
                  initial={{ scale: 0.82, opacity: 0, rotate: 0 }}
                  animate={{ scale: 1, opacity: 1, rotate: ROTATIONS[idx] }}
                  transition={{ delay: 0.06 * idx, type: 'spring', bounce: 0.3 }}
                  className="bg-white rounded-3xl"
                  style={{
                    padding: '10px',
                    boxShadow: isUnlocked
                      ? `0 10px 36px rgba(0,0,0,0.16), 0 0 0 2px ${mission.accent}33`
                      : '0 8px 28px rgba(0,0,0,0.12)',
                  }}
                >
                  {/* Photo area */}
                  <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{ aspectRatio: '1 / 1' }}
                  >
                    {/* Mission image */}
                    <div
                      className={`w-full h-full bg-gradient-to-br ${mission.bg} flex items-center justify-center`}
                      style={{
                        fontSize: '3.2rem',
                        filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.72)',
                      }}
                    >
                      {mission.emoji}
                    </div>

                    {/* Locked overlay — elegant frosted glass */}
                    {!isUnlocked && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center"
                        style={{ background: 'rgba(15,10,40,0.68)' }}
                      >
                        <div
                          className="flex flex-col items-center gap-1 rounded-2xl px-4 py-3 border border-white/20"
                          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}
                        >
                          <span className="text-3xl leading-none">🔒</span>
                          <span
                            className="text-white font-bold tracking-widest"
                            style={{ fontFamily: 'Fredoka One, cursive', fontSize: '0.65rem' }}
                          >
                            LOCKED
                          </span>
                          <span className="text-white/60 font-semibold" style={{ fontSize: '0.6rem' }}>
                            Reach Level 12
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Unlocked badge */}
                    {isUnlocked && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-green-500 shadow-md flex items-center justify-center">
                        <span className="text-white font-bold text-xs">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Caption strip */}
                  <div className="pt-2.5 pb-0.5 px-1">
                    <p
                      className="text-center font-bold leading-tight"
                      style={{
                        fontFamily: 'Fredoka One, cursive',
                        fontSize: '0.72rem',
                        color: isUnlocked ? mission.accent : '#9CA3AF',
                      }}
                    >
                      {mission.title}
                    </p>
                    <p className="text-center text-gray-400 font-semibold mt-0.5" style={{ fontSize: '0.6rem' }}>
                      {lvl > 0 ? `Level ${lvl}` : '— not started —'}
                    </p>
                  </div>
                </motion.div>
              );

              // Center the lone last item
              if (isLast) {
                return (
                  <div key={mission.id} className="col-span-2 flex justify-center">
                    <div style={{ width: 'calc(50% - 10px)' }}>{frame}</div>
                  </div>
                );
              }
              return frame;
            })}
          </div>

          <p className="text-center text-[11px] text-indigo-300 font-semibold mt-5">
            🌈 Reach Level 12 in each mission to unlock its photo!
          </p>
        </div>
      </div>
    </div>
  );
}
