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
      setError('Pick a Hero Name first! 🦸');
      return;
    }
    localStorage.setItem(HERO_NAME_KEY, trimmed);
    localStorage.setItem(HERO_AGE_KEY, String(age));
    navigate('/map');
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F0F4FF' }}>
      <div className="flex flex-col items-center px-6 pt-10 pb-12 space-y-6">

        {/* ── Branding ── */}
        <div className="text-center space-y-1">
          <p
            className="text-xs font-bold uppercase tracking-widest text-indigo-400"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            🏙️ CityHero Academy
          </p>
          <h1
            className="text-4xl font-bold text-indigo-900 leading-tight"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            Your Mission<br />Awaits! 🚀
          </h1>
        </div>

        {/* ── Tommy avatar ── */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="w-28 h-28 rounded-full border-4 border-white shadow-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #FFD93D 0%, #FF8C42 100%)',
            fontSize: '3.8rem',
          }}
        >
          👦
        </motion.div>

        {/* ── Form card ── */}
        <div className="w-full bg-white rounded-3xl shadow-lg p-6 space-y-5">

          <h2
            className="text-2xl font-bold text-center text-indigo-600"
            style={{ fontFamily: 'Fredoka One, cursive' }}
          >
            Create Your Hero! 🦸
          </h2>

          {/* Hero name */}
          <div className="space-y-2">
            <label
              className="block text-xs font-bold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: 'Fredoka One, cursive' }}
            >
              Hero Name
            </label>
            <div className="flex items-center gap-3 w-full rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 focus-within:border-indigo-500 focus-within:bg-white transition-colors">
              <span className="text-2xl flex-shrink-0 leading-none">🦸</span>
              <input
                type="text"
                value={heroName}
                onChange={e => { setHeroName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Choose your Hero Name!"
                maxLength={20}
                autoComplete="off"
                className="flex-1 bg-transparent outline-none text-gray-700 text-lg placeholder:text-gray-300"
                style={{ fontFamily: 'Fredoka One, cursive', minWidth: 0 }}
              />
            </div>
            <p className="text-sm text-amber-500 font-semibold">
              💡 Don't use your real name to stay anonymous!
            </p>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold text-red-500"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Age selector */}
          <div className="space-y-3">
            <label
              className="block text-xs font-bold uppercase tracking-widest text-gray-400"
              style={{ fontFamily: 'Fredoka One, cursive' }}
            >
              How old are you?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[5, 6, 7, 8, 9, 10].map(a => (
                <motion.button
                  key={a}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setAge(a)}
                  className="h-14 rounded-2xl font-bold text-xl transition-all"
                  style={{
                    fontFamily: 'Fredoka One, cursive',
                    background: age === a
                      ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                      : '#EEF2FF',
                    color: age === a ? '#FFFFFF' : '#818CF8',
                    boxShadow: age === a ? '0 4px 14px rgba(79,70,229,0.4)' : 'none',
                  }}
                >
                  {a}
                </motion.button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            className="w-full py-4 rounded-2xl text-white font-bold text-xl shadow-lg"
            style={{
              fontFamily: 'Fredoka One, cursive',
              background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
              boxShadow: '0 6px 24px rgba(249,115,22,0.45)',
            }}
          >
            🚀 START MISSION!
          </motion.button>
        </div>

        {/* ── Decorative stars ── */}
        <div className="flex items-center gap-6">
          {[
            { icon: '⭐', dur: 2.0, dir:  1 },
            { icon: '🌟', dur: 2.7, dir: -1 },
            { icon: '⭐', dur: 1.9, dir:  1 },
          ].map(({ icon, dur, dir }, i) => (
            <motion.span
              key={i}
              className="text-3xl"
              animate={{ rotate: [0, dir * 20, 0] }}
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
