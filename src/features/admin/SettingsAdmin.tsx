import React, { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { SITE_URL } from '../../lib/site';
import { SectionHeader, StateBlock } from './ui';

type Flag = { key: string; enabled: boolean; description: string | null };

// Solo lectura: las automatizaciones (incl. auto_publish) no se activan desde la UI.
export const SettingsAdmin: React.FC<{ user: User; onSignOut: () => void }> = ({ user, onSignOut }) => {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: queryError } = await supabase
      .from('feature_flags')
      .select('key, enabled, description')
      .order('key');
    if (queryError) setError(true);
    else setFlags((data ?? []) as Flag[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="max-w-2xl">
      <SectionHeader title="Configuración" description="Cuenta, sitio y automatizaciones (solo lectura)." />

      <div className="mb-8 divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
          <span className="text-zinc-500">Cuenta</span>
          <span className="truncate text-zinc-200">{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
          <span className="text-zinc-500">Rol</span>
          <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            Administrador
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
          <span className="text-zinc-500">Sitio</span>
          <span className="truncate font-mono text-xs text-zinc-300">{SITE_URL}</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
          <span className="text-zinc-500">Sesión</span>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </div>

      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        Automatizaciones (feature flags)
      </h2>
      {loading && <StateBlock kind="loading" message="Cargando…" />}
      {!loading && error && <StateBlock kind="error" message="No se pudieron cargar los flags." onRetry={load} />}
      {!loading && !error && flags.length === 0 && <StateBlock kind="empty" message="Sin flags definidos." />}
      {!loading && !error && flags.length > 0 && (
        <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
          {flags.map((flag) => (
            <li key={flag.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="font-mono text-sm text-zinc-200">{flag.key}</p>
                {flag.description && <p className="mt-0.5 text-xs text-zinc-600">{flag.description}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  flag.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {flag.enabled ? 'Activo' : 'Apagado'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
