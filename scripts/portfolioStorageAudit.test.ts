import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeStorageServer, type FakeOverrides } from '../src/features/admin/portfolioFakeStorage';
import { runPortfolioStorageAudit } from './portfolioStorageAudit';

async function audit(overrides: FakeOverrides = {}) {
  const server = new FakeStorageServer(overrides);
  const results = await runPortfolioStorageAudit({
    anon: server.client('anon'),
    user: server.client('user'),
    admin: server.client('admin'),
    publicGet: (bucket, path) => server.publicGet(bucket, path),
    runId: 'test-run',
  });
  return { server, results, failed: results.filter((result) => !result.passed) };
}

test('the audit passes against the approved policy model and cleans up after itself', async () => {
  const { server, results, failed } = await audit();
  assert.deepEqual(failed, []);
  assert.equal(results.length, 28);
  assert.deepEqual([...server.keys('portfolio-drafts'), ...server.keys('portfolio-published')], []);
  assert.ok(server.log.filter((entry) => entry.role !== 'admin').every((entry) => entry.path.startsWith('_audit/')));
});

test('the audit flags public write access', async () => {
  const { failed } = await audit({ anonCanWrite: true });
  assert.ok(failed.some((result) => /anónimo no sube a publicados/.test(result.name)));
  assert.ok(failed.some((result) => /anónimo no borra nada|anónimo no reemplaza/.test(result.name)));
});

test('the audit flags a non-admin who can read private drafts', async () => {
  const { failed } = await audit({ userCanReadDrafts: true });
  assert.ok(failed.some((result) => result.name === 'autenticado no admin no lee borradores'));
});

test('the audit flags a public drafts bucket', async () => {
  const { failed } = await audit({ draftsArePublic: true });
  assert.deepEqual(failed.map((result) => result.name), ['URL pública de borradores no responde 200']);
});

test('the audit cleans up even when a check fails midway', async () => {
  const server = new FakeStorageServer();
  server.failWhen = (op, bucket) => op === 'download' && bucket === 'portfolio-drafts';
  const results = await runPortfolioStorageAudit({
    anon: server.client('anon'),
    user: server.client('user'),
    admin: server.client('admin'),
    publicGet: (bucket, path) => server.publicGet(bucket, path),
    runId: 'test-run',
  });
  assert.ok(results.some((result) => !result.passed));
  assert.deepEqual([...server.keys('portfolio-drafts'), ...server.keys('portfolio-published')], []);
});
