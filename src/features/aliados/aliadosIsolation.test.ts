import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const dir = path.dirname(new URL(import.meta.url).pathname);
const sources = readdirSync(dir)
  .filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
  .map((name) => ({ name, text: readFileSync(path.join(dir, name), 'utf8') }));

test('the Aliados module never uses the editorial Supabase client or its env vars', () => {
  for (const { name, text } of sources) {
    assert.equal(/lib\/supabaseClient/.test(text), false, `${name} importa el cliente editorial`);
    assert.equal(/VITE_SUPABASE_/.test(text), false, `${name} lee variables del Supabase editorial`);
    assert.equal(/features\/admin\//.test(text), false, `${name} importa el admin editorial`);
  }
});

test('public registration stays disabled: no signUp, OTP or OAuth flows', () => {
  for (const { name, text } of sources) {
    assert.equal(/\.signUp\s*\(/.test(text), false, `${name} llama a signUp`);
    assert.equal(/signInWithOtp|signInWithOAuth|signInAnonymously|resetPasswordForEmail/.test(text), false, `${name} usa un flujo no autorizado`);
  }
});

test('no secrets or service_role keys appear in the Aliados frontend', () => {
  for (const { name, text } of sources) {
    assert.equal(/service_role|SERVICE_ROLE|sb_secret_/.test(text), false, `${name} menciona claves privilegiadas`);
    assert.equal(/eyJ[A-Za-z0-9_-]{20,}/.test(text), false, `${name} contiene un token incrustado`);
  }
});

test('the Aliados client is independent: own storage key, built only from the injected constants', () => {
  const client = sources.find((source) => source.name === 'aliadosSupabase.ts')?.text ?? '';
  assert.match(client, /storageKey: 'charlitron-aliados-auth'/);
  assert.match(client, /__ALIADOS_SUPABASE_URL__/);
  assert.match(client, /__ALIADOS_SUPABASE_ANON_KEY__/);
  assert.match(client, /detectSessionInUrl: false/);
});

test('the admin panel is only reachable through the admin gate', () => {
  const app = sources.find((source) => source.name === 'AliadosApp.tsx')?.text ?? '';
  const uses = app.match(/<AliadosAdminPrototype\b/g) ?? [];
  assert.equal(uses.length, 1);
  assert.match(app, /function AdminGate[\s\S]*destinationFor\(state\.role\) !== 'admin'[\s\S]*<AliadosAdminPrototype/);
  assert.match(app, /lazy\(\(\) => import\('\.\/AliadosAdminPrototype'\)\)/);
});

test('the old fake login state is gone', () => {
  const app = sources.find((source) => source.name === 'AliadosApp.tsx')?.text ?? '';
  assert.equal(/demoSignedIn|setDemoSignedIn|Acceso de demostraci/.test(app), false);
});
