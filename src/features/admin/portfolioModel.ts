export const MAX_PORTFOLIO_GALLERY_IMAGES = 8;
export const MAX_PORTFOLIO_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_PORTFOLIO_FINAL_WEBP_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PORTFOLIO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PortfolioImageAsset {
  id: string;
  fileName: string;
  alt: string;
  order: number;
  width: number;
  height: number;
  webBlob: Blob;
  thumbBlob: Blob;
}

export interface PortfolioProjectDraft {
  projectSlug: string;
  cover: PortfolioImageAsset | null;
  gallery: PortfolioImageAsset[];
  updatedAt: string | null;
}

export interface PortfolioPublishedVersion {
  projectSlug: string;
  version: number;
  publishedAt: string;
  cover: PortfolioImageAsset;
  gallery: PortfolioImageAsset[];
}

export interface PortfolioManifestImage {
  path: string;
  thumbPath: string;
  alt: string;
  order: number;
  width: number;
  height: number;
}

export interface PortfolioManifest {
  schemaVersion: 1;
  projectSlug: string;
  version: number;
  publishedAt: string;
  cover: PortfolioManifestImage;
  gallery: PortfolioManifestImage[];
}

export type UploadedPortfolioImagePaths = Record<
  string,
  { path: string; thumbPath: string }
>;

export function validatePortfolioUpload(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ALLOWED_PORTFOLIO_IMAGE_TYPES.includes(file.type)) {
    return 'Usa una imagen JPG, PNG o WebP.';
  }
  if (file.size <= 0 || file.size > MAX_PORTFOLIO_UPLOAD_BYTES) {
    return 'La imagen original no puede superar 12 MiB.';
  }
  return null;
}

export function validateProcessedPortfolioImage(webSize: number, thumbSize: number): string | null {
  if (
    webSize <= 0 ||
    thumbSize <= 0 ||
    webSize > MAX_PORTFOLIO_FINAL_WEBP_BYTES ||
    thumbSize > MAX_PORTFOLIO_FINAL_WEBP_BYTES
  ) {
    return 'Cada WebP optimizado debe pesar como máximo 5 MiB. Reduce dimensiones o calidad y vuelve a intentar.';
  }
  return null;
}

export function createEmptyPortfolioDraft(projectSlug: string): PortfolioProjectDraft {
  return { projectSlug, cover: null, gallery: [], updatedAt: null };
}

export function normalizeGalleryOrder(gallery: PortfolioImageAsset[]): PortfolioImageAsset[] {
  return gallery.map((image, index) => ({ ...image, order: index }));
}

export function addGalleryImage(
  draft: PortfolioProjectDraft,
  image: PortfolioImageAsset,
): PortfolioProjectDraft {
  if (draft.gallery.length >= MAX_PORTFOLIO_GALLERY_IMAGES) {
    throw new Error(`La galería admite hasta ${MAX_PORTFOLIO_GALLERY_IMAGES} imágenes.`);
  }
  return { ...draft, gallery: normalizeGalleryOrder([...draft.gallery, image]) };
}

export function removeGalleryImage(
  draft: PortfolioProjectDraft,
  imageId: string,
): PortfolioProjectDraft {
  return {
    ...draft,
    gallery: normalizeGalleryOrder(draft.gallery.filter((image) => image.id !== imageId)),
  };
}

export function moveGalleryImage(
  draft: PortfolioProjectDraft,
  imageId: string,
  direction: -1 | 1,
): PortfolioProjectDraft {
  const index = draft.gallery.findIndex((image) => image.id === imageId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= draft.gallery.length) return draft;
  const gallery = [...draft.gallery];
  [gallery[index], gallery[nextIndex]] = [gallery[nextIndex], gallery[index]];
  return { ...draft, gallery: normalizeGalleryOrder(gallery) };
}

export function updatePortfolioImageAlt(
  draft: PortfolioProjectDraft,
  imageId: string,
  alt: string,
  target: 'cover' | 'gallery',
): PortfolioProjectDraft {
  if (target === 'cover') {
    return draft.cover?.id === imageId ? { ...draft, cover: { ...draft.cover, alt } } : draft;
  }
  return {
    ...draft,
    gallery: draft.gallery.map((image) => (image.id === imageId ? { ...image, alt } : image)),
  };
}

export function portfolioPublishErrors(draft: PortfolioProjectDraft): string[] {
  const errors: string[] = [];
  if (!draft.cover) errors.push('Agrega una imagen principal.');
  if (draft.cover && !draft.cover.alt.trim()) errors.push('Agrega texto ALT a la imagen principal.');
  if (draft.cover && draft.cover.alt.trim().length > 250) {
    errors.push('El texto ALT de la portada no puede superar 250 caracteres.');
  }
  if (draft.gallery.length > MAX_PORTFOLIO_GALLERY_IMAGES) {
    errors.push(`La galería admite hasta ${MAX_PORTFOLIO_GALLERY_IMAGES} imágenes.`);
  }
  if (draft.gallery.some((image) => !image.alt.trim())) {
    errors.push('Agrega texto ALT a todas las imágenes de galería.');
  }
  if (draft.gallery.some((image) => image.alt.trim().length > 250)) {
    errors.push('El texto ALT de galería no puede superar 250 caracteres.');
  }
  return errors;
}

export function cloneDraft(draft: PortfolioProjectDraft): PortfolioProjectDraft {
  return {
    ...draft,
    cover: draft.cover ? { ...draft.cover } : null,
    gallery: draft.gallery.map((image) => ({ ...image })),
  };
}

export function createPublishedVersion(
  draft: PortfolioProjectDraft,
  version: number,
  publishedAt: string,
): PortfolioPublishedVersion {
  const errors = portfolioPublishErrors(draft);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return {
    projectSlug: draft.projectSlug,
    version,
    publishedAt,
    cover: { ...draft.cover! },
    gallery: draft.gallery.map((image) => ({ ...image })),
  };
}

export function createPortfolioManifest(
  published: PortfolioPublishedVersion,
  paths: UploadedPortfolioImagePaths,
): PortfolioManifest {
  const toManifestImage = (image: PortfolioImageAsset): PortfolioManifestImage => {
    const storedPaths = paths[image.id];
    if (!storedPaths?.path || !storedPaths.thumbPath) {
      throw new Error(`Faltan rutas Storage para ${image.fileName}.`);
    }
    return {
      ...storedPaths,
      alt: image.alt.trim(),
      order: image.order,
      width: image.width,
      height: image.height,
    };
  };

  return {
    schemaVersion: 1,
    projectSlug: published.projectSlug,
    version: published.version,
    publishedAt: published.publishedAt,
    cover: toManifestImage(published.cover),
    gallery: [...published.gallery]
      .sort((left, right) => left.order - right.order)
      .map(toManifestImage),
  };
}