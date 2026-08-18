import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isOnlineAndSupabaseReady = (): boolean => {
  return Boolean(isSupabaseConfigured && supabase && (typeof navigator === 'undefined' || navigator.onLine));
};

export const getSupabaseSession = async () => {
  if (isOnlineAndSupabaseReady() && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session || null;
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const getSupabaseUser = async () => {
  const session = await getSupabaseSession();
  return session?.user || null;
};
