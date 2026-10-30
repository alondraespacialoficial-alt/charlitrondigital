import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FakeStorageServer, type FakeOverrides } from '../src/features/admin/portfolioFakeStorage';
import { AuditScopeError, checkAnonKey, PILOT_PENDING, PILOT_WEBP, runPortfolioStoragePilot } from './portfolioStorageAudit';

const RUN = 'pilot-run';
const BUCKETS = ['portfolio-drafts', 'portfolio-published'];

function seeded(overrides: FakeOverrides = {}) {
  const server = new FakeStorageServer(overrides);
  server.seed('portfolio-published', 'projects/charlitron-vet/current.json', '{"version":3}');
  server.seed('portfolio-published', 'projects/charlitron-vet/versions/3/cover-0001-web.webp', 'real-image-bytes', 'image/webp');
  server.seed('portfolio-drafts', 'drafts/eventos-360/draft.json', '{"schemaVersion":1}');
  return server;
}

function run(server: FakeStorageServer, runId = RUN) {
  return runPortfolioStoragePilot({
    anon: server.client('anon'),
    admin: server.client('admin'),
    publicRead: (bucket, path) => server.publicRead(bucket, path),
    runId,
  });
}

async function snapshot(server: FakeStorageServer) {
  const entries: Record<string, string> = {};
  for (const bucket of BUCKETS) {
    for (const key of server.keys(bucket)) entries[`${bucket}/${key}`] = await server.read(bucket, key)!.text();
  }
  return entries;
}

test('the pilot test image is a real WebP file', () => {
  assert.equal(new TextDecoder().decode(PILOT_WEBP.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(PILOT_WEBP.slice(8, 12)), 'WEBP');
});

test('the pilot passes on correctly configured Storage and leaves no trace', async () => {
  const server = seeded();
  const before = await snapshot(server);
  const results = await run(server);

  assert.deepEqual(results.filter((result) => !result.passed), []);
  for (const topic of ['sube la imagen WebP', 'lee el borrador', 'publica la imagen', 'persistencia', 'elimina', 'limpieza', 'anónimo no sube', 'anónimo no reemplaza', 'anónimo no lee']) {
    assert.ok(results.some((result) => result.name.includes(topic)), `falta comprobar: ${topic}`);
  }
  assert.deepEqual(await snapshot(server), before);
});

test('the pilot never involves a non-admin authenticated role', async () => {
  const server = seeded();
  await run(server);
  assert.deepEqual([...new Set(server.log.map((entry) => entry.role))].sort(), ['admin', 'anon']);
  assert.match(PILOT_PENDING, /PENDIENTE/);
});

test('every pilot attempt targets only _audit/<runId>/ in the two buckets', async () => {
  const server = seeded();
  await run(server);
  assert.ok(server.log.length > 0);
  for (const entry of server.log) {
    assert.ok(BUCKETS.includes(entry.bucket), `${entry.role} ${entry.op} ${entry.bucket}`);
    const inScope = entry.op === 'list' ? entry.path === `_audit/${RUN}` : entry.path.startsWith(`_audit/${RUN}/`);
    assert.ok(inScope, `${entry.role} ${entry.op} ${entry.path}`);
  }
});

test('public write access for anonymous sessions is detected, real files stay intact and temporary objects are removed', async () => {
  const server = seeded({ anonCanWrite: true });
  const before = await snapshot(server);
  const results = await run(server);

  const failures = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failures.some((name) => name.startsWith('anónimo no sube')), failures.join(' | '));
  assert.ok(failures.some((name) => name.startsWith('anónimo no reemplaza')), failures.join(' | '));
  assert.ok(failures.some((name) => name.startsWith('persistencia')), failures.join(' | '));
  assert.equal(results.find((result) => result.name.startsWith('limpieza'))?.passed, true);
  assert.deepEqual(await snapshot(server), before);
});

test('public drafts are detected', async () => {
  const results = await run(seeded({ draftsArePublic: true }));
  assert.ok(results.some((result) => !result.passed && result.name === 'el borrador no es público'));
});

test('a failure while publishing is reported and the temporary draft is still removed', async () => {
  const server = seeded();
  server.failWhen = (op, bucket) => op === 'upload' && bucket === 'portfolio-published';
  const results = await run(server);
  assert.ok(results.some((result) => !result.passed && /publica/.test(result.name)));
  assert.deepEqual(server.keys('portfolio-drafts').filter((key) => key.startsWith('_audit/')), []);
});

test('malformed run ids are refused before any Storage call', async () => {
  for (const runId of ['', '../x', 'a/b', 'short', 'x'.repeat(41)]) {
    const server = seeded();
    await assert.rejects(() => run(server, runId), AuditScopeError, runId);
    assert.equal(server.log.length, 0, runId);
  }
});

test('the CLI states that the pilot is partial and never reports it as the complete audit', () => {
  const cli = readFileSync('scripts/portfolioStorageAuditCli.ts', 'utf8');
  assert.match(cli, /PILOTO PARCIAL/);
  assert.match(cli, /NO es la auditor\u00eda completa/);
  assert.match(cli, /PENDIENTE: \$\{PILOT_PENDING\}/);
});

const jwt = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.firma`;

test('only the anonymous key of the expected project is accepted', () => {
  const ref = 'rvvqhpbtqgjpzflopflv';
  assert.equal(checkAnonKey(jwt({ role: 'anon', ref }), ref).ok, true);
  assert.equal(checkAnonKey('sb_publishable_abc', ref).ok, true);
  assert.equal(checkAnonKey(jwt({ role: 'service_role', ref }), ref).ok, false);
  assert.equal(checkAnonKey(jwt({ role: 'anon', ref: 'otroproyecto' }), ref).ok, false);
  assert.equal(checkAnonKey('sb_secret_abc', ref).ok, false);
  assert.equal(checkAnonKey('no-es-una-clave', ref).ok, false);
  assert.equal(checkAnonKey('a.%%%.c', ref).ok, false);
  assert.ok(!checkAnonKey(jwt({ role: 'service_role', ref }), ref).detail.includes('firma'));
});

test('cleanup is also verified by an independent listing and flags what remains', async () => {
  const clean = await run(seeded());
  assert.equal(clean.find((result) => result.name.includes('listado'))?.passed, true);

  const server = seeded();
  const original = server.client('admin');
  let failedRemoval = true;
  const admin = {
    from: (bucket: string) => {
      const api = original.from(bucket);
      return { ...api, remove: (paths: string[]) => (failedRemoval && bucket === 'portfolio-drafts' ? Promise.resolve({ error: null }) : api.remove(paths)) };
    },
  };
  const results = await runPortfolioStoragePilot({ anon: server.client('anon'), admin, publicRead: (b, p) => server.publicRead(b, p), runId: RUN });
  failedRemoval = false;
  assert.equal(results.find((result) => result.name.includes('listado'))?.passed, false);
  assert.equal(results.find((result) => result.name.startsWith('limpieza: no queda'))?.passed, false);
});

test('the CLI validates project and key before asking for credentials and offers a no-network preflight', () => {
  const cli = readFileSync('scripts/portfolioStorageAuditCli.ts', 'utf8');
  assert.ok(cli.indexOf('resolveEnvironment();') < cli.indexOf("signedInClient(url, anonKey, 'ADMINISTRADORA')"));
  assert.match(cli, /--preflight/);
});
