import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { SavedBuilding } from './userStore';

interface GameState {
  cityPoints: number;
  cityCoins: number;
  highScores: Record<number, number>;
  highestLevel: Record<number, number>;   // missionId → highest completed level
  puzzlePieces: Record<number, number>;   // missionId → pieces revealed (0-20)
  cityGrid: SavedBuilding[];              // CityBuilder placed buildings

  addCityPoints: (points: number) => void;
  addCityCoins: (coins: number) => void;
  updateHighScore: (missionId: number, score: number) => void;
  completeLevel: (missionId: number, level: number) => void;
  setHighestLevel: (missionId: number, level: number) => void;
  getHighestLevel: (missionId: number) => number;
  getPuzzlePieces: (missionId: number) => number;
  getRankInfo: () => { rank: string; nextRank: string; progress: number; currentCP: number; nextCP: number };
  setCityGrid: (grid: SavedBuilding[]) => void;
  resetProgress: () => void;
}

const RANKS = [
  { name: '🌱 Newbie', cp: 0 },
  { name: '🏃 Explorer', cp: 100 },
  { name: '⭐ Helper', cp: 300 },
  { name: '🛡️ Guardian', cp: 600 },
  { name: '🦸 Hero', cp: 1000 },
  { name: '👑 Master CityHero', cp: 2000 }
];

// Debounced Supabase sync — waits 1.5 s after last change before writing
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToSupabase, 1500);
}

async function syncToSupabase() {
  // Avoid circular import: import userStore lazily
  const { useUserStore } = await import('./userStore');
  const userId = useUserStore.getState().user?.id;
  if (!userId) return;

  const { cityCoins, cityPoints, highScores, highestLevel, puzzlePieces, cityGrid } =
    useProgressStore.getState();

  await supabase.from('perfiles_usuarios').update({
    monedas: cityCoins,
    progreso_juegos: { cityPoints, highScores, highestLevel, puzzlePieces },
    city_grid: cityGrid,
  }).eq('id', userId);
}

export const useProgressStore = create<GameState>()(
  persist(
    (set, get) => ({
      cityPoints: 0,
      cityCoins: 0,
      highScores: {},
      highestLevel: {},
      puzzlePieces: {},
      cityGrid: [],

      addCityPoints: (points) => {
        set((s) => ({ cityPoints: s.cityPoints + points }));
        scheduleSync();
      },

      addCityCoins: (coins) => {
        set((s) => ({ cityCoins: s.cityCoins + coins }));
        scheduleSync();
      },

      updateHighScore: (missionId, score) => {
        set((s) => {
          const cur = s.highScores[missionId] || 0;
          return score > cur ? { highScores: { ...s.highScores, [missionId]: score } } : s;
        });
        scheduleSync();
      },

      completeLevel: (missionId, level) => {
        set((s) => {
          const prevHighest = s.highestLevel[missionId] || 0;
          const newHighest = Math.max(prevHighest, level);
          const newPieces = Math.min(20, newHighest);
          const earnedCP = prevHighest < level ? 20 : 0;
          return {
            highestLevel: { ...s.highestLevel, [missionId]: newHighest },
            puzzlePieces: { ...s.puzzlePieces, [missionId]: newPieces },
            cityPoints: s.cityPoints + earnedCP,
          };
        });
        scheduleSync();
      },

      setHighestLevel: (missionId, level) => {
        set((s) => ({
          highestLevel: { ...s.highestLevel, [missionId]: level },
          puzzlePieces: { ...s.puzzlePieces, [missionId]: Math.min(20, level) },
        }));
        scheduleSync();
      },

      setCityGrid: (grid) => {
        set({ cityGrid: grid });
        scheduleSync();
      },

      getHighestLevel: (missionId) => get().highestLevel[missionId] || 0,
      getPuzzlePieces: (missionId) => get().puzzlePieces[missionId] || 0,

      resetProgress: () => set({
        cityPoints: 0, cityCoins: 0, highScores: {}, highestLevel: {},
        puzzlePieces: {}, cityGrid: [],
      }),

      getRankInfo: () => {
        const cp = get().cityPoints;
        let idx = 0;
        for (let i = 0; i < RANKS.length; i++) {
          if (cp >= RANKS[i].cp) idx = i;
          else break;
        }
        const cur = RANKS[idx];
        const isMax = idx === RANKS.length - 1;
        const next = isMax ? cur : RANKS[idx + 1];
        const progress = isMax ? 100 : ((cp - cur.cp) / (next.cp - cur.cp)) * 100;
        return {
          rank: cur.name,
          nextRank: isMax ? 'Max Rank' : next.name,
          progress: Math.min(100, Math.max(0, progress)),
          currentCP: cp,
          nextCP: next.cp,
        };
      },
    }),
    { name: 'cityhero-progress-v3' }
  )
);
