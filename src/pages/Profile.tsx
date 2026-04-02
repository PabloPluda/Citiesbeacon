import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';
import { Trophy, Star, Medal } from 'lucide-react';

export default function Profile() {
  const { cityPoints, highScores, getRankInfo } = useProgressStore();
  const { rank, nextRank, progress, currentCP, nextCP } = getRankInfo();

  // Mock total missions implemented so far
  const totalMissions = 1;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-light)',
      overflowY: 'auto'
    }}>
      {/* Profile Header */}
      <div style={{
        background: 'var(--primary)',
        padding: '40px 20px',
        color: 'white',
        borderBottomLeftRadius: '32px',
        borderBottomRightRadius: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: 'var(--shadow-soft)'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          backgroundColor: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          border: '4px solid var(--accent-1)',
          marginBottom: '16px'
        }}>
          👦
        </div>
        <h2 style={{ fontSize: '2rem', margin: '0 0 8px 0' }}>CityHero</h2>
        <span style={{ 
          fontSize: '1.2rem', 
          backgroundColor: 'var(--accent-1)', 
          color: 'var(--text-primary)', 
          padding: '4px 16px', 
          borderRadius: '16px',
          fontFamily: 'var(--font-title)'
        }}>
          {rank}
        </span>
      </div>

      {/* Progress Section */}
      <div style={{ padding: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={20} color="var(--accent-2)" /> Rank Progress
        </h3>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{currentCP} CP</span>
            <span style={{ color: '#888' }}>{progress >= 100 ? 'Max Rank' : `Next: ${nextRank} (${nextCP} CP)`}</span>
          </div>
          
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '16px', backgroundColor: '#EEE', borderRadius: '8px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ height: '100%', backgroundColor: 'var(--secondary)' }}
            />
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ padding: '0 24px 24px 24px' }}>
        <h3 className="title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={20} color="var(--accent-1)" /> Your Stats
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
              {cityPoints}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#888' }}>Total Points</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--accent-2)', fontFamily: 'var(--font-title)' }}>
              {Object.keys(highScores).length}/{totalMissions}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#888' }}>Missions Played</div>
          </div>
        </div>
      </div>

      {/* Badges Section */}
      <div style={{ padding: '0 24px 40px 24px' }}>
        <h3 className="title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Medal size={20} color="var(--accent-3)" /> Badges
        </h3>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
          {cityPoints > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px', opacity: 1 }}>
              <div style={{ fontSize: '3rem' }}>🥉</div>
              <span style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '8px' }}>First Toss</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', width: '100%' }}>
              Play your first mission to earn badges!
            </div>
          )}
          
          {cityPoints >= 500 && (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px', opacity: 1 }}>
              <div style={{ fontSize: '3rem' }}>🥈</div>
              <span style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '8px' }}>Clean Streak</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
