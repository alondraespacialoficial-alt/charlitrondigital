import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FakeStorageServer } from './portfolioFakeStorage';
import {
  createEmptyPortfolioDraft,
  type PortfolioImageAsset,
  type PortfolioProjectDraft,
} from './portfolioModel';
import {
  createStoragePortfolioRepository,
  isStorageNotFound,
  parseStoredDraft,
  publishedCurrentPath,
} from './portfolioStorageRepository';
import { parsePortfolioManifest } from '../projects/portfolioManifest';

const SLUG = 'charlitron-vet';
const DRAFTS = 'portfolio-drafts';
const PUBLISHED = 'portfolio-published';
const NOW = () => '2026-10-29T12:00:00.000Z';

function asset(id: string, alt = `Descripción ${id}`): PortfolioImageAsset {
  return {
    id,
    fileName: `${id}.png`,
    alt,
    order: 0,
    width: 1200,
    height: 800,
    webBlob: new Blob([`web-${id}`], { type: 'image/webp' }),
    thumbBlob: new Blob([`thumb-${id}`], { type: 'image/webp' }),
  };
}

function draftWith(cover: PortfolioImageAsset | null, gallery: PortfolioImageAsset[] = []): PortfolioProjectDraft {
  return {
    ...createEmptyPortfolioDraft(SLUG),
    cover,
    gallery: gallery.map((image, index) => ({ ...image, order: index })),
  };
}

function setup(role: 'admin' | 'user' | 'anon' = 'admin', server = new FakeStorageServer()) {
  return { server, repo: createStoragePortfolioRepository(server.client(role), NOW) };
}

test('a saved draft round-trips through the private bucket and never touches the public one', async () => {
  const { server, repo } = setup();
  const draft = draftWith(asset('cover-0001', 'Portada'), [asset('gal-0001', 'Uno'), asset('gal-0002', 'Dos')]);
  await repo.saveDraft(draft);

  assert.equal(server.uploads(PUBLISHED).length, 0);
  assert.ok(server.has(DRAFTS, `drafts/${SLUG}/draft.json`));

  const loaded = (await repo.loadProject(SLUG)).draft;
  assert.equal(loaded.cover?.alt, 'Portada');
  assert.deepEqual(loaded.gallery.map((image) => [image.id, image.alt, image.order]), [
    ['gal-0001', 'Uno', 0],
    ['gal-0002', 'Dos', 1],
  ]);
  assert.equal(await loaded.cover?.webBlob.text(), 'web-cover-0001');
  assert.equal(await loaded.gallery[1].thumbBlob.text(), 'thumb-gal-0002');
});

test('replacing and removing images deletes orphaned draft assets and keeps referenced ones', async () => {
  const { server, repo } = setup();
  await repo.saveDraft(draftWith(asset('cover-0001'), [asset('gal-0001'), asset('gal-0002')]));
  await repo.saveDraft(draftWith(asset('cover-0002'), [asset('gal-0002')]));

  const assets = server.keys(DRAFTS).filter((key) => key.includes('/assets/'));
  assert.deepEqual(
    assets.sort(),
    [
      `drafts/${SLUG}/assets/cover-0002-thumb.webp`,
      `drafts/${SLUG}/assets/cover-0002-web.webp`,
      `drafts/${SLUG}/assets/gal-0002-thumb.webp`,
      `drafts/${SLUG}/assets/gal-0002-web.webp`,
    ].sort(),
  );
});

test('publishing uploads immutable versioned files first and writes current.json last', async () => {
  const { server, repo } = setup();
  const saved = await repo.saveDraft(draftWith(asset('cover-0001', 'Portada'), [asset('gal-0001', 'Uno')]));
  const result = await repo.publish(saved.draft, NOW());

  assert.equal(result.published?.version, 1);
  const uploads = server.uploads(PUBLISHED);
  const last = uploads.at(-1);
  assert.equal(last?.path, publishedCurrentPath(SLUG));
  assert.equal(last?.upsert, true);
  const versioned = uploads.slice(0, -1);
  assert.ok(versioned.length > 0);
  assert.ok(versioned.every((entry) => entry.path.startsWith(`projects/${SLUG}/versions/1/`) && entry.upsert === false));

  const manifest = parsePortfolioManifest(
    JSON.parse(await server.read(PUBLISHED, publishedCurrentPath(SLUG))!.text()),
    SLUG,
  );
  assert.equal(manifest?.cover.alt, 'Portada');
  assert.equal(manifest?.gallery[0].path, `projects/${SLUG}/versions/1/gal-0001-web.webp`);
  assert.equal(await server.publicGet(PUBLISHED, publishedCurrentPath(SLUG)), 200);

  const second = await repo.publish(saved.draft, NOW());
  assert.equal(second.published?.version, 2);
  assert.ok(server.has(PUBLISHED, `projects/${SLUG}/versions/1/cover-0001-web.webp`));
});

