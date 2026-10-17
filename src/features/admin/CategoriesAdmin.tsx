import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { CategoryRow } from '../../lib/database.types';
import { logAdminAction } from './audit';
import { ActionError, inputClass, primaryButton, SectionHeader, StateBlock } from './ui';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const CategoriesAdmin: React.FC<{ user: User }> = ({ user }) => {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, created_at')
      .order('name');
    if (error) setLoadError(true);
    else setCategories((data ?? []) as CategoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const slug = slugify(name);
    const { error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), slug, description: description.trim() || null });
    if (error) {
      setActionError(`No se pudo crear la categoría: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'category.create', 'category', slug, { name });
    setName('');
    setDescription('');
    void load();
  };

  const handleDelete = async (category: CategoryRow) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"? Los artículos quedarán sin categoría.`))
      return;
    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    if (error) {
      setActionError(`No se pudo eliminar: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'category.delete', 'category', category.id, { name: category.name });
    void load();
  };

  return (
    <section className="max-w-2xl">
      <SectionHeader title="Categorías" description="Agrupan los artículos del blog." />

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <input
          type="text"
          required
          placeholder="Nombre de la categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
        <button type="submit" className={primaryButton}>
          <Plus className="h-4 w-4" /> Crear categoría
        </button>
      </form>

      {loading && <StateBlock kind="loading" message="Cargando categorías…" />}
      {!loading && loadError && (
        <StateBlock kind="error" message="No se pudieron cargar las categorías." onRetry={load} />
      )}
      {!loading && !loadError && categories.length === 0 && (
        <StateBlock kind="empty" message="Sin categorías todavía." />
      )}

      {!loading && !loadError && categories.length > 0 && (
        <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="font-medium text-white">
                  {category.name} <span className="font-mono text-xs text-zinc-600">/{category.slug}</span>
                </p>
                {category.description && <p className="text-sm text-zinc-500">{category.description}</p>}
              </div>
              <button
                onClick={() => handleDelete(category)}
                className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-900 hover:text-red-400"
                title="Eliminar"
                aria-label={`Eliminar ${category.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
