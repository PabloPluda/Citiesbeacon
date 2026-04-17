import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const HERO_NAME_KEY = 'cityhero-hero-name';
const HERO_AGE_KEY  = 'cityhero-hero-age';

export default function Onboarding() {
  const [heroName, setHeroName] = useState('');
  const [age, setAge]           = useState(7);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(HERO_NAME_KEY)) {
      navigate('/profile', { replace: true });
    }
  }, [navigate]);

  const handleStart = () => {
    const trimmed = heroName.trim();
    if (trimmed.length < 2) {
      setError('Give yourself a Hero Name first! 🦸');
      return;
    }
    localStorage.setItem(HERO_NAME_KEY, trimmed);
    localStorage.setItem(HERO_AGE_KEY, String(age));
    navigate('/map');
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#EEEEFF' }}>

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden flex flex-col items-center pt-14 pb-28 px-6"
        style={{ background: 'linear-gradient(155deg, #3730A3 0%, #7C3AED 55%, #C026D3 100%)' }}
      >
        {/* Background decorative circles */}
        <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute top-24 left-2 w-14 h-14 rounded-full bg-white/10" />
        <div className="absolute bottom-14 right-8 w-18 h-18 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 left-12 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute top-8 right-20 w-6 h-6 rounded-full bg-yellow-300/40" />
        <div className="absolute top-36 left-10 w-4 h-4 rounded-full bg-pink-300/50" />

        {/* App name badge */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-2 mb-5 border border-white/25"
        >
          <span className="text-xl">🏙️</span>
          <span
            className="text-white font-bold text-sm tracking-widest uppercase"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            CityHero Academy
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="relative z-10 text-center text-white font-bold leading-tight mb-8"
          style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '2.6rem',
            textShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          Your Mission<br />Awaits! 🚀
        </motion.h1>

        {/* Tommy character */}
        <motion.div
          animate={{ y: [0, -14, 0] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
          className="relative z-10"
        >
          {/* Floor shadow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full blur-lg"
            style={{ bottom: '-14px', width: '80px', height: '14px', background: 'rgba(0,0,0,0.35)' }}
          />
          {/* Outer glow ring */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.6, 0.35] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="absolute rounded-full border-4 border-yellow-300/60"
            style={{ inset: '-12px' }}
          />
          <div
            className="w-32 h-32 rounded-full border-[6px] border-white shadow-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)',
              fontSize: '4rem',
            }}
          >
            👦
          </div>
        </motion.div>
      </div>

      {/* ── Form card — overlaps banner ─────────────────────────────── */}
      <div className="flex-1 px-4 pb-8" style={{ background: '#EEEEFF' }}>
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.5, type: 'spring', bounce: 0.2 }}
          className="bg-white rounded-3xl p-6 flex flex-col gap-5"
          style={{
            marginTop: '-48px',
            boxShadow: '0 -4px 0 0 #C4B5FD, 0 20px 60px rgba(79,70,229,0.2)',
          }}
        >
          {/* Card title */}
          <div className="text-center">
            <h2
              className="text-2xl text-indigo-600 font-bold"
              style={{ fontFamily: 'Fredoka One, cursive' }}
            >
              Create Your Hero! 🦸
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Choose a name that makes you legendary
            </p>
          </div>

          {/* Hero name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em] px-1">
              Hero Name
            </label>
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border-2 border-indigo-100 bg-indigo-50 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]">
              <span className="text-2xl leading-none select-none">🦸</span>
              <input
                type="text"
                value={heroName}
                onChange={e => { setHeroName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Choose your Hero Name!"
                maxLength={20}
                autoComplete="off"
                className="flex-1 bg-transparent outline-none text-gray-700 text-lg placeholder:text-gray-300 placeholder:text-base"
                style={{ fontFamily: 'Fredoka One, cursive' }}
              />
            </div>
            <div className="flex items-start gap-1.5 px-1 mt-0.5">
              <span className="text-amber-400 text-xs leading-4">💡</span>
              <p className="text-[11px] text-gray-400 font-semibold leading-tight">
                Don't use your real name to stay anonymous!
              </p>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-500 font-bold px-1"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Age selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em] px-1">
              How old are you?
            </label>
            <div className="flex gap-1.5">
              {[5, 6, 7, 8, 9, 10].map(a => (
                <motion.button
                  key={a}
                  whileTap={{ scale: 0.82 }}
                  onClick={() => setAge(a)}
                  className="flex-1 h-11 rounded-2xl font-bold text-sm transition-colors"
                  style={{
                    fontFamily: 'Fredoka One, cursive',
                    background: age === a
                      ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                      : '#F5F3FF',
                    color: age === a ? '#FFFFFF' : '#A78BFA',
                    boxShadow: age === a
                      ? '0 4px 14px rgba(79,70,229,0.45)'
                      : 'none',
                  }}
                >
                  {a}
                </motion.button>
              ))}
            </div>
          </div>

          {/* CTA button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: [
                '0 6px 20px rgba(249,115,22,0.4)',
                '0 10px 36px rgba(249,115,22,0.75)',
                '0 6px 20px rgba(249,115,22,0.4)',
              ],
            }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            onClick={handleStart}
            className="w-full py-4 rounded-2xl text-white font-bold"
            style={{
              fontFamily: 'Fredoka One, cursive',
              fontSize: '1.35rem',
              background: 'linear-gradient(135deg, #FB923C 0%, #EF4444 100%)',
            }}
          >
            🚀 START MISSION!
          </motion.button>
        </motion.div>

        {/* Stars decoration */}
        <div className="flex justify-center gap-7 mt-7" style={{ opacity: 0.55 }}>
          {[
            { icon: '⭐', dur: 2.0, dir: 1  },
            { icon: '🌟', dur: 2.7, dir: -1 },
            { icon: '⭐', dur: 1.9, dir: 1  },
          ].map(({ icon, dur, dir }, i) => (
            <motion.span
              key={i}
              className="text-3xl"
              animate={{ rotate: [0, dir * 22, 0], scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: dur, ease: 'easeInOut' }}
            >
              {icon}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
