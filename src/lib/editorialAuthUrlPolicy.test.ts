import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { editorialShouldDetectSessionInUrl, isAliadosPath } from './editorialAuthUrlPolicy';

const INVITE_HASH = '#access_token=invite.jwt.token&refresh_token=invite-refresh&expires_in=3600&token_type=bearer&type=invite';

function detect(href: string): boolean {
  const url = new URL(href);
  const params = Object.fromEntries(new URLSearchParams(url.hash.replace(/^#/, '')));
  return editorialShouldDetectSessionInUrl(url, params);
}

test('el cliente editorial ignora los tokens de invitacion de Aliados', () => {
  assert.equal(detect(`https://charlitron.example/aliados/activar${INVITE_HASH}`), false);
  assert.equal(detect(`https://charlitron.example/${INVITE_HASH}`), false, 'invitacion que cae en la raiz por Site URL');
  assert.equal(detect('https://charlitron.example/#access_token=a&refresh_token=b&type=recovery'), false);
  assert.equal(detect('https://charlitron.example/aliados/activar#error=access_denied&error_code=otp_expired'), false);
});

test('el cliente editorial conserva su deteccion normal fuera de Aliados', () => {
  assert.equal(detect('https://charlitron.example/admin#access_token=a&refresh_token=b'), true);
  assert.equal(detect('https://charlitron.example/admin#error=access_denied&error_description=x'), true);
  assert.equal(detect('https://charlitron.example/blog'), false);
  assert.equal(detect('https://charlitron.example/admin'), false);
});

test('isAliadosPath solo reconoce la ruta /aliados', () => {
  assert.equal(isAliadosPath('/aliados'), true);
  assert.equal(isAliadosPath('/aliados/activar'), true);
  assert.equal(isAliadosPath('/aliadosx'), false);
  assert.equal(isAliadosPath('/admin'), false);
});

test('supabaseClient.ts usa la politica y ya no activa la deteccion incondicional', () => {
  const source = readFileSync(new URL('./supabaseClient.ts', import.meta.url), 'utf8');
  assert.match(source, /detectSessionInUrl: editorialShouldDetectSessionInUrl/);
  assert.equal(/detectSessionInUrl:\s*true/.test(source), false);
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

async function runEditorialClientAt(href: string, detectSessionInUrl: boolean | typeof editorialShouldDetectSessionInUrl) {
  const url = new URL(href);
  const requests: string[] = [];
  const history = { replaced: 0 };
  const globals = globalThis as Record<string, unknown>;
  const previous = { window: globals.window, document: globals.document, channel: globals.BroadcastChannel };
  // Sin BroadcastChannel el cliente no deja un canal abierto que mantenga vivo el proceso de prueba.
  globals.BroadcastChannel = undefined;
  globals.document = {};
  globals.window = {
    location: { href: url.href, hash: url.hash, search: url.search, pathname: url.pathname },
    history: { replaceState: () => void (history.replaced += 1) },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  try {
    const client = createClient('https://editorial.example.supabase.co', 'editorial-anon-key', {
      auth: {
        storage: memoryStorage(),
        storageKey: 'editorial-test',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl,
      },
      global: {
        fetch: (async (input: unknown) => {
          requests.push(String(input));
          return new Response(JSON.stringify({ message: 'invalid JWT' }), { status: 401, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch,
      },
    });
    await client.auth.getSession();
    await client.auth.stopAutoRefresh();
    return { requests, replaced: history.replaced };
  } finally {
    globals.window = previous.window;
    globals.document = previous.document;
    globals.BroadcastChannel = previous.channel;
  }
}

test('con un cliente real, el token de invitacion de Aliados nunca llega al proyecto editorial', async () => {
  const result = await runEditorialClientAt(`https://charlitron.example/aliados/activar${INVITE_HASH}`, editorialShouldDetectSessionInUrl);
  assert.deepEqual(result.requests, []);
  assert.equal(result.replaced, 0, 'el fragmento queda intacto para que lo lea Aliados');
});

test('control: sin la politica (detectSessionInUrl: true) el cliente editorial si enviaba el token', async () => {
  const result = await runEditorialClientAt(`https://charlitron.example/aliados/activar${INVITE_HASH}`, true);
  assert.ok(result.requests.length > 0, 'la prueba detecta el fallo original');
});
