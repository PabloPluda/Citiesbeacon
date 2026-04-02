import { useNavigate } from 'react-router-dom';
import { Play, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
      background: 'linear-gradient(180deg, var(--bg-light) 0%, #E6F3FF 100%)'
    }}>
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5 }}
        style={{ textAlign: 'center', marginBottom: '40px' }}
      >
        <h1 style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '10px' }}>
          CityHero <br/><span style={{ color: 'var(--accent-2)' }}>Academy</span>
        </h1>
        <p className="text-dialog" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          "It's not that hard, buddy!"
        </p>
      </motion.div>

      {/* Placeholder Tommy */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        style={{
          width: '120px',
          height: '120px',
          backgroundColor: 'var(--accent-1)',
          borderRadius: '50%',
          border: '6px solid white',
          boxShadow: 'var(--shadow-soft)',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '3rem' }}>👦</span>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '300px' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/map')}
          style={{ padding: '16px', fontSize: '1.4rem' }}
        >
          <Play size={24} fill="currentColor" /> Play Now!
        </button>
        <button 
          className="btn" 
          style={{ backgroundColor: 'white', color: 'var(--primary)' }}
        >
          <Trophy size={20} /> Leaderboard
        </button>
      </div>
    </div>
  );
}
