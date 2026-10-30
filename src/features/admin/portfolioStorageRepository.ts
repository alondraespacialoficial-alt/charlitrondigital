import { PROJECTS } from '../../data/projects';
import { PORTFOLIO_PUBLISHED_BUCKET, parsePortfolioManifest } from '../projects/portfolioManifest';
import {
  cloneDraft,
  createEmptyPortfolioDraft,
  createPortfolioManifest,
  createPublishedVersion,
  MAX_PORTFOLIO_GALLERY_IMAGES,
  normalizeGalleryOrder,
  portfolioPublishErrors,
  validateProcessedPortfolioImage,
  type PortfolioImageAsset,
  type PortfolioManifest,
  type PortfolioProjectDraft,
  type UploadedPortfolioImagePaths,
} from './portfolioModel';
import type {
  PortfolioProjectState,
  PortfolioPublishedInfo,
  PortfolioRepository,
} from './portfolioRepository';

export const PORTFOLIO_DRAFTS_BUCKET = 'portfolio-drafts';

const JSON_TYPE = 'application/json';
const WEBP_TYPE = 'image/webp';
const IMAGE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_ALT_LENGTH = 250;
const IMMUTABLE_CACHE = '31536000';
const POINTER_CACHE = '60';

export interface StorageErrorLike {
  message: string;
  status?: number;
  statusCode?: string;
}

export interface StorageUploadOptions {
  contentType: string;
  cacheControl: string;
  upsert: boolean;
}

export interface StorageBucketLike {
  upload(
    path: string,
    body: Blob,
    options: StorageUploadOptions,
  ): PromiseLike<{ error: StorageErrorLike | null }>;
  download(path: string): PromiseLike<{ data: Blob | null; error: StorageErrorLike | null }>;
  remove(paths: string[]): PromiseLike<{ error: StorageErrorLike | null }>;
}

export interface StorageLike {
  from(bucket: string): StorageBucketLike;
}

export const draftManifestPath = (slug: string) => `drafts/${slug}/draft.json`;
export const draftAssetPath = (slug: string, imageId: string, kind: 'web' | 'thumb') =>
  `drafts/${slug}/assets/${imageId}-${kind}.webp`;
export const publishedVersionDir = (slug: string, version: number) =>
  `projects/${slug}/versions/${version}`;
export const publishedCurrentPath = (slug: string) => `projects/${slug}/current.json`;

export function isStorageNotFound(error: StorageErrorLike): boolean {
  if (/bucket/i.test(error.message)) return false;
  return (
    error.status === 404 ||
    error.statusCode === '404' ||
    /not.?found|no.?such.?object/i.test(error.message)
  );
}

export interface StoredDraftImage {
  id: string;
  fileName: string;
  alt: string;
  order: number;
  width: number;
  height: number;
}

export interface StoredDraft {
  schemaVersion: 1;
  projectSlug: string;
  updatedAt: string;
  cover: StoredDraftImage | null;
  gallery: StoredDraftImage[];
}

function isStoredImage(value: unknown): value is StoredDraftImage {
  if (!value || typeof value !== 'object') return false;
  const image = value as Partial<StoredDraftImage>;
  return (
    typeof image.id === 'string' && IMAGE_ID_PATTERN.test(image.id) &&
    typeof image.fileName === 'string' && image.fileName.length <= 255 &&
    typeof image.alt === 'string' && image.alt.length <= MAX_ALT_LENGTH &&
    Number.isInteger(image.order) && Number(image.order) >= 0 &&
    Number.isInteger(image.width) && Number(image.width) > 0 &&
    Number.isInteger(image.height) && Number(image.height) > 0
  );
}

