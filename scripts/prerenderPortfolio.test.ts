// Ejecuta scripts/prerender.ts como proceso real contra un servidor HTTP local que imita Storage.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';

const REPO = process.cwd();
const SLUGS = ['charlitron-vet', 'eventos-360', 'planeaslp-celebra-tu-evento', 'viajero-del-tiempo'];
const NOT_FOUND = JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' });
const SITE = 'https://www.charlitrondigital.com';
const PRODUCTION = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_REF: 'main',
  PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true',
};

type Reply = { status: number; body: string };
let handler: (slug: string, call: number) => Reply = () => ({ status: 404, body: NOT_FOUND });
const calls: Record<string, number> = {};
let articleRequests = 0;
let articlesStatus = 200;
let server: Server;
let base = '';
let workDir = '';

const manifestFor = (slug: string, version = 3) => ({
  schemaVersion: 1,
  projectSlug: slug,
  version,
  publishedAt: '2026-10-29T12:00:00.000Z',
  cover: { path: `projects/${slug}/versions/${version}/cover-web.webp`, thumbPath: `projects/${slug}/versions/${version}/cover-thumb.webp`, alt: `Captura de ${slug} & "demo"`, order: 0, width: 1280, height: 720 },
  gallery: [
    { path: `projects/${slug}/versions/${version}/g1-web.webp`, thumbPath: `projects/${slug}/versions/${version}/g1-thumb.webp`, alt: `Detalle de ${slug}`, order: 0, width: 1000, height: 600 },
  ],
});
const ok = (slug: string): Reply => ({ status: 200, body: JSON.stringify(manifestFor(slug)) });
const absent = (): Reply => ({ status: 404, body: NOT_FOUND });

before(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '';
    const match = url.match(/\/projects\/([^/]+)\/current\.json/);
    if (match) {
      const slug = match[1];
      calls[slug] = (calls[slug] ?? 0) + 1;
      const reply = handler(slug, calls[slug]);
      response.writeHead(reply.status, { 'content-type': 'application/json' }).end(reply.body);
      return;
    }
    if (url.startsWith('/rest/v1/articles')) articleRequests += 1;
    response.writeHead(articlesStatus, { 'content-type': 'application/json' }).end(articlesStatus === 200 ? '[]' : 'articles unavailable');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const key of Object.keys(calls)) delete calls[key];
  articleRequests = 0;
  articlesStatus = 200;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = mkdtempSync(path.join(tmpdir(), 'prerender-'));
  mkdirSync(path.join(workDir, 'dist'));
  cpSync(path.join(REPO, 'index.html'), path.join(workDir, 'dist', 'index.html'));
});

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const read = (relative: string) => readFileSync(path.join(workDir, 'dist', relative), 'utf8');

async function prerender(env: Record<string, string>, supabaseUrl = base) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(VERCEL|VITE_|PORTFOLIO_|NODE_OPTIONS)/.test(key)),
  ) as Record<string, string>;
  const child = spawn(path.join(REPO, 'node_modules/.bin/tsx'), [path.join(REPO, 'scripts/prerender.ts')], {
    cwd: workDir,
    env: {
      ...clean,
      VITE_SITE_URL: SITE,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      PORTFOLIO_PRERENDER_RETRY_DELAY_MS: '0',
      ...env,
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  return { code, stdout, stderr };
}

function head(html: string, key: string, attribute: 'property' | 'name' = 'property'): string | undefined {
  return html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1];
}

function jsonLd(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]))
    .flat();
}

test('success: HTML, og:image, twitter:image, JSON-LD and canonical all use the published cover', async () => {
  handler = (slug) => ok(slug);
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 0, result.stderr);

  for (const slug of SLUGS) {
    const html = read(`proyectos/${slug}/index.html`);
    const cover = `${base}/storage/v1/object/public/portfolio-published/projects/${slug}/versions/3/cover-web.webp`;
    assert.equal(head(html, 'og:image'), cover, slug);
    assert.equal(head(html, 'twitter:image', 'name'), cover, slug);
    assert.equal(head(html, 'og:image:secure_url'), cover, slug);
    assert.equal(head(html, 'og:image:width'), '1280', slug);
    assert.equal(head(html, 'og:image:height'), '720', slug);
    assert.match(head(html, 'og:image:alt') ?? '', /Captura de .* &amp; &quot;demo&quot;/, slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/proyectos/${slug}" />`), slug);
    assert.equal(head(html, 'og:url'), `${SITE}/proyectos/${slug}`, slug);
    assert.ok(html.includes(`<img src="${cover}"`), slug);
    assert.ok(html.includes(`g1-web.webp`), 'galería');
    assert.ok(!html.includes('Captura auténtica autorizada pendiente'), slug);
    const work = jsonLd(html).find((entry) => entry['@type'] === 'CreativeWork');
    assert.equal(work?.image, cover, slug);
    assert.equal(work?.url, `${SITE}/proyectos/${slug}`, slug);
    assert.ok(jsonLd(html).some((entry) => entry['@type'] === 'BreadcrumbList'), slug);
  }
  const home = read('index.html');
  for (const slug of SLUGS) assert.ok(home.includes(`/projects/${slug}/versions/3/cover-web.webp`), `home ${slug}`);
  const sitemap = read('sitemap.xml');
  for (const slug of SLUGS) assert.ok(sitemap.includes(`<loc>${SITE}/proyectos/${slug}</loc>`), slug);
  for (const file of ['blog/index.html', 'agencia/index.html', 'agencia/casos/index.html']) assert.ok(existsSync(path.join(workDir, 'dist', file)), file);
  assert.match(result.stdout, /charlitron-vet: versión 3/);
});

