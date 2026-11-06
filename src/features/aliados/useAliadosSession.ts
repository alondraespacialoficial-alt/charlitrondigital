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
  // Vuelve a consultar el rol y la aceptacion en la base (p. ej. tras registrar la aceptacion).
  refresh: () => Promise<void>;
}

export function useAliadosSession(): AliadosSession {
  const [state, setState] = useState<AliadosSessionState>(
    isAliadosAuthConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  );
  const requestId = useRef(0);
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);

  const resolve = useCallback(async (userId: string | null) => {
    const client = aliadosSupabase;
    if (!client) return;
    userIdRef.current = userId;
    const current = ++requestId.current;
    if (!userId) {
      if (mountedRef.current) setState({ status: 'anonymous' });
      return;
    }
    try {
      const role = await resolveAliadosRole(client as unknown as RoleQueryClient, userId);
      if (mountedRef.current && current === requestId.current) setState({ status: 'ready', role });
    } catch {
      if (mountedRef.current && current === requestId.current) {
        setState({ status: 'error', message: 'No se pudo verificar tu acceso. Intenta de nuevo.' });
      }
    }
  }, []);

  useEffect(() => {
    const client = aliadosSupabase;
    if (!client) return;
    mountedRef.current = true;

    // setTimeout evita consultar dentro del callback de auth (bloqueo interno de supabase-js).
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      setTimeout(() => void resolve(userId), 0);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [resolve]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!aliadosSupabase) return 'El acceso no está configurado en esta vista previa.';
    const { error } = await aliadosSupabase.auth.signInWithPassword({ email: email.trim(), password });
    return loginErrorMessage(error);
  }, []);

  const signOut = useCallback(async () => {
    if (!aliadosSupabase) return;
    await aliadosSupabase.auth.signOut();
    userIdRef.current = null;
    setState({ status: 'anonymous' });
  }, []);

  const refresh = useCallback(() => resolve(userIdRef.current), [resolve]);

  return { state, signIn, signOut, refresh };
}
