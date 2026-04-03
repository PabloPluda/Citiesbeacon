import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '../store/progressStore';

interface Props {
  missionId: number;
  currentLevel: number;      // level just completed
  isMissionComplete: boolean;
  onNextLevel: () => void;
  onPlayAgain: () => void;   // used when mission complete
  onQuit: () => void;
}

const COLS = 4;
const ROWS = 5;
const CELL = 60;
const W = COLS * CELL; // 240
const H = ROWS * CELL; // 300

// Fixed tab configurations for a 4x5 grid interlocking pattern
// 1 = tab points right/bottom, -1 = tab points left/top
const TABS_H = [
  [ 1, -1,  1],  // row 0
  [-1,  1, -1],  // row 1
  [ 1,  1, -1],  // row 2
  [-1, -1,  1],  // row 3
  [ 1, -1,  1]   // row 4
];
const TABS_V = [
  [ 1, -1,  1, -1], // col 0,1,2,3
  [-1,  1, -1,  1], // row 1 bottom
  [ 1,  1, -1, -1], // row 2 bottom
  [-1, -1,  1,  1]  // row 3 bottom
];

function getJigsawPath(col: number, row: number) {
  const top    = row === 0 ? 0 : -TABS_V[row - 1][col];
  const right  = col === COLS - 1 ? 0 : TABS_H[row][col];
  const bottom = row === ROWS - 1 ? 0 : TABS_V[row][col];
  const left   = col === 0 ? 0 : -TABS_H[row][col - 1];

  const tH = 14;  // tab stretch depth
  const tW = 9;   // tab connector neck width

  const x = col * CELL;
  const y = row * CELL;

  let p = `M ${x} ${y} `;
  
  // Top edge
  if (top === 0) p += `L ${x + CELL} ${y} `;
  else p += `L ${x + CELL/2 - tW} ${y} C ${x + CELL/2 - tW*2} ${y - top*tH*2}, ${x + CELL/2 + tW*2} ${y - top*tH*2}, ${x + CELL/2 + tW} ${y} L ${x + CELL} ${y} `;
  
  // Right edge
  if (right === 0) p += `L ${x + CELL} ${y + CELL} `;
  else p += `L ${x + CELL} ${y + CELL/2 - tW} C ${x + CELL + right*tH*2} ${y + CELL/2 - tW*2}, ${x + CELL + right*tH*2} ${y + CELL/2 + tW*2}, ${x + CELL} ${y + CELL/2 + tW} L ${x + CELL} ${y + CELL} `;
  
  // Bottom edge
  if (bottom === 0) p += `L ${x} ${y + CELL} `;
  else p += `L ${x + CELL/2 + tW} ${y + CELL} C ${x + CELL/2 + tW*2} ${y + CELL + bottom*tH*2}, ${x + CELL/2 - tW*2} ${y + CELL + bottom*tH*2}, ${x + CELL/2 - tW} ${y + CELL} L ${x} ${y + CELL} `;
  
  // Left edge
  if (left === 0) p += `Z`;
  else p += `L ${x} ${y + CELL/2 + tW} C ${x - left*tH*2} ${y + CELL/2 + tW*2}, ${x - left*tH*2} ${y + CELL/2 - tW*2}, ${x} ${y + CELL/2 - tW} Z`;
  
  return p;
}

export default function PuzzleReveal({ missionId, currentLevel, isMissionComplete, onNextLevel, onPlayAgain, onQuit }: Props) {
  const { getPuzzlePieces } = useProgressStore();
  const totalRevealed = getPuzzlePieces(missionId);
  const newPieceIndex = totalRevealed - 1;

  const PIECE_PATHS = useMemo(() => Array.from({ length: 20 }, (_, i) => getJigsawPath(i % COLS, Math.floor(i / COLS))), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(15, 15, 40, 0.95)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 20, zIndex: 50,
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 10 }}
      >
        {isMissionComplete ? (
          <>
            <div style={{ fontSize: '3rem' }}>🏆</div>
            <h2 style={{ fontFamily: 'Fredoka One', color: '#FFD700', fontSize: '2rem', margin: '4px 0' }}>Mission Complete!</h2>
            <p style={{ color: '#A0AEC0', fontFamily: 'Fredoka', fontSize: '1rem' }}>You revealed the full picture!</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem' }}>🧩</div>
            <h2 style={{ fontFamily: 'Fredoka One', color: '#FFFFFF', fontSize: '1.8rem', margin: '4px 0' }}>Level {currentLevel} Done!</h2>
            <p style={{ color: '#A0AEC0', fontFamily: 'Fredoka', fontSize: '1rem' }}>A new puzzle piece revealed!</p>
          </>
        )}
      </motion.div>

      {/* SVG Puzzle Board */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', bounce: 0.3 }}
        style={{
          width: W, height: H,
          position: 'relative',
          filter: 'drop-shadow(0 0 30px rgba(102,126,234,0.4))'
        }}
      >
        <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="puzzle-grad" x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="50%" stopColor="#f093fb" />
              <stop offset="100%" stopColor="#fda085" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Empty Board Silhouettes */}
          {PIECE_PATHS.map((d, i) => (
            <path key={`empty-${i}`} d={d} fill="rgba(30, 40, 60, 0.6)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth={1.5} />
          ))}

          {/* Filled Pieces */}
          {PIECE_PATHS.map((d, i) => {
            const revealed = i < totalRevealed;
            const isNew = i === newPieceIndex;
            if (!revealed) return null;

            return (
              <motion.path
                key={`filled-${i}`}
                d={d}
                fill="url(#puzzle-grad)"
                stroke={isNew ? "#FFD700" : "rgba(255, 255, 255, 0.4)"}
                strokeWidth={isNew ? 3 : 1.5}
                initial={isNew ? { scale: 1.6, opacity: 0, x: 40, y: -40 } : false}
                animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 1.2, delay: isNew ? 0.6 : 0 }}
                style={{
                  transformOrigin: `${(i % COLS) * CELL + CELL/2}px ${Math.floor(i / COLS) * CELL + CELL/2}px`,
                  filter: isNew ? 'drop-shadow(0px 8px 16px rgba(255,215,0,0.6))' : 'none'
                }}
              />
            );
          })}
        </svg>
      </motion.div>

      <p style={{ color: '#718096', fontFamily: 'Fredoka', fontSize: '0.95rem', marginTop: '10px' }}>
        {totalRevealed} / 20 pieces revealed
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, marginTop: 10 }}>
        {isMissionComplete ? (
          <>
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onPlayAgain} style={{ fontSize: '1.1rem', padding: '14px' }}>
              🔄 Play Again
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn" onClick={onQuit} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}>
              Back to Map
            </motion.button>
          </>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onNextLevel} style={{ fontSize: '1.1rem', padding: '14px' }}>
              Next Level →
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn" onClick={onQuit} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}>
              Back to Map
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}
