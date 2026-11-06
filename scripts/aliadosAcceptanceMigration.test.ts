import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { LEGAL_DOCUMENTS, canonicalLegalContent } from '../src/features/aliados/aliadosLegal';
import { LEGAL_SEED_PATH, buildLegalSeedSql, legalDigest } from './aliadosLegalSeed';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const migration = read('../supabase/proposals/aliados-lab-0006-acceptance.sql');
const rollback = read('../supabase/proposals/aliados-lab-0006-acceptance-rollback.sql');
const seed = readFileSync(LEGAL_SEED_PATH, 'utf8');
const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, '');

test('0007 esta al dia con aliadosLegal.ts (si falla: npm run generate:aliados-legal-seed)', () => {
  assert.equal(seed, buildLegalSeedSql());
});

test('0007 guarda el texto canonico completo y la huella SHA-256 de cada version, y no registra aceptaciones', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    assert.ok(seed.includes(`$legal$${canonicalLegalContent(doc)}$legal$`), `${doc.type} v${doc.version}: texto completo`);
    assert.ok(seed.includes(`'${legalDigest(doc)}'`), `${doc.type} v${doc.version}: huella`);
    assert.match(legalDigest(doc), /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(LEGAL_DOCUMENTS.map((doc) => `${doc.type}:${doc.version}`), ['terms:1.0', 'privacy:1.2']);
  assert.equal(/INSERT INTO public\.ally_acceptances/.test(seed), false);
});

test('0006: la unica escritura de evidencia esta dentro de ally_accept_terms', () => {
  const sql = stripComments(migration);
  assert.equal((sql.match(/INSERT INTO public\.ally_acceptances/g) ?? []).length, 1);
  const fn = /CREATE FUNCTION public\.ally_accept_terms[\s\S]*?\$fn\$;/.exec(sql)?.[0] ?? '';
  assert.match(fn, /INSERT INTO public\.ally_acceptances/);
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /SECURITY DEFINER/);
  // La fecha la pone el servidor (default de la columna), no un parametro.
  assert.match(sql, /accepted_at\s+timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
  assert.equal(/p_user|p_accepted_at|p_source|p_action/.test(sql), false);
});

test('0006: no abre el registro publico, no toca porcentajes ni funciones de administracion o comisiones', () => {
  for (const sql of [stripComments(migration), stripComments(rollback), stripComments(seed)]) {
    assert.equal(/registration_open\s*=\s*true|UPDATE\s+public\.aliados_settings|INSERT INTO public\.aliados_settings/i.test(sql), false);
    if (sql !== stripComments(seed)) assert.equal(/percent|porcentaje|%\s*de comisi/i.test(sql), false);
    assert.equal(/INSERT INTO public\.(commissions|sales|payments|commission_payments|referrals)\b/.test(sql.replace(/CREATE OR REPLACE FUNCTION public\.submit_referral[\s\S]*?\$fn\$;/, '')), false);
  }
  const sql = stripComments(migration);
  const replaced = [...sql.matchAll(/CREATE OR REPLACE (FUNCTION|VIEW) (public\.\w+)/g)].map((match) => match[2]);
  assert.deepEqual(replaced.sort(), ['public.ally_my_commission_payments', 'public.ally_my_commissions', 'public.ally_my_referrals', 'public.submit_referral']);
  assert.equal(/admin_(assign|authorize|pay|record|correct|reverse|set)_\w+\s*\(/.test(sql), false, 'no redefine funciones administrativas');
});

test('0006: bloquea las vistas del aliado y submit_referral sin aceptacion vigente, y mantiene los permisos', () => {
  const sql = stripComments(migration);
  // 3 vistas ally_my_*, submit_referral y ally_acceptance_state.
  assert.equal((sql.match(/EXISTS \(SELECT 1 FROM public\.ally_current_acceptance\)/g) ?? []).length, 5);
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM public\.ally_current_acceptance\) THEN\s+RAISE EXCEPTION 'Debes aceptar/);
  assert.match(sql, /REVOKE ALL ON public\.ally_legal_documents, public\.ally_acceptances FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ally_accept_terms\(text, text, boolean, boolean\) FROM PUBLIC, anon, authenticated/);
  assert.equal(/GRANT[^;]*TO[^;]*\banon\b/i.test(sql), false, 'nada se otorga a anon');
  assert.equal(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*ally_(acceptances|legal_documents)/i.test(sql), false);
});

test('0006 es reversible: la reversion restaura 0002 y conserva la evidencia', () => {
  const sql = stripComments(rollback);
  assert.match(sql, /DROP FUNCTION public\.ally_accept_terms/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.submit_referral/);
  assert.equal(/ally_current_acceptance\)/.test(sql.split('COMMIT;')[0] ?? ''), false);
  assert.equal(/DROP TABLE/.test(sql), false, 'las tablas solo se borran en la parte B, comentada');
  assert.match(rollback, /-- DROP TABLE public\.ally_acceptances;/);
});

test('invitar, aprobar y crear contrasenas no registran aceptaciones: ningun codigo de esos flujos las toca', () => {
  const apiDir = new URL('../api/', import.meta.url);
  for (const name of readdirSync(apiDir).filter((file) => /^aliados-.*\.ts$/.test(file) && !file.endsWith('.test.ts'))) {
    const text = readFileSync(new URL(name, apiDir), 'utf8');
    assert.equal(/ally_accept_terms|ally_acceptances/.test(text), false, `${name} no debe registrar aceptaciones`);
  }
  const activation = readFileSync(new URL('../src/features/aliados/aliadosActivation.ts', import.meta.url), 'utf8');
  assert.equal(/ally_accept_terms|ally_acceptances|rpc\(/.test(activation), false);
  const accept0003to0005 = ['0002-operations', '0003-ally-status', '0004-registration', '0005-admin-invite']
    .map((name) => read(`../supabase/proposals/aliados-lab-${name}.sql`))
    .join('\n');
  assert.equal(/ally_acceptances/.test(accept0003to0005), false);
});

test('el arnes SQL instala y prueba 0006 y 0007 y la reversion', () => {
  const run = read('./aliados-sql/run.sh');
  for (const piece of ['aliados-lab-0006-acceptance.sql', 'aliados-lab-0007-legal-documents.sql', 'aliados-lab-0006-acceptance-rollback.sql', 'tests-0006.sql']) {
    assert.ok(run.includes(piece), piece);
  }
});
