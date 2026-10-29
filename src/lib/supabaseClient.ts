import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Solo se usa la ANON/PUBLISHABLE key en frontend. NUNCA la service role key.
// La seguridad real vive en las políticas RLS de la base de datos.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const blockedFetch: typeof fetch = async () => {
  throw new Error('Supabase requests are disabled because credentials are unavailable.');
};

if (!isSupabaseConfigured) {
  // Aviso en desarrollo; la landing debe seguir funcionando sin Supabase.
  console.warn(
    '[charlitron] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no configuradas. ' +
      'El blog y el admin estarán deshabilitados.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: isSupabaseConfigured ? fetch : blockedFetch,
    },
  },
);
