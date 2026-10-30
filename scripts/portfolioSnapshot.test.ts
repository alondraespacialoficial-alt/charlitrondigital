import assert from 'node:assert/strict';
import test from 'node:test';
import { PortfolioSnapshotError, loadPortfolioSnapshot } from './portfolioSnapshot';

const BASE = 'https://fake-project.supabase.co';
const SLUGS = ['charlitron-vet', 'eventos-360', 'planeaslp-celebra-tu-evento', 'viajero-del-tiempo'];
const NOT_FOUND = { statusCode: '404', error: 'not_found', message: 'Object not found' };

const manifestFor = (slug: string, version = 2) => ({
  schemaVersion: 1,
  projectSlug: slug,
  version,
  publishedAt: '2026-10-29T12:00:00.000Z',
  cover: { path: `projects/${slug}/versions/${version}/c-web.webp`, thumbPath: `projects/${slug}/versions/${version}/c-thumb.webp`, alt: `Portada ${slug}`, order: 0, width: 1200, height: 800 },
  gallery: [],
});

function serverFor(handler: (slug: string, call: number) => Response) {
  const calls: Record<string, number> = {};
  const fetcher: typeof fetch = async (input) => {
    const slug = String(input).match(/projects\/([^/]+)\/current\.json/)![1];
    calls[slug] = (calls[slug] ?? 0) + 1;
    return handler(slug, calls[slug]);
  };
  return { fetcher, calls };
}

const run = (fetcher: typeof fetch, extra: object = {}) =>
  loadPortfolioSnapshot({ supabaseUrl: BASE, slugs: SLUGS, fetcher, sleep: async () => {}, ...extra });

test('all manifests published: every project gets absolute image URLs and ALT', async () => {
  const { fetcher } = serverFor((slug) => new Response(JSON.stringify(manifestFor(slug)), { status: 200 }));
  const images = await run(fetcher);
  assert.deepEqual(Object.keys(images), SLUGS);
  assert.equal(images['charlitron-vet'][0].src, `${BASE}/storage/v1/object/public/portfolio-published/projects/charlitron-vet/versions/2/c-web.webp`);
  assert.equal(images['charlitron-vet'][0].alt, 'Portada charlitron-vet');
});

test('absent manifests are valid: those projects simply have no images', async () => {
  const { fetcher } = serverFor((slug) =>
    slug === 'eventos-360' ? new Response(JSON.stringify(manifestFor(slug)), { status: 200 }) : new Response(JSON.stringify(NOT_FOUND), { status: 404 }),
  );
  const images = await run(fetcher);
  assert.deepEqual(Object.keys(images), ['eventos-360']);
});

test('a transient failure that recovers within the retries still yields the snapshot', async () => {
  const { fetcher, calls } = serverFor((slug, call) =>
    slug === 'charlitron-vet' && call < 3 ? new Response('unavailable', { status: 503 }) : new Response(JSON.stringify(manifestFor(slug)), { status: 200 }),
  );
  const images = await run(fetcher);
  assert.equal(calls['charlitron-vet'], 3);
  assert.equal(Object.keys(images).length, 4);
});

test('a persistent failure stops the snapshot and reports every failing project', async () => {
  const { fetcher } = serverFor((slug) => {
    if (slug === 'charlitron-vet') return new Response('unavailable', { status: 503 });
    if (slug === 'viajero-del-tiempo') return new Response('{broken', { status: 200 });
    return new Response(JSON.stringify(manifestFor(slug)), { status: 200 });
  });
  await assert.rejects(
    () => run(fetcher),
    (error: unknown) => {
      assert.ok(error instanceof PortfolioSnapshotError);
      assert.deepEqual(error.failures.map((failure) => [failure.slug, failure.reason]), [
        ['charlitron-vet', 'http'],
        ['viajero-del-tiempo', 'invalid-json'],
      ]);
      assert.match(error.message, /Se detiene el build/);
      return true;
    },
  );
});

test('a project that was published is never downgraded to absent by a read error', async () => {
  const { fetcher } = serverFor(() => new Response('gateway timeout', { status: 504 }));
  await assert.rejects(() => run(fetcher), PortfolioSnapshotError);
});

test('activated media reads without a Supabase URL fail instead of silently using placeholders', async () => {
  await assert.rejects(
    () => loadPortfolioSnapshot({ supabaseUrl: undefined, slugs: SLUGS }),
    (error: unknown) => error instanceof PortfolioSnapshotError && error.failures[0].reason === 'config',
  );
});

test('the log makes each decision traceable', async () => {
  const lines: string[] = [];
  const { fetcher } = serverFor((slug) =>
    slug === 'charlitron-vet' ? new Response(JSON.stringify(manifestFor(slug, 7)), { status: 200 }) : new Response(JSON.stringify(NOT_FOUND), { status: 404 }),
  );
  await run(fetcher, { log: (line: string) => lines.push(line) });
  assert.ok(lines.some((line) => /charlitron-vet: versión 7 \(1 imagen/.test(line)));
  assert.ok(lines.some((line) => /eventos-360: sin versión publicada/.test(line)));
});
