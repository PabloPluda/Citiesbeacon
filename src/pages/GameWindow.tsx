import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { createGameConfig } from '../game/GameConfig';
import { EventBus } from '../game/EventBus';
import { Heart, ChevronLeft } from 'lucide-react';
import { useProgressStore } from '../store/progressStore';

export default function GameWindow() {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(4);
  const [streak, setStreak] = useState(0);
  
  // Ref for score to use inside effect without dependencies changing
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const { addCityPoints, updateHighScore } = useProgressStore();

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = new Phaser.Game(createGameConfig(containerRef.current));
    }

    const handleScore = (points: number) => {
      setScore(s => s + points);
      setStreak(s => {
        const newStreak = s + 1;
        if (newStreak % 5 === 0) {
          setLives(l => Math.min(4, l + 1)); // Recover 1 life every 5 hits
        }
        return newStreak;
      });
    };

    const handleMiss = () => {
      setStreak(0);
      setLives(l => {
        const newLives = l - 1;
        if (newLives <= 0) {
          // Game Over logic
          const finalScore = scoreRef.current;
          
          // Grant CP (10 base + 1 CP every 100 points)
          const earnedCP = 10 + Math.floor(finalScore / 100);
          addCityPoints(earnedCP);
          
          if (missionId) {
             updateHighScore(parseInt(missionId, 10), finalScore);
          }

          setTimeout(() => {
             alert(`Great job, CityHero!\nYour Score: ${finalScore} pts\nEarned: +${earnedCP} CP!`);
             navigate('/map');
          }, 100);
        }
        return newLives;
      });
    };

    EventBus.on('game-score', handleScore);
    EventBus.on('game-miss', handleMiss);

    return () => {
      EventBus.off('game-score', handleScore);
      EventBus.off('game-miss', handleMiss);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [navigate]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {/* Game Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* HTML UI / HUD Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        pointerEvents: 'none' // Let clicks pass through to Phaser
      }}>
        {/* Left Side: Back & Lives */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => navigate('/map')}
            style={{ 
              pointerEvents: 'auto', 
              background: 'white', 
              border: 'none', 
              borderRadius: '50%', 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: 'var(--shadow-soft)'
            }}
          >
            <ChevronLeft size={24} color="var(--primary)" />
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[...Array(4)].map((_, i) => (
              <Heart 
                key={i} 
                size={24} 
                fill={i < lives ? "var(--accent-3)" : "none"} 
                color={i < lives ? "var(--accent-3)" : "#FFF"} 
                style={{ opacity: i < lives ? 1 : 0.5 }}
              />
            ))}
          </div>
        </div>

        {/* Right Side: Score & Streak */}
        <div style={{ textAlign: 'right', color: 'white', textShadow: '2px 2px 0 #000' }}>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>{score}</h2>
          {streak >= 2 && <span style={{ fontSize: '1.2rem', color: 'var(--accent-1)' }}>Combo x{streak} 🔥</span>}
        </div>
      </div>
    </div>
  );
}
