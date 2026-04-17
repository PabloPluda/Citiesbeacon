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

export default function Profile() {
  const { highestLevel, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();

  const heroName         = localStorage.getItem(HERO_NAME_KEY) || 'CityHero';
  const missionsMastered = SCRAPBOOK.filter(m => (highestLevel[m.id] || 0) >= 12).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#F0F4FF' }}>

      {/* ── Header ── */}
      <div
        className="flex flex-col items-center pt-10 pb-8 px-6 space-y-3"
        style={{ background: 'linear-gradient(150deg, #4F46E5 0%, #7C3AED 100%)' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
          className="w-24 h-24 rounded-full border-4 border-white shadow-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)',
            fontSize: '3.2rem',
          }}
        >
          👦
        </motion.div>

        <h2
          className="text-3xl font-bold text-white text-center"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          {heroName}
        </h2>

        <span
          className="bg-yellow-400 text-gray-800 font-bold px-5 py-2 rounded-full text-sm shadow-md"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          {rank}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="px-4 py-5 space-y-4">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-md text-center space-y-1">
            <div className="text-3xl">⭐</div>
            <div
              className="text-2xl font-bold text-amber-500"
              style={{ fontFamily: 'Fredoka One, cursive' }}
            >
              {currentCP}
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Hero Points
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md text-center space-y-1">
            <div className="text-3xl">🏆</div>
            <div
              className="text-2xl font-bold text-indigo-500"
              style={{ fontFamily: 'Fredoka One, cursive' }}
            >
              {missionsMastered}
              <span className="text-sm text-gray-400 font-semibold">/5</span>
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Mastered
            </div>
          </div>
        </div>

        {/* Rank progress */}
        <div className="bg-white rounded-2xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-500">Rank Progress</span>
            <span className="text-sm font-bold text-indigo-500">
              {progress >= 100 ? '👑 MAX!' : `${Math.round(progress)}%`}
            </span>
          </div>
          <div className="h-4 w-full bg-indigo-50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right font-medium">
            {progress >= 100
              ? 'Max Rank reached! 🎉'
              : `${currentCP} / ${nextCP} CP  ·  Next: ${nextRank}`}
          </p>
        </div>

        {/* Gallery */}
        <div className="space-y-3">
          <h3
            className="text-xl font-bold text-indigo-600 text-center"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            🖼️ City Hero Gallery
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {SCRAPBOOK.map((mission, idx) => {
              const lvl        = highestLevel[mission.id] || 0;
              const isUnlocked = lvl >= 12;
              const isLast     = idx === SCRAPBOOK.length - 1;

              const card = (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07 * idx }}
                  className="bg-white rounded-3xl shadow-md overflow-hidden"
                >
                  {/* Photo area */}
                  <div
                    className={`relative w-full bg-gradient-to-br ${mission.bg} flex items-center justify-center`}
                    style={{
                      aspectRatio: '1 / 1',
                      fontSize: '3rem',
                      filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.72)',
                    }}
                  >
                    {mission.emoji}

                    {/* Locked overlay */}
                    {!isUnlocked && (
                      <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1">
                        <span className="text-3xl">🔒</span>
                        <span
                          className="text-white font-bold text-xs tracking-widest"
                          style={{ fontFamily: 'Fredoka One, cursive' }}
                        >
                          LOCKED
                        </span>
                        <span className="text-white/70 text-[10px] font-semibold">
                          Reach Level 12
                        </span>
                      </div>
                    )}

                    {/* Unlocked checkmark */}
                    {isUnlocked && (
                      <div className="absolute top-2 right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  <div className="p-3 text-center space-y-0.5">
                    <p
                      className="font-bold text-sm leading-tight"
                      style={{
                        fontFamily: 'Fredoka One, cursive',
                        color: isUnlocked ? mission.accent : '#9CA3AF',
                      }}
                    >
                      {mission.title}
                    </p>
                    <p className="text-xs text-gray-400 font-semibold">
                      {lvl > 0 ? `Level ${lvl}` : '— not started —'}
                    </p>
                  </div>
                </motion.div>
              );

              // Last item (5th) centred in 2-col grid
              if (isLast) {
                return (
                  <div key={mission.id} className="col-span-2 flex justify-center">
                    <div className="w-1/2">{card}</div>
                  </div>
                );
              }
              return card;
            })}
          </div>

          <p className="text-center text-xs text-indigo-300 font-semibold pt-1">
            🌈 Reach Level 12 in each mission to unlock its photo!
          </p>
        </div>

      </div>
    </div>
  );
}
