import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const dir = path.dirname(new URL(import.meta.url).pathname);
const sources = readdirSync(dir)
  .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts'))
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
  const uses = app.match(/<AliadosAdminPanel\b/g) ?? [];
  assert.equal(uses.length, 1);
  assert.match(app, /function AdminGate[\s\S]*destinationFor\(state\.role\) !== 'admin'[\s\S]*<AliadosAdminPanel/);
  assert.match(app, /lazy\(\(\) => import\('\.\/AliadosAdminPanel'\)/);
});

test('the old fake login state is gone', () => {
  const app = sources.find((source) => source.name === 'AliadosApp.tsx')?.text ?? '';
  assert.equal(/demoSignedIn|setDemoSignedIn|Acceso de demostraci/.test(app), false);
});

test('el codigo del aliado no consulta tablas ni vistas de administrador', () => {
  for (const name of ['AliadosApp.tsx', 'useAliadosData.ts']) {
    const text = sources.find((source) => source.name === name)?.text ?? '';
    assert.equal(/\.from\(\s*['"`]/.test(text), false, `${name} consulta tablas directamente`);
    assert.equal(/admin_(registrations|allies|referrals|sales|payments|commissions|commission_payments|audit_log)/.test(text), false, `${name} usa vistas de administrador`);
  }
  const hook = sources.find((source) => source.name === 'useAliadosData.ts')?.text ?? '';
  assert.match(hook, /listMyReferrals/);
  assert.match(hook, /listMyCommissions/);
});

test('el registro publico solo usa las dos funciones publicas y nunca toca tablas', () => {
  const allowed = new Set(['submit_ally_registration', 'aliados_registration_open']);
  for (const name of ['aliadosRegistration.ts', 'AllyPublicPages.tsx', 'aliadosActivation.ts']) {
    const text = sources.find((source) => source.name === name)?.text ?? '';
    assert.ok(text.length > 0, `${name} existe`);
    assert.equal(/\.from\(\s*['"`]/.test(text), false, `${name} consulta tablas directamente`);
    for (const match of text.matchAll(/\.rpc\(\s*['"`]([a-z_]+)['"`]/g)) {
      assert.ok(allowed.has(match[1] ?? ''), `${name} llama a la funcion no publica ${match[1]}`);
    }
  }
});

test('la activacion de cuenta solo usa setSession y updateUser con la contrasena; no crea cuentas ni cambia roles', () => {
  const text = sources.find((source) => source.name === 'aliadosActivation.ts')?.text ?? '';
  assert.match(text, /setSession/);
  assert.match(text, /updateUser\(\{ password \}\)/);
  assert.equal(/auth\.admin|inviteUserByEmail|user_metadata|raw_user_meta_data|account_roles/.test(text), false);
});

test('tras activar la cuenta el aliado va a la aceptacion electronica, nunca directo al panel', () => {
  const page = sources.find((source) => source.name === 'AllyPublicPages.tsx')?.text ?? '';
  assert.match(page, /navigate\(ACCEPTANCE_ROUTE/);
  assert.equal(/navigate\('\/aliados\/panel'/.test(page), false, 'la activacion no abre el panel');
  assert.equal(/AliadosAdminPanel|PartnerDashboard/.test(page), false, 'la pagina de activacion no renderiza paneles');
});

test('la aceptacion solo usa las dos funciones de la base y nunca escribe tablas ni envia identidad', () => {
  const text = sources.find((source) => source.name === 'aliadosAcceptance.ts')?.text ?? '';
  assert.ok(text.length > 0);
  assert.equal(/\.from\(\s*['"`]/.test(text), false);
  const rpcs = [...text.matchAll(/\.rpc\(\s*['"`]([a-z_]+)['"`]/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(rpcs)].sort(), ['ally_accept_terms', 'ally_acceptance_state']);
  assert.equal(/user_id|p_user|accepted_at|source|action|ip_address/.test(text.replace(/\/\/.*$/gm, '')), false, 'el navegador no envia identidad, fecha ni origen');
});

test('el panel del aliado solo se renderiza desde PanelGate, tras destination === panel', () => {
  const app = sources.find((source) => source.name === 'AliadosApp.tsx')?.text ?? '';
  const uses = app.match(/<PartnerDashboard\b/g) ?? [];
  assert.equal(uses.length, 1);
  assert.match(app, /destination === 'panel' && state\.role\.kind === 'ally'\) \{\s*return <PartnerDashboard/);
});
