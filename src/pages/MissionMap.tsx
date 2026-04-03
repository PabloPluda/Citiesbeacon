import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Lock } from 'lucide-react';
import { useProgressStore } from '../store/progressStore';

const MISSIONS = [
  { id: 1, title: 'Keeping the city clean', icon: '🗑️', active: true },
  { id: 2, title: 'Crossing the right way', icon: '🚶', active: true },
  { id: 3, title: 'Responsible use of electricity', icon: '💡', active: true },
  { id: 4, title: 'Water saver', icon: '💧', active: true },
  { id: 5, title: 'Park ranger', icon: '🌲', active: false },
  { id: 6, title: 'Healthy eating', icon: '🍎', active: false },
];

const HOUSE_COLORS = ['#EF4444', '#3B82F6', '#EAB308', '#EC4899', '#8B5CF6', '#F97316'];

export default function MissionMap() {
  const navigate = useNavigate();
  const { getRankInfo, getHighestLevel, getPuzzlePieces } = useProgressStore();
  const { rank, currentCP, nextCP } = getRankInfo();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#86EFAC', // Main map terrain (grass)
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        zIndex: 50
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={32} color="var(--primary)" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)', fontFamily: 'Fredoka One' }}>City Map</h2>
          <span className="text-dialog" style={{ fontSize: '0.9rem', color: 'var(--accent-2)' }}>
            {currentCP}/{nextCP} CP • {rank}
          </span>
        </div>
        <div style={{ width: 32 }} />
      </header>

      {/* Map Content (Scrollable City) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* The Road Background */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '140px',
          backgroundColor: '#52525B', // Road color
          zIndex: 0
        }}>
          {/* Dotted center line */}
          <div style={{
            position: 'absolute',
            left: '50%', transform: 'translateX(-50%)',
            height: '100%', width: 0,
            borderLeft: '6px dashed #FCD34D'
          }} />
        </div>

        {/* Decorative Houses along the street */}
        {MISSIONS.map((_, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const houseColor = HOUSE_COLORS[i % HOUSE_COLORS.length];
          const topPos = 120 + i * 160;
          return (
            <div key={`house-${i}`} style={{
              position: 'absolute',
              top: topPos,
              [side]: '8%',
              width: '60px', height: '60px',
              backgroundColor: houseColor,
              borderRadius: '8px',
              zIndex: 1,
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
              display: 'flex', justifyContent: 'center'
            }}>
              {/* Roof */}
              <div style={{
                position: 'absolute',
                top: -30,
                width: 0, height: 0,
                borderLeft: '35px solid transparent',
                borderRight: '35px solid transparent',
                borderBottom: `30px solid ${houseColor}`,
                filter: 'brightness(0.8)'
              }} />
            </div>
          )
        })}

        {/* Missions Container */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          padding: '60px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '60px'
        }}>
          {MISSIONS.map((mission, i) => {
            if (!mission.active) {
              return (
                <div key={mission.id} style={{
                  width: '100%', maxWidth: '400px',
                  backgroundColor: '#F3F4F6',
                  borderRadius: '24px', padding: '20px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                  opacity: 0.8,
                  marginLeft: i % 2 === 0 ? '-20px' : '20px' // Staggered placement on the road
                }}>
                  <div style={{
                    minWidth: '64px', height: '64px', backgroundColor: '#E5E7EB', borderRadius: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2.2rem', filter: 'grayscale(100%)'
                  }}>
                    {mission.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, color: '#9CA3AF', fontSize: '1.3rem' }}>{mission.title}</h3>
                    <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.85rem', marginTop: 2 }}>Mission {mission.id} • Locked</p>
                  </div>
                  <div style={{ color: '#9CA3AF' }}><Lock size={24} /></div>
                </div>
              );
            }

            // Active Mission
            const highestLevel = getHighestLevel(mission.id);
            const puzzlePieces = getPuzzlePieces(mission.id);
            const isComplete = highestLevel >= 12;

            return (
              <motion.div
                key={mission.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/game/${mission.id}`)}
                style={{
                  width: '100%', maxWidth: '400px',
                  backgroundColor: 'white',
                  borderRadius: '24px', padding: '20px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  border: `4px solid ${isComplete ? 'var(--secondary)' : 'var(--primary)'}`,
                  marginLeft: i % 2 === 0 ? '-20px' : '20px' // Staggered placement
                }}
              >
                <div style={{
                  minWidth: '64px', height: '64px',
                  backgroundColor: '#E6F3FF',
                  borderRadius: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.2rem'
                }}>
                  {mission.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.3rem', lineHeight: '1.2' }}>{mission.title}</h3>
                  <p style={{ margin: 0, color: '#888', fontSize: '0.85rem', marginTop: 4 }}>Mission {mission.id} • Active</p>
                  
                  {/* Progress bar */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Fredoka', fontSize: '0.78rem', color: 'var(--primary)' }}>
                        {isComplete ? '✅ Complete!' : highestLevel === 0 ? 'Not started' : `Level ${highestLevel} / 20`}
                      </span>
                      <span style={{ fontFamily: 'Fredoka', fontSize: '0.78rem', color: '#aaa' }}>
                        🧩 {puzzlePieces}/20
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#EEE', borderRadius: 99 }}>
                      <div style={{
                        height: '100%',
                        width: `${(highestLevel / 20) * 100}%`,
                        background: isComplete ? 'var(--secondary)' : 'var(--primary)',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem' }}>
                  {isComplete ? '🏆' : '▶️'}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
