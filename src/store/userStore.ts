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

export interface SavedBuilding {
  key: string;
  col: number;
  row: number;
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

async function loadProgressFromSupabase(userId: string) {
  try {
    const { data } = await supabase
      .from('perfiles_usuarios')
      .select('monedas, progreso_juegos, city_grid')
      .eq('id', userId)
      .single();
    if (!data) return;
    const progress = (data.progreso_juegos ?? {}) as Record<string, unknown>;
    useProgressStore.setState({
      cityCoins:    data.monedas ?? 0,
      cityPoints:   (progress.cityPoints  as number) ?? 0,
      highScores:   (progress.highScores  as Record<number,number>) ?? {},
      highestLevel: (progress.highestLevel as Record<number,number>) ?? {},
      puzzlePieces: (progress.puzzlePieces as Record<number,number>) ?? {},
      cityGrid:     (data.city_grid ?? []) as SavedBuilding[],
    });
  } catch (e) {
    console.error('[loadProgress]', e);
  }
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  profile: null,
  loading: true,
  authError: null,

  initialize: async () => {
    try {
      set({ loading: true });
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('perfiles_usuarios')
          .select('id, username, pais_residencia, avatar_url, monedas')
          .eq('id', session.user.id)
          .single();
        set({ user: session.user, profile: profile ?? null, loading: false });
        await loadProgressFromSupabase(session.user.id);
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (e) {
      console.error('[initialize]', e);
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
    });
  },

  signIn: async (username, password) => {
    set({ authError: null, loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) {
        console.error('[signIn]', error);
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('email'))
          set({ authError: 'Wrong username or password.', loading: false });
        else
          set({ authError: `Login error: ${error.message}`, loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from('perfiles_usuarios')
        .select('id, username, pais_residencia, avatar_url, monedas')
        .eq('id', data.user.id)
        .single();
      await supabase.from('perfiles_usuarios')
        .update({ last_active: new Date().toISOString() })
        .eq('id', data.user.id);
      set({ user: data.user, profile: profile ?? null, loading: false });
      await loadProgressFromSupabase(data.user.id);
    } catch (e) {
      console.error('[signIn unexpected]', e);
      set({ authError: `Unexpected error. Check your connection.`, loading: false });
    }
  },

  signUp: async (username, password, country) => {
    set({ authError: null, loading: true });
    try {
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        console.error('[signUp]', error);
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists'))
          set({ authError: 'That username is already taken.', loading: false });
        else
          set({ authError: `Sign-up error: ${error.message}`, loading: false });
        return;
      }
      if (!data.user) {
        set({ authError: 'Could not create account. Try again.', loading: false });
        return;
      }
      if (!data.session) {
        set({ authError: 'Email confirmation is ON in Supabase — disable it in Auth → Settings.', loading: false });
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
        console.error('[signUp profile]', profileError);
        set({ authError: `Profile error: ${profileError.message}`, loading: false });
        return;
      }
      set({
        user: data.user,
        profile: { id: data.user.id, username: username.trim(), pais_residencia: country.trim(), avatar_url: null, monedas: 0 },
        loading: false,
      });
    } catch (e) {
      console.error('[signUp unexpected]', e);
      set({ authError: `Unexpected error. Check your connection.`, loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    useProgressStore.getState().resetProgress();
    set({ user: null, profile: null });
  },

  clearError: () => set({ authError: null }),
}));