test('a failure before current.json leaves the previous version live and removes partial files', async () => {
  const { server, repo } = setup();
  const saved = await repo.saveDraft(draftWith(asset('cover-0001'), [asset('gal-0001')]));
  await repo.publish(saved.draft, NOW());
  const liveBefore = await server.read(PUBLISHED, publishedCurrentPath(SLUG))!.text();

  server.failWhen = (op, bucket, path) =>
    op === 'upload' && bucket === PUBLISHED && path.endsWith('/gal-0001-thumb.webp') && path.includes('/versions/2/');
  await assert.rejects(() => repo.publish(saved.draft, NOW()), /injected failure/);

  assert.equal(await server.read(PUBLISHED, publishedCurrentPath(SLUG))!.text(), liveBefore);
  assert.deepEqual(server.keys(PUBLISHED).filter((key) => key.includes('/versions/2/')), []);
  assert.ok(server.has(PUBLISHED, `projects/${SLUG}/versions/1/cover-0001-web.webp`));
});

test('a failure writing current.json removes the unreferenced version and publishes nothing', async () => {
  const { server, repo } = setup();
  const saved = await repo.saveDraft(draftWith(asset('cover-0001')));
  server.failWhen = (op, _bucket, path) => op === 'upload' && path === publishedCurrentPath(SLUG);

  await assert.rejects(() => repo.publish(saved.draft, NOW()), /injected failure/);
  assert.equal(server.has(PUBLISHED, publishedCurrentPath(SLUG)), false);
  assert.deepEqual(server.keys(PUBLISHED), []);
});

test('a concurrent publisher that already wrote the next version is never overwritten or deleted', async () => {
  const { server, repo } = setup();
  const saved = await repo.saveDraft(draftWith(asset('cover-0001')));
  await repo.publish(saved.draft, NOW());
  const foreignPath = `projects/${SLUG}/versions/2/cover-0001-web.webp`;
  server.seed(PUBLISHED, foreignPath, 'foreign', 'image/webp');

  await assert.rejects(() => repo.publish(saved.draft, NOW()), /already exists/);
  assert.equal(await server.read(PUBLISHED, foreignPath)!.text(), 'foreign');
  const current = JSON.parse(await server.read(PUBLISHED, publishedCurrentPath(SLUG))!.text());
  assert.equal(current.version, 1);
});

test('publishing is refused without cover or ALT, and oversized WebP never reaches the network', async () => {
  const { server, repo } = setup();
  await assert.rejects(() => repo.publish(draftWith(null), NOW()), /imagen principal/);
  await assert.rejects(() => repo.publish(draftWith(asset('cover-0001', '')), NOW()), /ALT/);

  const oversized: PortfolioImageAsset = {
    ...asset('cover-0002'),
    webBlob: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/webp' }),
  };
  await assert.rejects(() => repo.saveDraft(draftWith(oversized)), /5 MiB/);
  assert.equal(server.log.length, 0);
});

test('anonymous and non-admin users cannot save or publish and leave no objects behind', async () => {
  for (const role of ['anon', 'user'] as const) {
    const { server, repo } = setup(role);
    await assert.rejects(() => repo.saveDraft(draftWith(asset('cover-0001'))), /row-level security/);
    await assert.rejects(() => repo.publish(draftWith(asset('cover-0001')), NOW()), /row-level security/);
    assert.deepEqual([...server.keys(DRAFTS), ...server.keys(PUBLISHED)], [], role);
  }
});

test('unknown projects and unsafe stored drafts are rejected', async () => {
  const { server, repo } = setup();
  await assert.rejects(() => repo.loadProject('../../etc'), /no encontrado/);
  await assert.rejects(() => repo.saveDraft({ ...draftWith(asset('cover-0001')), projectSlug: 'otro' }), /no encontrado/);

  server.seed(DRAFTS, `drafts/${SLUG}/draft.json`, '{"schemaVersion":2}');
  await assert.rejects(() => repo.loadProject(SLUG), /borrador guardado no es válido/);

  const valid = {
    schemaVersion: 1,
    projectSlug: SLUG,
    updatedAt: NOW(),
    cover: { id: 'cover-0001', fileName: 'a.png', alt: 'A', order: 0, width: 10, height: 10 },
    gallery: [],
  };
  assert.ok(parseStoredDraft(valid, SLUG));
  assert.equal(parseStoredDraft(valid, 'eventos-360'), null);
  assert.equal(parseStoredDraft({ ...valid, cover: { ...valid.cover, id: '../escape' } }, SLUG), null);
  assert.equal(parseStoredDraft({ ...valid, gallery: [valid.cover] }, SLUG), null);
  const nine = Array.from({ length: 9 }, (_, i) => ({ ...valid.cover, id: `gal-000${i}`, order: i }));
  assert.equal(parseStoredDraft({ ...valid, cover: null, gallery: nine }, SLUG), null);
});

