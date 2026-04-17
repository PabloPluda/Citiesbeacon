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
    <div className="flex-1 flex flex-col items-center overflow-y-auto bg-gradient-to-b from-sky-400 via-blue-300 to-amber-100 px-5 pt-8 pb-10">

      {/* Title */}
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-2"
      >
        <h1
          className="text-5xl font-bold text-white drop-shadow-lg leading-tight"
          style={{ fontFamily: 'Fredoka One, cursive', textShadow: '0 3px 8px rgba(0,0,0,0.2)' }}
        >
          CityHero 🏙️
        </h1>
        <p
          className="text-2xl text-blue-900/60 font-bold tracking-widest"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          ACADEMY
        </p>
      </motion.div>

      {/* Tommy avatar */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
        className="w-28 h-28 rounded-full border-[5px] border-white shadow-2xl flex items-center justify-center text-6xl mb-6"
        style={{ background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)' }}
      >
        👦
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, type: 'spring', bounce: 0.3 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
      >
        <h2
          className="text-center text-2xl text-blue-500"
          style={{ fontFamily: 'Fredoka One, cursive' }}
        >
          Create Your Hero! 🦸
        </h2>

        {/* Hero name input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
            Hero Name
          </label>
          <div className="flex items-center gap-3 border-2 border-blue-200 rounded-2xl px-4 py-3 bg-blue-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <span className="text-2xl select-none">🦸</span>
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
          <p className="text-xs text-orange-400 font-semibold px-1">
            💡 Tip: Don't use your real name to stay anonymous!
          </p>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500 font-semibold px-1"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Age selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
            How old are you?
          </label>
          <div className="flex gap-2 justify-between">
            {[5, 6, 7, 8, 9, 10].map(a => (
              <motion.button
                key={a}
                whileTap={{ scale: 0.88 }}
                onClick={() => setAge(a)}
                className={`flex-1 h-10 rounded-full font-bold text-sm transition-all ${
                  age === a
                    ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-300'
                    : 'bg-gray-100 text-gray-500'
                }`}
                style={{ fontFamily: 'Fredoka One, cursive' }}
              >
                {a}
              </motion.button>
            ))}
          </div>
        </div>

        {/* CTA button */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          animate={{
            boxShadow: [
              '0 6px 20px rgba(251,146,60,0.45)',
              '0 10px 32px rgba(251,146,60,0.8)',
              '0 6px 20px rgba(251,146,60,0.45)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          onClick={handleStart}
          className="w-full py-4 rounded-full text-white text-2xl font-bold shadow-lg transition-transform"
          style={{
            fontFamily: 'Fredoka One, cursive',
            background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
          }}
        >
          🚀 START MISSION!
        </motion.button>
      </motion.div>

      {/* Decorative stars */}
      <div className="flex gap-5 mt-7 opacity-70">
        {['⭐', '🌟', '⭐'].map((s, i) => (
          <motion.span
            key={i}
            className="text-3xl"
            animate={{ rotate: [0, i % 2 === 0 ? 18 : -18, 0] }}
            transition={{ repeat: Infinity, duration: 2 + i * 0.4, ease: 'easeInOut' }}
          >
            {s}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
