import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SectionHeader, StateBlock } from './ui';

type TopPage = { path: string; views: number };

export const MetricsAdmin: React.FC = () => {
  const [total, setTotal] = useState(0);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: queryError } = await supabase
      .from('page_views')
      .select('path')
      .gte('created_at', since)
      .limit(5000);
    if (queryError) {
      setError(true);
    } else {
      const rows = (data ?? []) as Array<{ path: string }>;
      const counts = new Map<string, number>();
      for (const row of rows) counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
      setTotal(rows.length);
      setTopPages(
        [...counts.entries()]
          .map(([path, views]) => ({ path, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 15),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="max-w-2xl">
      <SectionHeader title="Métricas" description="Vistas de los últimos 30 días, sin cookies ni datos personales." />

      {loading && <StateBlock kind="loading" message="Cargando métricas…" />}
      {!loading && error && <StateBlock kind="error" message="No se pudieron cargar las métricas." onRetry={load} />}
      {!loading && !error && total === 0 && (
        <StateBlock
          kind="empty"
          message="Sin datos. La recolección desde el navegador está desactivada por seguridad; se habilitará con un endpoint con rate-limit o Vercel Analytics."
        />
      )}

      {!loading && !error && total > 0 && (
        <>
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-mono text-4xl font-semibold text-white">{total}</p>
            <p className="mt-1 text-sm text-zinc-500">Vistas totales</p>
          </div>
          <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
            {topPages.map((page) => (
              <li key={page.path} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-zinc-300">{page.path}</span>
                <span className="font-medium text-white">{page.views}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
