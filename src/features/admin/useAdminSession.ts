// Sesión del admin: Supabase Auth + verificación de rol vía admin_users (RLS: solo su propia fila).
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

export type AdminState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'admin'; user: User }
  | { status: 'denied'; user: User }
  | { status: 'error'; user: User; message: string };

export function useAdminSession(): AdminState {
  const [state, setState] = useState<AdminState>({ status: 'loading' });
  const requestId = useRef(0);

  useEffect(() => {
    let mounted = true;

    const resolve = async (user: User | null) => {
      const current = ++requestId.current;
      if (!user) {
        if (mounted) setState({ status: 'anonymous' });
        return;
      }
      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted || current !== requestId.current) return;
      if (error) {
        setState({ status: 'error', user, message: 'No se pudo verificar tu acceso. Intenta de nuevo.' });
        return;
      }
      setState(data ? { status: 'admin', user } : { status: 'denied', user });
    };

    // setTimeout evita consultar Supabase dentro del callback de auth (riesgo de bloqueo interno).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      const user = authSession?.user ?? null;
      setTimeout(() => void resolve(user), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
