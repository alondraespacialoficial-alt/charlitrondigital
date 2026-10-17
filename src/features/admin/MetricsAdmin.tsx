import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface TopPage {
  path: string;
  views: number;
}

// Métricas mínimas: conteos sobre page_views (solo admin vía RLS).
export const MetricsAdmin: React.FC = () => {
  const [total, setTotal] = useState(0);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('page_views')
        .select('path')
        .gte('created_at', since)
        .limit(5000);
      if (!error && data) {
        setTotal(data.length);
        const counts = new Map<string, number>();
        for (const row of data as Array<{ path: string }>) {
          counts.set(row.path, (counts.get(row.path) ?? 0) + 1);
        }
        const sorted = [...counts.entries()]
          .map(([path, views]) => ({ path, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 15);
        setTopPages(sorted);
      }
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-bold mb-2">Métricas (últimos 30 días)</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Medición mínima sin cookies ni datos personales. La recolección desde el
        navegador está desactivada por seguridad (sin inserts anónimos); se
        habilitará con un endpoint con rate-limit o Vercel Analytics.
      </p>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 mb-6">
            <p className="text-4xl font-extrabold text-white">{total}</p>
            <p className="text-sm text-zinc-500 mt-1">Vistas totales</p>
          </div>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-zinc-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Ruta</th>
                  <th className="px-4 py-3 font-medium text-right">Vistas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {topPages.map((page) => (
                  <tr key={page.path}>
                    <td className="px-4 py-3 text-zinc-300">{page.path}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{page.views}</td>
                  </tr>
                ))}
                {topPages.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-zinc-500">
                      Sin datos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
