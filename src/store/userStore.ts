import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase, usernameToEmail } from '../lib/supabase';
import { useProgressStore } from './progressStore';

export interface UserProfile {
  id: string;
  username: string;
  pais_residencia: string;
  avatar_url: string | null;
  monedas: number;
}

interface UserState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;

  initialize: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, country: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// Load game progress from Supabase into progressStore
async function loadProgressFromSupabase(userId: string) {
  const { data } = await supabase
    .from('perfiles_usuarios')
    .select('monedas, progreso_juegos, city_grid')
    .eq('id', userId)
    .single();
  if (!data) return;

  const progress = (data.progreso_juegos ?? {}) as Record<string, unknown>;
  useProgressStore.setState({
    cityCoins:    data.monedas ?? 0,
    cityPoints:   (progress.cityPoints as number)    ?? 0,
    highScores:   (progress.highScores as Record<number,number>) ?? {},
    highestLevel: (progress.highestLevel as Record<number,number>) ?? {},
    puzzlePieces: (progress.puzzlePieces as Record<number,number>) ?? {},
    cityGrid:     (data.city_grid ?? []) as SavedBuilding[],
  });
}

export interface SavedBuilding {
  key: string;
  col: number;
  row: number;
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  profile: null,
  loading: true,
  authError: null,

  initialize: async () => {
    set({ loading: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('perfiles_usuarios')
        .select('id, username, pais_residencia, avatar_url, monedas')
        .eq('id', session.user.id)
        .single();
      set({ user: session.user, profile: profile ?? null, loading: false });
      if (session.user) await loadProgressFromSupabase(session.user.id);
    } else {
      set({ user: null, profile: null, loading: false });
    }

    // Keep session in sync
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
    });
  },

  signIn: async (username, password) => {
    set({ authError: null, loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) {
      set({ authError: 'Usuario o contraseña incorrectos.', loading: false });
      return;
    }
    const { data: profile } = await supabase
      .from('perfiles_usuarios')
      .select('id, username, pais_residencia, avatar_url, monedas')
      .eq('id', data.user.id)
      .single();
    set({ user: data.user, profile: profile ?? null, loading: false });
    await loadProgressFromSupabase(data.user.id);
  },

  signUp: async (username, password, country) => {
    set({ authError: null, loading: true });
    const email = usernameToEmail(username);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({
        authError: error.message.includes('already registered')
          ? 'Ese usuario ya existe.'
          : error.message,
        loading: false,
      });
      return;
    }
    if (!data.user) {
      set({ authError: 'Error al crear cuenta. Intentá de nuevo.', loading: false });
      return;
    }

    const { error: profileError } = await supabase.from('perfiles_usuarios').insert({
      id: data.user.id,
      username: username.trim(),
      pais_residencia: country.trim(),
      monedas: 0,
      progreso_juegos: {},
      city_grid: [],
    });
    if (profileError) {
      set({ authError: 'Error al crear perfil. Intentá de nuevo.', loading: false });
      return;
    }

    const profile: UserProfile = {
      id: data.user.id,
      username: username.trim(),
      pais_residencia: country.trim(),
      avatar_url: null,
      monedas: 0,
    };
    set({ user: data.user, profile, loading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    useProgressStore.getState().resetProgress();
    set({ user: null, profile: null });
  },

  clearError: () => set({ authError: null }),
}));
