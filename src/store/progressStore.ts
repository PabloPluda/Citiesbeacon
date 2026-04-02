import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  cityPoints: number;
  highScores: Record<number, number>; // missionId -> score
  addCityPoints: (points: number) => void;
  updateHighScore: (missionId: number, score: number) => void;
  getRankInfo: () => { rank: string; nextRank: string; progress: number; currentCP: number; nextCP: number };
}

const RANKS = [
  { name: '🌱 Newbie', cp: 0 },
  { name: '🏃 Explorer', cp: 100 },
  { name: '⭐ Helper', cp: 300 },
  { name: '🛡️ Guardian', cp: 600 },
  { name: '🦸 Hero', cp: 1000 },
  { name: '👑 Master CityHero', cp: 2000 }
];

export const useProgressStore = create<GameState>()(
  persist(
    (set, get) => ({
      cityPoints: 0,
      highScores: {},
      addCityPoints: (points) => set((state) => ({ cityPoints: state.cityPoints + points })),
      updateHighScore: (missionId, score) => set((state) => {
        const currentHigh = state.highScores[missionId] || 0;
        if (score > currentHigh) {
          return { highScores: { ...state.highScores, [missionId]: score } };
        }
        return state;
      }),
      getRankInfo: () => {
        const cp = get().cityPoints;
        let currentRankIdx = 0;
        
        for (let i = 0; i < RANKS.length; i++) {
          if (cp >= RANKS[i].cp) {
            currentRankIdx = i;
          } else {
            break;
          }
        }
        
        const currentRank = RANKS[currentRankIdx];
        const isMaxRank = currentRankIdx === RANKS.length - 1;
        const nextRank = isMaxRank ? currentRank : RANKS[currentRankIdx + 1];
        
        const progress = isMaxRank 
          ? 100 
          : ((cp - currentRank.cp) / (nextRank.cp - currentRank.cp)) * 100;
          
        return {
          rank: currentRank.name,
          nextRank: isMaxRank ? 'Max Rank' : nextRank.name,
          progress: Math.min(100, Math.max(0, progress)),
          currentCP: cp,
          nextCP: nextRank.cp
        };
      }
    }),
    {
      name: 'cityhero-progress'
    }
  )
);
