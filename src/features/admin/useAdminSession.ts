// Hook de sesión del admin: Supabase Auth + verificación de rol vía admin_users.
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

export interface AdminSession {
  user: User;
  isAdmin: boolean;
}

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolve = async (user: User | null) => {
      if (!mounted) return;
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }
      // Verifica rol admin (RLS: solo puede leer su propia fila).
      const { data } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      setSession({ user, isAdmin: Boolean(data) });
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => resolve(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      resolve(authSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