test('only genuine not-found errors are treated as absent objects', () => {
  assert.equal(isStorageNotFound({ message: 'Object not found', status: 400, statusCode: '404' }), true);
  assert.equal(isStorageNotFound({ message: 'x', status: 404 }), true);
  assert.equal(isStorageNotFound({ message: 'Bucket not found', status: 404 }), false);
  assert.equal(isStorageNotFound({ message: 'injected failure', status: 500 }), false);
});

test('a read error on current.json aborts publishing instead of restarting at version 1', async () => {
  const { server, repo } = setup();
  const saved = await repo.saveDraft(draftWith(asset('cover-0001')));
  server.failWhen = (op, _bucket, path) => op === 'download' && path === publishedCurrentPath(SLUG);
  await assert.rejects(() => repo.publish(saved.draft, NOW()), /No se pudo leer/);
  assert.equal(server.uploads(PUBLISHED).length, 0);
});

test('publishing never triggers a production deploy: no network call outside Storage', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    throw new Error('publishing must not call fetch');
  };
  try {
    const { repo } = setup();
    const saved = await repo.saveDraft(draftWith(asset('cover-0001')));
    await repo.publish(saved.draft, NOW());
    assert.deepEqual(requested, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the publish flow has no code path to the redeploy endpoint or any deploy hook', () => {
  const sources = [
    'src/features/admin/portfolioStorageRepository.ts',
    'src/features/admin/portfolioRepository.ts',
    'src/features/admin/portfolioRepositoryFactory.ts',
    'src/features/admin/PortfolioAdmin.tsx',
  ].map((file) => [file, readFileSync(file, 'utf8')] as const);
  for (const [file, text] of sources) {
    assert.ok(!/redeploy-portfolio|redeploy-blog|requestBlogRedeploy|DEPLOY_HOOK|\/api\//.test(text), file);
    assert.ok(!/\bfetch\s*\(/.test(text), `${file} no debe llamar fetch directamente`);
  }
});

const PILOT = 'planeaslp-celebra-tu-evento';

function pilotRepo(guards: { publishEnabled: boolean; projectSlugs?: readonly string[] }) {
  const server = new FakeStorageServer();
  return { server, repo: createStoragePortfolioRepository(server.client('admin'), NOW, guards) };
}

test('with publishing disabled, saving a pilot draft works but publishing writes nothing and current.json is untouched', async () => {
  const { server, repo } = pilotRepo({ publishEnabled: false, projectSlugs: [PILOT] });
  const draft = { ...draftWith(asset('cover-0001', 'Portada')), projectSlug: PILOT };
  assert.equal(repo.canPublish, false);

  await repo.saveDraft(draft);
  const reloaded = (await repo.loadProject(PILOT)).draft;
  assert.equal(reloaded.cover?.alt, 'Portada');
  assert.equal(await reloaded.cover?.webBlob.text(), 'web-cover-0001');
  assert.deepEqual(server.uploads(PUBLISHED), []);

  const logBefore = server.log.length;
  await assert.rejects(() => repo.publish(reloaded, NOW()), /desactivada/);
  assert.equal(server.log.length, logBefore, 'publicar bloqueado no debe tocar Storage');
  assert.equal(server.has(PUBLISHED, publishedCurrentPath(PILOT)), false);
  assert.deepEqual(server.keys(PUBLISHED), []);
  assert.ok(server.log.filter((entry) => entry.op !== 'download' && entry.op !== 'list').every((entry) => entry.bucket === DRAFTS && entry.path.startsWith(`drafts/${PILOT}/`)));
});

test('the pilot restriction blocks every other project before any Storage call', async () => {
  const { server, repo } = pilotRepo({ publishEnabled: false, projectSlugs: [PILOT] });
  await assert.rejects(() => repo.loadProject(SLUG), /piloto/);
  await assert.rejects(() => repo.saveDraft(draftWith(asset('cover-0001'))), /piloto/);
  assert.equal(server.log.length, 0);
});

test('publishing stays available when the guards allow it', async () => {
  const { server, repo } = pilotRepo({ publishEnabled: true });
  const state = await repo.publish(draftWith(asset('cover-0001')), NOW());
  assert.equal(state.published?.version, 1);
  assert.ok(server.has(PUBLISHED, publishedCurrentPath(SLUG)));
});

test('the factory and panel wire the pilot guards and the publish button follows canPublish', () => {
  const factory = readFileSync('src/features/admin/portfolioRepositoryFactory.ts', 'utf8');
  assert.match(factory, /publishEnabled: __PORTFOLIO_PUBLISH_ENABLED__/);
  assert.match(factory, /__PORTFOLIO_PILOT_PROJECT__/);
  const panel = readFileSync('src/features/admin/PortfolioAdmin.tsx', 'utf8');
  assert.match(panel, /disabled=\{uploading \|\| publishBlocked\}/);
});
