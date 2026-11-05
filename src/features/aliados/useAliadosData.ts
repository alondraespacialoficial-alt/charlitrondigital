/**
 * Hooks for Aliados data loading and management
 * Integrates with AliadosRepository for real database operations
 */

import { useCallback, useEffect, useState } from 'react';
import { aliadosSupabase } from './aliadosSupabase';
import { AliadosRepository, type AllyProfile, type Referral, type Sale, type Commission } from './aliadosRepository';

export interface AliadosDataState {
  loading: boolean;
  error: string | null;
  allies: AllyProfile[];
  referrals: Referral[];
  sales: Sale[];
  commissions: Commission[];
}

export function useAliadosData() {
  const [state, setState] = useState<AliadosDataState>({
    loading: true,
    error: null,
    allies: [],
    referrals: [],
    sales: [],
    commissions: [],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!aliadosSupabase) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const repo = new AliadosRepository(aliadosSupabase);
        const user = (await aliadosSupabase.auth.getUser()).data.user;

        if (!user) {
          setState((prev) => ({ ...prev, loading: false, error: 'No authenticated' }));
          return;
        }

        // Load ally profile
        let allies: AllyProfile[] = [];
        try {
          allies = await repo.listAllies();
        } catch (err) {
          console.warn('Could not load allies:', err);
        }

        // Load referrals for this ally
        let referrals: Referral[] = [];
        try {
          referrals = await repo.listReferralsByAlly(user.id);
        } catch (err) {
          console.warn('Could not load referrals:', err);
        }

        // Load sales for this ally
        let sales: Sale[] = [];
        try {
          sales = await repo.listSalesByAlly(user.id);
        } catch (err) {
          console.warn('Could not load sales:', err);
        }

        // Load commissions for this ally
        let commissions: Commission[] = [];
        try {
          commissions = await repo.listCommissionsByAlly(user.id);
        } catch (err) {
          console.warn('Could not load commissions:', err);
        }

        setState({
          loading: false,
          error: null,
          allies,
          referrals,
          sales,
          commissions,
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Error loading data',
        }));
      }
    };

    loadData();
  }, []);

  return state;
}

export function useAliadosRepository() {
  return aliadosSupabase ? new AliadosRepository(aliadosSupabase) : null;
}
