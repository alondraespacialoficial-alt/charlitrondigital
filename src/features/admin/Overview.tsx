import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { ArticleStatus } from '../../lib/database.types';
import { formatDateTime, SectionHeader, StateBlock } from './ui';

type Counts = {
  draft: number;
  review: number;
  published: number;
  archived: number;
  pendingIdeas: number;
};

type ActivityRow = {
  id: number;
  user_email: string | null;
  action: string;
  entity: string;
  created_at: string;
};

const CARDS: Array<{ key: keyof Counts; label: string; hint: string; target: 'articles' | 'ideas' }> = [
  { key: 'draft', label: 'Borradores', hint: 'En redacción', target: 'articles' },
  { key: 'review', label: 'En revisión', hint: 'Listos para aprobar', target: 'articles' },
  { key: 'published', label: 'Publicados', hint: 'Visibles en /blog', target: 'articles' },
  { key: 'archived', label: 'Archivados', hint: 'Fuera del sitio', target: 'articles' },
  { key: 'pendingIdeas', label: 'Ideas pendientes', hint: 'Nuevas o planeadas', target: 'ideas' },
];

const countArticles = (status: ArticleStatus) =>
  supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', status);

export const Overview: React.FC<{
  onNavigate: (section: 'articles' | 'ideas') => void;
}> = ({ onNavigate }) => {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const [draft, review, published, archived, ideas, log] = await Promise.all([
      countArticles('draft'),
      countArticles('review'),
      countArticles('published'),
      countArticles('archived'),
      supabase
        .from('content_ideas')
        .select('id', { count: 'exact', head: true })
        .in('status', ['new', 'planned']),
      supabase
        .from('admin_audit_log')
        .select('id, user_email, action, entity, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if (draft.error || review.error || published.error || archived.error || ideas.error || log.error) {
      setError(true);
    } else {
      setCounts({
        draft: draft.count ?? 0,
        review: review.count ?? 0,
        published: published.count ?? 0,
        archived: archived.count ?? 0,
        pendingIdeas: ideas.count ?? 0,
      });
      setActivity((log.data ?? []) as ActivityRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <SectionHeader title="Resumen" description="Estado editorial y actividad reciente." />

      {loading && <StateBlock kind="loading" message="Cargando resumen…" />}
      {!loading && error && (
        <StateBlock kind="error" message="No se pudo cargar el resumen." onRetry={load} />
      )}

      {!loading && !error && counts && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {CARDS.map((card) => (
              <button
                key={card.key}
                onClick={() => onNavigate(card.target)}
                className="group rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left transition-colors hover:border-amber-400/40"
              >
                <p className="font-mono text-3xl font-semibold text-white">{counts[card.key]}</p>
                <p className="mt-2 text-sm font-medium text-zinc-300 group-hover:text-amber-300">
                  {card.label}
                </p>
                <p className="text-xs text-zinc-600">{card.hint}</p>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Última actividad administrativa
            </h2>
            {activity.length === 0 ? (
              <StateBlock kind="empty" message="Aún no hay actividad registrada." />
            ) : (
              <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
                {activity.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-zinc-200">{row.action}</p>
                      <p className="truncate text-xs text-zinc-600">
                        {row.entity}
                        {row.user_email ? ` · ${row.user_email}` : ''}
                      </p>
                    </div>
                    <time className="text-xs text-zinc-500" dateTime={row.created_at}>
                      {formatDateTime(row.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};
