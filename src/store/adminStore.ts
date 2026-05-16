import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATS } from '../game/cityBuilderData';
import type { BuildItem } from '../game/cityBuilderData';

export type AdminBuildCat = { label: string; emoji: string; items: BuildItem[] };

export const DEFAULT_MISSION_CONFIG = [
  { id: 1, title: 'Keeping the city clean',         icon: '🗑️' },
  { id: 2, title: 'Crossing the right way',          icon: '🚶' },
  { id: 3, title: 'Responsible use of electricity',  icon: '💡' },
  { id: 4, title: 'Water saver',                     icon: '💧' },
  { id: 5, title: 'Not my dog, still my job',        icon: '🐕' },
  { id: 6, title: 'Biking my city',                  icon: '🚲' },
  { id: 8, title: 'Recycling challenge',             icon: '♻️' },
  { id: 7, title: 'City Builder',                    icon: '🏙️' },
];

interface AdminState {
  // null means "use code defaults"; set once user makes any change
  missionOverrides: Record<number, { title?: string; icon?: string }>;
  builderCats: AdminBuildCat[] | null;

  setMissionOverride: (id: number, patch: { title?: string; icon?: string }) => void;
  setBuilderCats: (cats: AdminBuildCat[]) => void;
  resetAll: () => void;

  getEffectiveCats: () => AdminBuildCat[];
  getEffectiveMission: (id: number) => { title: string; icon: string };
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      missionOverrides: {},
      builderCats: null,

      setMissionOverride: (id, patch) =>
        set(s => ({
          missionOverrides: {
            ...s.missionOverrides,
            [id]: { ...s.missionOverrides[id], ...patch },
          },
        })),

      setBuilderCats: (cats) => set({ builderCats: cats }),

      resetAll: () => set({ missionOverrides: {}, builderCats: null }),

      getEffectiveCats: () => {
        const { builderCats } = get();
        return builderCats ?? (CATS as AdminBuildCat[]);
      },

      getEffectiveMission: (id) => {
        const def = DEFAULT_MISSION_CONFIG.find(m => m.id === id)!;
        const ov  = get().missionOverrides[id] ?? {};
        return { title: ov.title ?? def.title, icon: ov.icon ?? def.icon };
      },
    }),
    { name: 'cityhero-admin-v1' }
  )
);
