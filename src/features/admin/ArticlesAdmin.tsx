import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Eye, Pencil, Plus } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { ArticleRow, ArticleStatus, CategoryRow } from '../../lib/database.types';
import { ArticleEditor } from './ArticleEditor';
import { logAdminAction } from './audit';
import { ActionError, primaryButton, SectionHeader, StateBlock } from './ui';

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Borrador',
  review: 'Revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-300',
  review: 'bg-sky-500/15 text-sky-300',
  published: 'bg-emerald-500/15 text-emerald-300',
  archived: 'bg-zinc-900 text-zinc-500',
};

type ListRow = Pick<
  ArticleRow,
  'id' | 'title' | 'slug' | 'status' | 'published_at' | 'updated_at' | 'category_id'
> & { categories?: Pick<CategoryRow, 'name'> | null };

type Filter = 'all' | ArticleStatus;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'draft', label: 'Borradores' },
  { id: 'review', label: 'Revisión' },
  { id: 'published', label: 'Publicados' },
  { id: 'archived', label: 'Archivados' },
];

export const ArticlesAdmin: React.FC<{ user: User }> = ({ user }) => {
  const [articles, setArticles] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, status, published_at, updated_at, category_id, categories(name)')
      .order('updated_at', { ascending: false });
    if (error) setLoadError(true);
    else setArticles((data ?? []) as unknown as ListRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Sin hard-delete: article_sources tiene ON DELETE CASCADE y la policy DELETE no existe.
  const handleArchive = async (article: ListRow) => {
    if (!window.confirm(`¿Archivar "${article.title}"? Dejará de mostrarse públicamente.`)) return;
    const { error } = await supabase.from('articles').update({ status: 'archived' }).eq('id', article.id);
    if (error) {
      setActionError(`No se pudo archivar: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'article.archive', 'article', article.id, { title: article.title });
    void load();
  };

  if (editingId !== null) {
    return (
      <ArticleEditor
        user={user}
        articleId={editingId === 'new' ? null : editingId}
        onClose={() => {
          setEditingId(null);
          void load();
        }}
      />
    );
  }

  const visible = filter === 'all' ? articles : articles.filter((a) => a.status === filter);

  return (
    <section>
      <SectionHeader
        title="Artículos"
        description="Borrador → revisión → publicado. Archivar reemplaza al borrado."
        action={
          <button onClick={() => setEditingId('new')} className={primaryButton}>
            <Plus className="h-4 w-4" /> Nuevo artículo
          </button>
        }
      />

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-amber-400 text-zinc-950'
                : 'border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <StateBlock kind="loading" message="Cargando artículos…" />}
      {!loading && loadError && (
        <StateBlock kind="error" message="No se pudieron cargar los artículos." onRetry={load} />
      )}
      {!loading && !loadError && visible.length === 0 && (
        <StateBlock
          kind="empty"
          message={articles.length === 0 ? 'Sin artículos todavía. Crea el primero.' : 'Ningún artículo en este estado.'}
        />
      )}

      {!loading && !loadError && visible.length > 0 && (
        <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
          {visible.map((article) => (
            <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{article.title}</p>
                <p className="truncate font-mono text-xs text-zinc-600">
                  /blog/{article.slug}
                  {article.categories?.name ? ` · ${article.categories.name}` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[article.status]}`}
              >
                {STATUS_LABELS[article.status]}
              </span>
              <span className="hidden text-xs text-zinc-600 md:inline">
                {new Date(article.updated_at).toLocaleDateString('es-MX')}
              </span>
              <div className="flex items-center">
                {article.status === 'published' && (
                  <a
                    href={`/blog/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
                    title="Ver público"
                    aria-label="Ver público"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => setEditingId(article.id)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
                  title="Editar"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {article.status !== 'archived' && (
                  <button
                    onClick={() => handleArchive(article)}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-amber-400"
                    title="Archivar"
                    aria-label="Archivar"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