export function parseStoredDraft(value: unknown, expectedSlug: string): StoredDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<StoredDraft>;
  if (
    draft.schemaVersion !== 1 ||
    draft.projectSlug !== expectedSlug ||
    typeof draft.updatedAt !== 'string' ||
    !(draft.cover === null || isStoredImage(draft.cover)) ||
    !Array.isArray(draft.gallery) ||
    draft.gallery.length > MAX_PORTFOLIO_GALLERY_IMAGES ||
    !draft.gallery.every(isStoredImage)
  ) {
    return null;
  }
  const ids = [draft.cover, ...draft.gallery].filter(Boolean).map((image) => image!.id);
  if (new Set(ids).size !== ids.length) return null;
  return draft as StoredDraft;
}

function toStoredImage(image: PortfolioImageAsset): StoredDraftImage {
  return {
    id: image.id,
    fileName: image.fileName,
    alt: image.alt,
    order: image.order,
    width: image.width,
    height: image.height,
  };
}

function assertKnownProject(projectSlug: string): void {
  if (!PROJECTS.some((project) => project.slug === projectSlug)) {
    throw new Error('Proyecto no encontrado.');
  }
}

function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: JSON_TYPE });
}

async function put(
  bucket: StorageBucketLike,
  path: string,
  body: Blob,
  contentType: string,
  cacheControl: string,
  upsert: boolean,
): Promise<void> {
  const typed = body.type === contentType ? body : new Blob([body], { type: contentType });
  const { error } = await bucket.upload(path, typed, { contentType, cacheControl, upsert });
  if (error) throw new Error(`No se pudo subir ${path}: ${error.message}`);
}

async function downloadBlob(bucket: StorageBucketLike, path: string): Promise<Blob> {
  const { data, error } = await bucket.download(path);
  if (error || !data) throw new Error(`No se pudo leer ${path}: ${error?.message ?? 'sin datos'}`);
  return data;
}

async function readJson(bucket: StorageBucketLike, path: string): Promise<unknown | null> {
  const { data, error } = await bucket.download(path);
  if (error) {
    if (isStorageNotFound(error)) return null;
    throw new Error(`No se pudo leer ${path}: ${error.message}`);
  }
  if (!data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    throw new Error(`${path} no es JSON válido.`);
  }
}

async function removeQuietly(bucket: StorageBucketLike, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await bucket.remove(paths);
  } catch {
    // Los huérfanos no referenciados son inofensivos.
  }
}

export interface PortfolioStorageGuards {
  publishEnabled: boolean;
  projectSlugs?: readonly string[];
}

