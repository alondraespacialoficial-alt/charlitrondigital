import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addGalleryImage,
  createPortfolioManifest,
  createPublishedVersion,
  createEmptyPortfolioDraft,
  moveGalleryImage,
  portfolioPublishErrors,
  removeGalleryImage,
  validatePortfolioUpload,
  validateProcessedPortfolioImage,
  type PortfolioImageAsset,
} from './portfolioModel';
import { createDemoPortfolioRepository } from './portfolioRepository';
import { loadPortfolioManifest, parsePortfolioManifest, resolvePortfolioManifestImages } from '../projects/portfolioManifest';

function image(id: string, alt = `Descripción ${id}`): PortfolioImageAsset {
  const blob = new Blob([id], { type: 'image/webp' });
  return {
    id,
    fileName: `${id}.webp`,
    alt,
    order: 0,
    width: 800,
    height: 600,
    webBlob: blob,
    thumbBlob: blob,
  };
}

test('upload validation accepts supported image formats and rejects unsafe types/sizes', () => {
  assert.equal(validatePortfolioUpload({ type: 'image/webp', size: 1024 }), null);
  assert.match(validatePortfolioUpload({ type: 'image/svg+xml', size: 1024 }) ?? '', /JPG/);
  assert.match(validatePortfolioUpload({ type: 'image/png', size: 13 * 1024 * 1024 }) ?? '', /12 MiB/);
  assert.equal(validateProcessedPortfolioImage(5 * 1024 * 1024, 1024), null);
  assert.match(validateProcessedPortfolioImage(5 * 1024 * 1024 + 1, 1024) ?? '', /5 MiB/);
});

test('gallery is capped at eight images and maintains sequential ordering', () => {
  let draft = createEmptyPortfolioDraft('charlitron-vet');
  for (let index = 0; index < 8; index += 1) draft = addGalleryImage(draft, image(`image-${index}`));
  assert.deepEqual(draft.gallery.map((entry) => entry.order), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.throws(() => addGalleryImage(draft, image('ninth')), /hasta 8/);
});

test('gallery reordering and removal renumber items without mutating the original draft', () => {
  const original = ['a', 'b', 'c'].reduce(
    (draft, id) => addGalleryImage(draft, image(id)),
    createEmptyPortfolioDraft('charlitron-vet'),
  );
  const reordered = moveGalleryImage(original, 'b', 1);
  assert.deepEqual(reordered.gallery.map((entry) => entry.id), ['a', 'c', 'b']);
  assert.deepEqual(original.gallery.map((entry) => entry.id), ['a', 'b', 'c']);
  assert.deepEqual(removeGalleryImage(reordered, 'c').gallery.map((entry) => entry.order), [0, 1]);
});

test('publishing requires a cover and ALT text for every image', () => {
  const emptyDraft = createEmptyPortfolioDraft('charlitron-vet');
  assert.deepEqual(portfolioPublishErrors(emptyDraft), ['Agrega una imagen principal.']);
  const draft = {
    ...emptyDraft,
    cover: image('cover', ''),
    gallery: [image('gallery', '')],
  };
  assert.deepEqual(portfolioPublishErrors(draft), [
    'Agrega texto ALT a la imagen principal.',
    'Agrega texto ALT a todas las imágenes de galería.',
  ]);
  assert.ok(portfolioPublishErrors({ ...draft, cover: image('cover', 'a'.repeat(251)) })
    .includes('El texto ALT de la portada no puede superar 250 caracteres.'));
});

test('demo repository keeps drafts separate from published versioned snapshots', async () => {
  const repository = createDemoPortfolioRepository();
  assert.equal(repository.mode, 'demo');
  const initial = await repository.loadProject('charlitron-vet');
  const saved = await repository.saveDraft({ ...initial.draft, cover: image('cover') });
  assert.equal(saved.published, null);
  const first = await repository.publish(saved.draft, '2026-10-29T12:00:00.000Z');
  assert.equal(first.published?.version, 1);
  const second = await repository.publish(first.draft, '2026-10-30T12:00:00.000Z');
  assert.equal(second.published?.version, 2);
  await assert.rejects(() => repository.loadProject('unknown-project'), /no encontrado/);
});

test('versioned manifest is JSON-safe and maps public image paths without Blob data', () => {
  const draft = { ...createEmptyPortfolioDraft('charlitron-vet'), cover: image('cover') };
  const version = createPublishedVersion(draft, 1, '2026-10-29T12:00:00.000Z');
  const manifest = createPortfolioManifest(version, {
    cover: { path: 'projects/charlitron-vet/v1/cover.webp', thumbPath: 'projects/charlitron-vet/v1/cover-thumb.webp' },
  });
  const serialized = JSON.stringify(manifest);
  assert.ok(!serialized.includes('webBlob'));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.cover.path, 'projects/charlitron-vet/v1/cover.webp');
});

test('public manifest loader uses injected fetch and rejects unsafe or mismatched manifests', async () => {
  const manifest = {
    schemaVersion: 1,
    projectSlug: 'charlitron-vet',
    version: 3,
    publishedAt: '2026-10-29T12:00:00.000Z',
    cover: { path: 'projects/charlitron-vet/v3/cover.webp', thumbPath: 'projects/charlitron-vet/v3/cover-thumb.webp', alt: 'Clínica veterinaria', order: 0, width: 1200, height: 800 },
    gallery: [],
  };
  let fetchCount = 0;
  const fetcher: typeof fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify(manifest), { status: 200 });
  };
  const loaded = await loadPortfolioManifest('https://fake-project.supabase.co', 'charlitron-vet', fetcher);
  assert.equal(fetchCount, 1);
  assert.ok(loaded);
  assert.equal(resolvePortfolioManifestImages(loaded, 'https://fake-project.supabase.co')[0].src,
    'https://fake-project.supabase.co/storage/v1/object/public/portfolio-published/projects/charlitron-vet/v3/cover.webp');
  assert.equal(parsePortfolioManifest(manifest, 'eventos-360'), null);
  assert.equal(parsePortfolioManifest({ ...manifest, cover: { ...manifest.cover, path: '../private.webp' } }, 'charlitron-vet'), null);
  const duplicateOrderManifest = {
    ...manifest,
    gallery: [
      { ...manifest.cover, path: 'projects/charlitron-vet/v3/one.webp', order: 0 },
      { ...manifest.cover, path: 'projects/charlitron-vet/v3/two.webp', order: 0 },
    ],
  };
  assert.equal(parsePortfolioManifest(duplicateOrderManifest, 'charlitron-vet'), null);
});