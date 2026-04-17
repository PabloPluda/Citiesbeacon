import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';

const HERO_NAME_KEY = 'cityhero-hero-name';

const SCRAPBOOK = [
  { id: 1, title: 'The Golden Broom',      emoji: '🧹', grad: 'from-yellow-100 to-yellow-200' },
  { id: 2, title: 'Safety Guardian',        emoji: '🚦', grad: 'from-green-100 to-emerald-200' },
  { id: 3, title: 'Planet Brightener',      emoji: '💡', grad: 'from-orange-100 to-amber-200'  },
  { id: 4, title: 'Blue River Protector',   emoji: '💧', grad: 'from-sky-100 to-blue-200'      },
  { id: 5, title: "Sparky's Best Friend",   emoji: '🐕', grad: 'from-pink-100 to-rose-200'     },
];

export default function Profile() {
  const { cityPoints, highestLevel, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();

  const heroName = localStorage.getItem(HERO_NAME_KEY) || 'CityHero';

  const missionsMastered = SCRAPBOOK.filter(m => (highestLevel[m.id] || 0) >= 12).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-indigo-50 to-purple-50">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="rounded-b-[44px] px-6 pt-10 pb-14 flex flex-col items-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #4DA6FF 0%, #9B59B6 100%)' }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.55, duration: 0.6 }}
          className="w-24 h-24 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-5xl mb-3"
          style={{ background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)' }}
        >
          👦
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl text-white font-bold mb-2 drop-shadow"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          {heroName}
        </motion.h2>

        <span
          className="bg-yellow-400 text-gray-800 font-bold px-5 py-1.5 rounded-full text-sm shadow-md"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          {rank}
        </span>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────── */}
      <div className="px-4 -mt-6 grid grid-cols-2 gap-3">
        {[
          { delay: 0.1, emoji: '⭐', value: currentCP, label: 'Hero Points (CP)', color: 'text-blue-500' },
          { delay: 0.2, emoji: '🎮', value: `${missionsMastered}/5`, label: 'Missions Mastered', color: 'text-purple-500' },
        ].map(({ delay, emoji, value, label, color }) => (
          <motion.div
            key={label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay }}
            className="bg-white rounded-2xl p-4 shadow-md text-center"
          >
            <div className="text-3xl mb-1">{emoji}</div>
            <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'Fredoka One, cursive' }}>
              {value}
            </div>
            <div className="text-xs text-gray-400 font-semibold mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Rank progress ─────────────────────────────────────────── */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
          <div className="flex justify-between text-xs text-gray-400 font-semibold mb-2">
            <span>{rank}</span>
            <span>{progress >= 100 ? '👑 Max Rank!' : `Next: ${nextRank} (${nextCP} CP)`}</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #4DA6FF, #9B59B6)' }}
            />
          </div>
        </div>
      </div>

      {/* ── Scrapbook ─────────────────────────────────────────────── */}
      <div className="px-4 mt-5 pb-6">
        <h3
          className="text-xl text-gray-700 mb-3 flex items-center gap-2"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          📸 The City Hero Scrapbook
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {SCRAPBOOK.map((mission, idx) => {
            const lvl        = highestLevel[mission.id] || 0;
            const isUnlocked = lvl >= 12;
            const isLast     = idx === SCRAPBOOK.length - 1 && SCRAPBOOK.length % 2 !== 0;

            return (
              <motion.div
                key={mission.id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 * idx, type: 'spring', bounce: 0.3 }}
                className={`bg-white rounded-2xl p-3 shadow-md flex flex-col items-center relative overflow-hidden${isLast ? ' col-span-2 mx-auto w-40' : ''}`}
              >
                {/* Photo area + title — filtered when locked */}
                <div style={isUnlocked ? {} : { filter: 'grayscale(100%)', opacity: 0.55 }} className="w-full flex flex-col items-center">
                  <div className={`w-full rounded-xl bg-gradient-to-br ${mission.grad} h-20 flex items-center justify-center text-4xl mb-2`}>
                    {mission.emoji}
                  </div>
                  <p
                    className="text-center text-xs font-bold text-gray-600 leading-tight"
                    style={{ fontFamily: 'Fredoka One, cursive' }}
                  >
                    {mission.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                    {lvl > 0 ? `Level ${lvl}` : 'Not started'}
                  </p>
                </div>

                {/* Lock overlay — full color on top of grayscale content */}
                {!isUnlocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                    <span className="text-2xl drop-shadow">🔒</span>
                    <span className="text-[9px] font-bold text-gray-600 bg-white/80 rounded-full px-1.5">
                      Lv.12 to unlock
                    </span>
                  </div>
                )}

                {/* Unlocked badge */}
                {isUnlocked && (
                  <div className="absolute top-2 right-2">
                    <span className="text-base drop-shadow">🌟</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 font-medium">
          Reach Level 12 in each mission to unlock its photo in color! 🌈
        </p>
      </div>
    </div>
  );
}
