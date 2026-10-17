import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { ArticleRow, CategoryRow } from '../../lib/database.types';
import { ArticleEditor } from './ArticleEditor';
import { logAdminAction } from './audit';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  review: 'Revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-200',
  review: 'bg-sky-500/20 text-sky-300',
  published: 'bg-emerald-500/20 text-emerald-300',
  archived: 'bg-zinc-800 text-zinc-500',
};

type ListRow = Pick<
  ArticleRow,
  'id' | 'title' | 'slug' | 'status' | 'published_at' | 'updated_at' | 'category_id'
> & { categories?: Pick<CategoryRow, 'name'> | null };

export const ArticlesAdmin: React.FC<{ user: User }> = ({ user }) => {
  const [articles, setArticles] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, status, published_at, updated_at, category_id, categories(name)')
      .order('updated_at', { ascending: false });
    if (!error) setArticles((data ?? []) as unknown as ListRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (article: ListRow) => {
    if (!window.confirm(`¿Eliminar "${article.title}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('articles').delete().eq('id', article.id);
    if (error) {
      window.alert(`Error al eliminar: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'article.delete', 'article', article.id, { title: article.title });
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

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Artículos</h2>
        <button
          onClick={() => setEditingId('new')}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo artículo
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : articles.length === 0 ? (
        <p className="text-zinc-500">Sin artículos todavía. Crea el primero.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Categoría</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Actualizado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{article.title}</span>
                    <span className="block text-xs text-zinc-500">/blog/{article.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[article.status]}`}
                    >
                      {STATUS_LABELS[article.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-400">
                    {article.categories?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-500">
                    {new Date(article.updated_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {article.status === 'published' && (
                        <a
                          href={`/blog/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                          title="Ver público"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setEditingId(article.id)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(article)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
