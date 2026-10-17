import React, { useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type {
  ArticleRow,
  ArticleSourceRow,
  ArticleStatus,
  CategoryRow,
  FaqItem,
} from '../../lib/database.types';
import { uploadCover } from './images';
import { logAdminAction } from './audit';
import { ActionError, inputClass as baseInputClass, primaryButton, SectionHeader, StateBlock } from './ui';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const inputClass = `${baseInputClass} mt-1.5`;
const labelClass = 'block text-sm text-zinc-400';
const cardClass = 'space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-5';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50 transition-colors';

interface SourceDraft {
  id?: string;
  title: string;
  url: string;
  publisher: string;
  published_date: string;
}

interface ArticleEditorProps {
  user: User;
  articleId: string | null;
  onClose: () => void;
}

export const ArticleEditor: React.FC<ArticleEditorProps> = ({ user, articleId, onClose }) => {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(articleId));
  const [actionError, setActionError] = useState<string | null>(null);
  // Id real del artículo: se conserva apenas se crea para que un reintento haga UPDATE.
  const [currentId, setCurrentId] = useState<string | null>(articleId);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [authorName, setAuthorName] = useState('Charlitron Digital');
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverThumbUrl, setCoverThumbUrl] = useState('');
  const [coverAlt, setCoverAlt] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [sources, setSources] = useState<SourceDraft[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug, description')
      .order('name')
      .then(({ data }) => setCategories((data ?? []) as CategoryRow[]));
  }, []);

  useEffect(() => {
    if (!articleId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, title, slug, excerpt, content, cover_image_url, cover_thumb_url, cover_alt, category_id, author_name, status, meta_title, meta_description, faq, cta_text, cta_url, published_at, created_by, created_at, updated_at',
        )
        .eq('id', articleId)
        .single();
      if (error || !data) {
        setLoadError('No se pudo cargar el artículo.');
        setLoading(false);
        return;
      }
      const article = data as unknown as ArticleRow;
      setTitle(article.title);
      setSlug(article.slug);
      setExcerpt(article.excerpt ?? '');
      setContent(article.content);
      setCategoryId(article.category_id ?? '');
      setAuthorName(article.author_name);
      setStatus(article.status);
      setCoverImageUrl(article.cover_image_url ?? '');
      setCoverThumbUrl(article.cover_thumb_url ?? '');
      setCoverAlt(article.cover_alt ?? '');
      setMetaTitle(article.meta_title ?? '');
      setMetaDescription(article.meta_description ?? '');
      setCtaText(article.cta_text ?? '');
      setCtaUrl(article.cta_url ?? '');
      setPublishedAt(article.published_at);
      setFaq(Array.isArray(article.faq) ? (article.faq as FaqItem[]) : []);

      const { data: sourceRows } = await supabase
        .from('article_sources')
        .select('id, article_id, title, url, publisher, published_date')
        .eq('article_id', articleId);
      setSources(
        ((sourceRows ?? []) as ArticleSourceRow[]).map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          publisher: s.publisher ?? '',
          published_date: s.published_date ?? '',
        })),
      );
      setLoading(false);
    };
    void load();
  }, [articleId]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError(null);
    setUploading(true);
    try {
      // Para artículos nuevos usamos un id temporal de carpeta.
      const folderId = currentId ?? 'drafts';
      const { webUrl, thumbUrl } = await uploadCover(file, folderId);
      setCoverImageUrl(webUrl);
      setCoverThumbUrl(thumbUrl);
    } catch (err) {
      setActionError(`Error al subir imagen: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (nextStatus?: ArticleStatus) => {
    const finalStatus = nextStatus ?? status;
    if (!title.trim() || !slug.trim()) {
      setActionError('Título y slug son obligatorios.');
      return;
    }
    setActionError(null);
    setSaving(true);

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      category_id: categoryId || null,
      author_name: authorName.trim() || 'Charlitron Digital',
      status: finalStatus,
      cover_image_url: coverImageUrl || null,
      cover_thumb_url: coverThumbUrl || null,
      cover_alt: coverAlt.trim() || null,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDescription.trim() || null,
      cta_text: ctaText.trim() || null,
      cta_url: ctaUrl.trim() || null,
      faq: faq.filter((item) => item.question.trim() && item.answer.trim()),
      // published_at lo fija el trigger de DB al primer pase a `published`
      // (ver 0001_init.sql §10b). Aquí solo se conserva el valor existente.
      published_at: publishedAt,
    };

    let savedId = currentId;
    if (currentId) {
      const { error } = await supabase.from('articles').update(payload).eq('id', currentId);
      if (error) {
        setActionError(`Error al guardar: ${error.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('articles')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single();
      if (error || !data) {
        setActionError(`Error al crear: ${error?.message ?? 'desconocido'}`);
        setSaving(false);
        return;
      }
      savedId = (data as { id: string }).id;
      setCurrentId(savedId);
    }

    if (!savedId) {
      setSaving(false);
      return;
    }

    // Fuentes: reemplazo completo (simple y suficiente para MVP).
    const { error: deleteSourcesError } = await supabase
      .from('article_sources')
      .delete()
      .eq('article_id', savedId);
    if (deleteSourcesError) {
      setActionError(`Error al actualizar las fuentes: ${deleteSourcesError.message}`);
      setSaving(false);
      return;
    }
    const validSources = sources.filter((s) => s.title.trim() && s.url.trim());
    if (validSources.length > 0) {
      const { error: insertSourcesError } = await supabase.from('article_sources').insert(
        validSources.map((s) => ({
          article_id: savedId,
          title: s.title.trim(),
          url: s.url.trim(),
          publisher: s.publisher.trim() || null,
          published_date: s.published_date || null,
        })),
      );
      if (insertSourcesError) {
        setActionError(`Error al guardar las fuentes: ${insertSourcesError.message}`);
        setSaving(false);
        return;
      }
    }

    await logAdminAction(
      user,
      articleId ? `article.update.${finalStatus}` : `article.create.${finalStatus}`,
      'article',
      savedId,
      { title: payload.title, slug: payload.slug },
    );

    setSaving(false);
    onClose();
  };

  if (loading) return <StateBlock kind="loading" message="Cargando artículo…" />;

  const backButton = (
    <button onClick={onClose} className={secondaryButton}>
      <ArrowLeft className="h-4 w-4" /> Volver a la lista
    </button>
  );

  if (loadError) {
    return (
      <section>
        <SectionHeader title="Artículo" action={backButton} />
        <StateBlock kind="error" message={loadError} />
      </section>
    );
  }

  return (
    <section className="max-w-3xl">
      <SectionHeader
        title={currentId ? 'Editar artículo' : 'Nuevo artículo'}
        description={currentId ? slug : undefined}
        action={backButton}
      />
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            Título *
            <input
              className={inputClass}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Slug *
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className={labelClass}>
            Categoría
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Extracto (resumen para listados y SEO)
            <textarea
              className={inputClass}
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Autor
            <input
              className={inputClass}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Estado
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleStatus)}
            >
              <option value="draft">Borrador</option>
              <option value="review">Revisión</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Contenido (markdown-lite: ## encabezados, - listas, **negrita**, [texto](url))
          <textarea
            className={`${inputClass} font-mono text-sm`}
            rows={16}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>

        <div className={cardClass}>
          <h3 className="font-semibold text-white">Imagen de portada</h3>
          <div className="flex items-center gap-4">
            <label className={`${secondaryButton} cursor-pointer`}>
              <ImagePlus className="w-4 h-4" />
              {uploading ? 'Optimizando y subiendo…' : 'Subir imagen (se convierte a WebP)'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleCoverUpload}
              />
            </label>
            {coverThumbUrl && (
              <img src={coverThumbUrl} alt="preview" className="h-16 rounded-lg border border-zinc-700" />
            )}
          </div>
          <label className={labelClass}>
            Texto alternativo (alt)
            <input
              className={inputClass}
              value={coverAlt}
              onChange={(e) => setCoverAlt(e.target.value)}
            />
          </label>
        </div>

        <div className={cardClass}>
          <h3 className="font-semibold text-white">SEO</h3>
          <label className={labelClass}>
            Meta título (opcional)
            <input
              className={inputClass}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Meta descripción (opcional)
            <textarea
              className={inputClass}
              rows={2}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
            />
          </label>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Preguntas frecuentes (FAQ schema)</h3>
            <button
              type="button"
              onClick={() => setFaq([...faq, { question: '', answer: '' }])}
              className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {faq.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  className={inputClass}
                  placeholder="Pregunta"
                  value={item.question}
                  onChange={(e) =>
                    setFaq(faq.map((f, i) => (i === idx ? { ...f, question: e.target.value } : f)))
                  }
                />
                <button
                  type="button"
                  onClick={() => setFaq(faq.filter((_, i) => i !== idx))}
                  className="p-2 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Respuesta"
                value={item.answer}
                onChange={(e) =>
                  setFaq(faq.map((f, i) => (i === idx ? { ...f, answer: e.target.value } : f)))
                }
              />
            </div>
          ))}
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Fuentes / evidencia</h3>
            <button
              type="button"
              onClick={() =>
                setSources([...sources, { title: '', url: '', publisher: '', published_date: '' }])
              }
              className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {sources.map((source, idx) => (
            <div key={idx} className="rounded-lg border border-zinc-800 p-4 grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Título de la fuente *"
                value={source.title}
                onChange={(e) =>
                  setSources(sources.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)))
                }
              />
              <input
                className={inputClass}
                placeholder="https://… *"
                value={source.url}
                onChange={(e) =>
                  setSources(sources.map((s, i) => (i === idx ? { ...s, url: e.target.value } : s)))
                }
              />
              <input
                className={inputClass}
                placeholder="Medio / publicador"
                value={source.publisher}
                onChange={(e) =>
                  setSources(
                    sources.map((s, i) => (i === idx ? { ...s, publisher: e.target.value } : s)),
                  )
                }
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className={inputClass}
                  value={source.published_date}
                  onChange={(e) =>
                    setSources(
                      sources.map((s, i) =>
                        i === idx ? { ...s, published_date: e.target.value } : s,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setSources(sources.filter((_, i) => i !== idx))}
                  className="p-2 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={cardClass}>
          <h3 className="font-semibold text-white">CTA final (opcional)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Texto del botón (p.ej. Agendar diagnóstico)"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="URL (https://wa.me/… o /#contacto)"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button onClick={() => handleSave()} disabled={saving} className={secondaryButton}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {status !== 'published' && (
            <button onClick={() => handleSave('published')} disabled={saving} className={primaryButton}>
              Guardar y publicar
            </button>
          )}
          {status === 'published' && (
            <button onClick={() => handleSave('archived')} disabled={saving} className={secondaryButton}>
              Archivar
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
