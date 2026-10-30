import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FakeStorageServer, type FakeOverrides } from '../src/features/admin/portfolioFakeStorage';
import {
  assertAuditPath,
  assertAuditPrefix,
  AuditScopeError,
  runPortfolioStorageAudit,
  scopeAuditClient,
} from './portfolioStorageAudit';

const RUN = 'test-run';
const BUCKETS = ['portfolio-drafts', 'portfolio-published'];

const REAL_FILES: Array<[string, string, string]> = [
  ['portfolio-published', 'projects/charlitron-vet/current.json', '{"version":3}'],
  ['portfolio-published', 'projects/charlitron-vet/versions/3/cover-0001-web.webp', 'real-image-bytes'],
  ['portfolio-published', 'projects/viajero-del-tiempo/current.json', '{"version":1}'],
  ['portfolio-drafts', 'drafts/charlitron-vet/draft.json', '{"schemaVersion":1}'],
  ['portfolio-drafts', 'drafts/eventos-360/assets/img-0001-web.webp', 'draft-bytes'],
  ['portfolio-published', '_auditor/real-looking.json', 'similar-prefix'],
];

function seeded(overrides: FakeOverrides = {}) {
  const server = new FakeStorageServer(overrides);
  for (const [bucket, path, body] of REAL_FILES) server.seed(bucket, path, body);
  return server;
}

function run(server: FakeStorageServer, runId = RUN) {
  return runPortfolioStorageAudit({
    anon: server.client('anon'),
    user: server.client('user'),
    admin: server.client('admin'),
    publicGet: (bucket, path) => server.publicGet(bucket, path),
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

test('the scope guard accepts only paths under _audit/<runId>/ in the two portfolio buckets', () => {
  assert.doesNotThrow(() => assertAuditPath('portfolio-published', `_audit/${RUN}/probe.json`, RUN));
  assert.doesNotThrow(() => assertAuditPrefix('portfolio-drafts', `_audit/${RUN}`, RUN));

  const rejectedPaths = [
    'projects/charlitron-vet/current.json',
    'drafts/charlitron-vet/draft.json',
    `_audit/otra-corrida/probe.json`,
    `_audit/${RUN}`,
    `_audit/${RUN}/`,
    `_audit/${RUN}/../projects/charlitron-vet/current.json`,
    `_audit/${RUN}/./x.json`,
    `_audit/${RUN}//x.json`,
    `_audit/${RUN}\\x.json`,
    `_auditor/${RUN}/probe.json`,
    `/_audit/${RUN}/probe.json`,
  ];
  for (const path of rejectedPaths) {
    assert.throws(() => assertAuditPath('portfolio-published', path, RUN), AuditScopeError, path);
  }
  assert.throws(() => assertAuditPath('article-images', `_audit/${RUN}/probe.json`, RUN), AuditScopeError);
  assert.throws(() => assertAuditPrefix('portfolio-published', '', RUN), AuditScopeError);
  assert.throws(() => assertAuditPrefix('portfolio-published', 'projects', RUN), AuditScopeError);
  assert.throws(() => assertAuditPrefix('article-images', `_audit/${RUN}`, RUN), AuditScopeError);
});

test('a scoped client rejects out-of-scope upload, download, remove and list before reaching Storage', async () => {
  const server = seeded();
  const scoped = scopeAuditClient(server.client('admin'), RUN);
  const target = scoped.from('portfolio-published');

  assert.throws(() => target.upload('projects/charlitron-vet/current.json', new Blob(['x']), { contentType: 'application/json', cacheControl: '0', upsert: true }), AuditScopeError);
  assert.throws(() => target.download('projects/charlitron-vet/current.json'), AuditScopeError);
  assert.throws(() => target.remove([`_audit/${RUN}/ok.json`, 'projects/charlitron-vet/current.json']), AuditScopeError);
  assert.throws(() => target.list('projects/charlitron-vet'), AuditScopeError);
  const blogImages = scoped.from('article-images');
  assert.throws(() => blogImages.upload(`_audit/${RUN}/x.json`, new Blob(['x']), { contentType: 'application/json', cacheControl: '0', upsert: true }), AuditScopeError);
  assert.throws(() => blogImages.remove([`_audit/${RUN}/x.json`]), AuditScopeError);
  assert.equal(server.log.length, 0);
});

test('malformed run ids are refused before any Storage call', async () => {
  for (const runId of ['', '../x', 'a/b', 'short', 'x'.repeat(41), 'con espacio', '-empieza-con-guion']) {
    const server = seeded();
    await assert.rejects(() => run(server, runId), AuditScopeError, runId);
    assert.equal(server.log.length, 0, runId);
  }
});

test('every attempt by every role targets only _audit/<runId>/ in the two buckets', async () => {
  const server = seeded();
  await run(server);
  assert.ok(server.log.length > 0);
  for (const entry of server.log) {
    assert.ok(BUCKETS.includes(entry.bucket), `${entry.role} ${entry.op} ${entry.bucket}`);
    const inScope = entry.op === 'list' ? entry.path === `_audit/${RUN}` : entry.path.startsWith(`_audit/${RUN}/`);
    assert.ok(inScope, `${entry.role} ${entry.op} ${entry.path}`);
  }
});

test('existing project files are byte-identical after a correct audit', async () => {
  const server = seeded();
  const before = await snapshot(server);
  const results = await run(server);
  assert.deepEqual(results.filter((result) => !result.passed), []);
  assert.deepEqual(await snapshot(server), before);
});

test('even a badly misconfigured Storage (public writes, no limits) cannot make the audit touch real files', async () => {
  const server = seeded({ anonCanWrite: true, limitsDisabled: true, userCanReadDrafts: true, draftsArePublic: true });
  const before = await snapshot(server);
  const results = await run(server);

  assert.ok(results.filter((result) => !result.passed).length >= 4, 'la mala configuración debe detectarse');
  assert.deepEqual(await snapshot(server), before);
  const cleanup = results.find((result) => result.name === 'limpieza de objetos de prueba');
  assert.equal(cleanup?.passed, true, 'los objetos de prueba aceptados por error también se borran');
});

test('objects accepted by mistake because limits are off are flagged and still removed', async () => {
  const server = seeded({ limitsDisabled: true });
  const results = await run(server);
  assert.ok(results.some((result) => !result.passed && /MIME|5 MiB/.test(result.name)));
  assert.deepEqual(
    [...server.keys('portfolio-published'), ...server.keys('portfolio-drafts')].filter((key) => key.startsWith('_audit/')),
    [],
  );
});

test('the audit sources never create, change or delete users, tables, policies or buckets', () => {
  const sources = ['scripts/portfolioStorageAudit.ts', 'scripts/portfolioStorageAuditCli.ts'].map((file) => [file, readFileSync(file, 'utf8')] as const);
  const forbidden = [
    '.insert(', '.update(', '.upsert(', '.delete(', '.rpc(', 'auth.admin', '.signUp(', 'updateUser(', 'createUser',
    'deleteUser', 'resetPasswordForEmail', 'inviteUserByEmail', 'createBucket', 'deleteBucket', 'updateBucket', 'emptyBucket',
    'CREATE POLICY', 'DROP POLICY', 'ALTER TABLE', 'service_role', 'SERVICE_ROLE',
  ];
  for (const [file, text] of sources) {
    for (const token of forbidden) assert.ok(!text.includes(token), `${file} contiene ${token}`);
  }
  const cli = sources[1][1];
  const tables = [...cli.matchAll(/\.from\('([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(tables)], ['admin_users']);
  assert.ok(!/admin_users'\)\.(?!select)/.test(cli));
});