export function createStoragePortfolioRepository(
  storage: StorageLike,
  now: () => string = () => new Date().toISOString(),
  guards: PortfolioStorageGuards = { publishEnabled: true },
): PortfolioRepository {
  const drafts = storage.from(PORTFOLIO_DRAFTS_BUCKET);
  const published = storage.from(PORTFOLIO_PUBLISHED_BUCKET);
  const knownAssets = new Map<string, Set<string>>();
  const assertOperable = (projectSlug: string): void => {
    assertKnownProject(projectSlug);
    if (guards.projectSlugs && !guards.projectSlugs.includes(projectSlug)) {
      throw new Error('Este proyecto no está habilitado en la prueba piloto.');
    }
  };
  const publishedInfo = new Map<string, PortfolioPublishedInfo | null>();

  const readCurrent = async (projectSlug: string): Promise<PortfolioManifest | null> => {
    const json = await readJson(published, publishedCurrentPath(projectSlug));
    if (json === null) return null;
    const manifest = parsePortfolioManifest(json, projectSlug);
    if (!manifest) throw new Error('El manifiesto publicado actual no es válido.');
    return manifest;
  };

  const infoOf = (manifest: PortfolioManifest | null): PortfolioPublishedInfo | null =>
    manifest ? { version: manifest.version, publishedAt: manifest.publishedAt } : null;

  const currentInfo = async (projectSlug: string): Promise<PortfolioPublishedInfo | null> => {
    if (publishedInfo.has(projectSlug)) return publishedInfo.get(projectSlug) ?? null;
    const info = infoOf(await readCurrent(projectSlug));
    publishedInfo.set(projectSlug, info);
    return info;
  };

  const hydrate = async (projectSlug: string, stored: StoredDraftImage): Promise<PortfolioImageAsset> => {
    const [webBlob, thumbBlob] = await Promise.all([
      downloadBlob(drafts, draftAssetPath(projectSlug, stored.id, 'web')),
      downloadBlob(drafts, draftAssetPath(projectSlug, stored.id, 'thumb')),
    ]);
    return { ...stored, webBlob, thumbBlob };
  };

  const validateDraft = (draft: PortfolioProjectDraft): PortfolioImageAsset[] => {
    assertOperable(draft.projectSlug);
    if (draft.gallery.length > MAX_PORTFOLIO_GALLERY_IMAGES) {
      throw new Error(`La galería admite hasta ${MAX_PORTFOLIO_GALLERY_IMAGES} imágenes.`);
    }
    const images = [draft.cover, ...draft.gallery].filter((image): image is PortfolioImageAsset => Boolean(image));
    if (new Set(images.map((image) => image.id)).size !== images.length) {
      throw new Error('Hay imágenes duplicadas en el borrador.');
    }
    for (const image of images) {
      if (!IMAGE_ID_PATTERN.test(image.id)) throw new Error('Identificador de imagen no válido.');
      if (image.alt.length > MAX_ALT_LENGTH) throw new Error('El texto ALT supera 250 caracteres.');
      const sizeError = validateProcessedPortfolioImage(image.webBlob.size, image.thumbBlob.size);
      if (sizeError) throw new Error(sizeError);
    }
    return images;
  };

  return {
    mode: 'storage',
    canPublish: guards.publishEnabled,
    projectSlugs: guards.projectSlugs,

    async loadProject(projectSlug) {
      assertOperable(projectSlug);
      const raw = await readJson(drafts, draftManifestPath(projectSlug));
      let draft = createEmptyPortfolioDraft(projectSlug);
      const known = new Set<string>();
      if (raw !== null) {
        const stored = parseStoredDraft(raw, projectSlug);
        if (!stored) throw new Error('El borrador guardado no es válido.');
        const cover = stored.cover ? await hydrate(projectSlug, stored.cover) : null;
        const gallery = await Promise.all(
          [...stored.gallery].sort((a, b) => a.order - b.order).map((image) => hydrate(projectSlug, image)),
        );
        draft = { projectSlug, cover, gallery: normalizeGalleryOrder(gallery), updatedAt: stored.updatedAt };
        [stored.cover, ...stored.gallery].forEach((image) => image && known.add(image.id));
      }
      knownAssets.set(projectSlug, known);
      const info = infoOf(await readCurrent(projectSlug));
      publishedInfo.set(projectSlug, info);
      return { draft, published: info };
    },

    async saveDraft(draft) {
      const images = validateDraft(draft);
      const projectSlug = draft.projectSlug;
      const known = knownAssets.get(projectSlug) ?? new Set<string>();

      for (const image of images) {
        if (known.has(image.id)) continue;
        await Promise.all([
          put(drafts, draftAssetPath(projectSlug, image.id, 'web'), image.webBlob, WEBP_TYPE, '3600', true),
          put(drafts, draftAssetPath(projectSlug, image.id, 'thumb'), image.thumbBlob, WEBP_TYPE, '3600', true),
        ]);
        known.add(image.id);
      }

      const updatedAt = now();
      const stored: StoredDraft = {
        schemaVersion: 1,
        projectSlug,
        updatedAt,
        cover: draft.cover ? toStoredImage(draft.cover) : null,
        gallery: draft.gallery.map(toStoredImage),
      };
      await put(drafts, draftManifestPath(projectSlug), jsonBlob(stored), JSON_TYPE, POINTER_CACHE, true);

      const keep = new Set(images.map((image) => image.id));
      const orphans = [...known].filter((id) => !keep.has(id));
      if (orphans.length > 0) {
        const { error } = await drafts.remove(
          orphans.flatMap((id) => [draftAssetPath(projectSlug, id, 'web'), draftAssetPath(projectSlug, id, 'thumb')]),
        );
        if (!error) orphans.forEach((id) => known.delete(id));
      }
      knownAssets.set(projectSlug, known);

      return { draft: { ...cloneDraft(draft), updatedAt }, published: await currentInfo(projectSlug) };
    },

    async publish(draft, publishedAt) {
      if (!guards.publishEnabled) throw new Error('La publicación está desactivada en esta prueba. Solo se guardan borradores.');
      validateDraft(draft);
      const publishErrors = portfolioPublishErrors(draft);
      if (publishErrors.length > 0) throw new Error(publishErrors.join(' '));

      const projectSlug = draft.projectSlug;
      const version = ((await readCurrent(projectSlug))?.version ?? 0) + 1;
      const snapshot = createPublishedVersion(draft, version, publishedAt);
      const dir = publishedVersionDir(projectSlug, version);
      const paths: UploadedPortfolioImagePaths = {};
      const uploaded: string[] = [];

      // Solo se registran subidas exitosas: nunca se borra un archivo que subió otro publicador.
      const uploadAll = async (
        items: Array<{ path: string; blob: Blob; type: string; cache: string }>,
      ): Promise<void> => {
        const results = await Promise.allSettled(
          items.map(async (item) => {
            await put(published, item.path, item.blob, item.type, item.cache, false);
            uploaded.push(item.path);
          }),
        );
        const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failed) throw failed.reason;
      };

      // Los archivos de esta versión no son alcanzables hasta que current.json los referencie.
      try {
        for (const image of [snapshot.cover, ...snapshot.gallery]) {
          const path = `${dir}/${image.id}-web.webp`;
          const thumbPath = `${dir}/${image.id}-thumb.webp`;
          await uploadAll([
            { path, blob: image.webBlob, type: WEBP_TYPE, cache: IMMUTABLE_CACHE },
            { path: thumbPath, blob: image.thumbBlob, type: WEBP_TYPE, cache: IMMUTABLE_CACHE },
          ]);
          paths[image.id] = { path, thumbPath };
        }
        const manifest = createPortfolioManifest(snapshot, paths);
        if (!parsePortfolioManifest(manifest, projectSlug)) {
          throw new Error('El manifiesto generado no es válido.');
        }
        await uploadAll([
          { path: `${dir}/manifest.json`, blob: jsonBlob(manifest), type: JSON_TYPE, cache: IMMUTABLE_CACHE },
        ]);

        // Paso final: solo ahora cambia lo que ve el sitio.
        await put(published, publishedCurrentPath(projectSlug), jsonBlob(manifest), JSON_TYPE, POINTER_CACHE, true);
      } catch (error) {
        // current.json aún apunta a la versión anterior en cualquier fallo previo a su escritura.
        if (!(await pointerMayHaveChanged(readCurrent, projectSlug, version))) {
          await removeQuietly(published, uploaded);
        }
        throw error;
      }

      const verified = await readCurrent(projectSlug);
      if (verified?.version !== version || verified.publishedAt !== publishedAt) {
        throw new Error(
          'La publicación terminó, pero current.json no coincide con la versión esperada. Puede haber otra publicación simultánea; recarga y revisa.',
        );
      }
      const info = infoOf(verified);
      publishedInfo.set(projectSlug, info);
      return { draft: cloneDraft(draft), published: info } satisfies PortfolioProjectState;
    },
  };
}

// Si no se puede leer el puntero, se asume que pudo cambiar y no se borra nada.
async function pointerMayHaveChanged(
  readCurrent: (projectSlug: string) => Promise<PortfolioManifest | null>,
  projectSlug: string,
  version: number,
): Promise<boolean> {
  try {
    return (await readCurrent(projectSlug))?.version === version;
  } catch {
    return true;
  }
}