test('absent manifests (404 and 400 forms): placeholder, default og:image, canonical intact, build succeeds', async () => {
  handler = (slug) => (slug === 'eventos-360' ? { status: 400, body: NOT_FOUND } : absent());
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 0, result.stderr);

  for (const slug of SLUGS) {
    const html = read(`proyectos/${slug}/index.html`);
    assert.ok(html.includes('Captura auténtica autorizada pendiente'), slug);
    assert.equal(head(html, 'og:image'), `${SITE}/og-default.png`, slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/proyectos/${slug}" />`), slug);
    const work = jsonLd(html).find((entry) => entry['@type'] === 'CreativeWork');
    assert.equal(work?.image, undefined, slug);
  }
  assert.match(result.stdout, /sin versión publicada/);
});

test('a mix of published and never-published projects renders each one correctly', async () => {
  handler = (slug) => (slug === 'viajero-del-tiempo' ? ok(slug) : absent());
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(read('proyectos/viajero-del-tiempo/index.html').includes('cover-web.webp'));
  assert.ok(read('proyectos/charlitron-vet/index.html').includes('Captura auténtica autorizada pendiente'));
});

test('a transient HTTP failure is retried and the snapshot is still produced', async () => {
  handler = (slug, call) => (slug === 'charlitron-vet' && call < 3 ? { status: 503, body: 'unavailable' } : ok(slug));
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(calls['charlitron-vet'], 3);
  assert.ok(read('proyectos/charlitron-vet/index.html').includes('cover-web.webp'));
});

const failureCases: Array<[string, (slug: string) => Reply, RegExp]> = [
  ['HTTP failure', (slug) => (slug === 'charlitron-vet' ? { status: 503, body: 'unavailable' } : ok(slug)), /charlitron-vet: http HTTP 503/],
  ['invalid JSON', (slug) => (slug === 'eventos-360' ? { status: 200, body: '{"schemaVersion":1,' } : ok(slug)), /eventos-360: invalid-json/],
  ['HTML maintenance page', (slug) => (slug === 'viajero-del-tiempo' ? { status: 200, body: '<html>maintenance</html>' } : ok(slug)), /viajero-del-tiempo: invalid-json/],
  ['manifest for another project', (slug) => (slug === 'charlitron-vet' ? ok('eventos-360') : ok(slug)), /charlitron-vet: invalid-manifest/],
  ['bucket not found', (slug) => (slug === 'charlitron-vet' ? { status: 404, body: JSON.stringify({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }) } : ok(slug)), /charlitron-vet: http HTTP 404/],
];

for (const [name, reply, expected] of failureCases) {
  test(`failure (${name}): build exits 1, writes nothing and keeps the previous output untouched`, async () => {
    const templateBefore = sha(path.join(workDir, 'dist', 'index.html'));
    const filesBefore = listFiles(path.join(workDir, 'dist'));
    handler = reply;

    const result = await prerender(PRODUCTION);

    assert.equal(result.code, 1, result.stdout + result.stderr);
    assert.match(result.stderr + result.stdout, expected);
    assert.match(result.stderr, /Se detiene el build/);
    assert.deepEqual(listFiles(path.join(workDir, 'dist')), filesBefore);
    assert.equal(sha(path.join(workDir, 'dist', 'index.html')), templateBefore);
    assert.ok(!existsSync(path.join(workDir, 'dist', 'proyectos')));
    assert.ok(!existsSync(path.join(workDir, 'dist', 'sitemap.xml')));
  });
}

test('a persistent failure does not turn a published project into a placeholder: nothing is generated', async () => {
  handler = () => ({ status: 502, body: 'bad gateway' });
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 1);
  assert.deepEqual(listFiles(path.join(workDir, 'dist')), ['index.html']);
  assert.equal(calls['charlitron-vet'], 3, 'agota los reintentos antes de detenerse');
});

test('unreachable Supabase fails the build instead of rendering placeholders', async () => {
  const result = await prerender(PRODUCTION, 'http://127.0.0.1:1');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /network/);
  assert.deepEqual(listFiles(path.join(workDir, 'dist')), ['index.html']);
});

test('media enabled without a Supabase URL fails with a configuration error', async () => {
  const result = await prerender(PRODUCTION, '');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /falta VITE_SUPABASE_URL/);
});

for (const [name, env] of [
  ['flag not set (merge is inert)', { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }],
  ['Preview with the flag', { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main', PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true' }],
  ['other branch with the flag', { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'otra', PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true' }],
  ['local build with the flag', { PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true' }],
] as const) {
  test(`no manifest is requested and a failing Storage cannot break the build (${name})`, async () => {
    handler = () => ({ status: 503, body: 'unavailable' });
    const result = await prerender({ ...env });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(calls, {});
    assert.ok(read('proyectos/charlitron-vet/index.html').includes('Captura auténtica autorizada pendiente'));
  });
}

test('the blog tolerant behaviour is unchanged: a failing articles request does not stop the build', async () => {
  articlesStatus = 500;
  handler = (slug) => ok(slug);
  const result = await prerender(PRODUCTION);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(articleRequests >= 1);
  assert.match(result.stderr + result.stdout, /no se pudieron leer artículos/);
  assert.ok(existsSync(path.join(workDir, 'dist', 'blog', 'index.html')));
  assert.ok(read('proyectos/charlitron-vet/index.html').includes('cover-web.webp'));
});
