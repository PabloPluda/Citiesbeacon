import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const HERO_NAME_KEY = 'cityhero-hero-name';
const HERO_AGE_KEY  = 'cityhero-hero-age';

const FF = 'Fredoka One, cursive';

const AGE_COLORS = [
  { from: '#F97316', to: '#EF4444', shadow: '#B91C1C' }, // 5 – orange-red
  { from: '#8B5CF6', to: '#6D28D9', shadow: '#4C1D95' }, // 6 – purple
  { from: '#0EA5E9', to: '#2563EB', shadow: '#1E3A8A' }, // 7 – blue
  { from: '#10B981', to: '#059669', shadow: '#064E3B' }, // 8 – green
  { from: '#F59E0B', to: '#D97706', shadow: '#92400E' }, // 9 – amber
  { from: '#EC4899', to: '#DB2777', shadow: '#831843' }, // 10 – pink
];

export default function Onboarding() {
  const [heroName, setHeroName] = useState('');
  const [age, setAge]           = useState(7);
  const [error, setError]       = useState('');
  const [pressing, setPressing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(HERO_NAME_KEY)) navigate('/profile', { replace: true });
  }, [navigate]);

  const handleStart = () => {
    const trimmed = heroName.trim();
    if (trimmed.length < 2) { setError('Pick a Hero Name first! 🦸'); return; }
    localStorage.setItem(HERO_NAME_KEY, trimmed);
    localStorage.setItem(HERO_AGE_KEY, String(age));
    navigate('/map');
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ background: 'linear-gradient(180deg,#1E3A8A 0%,#3B82F6 45%,#EFF6FF 100%)' }}>

      {/* ── Banner ──────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-6 pt-10 pb-12 space-y-4">

        {/* App badge */}
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.35)' }}
        >
          <span className="text-lg">🏙️</span>
          <span className="text-white font-bold text-sm" style={{ fontFamily: FF }}>CityHero Academy</span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl text-white text-center font-bold leading-tight"
          style={{ fontFamily: FF, textShadow: '0 3px 10px rgba(0,0,0,0.25)' }}
        >
          Your Mission<br />Awaits! 🚀
        </h1>

        {/* Tommy */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Glow */}
          <div
            className="absolute -inset-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(253,224,71,0.55) 0%, transparent 72%)' }}
          />
          <div
            className="relative w-28 h-28 rounded-full border-4 border-white flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#FFD93D 0%,#FF8C42 100%)',
              fontSize: '3.8rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            👦
          </div>
        </motion.div>
      </div>

      {/* ── White slide-up form section ────────────────────────────── */}
      <div
        className="flex-1 px-5 pt-7 pb-10 space-y-6"
        style={{
          background: '#FFFFFF',
          borderTopLeftRadius: '36px',
          borderTopRightRadius: '36px',
          boxShadow: '0 -8px 32px rgba(30,58,138,0.15)',
        }}
      >
        <h2
          className="text-2xl text-center font-bold"
          style={{ fontFamily: FF, color: '#1E3A8A' }}
        >
          Create Your Hero! 🦸
        </h2>

        {/* Hero name */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            Hero Name
          </p>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all"
            style={{ border: '2.5px solid #BFDBFE', background: '#EFF6FF' }}
            onFocus={() => {}} // handled by CSS focus-within
          >
            <span className="text-2xl leading-none flex-shrink-0">🦸</span>
            <input
              type="text"
              value={heroName}
              onChange={e => { setHeroName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="Choose your Hero Name!"
              maxLength={20}
              autoComplete="off"
              className="flex-1 bg-transparent outline-none text-gray-700 text-lg placeholder:text-blue-200"
              style={{ fontFamily: FF, minWidth: 0 }}
            />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
            💡 Don't use your real name to stay anonymous!
          </p>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold text-red-500"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Age selector */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            How old are you?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[5, 6, 7, 8, 9, 10].map((a, i) => {
              const col = AGE_COLORS[i];
              const sel = age === a;
              return (
                <motion.button
                  key={a}
                  whileTap={{ y: 4 }}
                  onClick={() => setAge(a)}
                  className="h-14 rounded-2xl font-bold text-xl transition-transform"
                  style={{
                    fontFamily: FF,
                    background: sel ? `linear-gradient(180deg,${col.from},${col.to})` : '#F1F5F9',
                    color: sel ? '#FFFFFF' : '#94A3B8',
                    boxShadow: sel
                      ? `0 5px 0 ${col.shadow}, 0 8px 16px rgba(0,0,0,0.18)`
                      : '0 3px 0 #CBD5E1',
                    transform: sel ? 'translateY(0)' : undefined,
                    border: 'none',
                  }}
                >
                  {a}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* START button */}
        <motion.button
          onTapStart={() => setPressing(true)}
          onTap={() => { setPressing(false); handleStart(); }}
          onTapCancel={() => setPressing(false)}
          onClick={handleStart}
          className="w-full rounded-2xl text-white font-bold text-xl py-4 transition-transform active:translate-y-1"
          style={{
            fontFamily: FF,
            background: 'linear-gradient(180deg,#22C55E 0%,#16A34A 100%)',
            boxShadow: pressing
              ? '0 2px 0 #14532D'
              : '0 6px 0 #14532D, 0 10px 20px rgba(21,128,61,0.4)',
            transform: pressing ? 'translateY(4px)' : undefined,
            border: 'none',
          }}
        >
          🚀 START MISSION!
        </motion.button>

        {/* Stars */}
        <div className="flex justify-center items-center gap-6 pt-2">
          {[
            { icon: '⭐', dur: 2.0, dir:  1 },
            { icon: '🌟', dur: 2.7, dir: -1 },
            { icon: '⭐', dur: 1.9, dir:  1 },
          ].map(({ icon, dur, dir }, i) => (
            <motion.span
              key={i}
              className="text-3xl"
              animate={{ rotate: [0, dir * 22, 0] }}
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
