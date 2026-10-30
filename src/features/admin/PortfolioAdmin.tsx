import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Send, Trash2, Upload } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { PROJECTS } from '../../data/projects';
import { processImage } from './imageProcessing';
import { logAdminAction } from './audit';
import {
  addGalleryImage,
  createEmptyPortfolioDraft,
  MAX_PORTFOLIO_GALLERY_IMAGES,
  moveGalleryImage,
  portfolioPublishErrors,
  removeGalleryImage,
  updatePortfolioImageAlt,
  validatePortfolioUpload,
  validateProcessedPortfolioImage,
  type PortfolioImageAsset,
  type PortfolioProjectDraft,
} from './portfolioModel';
import type { PortfolioPublishedInfo, PortfolioRepository } from './portfolioRepository';
import { createConfiguredPortfolioRepository } from './portfolioRepositoryFactory';
import { ActionError, SectionHeader, inputClass } from './ui';

let repository: PortfolioRepository | null = null;
const getRepository = (): PortfolioRepository => (repository ??= createConfiguredPortfolioRepository());

type Busy = 'loading' | 'processing' | 'saving' | 'publishing' | null;

const BUSY_MESSAGES: Record<Exclude<Busy, null>, string> = {
  loading: 'Cargando proyecto…',
  processing: 'Optimizando imágenes…',
  saving: 'Guardando borrador…',
  publishing: 'Publicando versión…',
};

