import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ielaccsufrrafhcssqpu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ujF_WvkXfx_4sbW_gN8dWg_UWroCm3K';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Convert a display username to the internal email used for Supabase Auth
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@cityheroacademy.app`;
}
