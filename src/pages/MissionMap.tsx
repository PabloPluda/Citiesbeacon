import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Star } from 'lucide-react';
import { useProgressStore } from '../store/progressStore';

export default function MissionMap() {
  const navigate = useNavigate();
  const { highScores, getRankInfo } = useProgressStore();
  const { rank, currentCP, nextCP } = getRankInfo();

  // Dynamic stars based on high scores
  const score1 = highScores[1] || 0;
  const stars1 = score1 >= 5000 ? 3 : score1 >= 2000 ? 2 : score1 > 0 ? 1 : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-light)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
        boxShadow: 'var(--shadow-soft)',
        zIndex: 10
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={32} color="var(--primary)" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>CityMap</h2>
          <span className="text-dialog" style={{ fontSize: '0.9rem', color: 'var(--accent-2)' }}>
            {currentCP}/{nextCP} CP ({rank})
          </span>
        </div>
        <div style={{ width: 32 }}></div> {/* Spacer for center alignment */}
      </header>

      {/* Map Content (scrollable) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '40px',
        paddingTop: '60px'
      }}>
        
        {/* Mission 1 */}
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/game/1')}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            boxShadow: 'var(--shadow-soft)',
            cursor: 'pointer',
            border: '4px solid var(--primary)'
          }}
        >
          <div style={{
            minWidth: '60px',
            height: '60px',
            backgroundColor: '#E6F3FF',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem'
          }}>
            🗑️
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>Throw to Bin</h3>
            <p style={{ margin: 0, color: '#888', fontSize: '0.9rem', marginTop: '4px' }}>Mission 1 • Park</p>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Star size={24} fill={stars1 >= 1 ? "var(--accent-1)" : "#EEE"} color={stars1 >= 1 ? "var(--accent-1)" : "#DDD"} />
            <Star size={24} fill={stars1 >= 2 ? "var(--accent-1)" : "#EEE"} color={stars1 >= 2 ? "var(--accent-1)" : "#DDD"} />
            <Star size={24} fill={stars1 >= 3 ? "var(--accent-1)" : "#EEE"} color={stars1 >= 3 ? "var(--accent-1)" : "#DDD"} />
          </div>
        </motion.div>

        {/* Mission 2 (Locked mockup) */}
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#F5F5F5',
            borderRadius: '24px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            opacity: 0.7
          }}
        >
          <div style={{
            minWidth: '60px',
            height: '60px',
            backgroundColor: '#DDD',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            filter: 'grayscale(100%)'
          }}>
            🏃
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: '#666', fontSize: '1.4rem' }}>Lane Rush</h3>
            <p style={{ margin: 0, color: '#888', fontSize: '0.9rem', marginTop: '4px' }}>Mission 2 • Coming soon</p>
          </div>
          <div style={{ fontSize: '1.5rem' }}>
            🔒
          </div>
        </div>

      </div>
    </div>
  );
}
