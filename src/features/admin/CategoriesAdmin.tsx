import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { CategoryRow } from '../../lib/database.types';
import { logAdminAction } from './audit';

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

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug, description, created_at')
      .order('name');
    setCategories((data ?? []) as CategoryRow[]);
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
      window.alert(`Error: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'category.create', 'category', slug, { name });
    setName('');
    setDescription('');
    void load();
  };

  const handleDelete = async (category: CategoryRow) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    if (error) {
      window.alert(`Error al eliminar: ${error.message}`);
      return;
    }
    await logAdminAction(user, 'category.delete', 'category', category.id, { name: category.name });
    void load();
  };

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">Categorías</h2>

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-8 space-y-4"
      >
        <input
          type="text"
          required
          placeholder="Nombre de la categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
        >
          <Plus className="w-4 h-4" /> Crear categoría
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="font-medium text-white">{category.name}</span>
                <span className="ml-2 text-xs text-zinc-500">/{category.slug}</span>
                {category.description && (
                  <p className="text-sm text-zinc-500">{category.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(category)}
                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="px-5 py-6 text-zinc-500">Sin categorías todavía.</li>
          )}
        </ul>
      )}
    </section>
  );
};
