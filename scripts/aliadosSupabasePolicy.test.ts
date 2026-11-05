import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aliadosSupabaseBuildConfig,
  aliadosSupabaseWasIgnored,
  isAliadosAuthBuildAllowed,
} from './aliadosSupabasePolicy';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (role: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role })}.firma`;
const LAB = 'https://labtestproject.supabase.co';
const previewAliados = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/aliados-charlitron' };

test('only Preview of the Aliados branch (or local dev) may use the Aliados project', () => {
  assert.equal(isAliadosAuthBuildAllowed(previewAliados), true);
  assert.equal(isAliadosAuthBuildAllowed({}), true);
  assert.equal(isAliadosAuthBuildAllowed({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), false);
  assert.equal(isAliadosAuthBuildAllowed({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feat/aliados-charlitron' }), false);
  assert.equal(isAliadosAuthBuildAllowed({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/portafolio-proyectos-v2' }), false);
  assert.equal(isAliadosAuthBuildAllowed({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main' }), false);
});

test('returns the config in the allowed Preview and ignores it everywhere else', () => {
  const vars = { ALIADOS_SUPABASE_URL: `${LAB}/`, ALIADOS_SUPABASE_ANON_KEY: jwt('anon') };
  assert.deepEqual(aliadosSupabaseBuildConfig({ ...previewAliados, ...vars }), { url: LAB, anonKey: jwt('anon') });
  const production = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
  assert.deepEqual(aliadosSupabaseBuildConfig({ ...production, ...vars }), { url: '', anonKey: '' });
  assert.equal(aliadosSupabaseWasIgnored({ ...production, ...vars }), true);
  assert.equal(aliadosSupabaseWasIgnored({ ...previewAliados, ...vars }), false);
  assert.deepEqual(aliadosSupabaseBuildConfig(previewAliados), { url: '', anonKey: '' });
});

test('breaks the build on unsafe combinations', () => {
  const base = { ...previewAliados, ALIADOS_SUPABASE_URL: LAB, ALIADOS_SUPABASE_ANON_KEY: jwt('anon') };
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_ANON_KEY: '' }), /juntas/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_URL: '' }), /juntas/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_ANON_KEY: jwt('service_role') }), /anon/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_ANON_KEY: 'sb_secret_abc' }), /secreta/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_ANON_KEY: 'no-es-un-jwt' }), /anon/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_URL: 'http://labtestproject.supabase.co' }), /https/);
  assert.throws(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_URL: 'https://rvvqhpbtqgjpzflopflv.supabase.co' }), /editorial/);
  assert.throws(
    () => aliadosSupabaseBuildConfig({ ...base, VITE_SUPABASE_URL: `${LAB}/` }),
    /coincide con VITE_SUPABASE_URL/,
  );
  assert.doesNotThrow(() => aliadosSupabaseBuildConfig({ ...base, ALIADOS_SUPABASE_ANON_KEY: 'sb_publishable_abc' }));
});

test('http is accepted only for localhost outside Vercel', () => {
  const vars = { ALIADOS_SUPABASE_URL: 'http://localhost:54321', ALIADOS_SUPABASE_ANON_KEY: jwt('anon') };
  assert.equal(aliadosSupabaseBuildConfig(vars).url, 'http://localhost:54321');
  assert.throws(() => aliadosSupabaseBuildConfig({ ...previewAliados, ...vars }), /https/);
});

test('error messages never include the key values', () => {
  const secret = jwt('service_role');
  try {
    aliadosSupabaseBuildConfig({ ...previewAliados, ALIADOS_SUPABASE_URL: LAB, ALIADOS_SUPABASE_ANON_KEY: secret });
    assert.fail('debia lanzar');
  } catch (error) {
    assert.equal(String((error as Error).message).includes(secret), false);
  }
});