export const PortfolioAdmin: React.FC<{ user: User }> = ({ user }) => {
  const repo = getRepository();
  const isStorage = repo.mode === 'storage';
  const publishBlocked = repo.canPublish === false;
  const selectable = PROJECTS.filter((item) => !repo.projectSlugs || repo.projectSlugs.includes(item.slug));
  const projectOptions = selectable.length > 0 ? selectable : PROJECTS;
  const [projectSlug, setProjectSlug] = useState(projectOptions[0].slug);
  const [loadedDraft, setLoadedDraft] = useState<PortfolioProjectDraft | null>(null);
  const [published, setPublished] = useState<PortfolioPublishedInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Busy>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const project = PROJECTS.find((item) => item.slug === projectSlug) ?? PROJECTS[0];
  const draft = loadedDraft ?? createEmptyPortfolioDraft(project.slug);
  const uploading = busy !== null || !loadedDraft;

  useEffect(() => {
    let active = true;
    setBusy('loading');
    setLoadedDraft(null);
    setError(null);
    setNotice(null);
    repo
      .loadProject(projectSlug)
      .then((state) => {
        if (!active) return;
        setLoadedDraft(state.draft);
        setPublished(state.published);
        setDirty(false);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el proyecto.');
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [repo, projectSlug]);

  const edit = (next: PortfolioProjectDraft) => {
    setLoadedDraft(next);
    setDirty(true);
    setNotice(null);
  };

  const selectProject = (nextSlug: string) => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de proyecto?')) return;
    setProjectSlug(nextSlug);
  };

  const createAsset = async (file: File): Promise<PortfolioImageAsset> => {
    const validationError = validatePortfolioUpload(file);
    if (validationError) throw new Error(validationError);
    const processed = await processImage(file);
    const processedValidationError = validateProcessedPortfolioImage(
      processed.web.size,
      processed.thumb.size,
    );
    if (processedValidationError) throw new Error(processedValidationError);
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      alt: '',
      order: 0,
      width: processed.width,
      height: processed.height,
      webBlob: processed.web,
      thumbBlob: processed.thumb,
    };
  };

  const handleCoverFile = async (file?: File) => {
    if (!file) return;
    setBusy('processing');
    setError(null);
    try {
      const cover = await createAsset(file);
      edit({ ...draft, cover });
      setNotice('Portada preparada en este navegador. Guarda el borrador para conservarla.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo procesar la imagen.');
    } finally {
      setBusy(null);
    }
  };

  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('processing');
    setError(null);
    try {
      const remaining = MAX_PORTFOLIO_GALLERY_IMAGES - draft.gallery.length;
      if (files.length > remaining) {
        throw new Error(`Puedes agregar ${remaining} imagen${remaining === 1 ? '' : 'es'} más.`);
      }
      let nextDraft = draft;
      for (const file of Array.from(files)) {
        nextDraft = addGalleryImage(nextDraft, await createAsset(file));
      }
      edit(nextDraft);
      setNotice('Imágenes preparadas en este navegador. Guarda el borrador para conservarlas.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudieron procesar las imágenes.');
    } finally {
      setBusy(null);
    }
  };

  const updateCoverAlt = (alt: string) => {
    if (!draft.cover) return;
    edit({ ...draft, cover: { ...draft.cover, alt } });
  };

  const updateGalleryAlt = (imageId: string, alt: string) => {
    edit(updatePortfolioImageAlt(draft, imageId, alt, 'gallery'));
  };

  const moveGallery = (imageId: string, direction: -1 | 1) => {
    edit(moveGalleryImage(draft, imageId, direction));
  };

  const removeGallery = (imageId: string) => {
    edit(removeGalleryImage(draft, imageId));
  };

  const saveDraft = async () => {
    setBusy('saving');
    setError(null);
    try {
      const state = await repo.saveDraft(draft);
      setLoadedDraft(state.draft);
      setPublished(state.published);
      setDirty(false);
      setNotice(isStorage ? 'Borrador guardado en Storage privado.' : 'Borrador guardado solo durante esta sesión de demostración.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el borrador.');
    } finally {
      setBusy(null);
    }
  };

  const publishDraft = async () => {
    const errors = portfolioPublishErrors(draft);
    if (errors.length) {
      setError(errors.join(' '));
      setNotice(null);
      return;
    }
    if (isStorage && !window.confirm(`Esto publica una nueva versión de «${project.title}» en el sitio público. ¿Continuar?`)) {
      return;
    }
    setBusy('publishing');
    setError(null);
    try {
      const saved = await repo.saveDraft(draft);
      const state = await repo.publish(saved.draft, new Date().toISOString());
      setLoadedDraft(state.draft);
      setPublished(state.published);
      setDirty(false);
      if (isStorage) {
        void logAdminAction(user, 'portfolio.publish', 'portfolio', project.slug, { version: state.published?.version });
        setNotice(`Versión ${state.published?.version} publicada. Las imágenes se actualizan sin redeploy; el HTML prerenderizado cambia con el próximo build de producción.`);
      } else {
        setNotice(`Versión ${state.published?.version} simulada en memoria. No modifica el sitio público.`);
      }
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'No se pudo publicar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Portafolio"
        description="Administra imágenes de los cuatro proyectos. Los textos y estados siguen en el catálogo local."
      />

      {isStorage ? (
        <div className="mb-6 border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-6 text-emerald-100">
          <strong className="block text-emerald-300">Storage real activo</strong>
          <span>
            Los borradores se guardan en un bucket privado. Publicar crea una versión pública nueva y cambia lo que ve el sitio.
          </span>
        </div>
      ) : (
        <div className="mb-6 border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
          <strong className="block text-amber-300">Modo de demostración local</strong>
          <span>
            No hay conexión con Storage ni persistencia. Los borradores y publicaciones se conservan solo en memoria durante esta sesión y no cambian las imágenes públicas ni el HTML prerenderizado.
          </span>
        </div>
      )}

      <ActionError message={error} onDismiss={() => setError(null)} />
      {notice && <p role="status" className="mb-5 border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}

      <div className="mb-6 grid gap-4 border-b border-zinc-800 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm text-zinc-400">
          Proyecto
          <select
            className={`${inputClass} mt-1.5`}
            value={projectSlug}
            disabled={busy !== null}
            onChange={(event) => selectProject(event.target.value)}
          >
            {projectOptions.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
          </select>
        </label>
        <div className="text-xs text-zinc-500">
          {published
            ? `${isStorage ? 'Última versión publicada' : 'Última versión simulada'}: ${published.version}`
            : isStorage ? 'Sin versión publicada' : 'Sin versión publicada en esta sesión'}
          {dirty && <span className="ml-2 text-amber-300">· Cambios sin guardar</span>}
        </div>
      </div>

      <div className="space-y-10">
        <section aria-labelledby="portfolio-cover-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="portfolio-cover-title" className="font-display text-lg font-bold text-white">Imagen principal</h2>
              <p className="mt-1 text-sm text-zinc-500">JPG, PNG o WebP · original hasta 12 MiB · WebP final hasta 5 MiB por archivo</p>
            </div>
            <label className={`inline-flex cursor-pointer items-center gap-2 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400 hover:text-amber-300 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {draft.cover ? 'Sustituir imagen' : 'Subir imagen'}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  void handleCoverFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {draft.cover ? (
            <div className="grid gap-4 border border-zinc-800 bg-zinc-950/40 p-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.7fr)]">
              <ImagePreview image={draft.cover} />
              <div className="flex flex-col justify-end">
                <p className="mb-2 break-all text-xs text-zinc-500">{draft.cover.fileName}</p>
                <label className="block text-sm text-zinc-400">
                  Texto ALT
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={draft.cover.alt}
                    onChange={(event) => updateCoverAlt(event.target.value)}
                    placeholder="Describe lo que muestra la imagen"
                    maxLength={250}
                  />
                </label>
                <p className="mt-2 text-xs text-zinc-600">{draft.cover.width} × {draft.cover.height} px optimizados</p>
              </div>
            </div>
          ) : (
            <EmptyImageState label="Previsualización de portada pendiente" />
          )}
        </section>

        <section aria-labelledby="portfolio-gallery-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="portfolio-gallery-title" className="font-display text-lg font-bold text-white">Galería</h2>
              <p className="mt-1 text-sm text-zinc-500">{draft.gallery.length} de {MAX_PORTFOLIO_GALLERY_IMAGES} imágenes</p>
            </div>
            <label className={`inline-flex cursor-pointer items-center gap-2 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400 hover:text-amber-300 ${uploading || draft.gallery.length >= MAX_PORTFOLIO_GALLERY_IMAGES ? 'pointer-events-none opacity-50' : ''}`}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Agregar a galería
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || draft.gallery.length >= MAX_PORTFOLIO_GALLERY_IMAGES}
                onChange={(event) => {
                  void handleGalleryFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {draft.gallery.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {draft.gallery.map((image, index) => (
                <article key={image.id} className="grid min-w-0 gap-4 border border-zinc-800 bg-zinc-950/40 p-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <ImagePreview image={image} />
                  <div className="flex min-w-0 flex-col">
                    <p className="mb-2 break-all text-xs text-zinc-500">{image.fileName}</p>
                    <label className="text-sm text-zinc-400">
                      Texto ALT
                      <input
                        className={`${inputClass} mt-1.5`}
                        value={image.alt}
                        onChange={(event) => updateGalleryAlt(image.id, event.target.value)}
                        placeholder="Describe lo que muestra la imagen"
                        maxLength={250}
                      />
                    </label>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                      <span className="text-xs text-zinc-500">Posición {index + 1}</span>
                      <div className="flex gap-1">
                        <IconButton label="Mover arriba" disabled={index === 0} onClick={() => moveGallery(image.id, -1)}>
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton label="Mover abajo" disabled={index === draft.gallery.length - 1} onClick={() => moveGallery(image.id, 1)}>
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton label="Eliminar del borrador" onClick={() => removeGallery(image.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyImageState label="Aún no hay imágenes en la galería" />
          )}
        </section>
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-zinc-800 pt-6 sm:flex-row sm:justify-end">
        <button type="button" className="border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void saveDraft()} disabled={uploading || !dirty}>
          {isStorage ? 'Guardar borrador' : 'Guardar borrador (simulado)'}
        </button>
        <button type="button" className="inline-flex items-center justify-center gap-2 bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void publishDraft()} disabled={uploading || publishBlocked}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {publishBlocked ? 'Publicación desactivada (prueba piloto)' : isStorage ? 'Publicar versión' : 'Publicar versión (simulada)'}
        </button>
      </div>
      <p className="mt-3 text-right text-xs text-zinc-600">
        {isStorage
          ? 'Publicar no solicita regeneración del HTML; las imágenes se actualizan al cargar la página.'
          : 'Regeneración SEO deshabilitada en esta simulación; no se llama a Vercel ni a Supabase.'}
      </p>
      {busy && <p role="status" className="mt-3 text-right text-sm text-zinc-400">{BUSY_MESSAGES[busy]}</p>}
    </section>
  );
};

function EmptyImageState({ label }: { label: string }) {
  return (
    <div className="flex aspect-video items-center justify-center border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-center">
      <p className="text-sm text-zinc-600">{label}</p>
    </div>
  );
}

function ImagePreview({ image }: { image: PortfolioImageAsset }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(image.thumbBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image.thumbBlob]);

  return previewUrl ? (
    <img
      src={previewUrl}
      alt={image.alt}
      width={image.width}
      height={image.height}
      className="max-h-64 w-full border border-zinc-800 bg-black object-contain"
    />
  ) : <EmptyImageState label="Preparando previsualización" />;
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center border border-zinc-800 text-zinc-400 hover:border-amber-400/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}