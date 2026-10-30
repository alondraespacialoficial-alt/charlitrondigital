import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readPortfolioManifest,
  readPortfolioManifestWithRetry,
  loadPortfolioManifest,
} from './portfolioManifest';

const URL_BASE = 'https://fake-project.supabase.co';
const SLUG = 'charlitron-vet';

const manifest = {
  schemaVersion: 1,
  projectSlug: SLUG,
  version: 4,
  publishedAt: '2026-10-29T12:00:00.000Z',
  cover: { path: `projects/${SLUG}/versions/4/c-web.webp`, thumbPath: `projects/${SLUG}/versions/4/c-thumb.webp`, alt: 'Portada', order: 0, width: 1200, height: 800 },
  gallery: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const text = (body: string, status: number) => new Response(body, { status });

function sequence(...responses: Array<Response | Error>) {
  const queue = [...responses];
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (next instanceof Error) throw next;
    return next.clone();
  };
  return { fetcher, calls: () => calls };
}

const read = (...responses: Array<Response | Error>) => readPortfolioManifest(URL_BASE, SLUG, sequence(...responses).fetcher);

test('a valid manifest is returned as ok', async () => {
  const result = await read(json(manifest));
  assert.equal(result.status, 'ok');
  assert.equal(result.status === 'ok' && result.manifest.version, 4);
});

test('Storage saying the object does not exist is absent, in both response shapes', async () => {
  const notFound = { statusCode: '404', error: 'not_found', message: 'Object not found' };
  assert.deepEqual(await read(json(notFound, 404)), { status: 'absent' });
  assert.deepEqual(await read(json(notFound, 400)), { status: 'absent' });
  assert.deepEqual(await read(json({ statusCode: 404, error: 'Not found', message: 'Object not found' }, 404)), { status: 'absent' });
});

test('anything that is not an explicit object-not-found is an error, never absent', async () => {
  const cases: Array<[string, Response | Error, string]> = [
    ['bucket missing', json({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }, 404), 'http'],
    ['404 with an HTML page', text('<html>Not Found</html>', 404), 'http'],
    ['404 with empty body', text('', 404), 'http'],
    ['400 unrelated', json({ statusCode: '400', error: 'invalid', message: 'bad request' }, 400), 'http'],
    ['server error', text('upstream unavailable', 503), 'http'],
    ['rate limited', text('slow down', 429), 'http'],
    ['forbidden', json({ message: 'denied' }, 403), 'http'],
    ['network failure', new TypeError('fetch failed'), 'network'],
    ['truncated JSON', text('{"schemaVersion":1,"proj', 200), 'invalid-json'],
    ['HTML with 200', text('<html>maintenance</html>', 200), 'invalid-json'],
    ['wrong project', json({ ...manifest, projectSlug: 'eventos-360' }), 'invalid-manifest'],
    ['path traversal', json({ ...manifest, cover: { ...manifest.cover, path: '../private.webp' } }), 'invalid-manifest'],
    ['empty ALT', json({ ...manifest, cover: { ...manifest.cover, alt: ' ' } }), 'invalid-manifest'],
    ['JSON null', text('null', 200), 'invalid-manifest'],
  ];
  for (const [name, response, reason] of cases) {
    const result = await read(response);
    assert.equal(result.status, 'error', name);
    assert.equal(result.status === 'error' && result.reason, reason, name);
  }
});

test('the exact response Supabase returned for a missing manifest on 2026-10-29 is absent', async () => {
  const observed = '{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}';
  const response = new Response(observed, { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  assert.deepEqual(await read(response), { status: 'absent' });
});

test('http errors keep their status code for diagnosis', async () => {
  const result = await read(text('x', 503));
  assert.deepEqual(result.status === 'error' && result.httpStatus, 503);
});

test('retries recover from transient failures and stop after the configured attempts', async () => {
  const sleeps: number[] = [];
  const sleep = async (ms: number) => void sleeps.push(ms);

  const flaky = sequence(text('x', 503), new TypeError('fetch failed'), json(manifest));
  const recovered = await readPortfolioManifestWithRetry(URL_BASE, SLUG, { fetcher: flaky.fetcher, sleep, delayMs: 10 });
  assert.equal(recovered.status, 'ok');
  assert.equal(flaky.calls(), 3);
  assert.deepEqual(sleeps, [10, 20]);

  const down = sequence(text('x', 503));
  const failed = await readPortfolioManifestWithRetry(URL_BASE, SLUG, { fetcher: down.fetcher, sleep, attempts: 4 });
  assert.equal(failed.status, 'error');
  assert.equal(down.calls(), 4);
});

test('definitive results are never retried', async () => {
  const absent = sequence(json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 404));
  assert.equal((await readPortfolioManifestWithRetry(URL_BASE, SLUG, { fetcher: absent.fetcher, sleep: async () => {} })).status, 'absent');
  assert.equal(absent.calls(), 1);

  const ok = sequence(json(manifest));
  assert.equal((await readPortfolioManifestWithRetry(URL_BASE, SLUG, { fetcher: ok.fetcher, sleep: async () => {} })).status, 'ok');
  assert.equal(ok.calls(), 1);
});

test('the client loader keeps returning null on any non-ok result', async () => {
  assert.ok(await loadPortfolioManifest(URL_BASE, SLUG, sequence(json(manifest)).fetcher));
  assert.equal(await loadPortfolioManifest(URL_BASE, SLUG, sequence(text('x', 503)).fetcher), null);
  assert.equal(await loadPortfolioManifest(URL_BASE, SLUG, sequence(json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 404)).fetcher), null);
});
