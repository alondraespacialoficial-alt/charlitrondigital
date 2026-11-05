import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = typeof __ALIADOS_SUPABASE_URL__ === 'string' ? __ALIADOS_SUPABASE_URL__ : '';
const anonKey = typeof __ALIADOS_SUPABASE_ANON_KEY__ === 'string' ? __ALIADOS_SUPABASE_ANON_KEY__ : '';

export const isAliadosAuthConfigured = Boolean(url && anonKey);

// Cliente independiente del Supabase editorial: otro proyecto, otra clave y otra sesion en el navegador.
export const aliadosSupabase: SupabaseClient | null = isAliadosAuthConfigured
  ? createClient(url, anonKey, {
      auth: {
        storageKey: 'charlitron-aliados-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
