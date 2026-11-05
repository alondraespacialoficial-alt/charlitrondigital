import { useCallback, useEffect, useRef, useState } from 'react';
import { aliadosSupabase, isAliadosAuthConfigured } from './aliadosSupabase';
import { loginErrorMessage, resolveAliadosRole, type AliadosRole, type RoleQueryClient } from './aliadosRole';

export type AliadosSessionState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'ready'; role: AliadosRole }
  | { status: 'error'; message: string };

export interface AliadosSession {
  state: AliadosSessionState;
  signIn: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
}

export function useAliadosSession(): AliadosSession {
  const [state, setState] = useState<AliadosSessionState>(
    isAliadosAuthConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  );
  const requestId = useRef(0);

  useEffect(() => {
    const client = aliadosSupabase;
    if (!client) return;
    let mounted = true;

    const resolve = async (userId: string | null) => {
      const current = ++requestId.current;
      if (!userId) {
        if (mounted) setState({ status: 'anonymous' });
        return;
      }
      try {
        const role = await resolveAliadosRole(client as unknown as RoleQueryClient, userId);
        if (mounted && current === requestId.current) setState({ status: 'ready', role });
      } catch {
        if (mounted && current === requestId.current) {
          setState({ status: 'error', message: 'No se pudo verificar tu acceso. Intenta de nuevo.' });
        }
      }
    };

    // setTimeout evita consultar dentro del callback de auth (bloqueo interno de supabase-js).
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      setTimeout(() => void resolve(userId), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!aliadosSupabase) return 'El acceso no está configurado en esta vista previa.';
    const { error } = await aliadosSupabase.auth.signInWithPassword({ email: email.trim(), password });
    return loginErrorMessage(error);
  }, []);

  const signOut = useCallback(async () => {
    if (!aliadosSupabase) return;
    await aliadosSupabase.auth.signOut();
    setState({ status: 'anonymous' });
  }, []);

  return { state, signIn, signOut };
}
