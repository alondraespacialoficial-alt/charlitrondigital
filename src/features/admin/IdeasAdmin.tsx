import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { ContentIdeaRow, IdeaStatus } from '../../lib/database.types';
import { logAdminAction } from './audit';

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

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_ideas')
      .select('id, title, notes, status, converted_article_id, created_by, created_at, updated_at')
      .order('created_at', { ascending: false });
    setIdeas((data ?? []) as ContentIdeaRow[]);
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
      window.alert(`Error: ${error.message}`);
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
      window.alert(`Error: ${error.message}`);
      return;
    }
    await logAdminAction(user, `idea.status.${status}`, 'idea', idea.id, { title: idea.title });
    void load();
  };

  const handleDelete = async (idea: ContentIdeaRow) => {
    if (!window.confirm(`¿Eliminar la idea "${idea.title}"?`)) return;
    const { error } = await supabase.from('content_ideas').delete().eq('id', idea.id);
    if (error) {
      window.alert(`Error: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'idea.delete', 'idea', idea.id, { title: idea.title });
    void load();
  };

  return (
    <section className="max-w-3xl">
      <h2 className="text-xl font-bold mb-6">Ideas de contenido</h2>

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-8 space-y-4"
      >
        <input
          type="text"
          required
          placeholder="Título o tema de la idea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
        />
        <textarea
          placeholder="Notas, ángulo, palabra clave objetivo… (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
        >
          <Plus className="w-4 h-4" /> Guardar idea
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-white">{idea.title}</p>
                {idea.notes && <p className="text-sm text-zinc-500 mt-1">{idea.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={idea.status}
                  onChange={(e) => handleStatusChange(idea, e.target.value as IdeaStatus)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 focus:border-amber-400 focus:outline-none"
                >
                  {(Object.keys(IDEA_STATUS) as IdeaStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {IDEA_STATUS[status]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(idea)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
          {ideas.length === 0 && (
            <li className="rounded-xl border border-zinc-800 px-5 py-6 text-zinc-500">
              Sin ideas todavía. Captura la primera.
            </li>
          )}
        </ul>
      )}
    </section>
  );
};
