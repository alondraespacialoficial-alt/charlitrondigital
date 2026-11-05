import { useCallback, useEffect, useMemo, useState } from 'react';
import { aliadosSupabase } from './aliadosSupabase';
import { AliadosRepository, type Commission, type Referral } from './aliadosRepository';
import { errorText } from './aliadosLabels';

export function useAliadosRepository(): AliadosRepository | null {
  return useMemo(() => (aliadosSupabase ? new AliadosRepository(aliadosSupabase) : null), []);
}

export interface AllyData {
  loading: boolean;
  error: string | null;
  referrals: Referral[];
  commissions: Commission[];
  reload: () => Promise<void>;
}

// Datos del aliado: solo las vistas ally_my_* (sin ventas, cobros ni notas internas).
export function useAllyData(repo: AliadosRepository | null): AllyData {
  const [state, setState] = useState<{ loading: boolean; error: string | null; referrals: Referral[]; commissions: Commission[] }>({
    loading: true,
    error: null,
    referrals: [],
    commissions: [],
  });

  const reload = useCallback(async () => {
    if (!repo) {
      setState((prev) => ({ ...prev, loading: false, error: 'El portal no está configurado.' }));
      return;
    }
    try {
      const [referrals, commissions] = await Promise.all([repo.listMyReferrals(), repo.listMyCommissions()]);
      setState({ loading: false, error: null, referrals, commissions });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: errorText(err, 'No se pudieron cargar tus datos.') }));
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
