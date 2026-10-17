import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { ContentIdeaRow, IdeaStatus } from '../../lib/database.types';
import { logAdminAction } from './audit';
import { ActionError, inputClass, primaryButton, SectionHeader, StateBlock } from './ui';

const IDEA_STATUS: Record<IdeaStatus, string> = {
  new: 'Nueva',
  planned: 'Planeada',
  converted: 'Convertida',
  discarded: 'Descartada',
};

export const IdeasAdmin: React.FC<{ user: User }> = ({ user }) => {
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('content_ideas')
      .select('id, title, notes, status, converted_article_id, created_by, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) setLoadError(true);
    else setIdeas((data ?? []) as ContentIdeaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase
      .from('content_ideas')
      .insert({ title: title.trim(), notes: notes.trim() || null, created_by: user.id });
    if (error) {
      setActionError(`No se pudo guardar la idea: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'idea.create', 'idea', null, { title });
    setTitle('');
    setNotes('');
    void load();
  };

  const handleStatusChange = async (idea: ContentIdeaRow, status: IdeaStatus) => {
    const { error } = await supabase.from('content_ideas').update({ status }).eq('id', idea.id);
    if (error) {
      setActionError(`No se pudo actualizar: ${error.message}`);
      return;
    }
    await logAdminAction(user, `idea.status.${status}`, 'idea', idea.id, { title: idea.title });
    void load();
  };

  const handleDelete = async (idea: ContentIdeaRow) => {
    if (!window.confirm(`¿Eliminar la idea "${idea.title}"?`)) return;
    const { error } = await supabase.from('content_ideas').delete().eq('id', idea.id);
    if (error) {
      setActionError(`No se pudo eliminar: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'idea.delete', 'idea', idea.id, { title: idea.title });
    void load();
  };

  return (
    <section className="max-w-3xl">
      <SectionHeader title="Ideas" description="Captura temas antes de convertirlos en borradores." />

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <input
          type="text"
          required
          placeholder="Título o tema de la idea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <textarea
          placeholder="Notas, ángulo, palabra clave objetivo… (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
        <button type="submit" className={primaryButton}>
          <Plus className="h-4 w-4" /> Guardar idea
        </button>
      </form>

      {loading && <StateBlock kind="loading" message="Cargando ideas…" />}
      {!loading && loadError && (
        <StateBlock kind="error" message="No se pudieron cargar las ideas." onRetry={load} />
      )}
      {!loading && !loadError && ideas.length === 0 && (
        <StateBlock kind="empty" message="Sin ideas todavía. Captura la primera." />
      )}

      {!loading && !loadError && ideas.length > 0 && (
        <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="font-medium text-white">{idea.title}</p>
                {idea.notes && <p className="mt-1 text-sm text-zinc-500">{idea.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={idea.status}
                  onChange={(e) => handleStatusChange(idea, e.target.value as IdeaStatus)}
                  aria-label="Estado de la idea"
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 focus:border-amber-400/70 focus:outline-none"
                >
                  {(Object.keys(IDEA_STATUS) as IdeaStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {IDEA_STATUS[status]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(idea)}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-900 hover:text-red-400"
                  title="Eliminar"
                  aria-label="Eliminar idea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
