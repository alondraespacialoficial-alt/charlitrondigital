import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEGAL_DOCUMENTS } from '../src/features/aliados/aliadosLegal';
import { LAB_GUARD, PRODUCTION_DIR, PRODUCTION_GUARD, PRODUCTION_MIGRATIONS, buildProductionFiles, buildVerifySql } from './aliadosProductionSql';
import { legalDigest } from './aliadosLegalSeed';

const lab = (name: string) => readFileSync(new URL(`../supabase/proposals/${name}`, import.meta.url), 'utf8');
const production = (name: string) => readFileSync(`${PRODUCTION_DIR}${name}`, 'utf8');
const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, '');
const stripBanner = (sql: string) => sql.replace(/^(?:--[^\n]*\n){5}\n/, '');

test('los scripts de Production estan al dia con el laboratorio (si falla: npm run generate:aliados-production-sql)', () => {
  for (const { file, content } of buildProductionFiles()) assert.equal(production(file), content, file);
});

test('la unica diferencia con el laboratorio es la guarda: no se eliminan protecciones', () => {
  for (const { lab: labFile, production: productionFile } of PRODUCTION_MIGRATIONS) {
    const labSql = lab(labFile);
    const prodSql = stripBanner(production(productionFile));
    assert.ok(labSql.includes(LAB_GUARD), `${labFile} conserva su guarda de laboratorio`);
    assert.equal(prodSql, labSql.replace(LAB_GUARD, PRODUCTION_GUARD), productionFile);
    assert.equal(/assert_aliados_lab\(\)\s*;/.test(stripComments(prodSql)), false);
    assert.equal((stripComments(prodSql).match(/assert_aliados_production\(\)/g) ?? []).length, 1);
  }
});

test('0007 de Production publica las mismas versiones y huellas SHA-256 que el laboratorio y aliadosLegal.ts', () => {
  const labSeed = lab('aliados-lab-0007-legal-documents.sql');
  const prodSeed = production('aliados-prod-0007-legal-documents.sql');
  const verify = buildVerifySql();
  const hashes = (sql: string) => [...sql.matchAll(/'([0-9a-f]{64})'/g)].map((match) => match[1]);
  assert.deepEqual(hashes(prodSeed), hashes(labSeed));
  assert.deepEqual(hashes(prodSeed), LEGAL_DOCUMENTS.map(legalDigest));
  for (const doc of LEGAL_DOCUMENTS) assert.ok(verify.includes(`('${doc.type}', '${doc.version}', '${legalDigest(doc)}')`));
  assert.deepEqual(LEGAL_DOCUMENTS.map((doc) => `${doc.type}:${doc.version}`), ['terms:1.0', 'privacy:1.2']);
  assert.equal(/INSERT INTO public\.ally_acceptances/.test(prodSeed), false);
});

test('la verificacion previa y la posterior son de solo lectura', () => {
  for (const sql of [production('aliados-prod-00-preflight.sql'), production('aliados-prod-99-verify.sql')].map((sql) => stripComments(sql).replace(/'[^']*'/g, "''"))) {
    assert.equal(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i.test(sql), false);
  }
});

test('el preflight exige proyecto de Aliados, 0001-0005, 0006/0007 ausentes, registro cerrado y anon acotado', () => {
  const sql = production('aliados-prod-00-preflight.sql');
  for (const piece of ['public.articles', 'lab_environment', 'admin_invite_ally', 'ally_acceptances', 'registration_open = false', 'aliados_registration_open', "has_table_privilege('anon'"]) {
    assert.ok(sql.includes(piece), piece);
  }
});

test('la guarda de Production no trae un Reference ID real, rechaza el editorial y no toca datos ni el registro', () => {
  const sql = production('aliados-prod-01-guard.sql');
  assert.match(sql, /v_ref\s+constant text := 'REEMPLAZAR_REFERENCE_ID_PRODUCTION'/);
  assert.match(sql, /v_ref = 'rvvqhpbtqgjpzflopflv'/);
  assert.match(sql, /to_regclass\('public\.lab_environment'\) IS NOT NULL/);
  const body = stripComments(sql);
  assert.equal(/UPDATE\s|DELETE\s|TRUNCATE|aliados_settings\s+SET|registration_open\s*=\s*true/i.test(body), false);
  assert.equal((body.match(/INSERT INTO/g) ?? []).length, 1, 'solo inserta el marcador');
  assert.match(body, /REVOKE ALL ON public\.aliados_production_marker FROM PUBLIC, anon, authenticated/);
  assert.match(body, /REVOKE ALL ON FUNCTION public\.assert_aliados_production\(\) FROM PUBLIC, anon, authenticated/);
});

test('los scripts de Production no abren el registro, no tocan comisiones ni porcentajes y no incluyen secretos', () => {
  for (const name of ['aliados-prod-0006-acceptance.sql', 'aliados-prod-0007-legal-documents.sql', 'aliados-prod-0006-acceptance-rollback.sql', 'aliados-prod-01-guard.sql']) {
    const sql = stripComments(production(name));
    assert.equal(/registration_open\s*=\s*true|UPDATE\s+public\.aliados_settings|INSERT INTO public\.aliados_settings/i.test(sql), false, name);
    assert.equal(/percent|porcentaje/i.test(sql.replace(/\$legal\$[\s\S]*?\$legal\$/g, '')), false, name);
    assert.equal(/service_role|sb_secret_|eyJ[A-Za-z0-9_-]{20,}/.test(sql), false, name);
  }
});

test('el procedimiento documenta el orden, las detenciones y la reversion', () => {
  const runbook = readFileSync(new URL('../docs/aliados-production-runbook.md', import.meta.url), 'utf8');
  const order = ['aliados-prod-00-preflight.sql', 'aliados-prod-01-guard.sql', 'aliados-prod-0006-acceptance.sql', 'aliados-prod-0007-legal-documents.sql', 'aliados-prod-99-verify.sql'];
  let cursor = -1;
  for (const file of order) {
    const index = runbook.indexOf(file, cursor + 1);
    assert.ok(index > cursor, `${file} aparece en orden`);
    cursor = index;
  }
  assert.match(runbook, /aliados-prod-0006-acceptance-rollback\.sql/);
  assert.match(runbook, /rvvqhpbtqgjpzflopflv/);
});
