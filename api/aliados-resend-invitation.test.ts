import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler, { activationRedirect, resendInvitation } from './aliados-resend-invitation';

const USER = '3f2b8c1e-0d4a-4b7e-9a51-6c2d8e7f1a90';

function makeClients(options: {
  lookup: { data: unknown; error: { code?: string } | null };
  invite?: { error: { code?: string; status?: number } | null };
}) {
  const calls: string[] = [];
  const asAdmin = {
    from: (table: string) => {
      calls.push(`from:${table}`);
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.eq = (column: string, value: string) => {
        calls.push(`eq:${column}:${value}`);
        return query;
      };
      query.maybeSingle = () => Promise.resolve(options.lookup);
      return query;
    },
  } as unknown as SupabaseClient;
  const authAdmin = {
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, invite?: { redirectTo?: string }) => {
          calls.push(`invite:${email}:${invite?.redirectTo ?? ''}`);
          return { data: {}, error: options.invite?.error ?? null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { clients: { asAdmin, authAdmin }, calls };
}

test('reenvio correcto: consulta la vista de administrador y vuelve a invitar con la pagina de activacion', async () => {
  const { clients, calls } = makeClients({ lookup: { data: { email: 'ana@ejemplo.com', confirmed_at: null }, error: null } });
  const result = await resendInvitation(clients, USER, 'https://www.charlitrondigital.com/aliados/activar');
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    'from:admin_allies',
    `eq:user_id:${USER}`,
    'invite:ana@ejemplo.com:https://www.charlitrondigital.com/aliados/activar',
  ]);
});

test('un no administrador (la vista no devuelve filas) recibe 404 y no se envia ningun correo', async () => {
  const { clients, calls } = makeClients({ lookup: { data: null, error: null } });
  assert.equal((await resendInvitation(clients, USER)).status, 404);
  assert.equal(calls.some((call) => call.startsWith('invite')), false);
});

test('cuenta ya confirmada: 409 y no se envia ningun correo', async () => {
  const { clients, calls } = makeClients({ lookup: { data: { email: 'ana@ejemplo.com', confirmed_at: '2026-11-05' }, error: null } });
  assert.equal((await resendInvitation(clients, USER)).status, 409);
  assert.equal(calls.some((call) => call.startsWith('invite')), false);
});

test('token invalido: 401; error de Auth al invitar: 502; correo ya confirmado segun Auth: 409', async () => {
  const bad = makeClients({ lookup: { data: null, error: { code: 'PGRST301' } } });
  assert.equal((await resendInvitation(bad.clients, USER)).status, 401);
  const failed = makeClients({ lookup: { data: { email: 'a@b.co', confirmed_at: null }, error: null }, invite: { error: { code: 'unexpected_failure', status: 500 } } });
  assert.equal((await resendInvitation(failed.clients, USER)).status, 502);
  const exists = makeClients({ lookup: { data: { email: 'a@b.co', confirmed_at: null }, error: null }, invite: { error: { code: 'email_exists', status: 422 } } });
  assert.equal((await resendInvitation(exists.clients, USER)).status, 409);
});

test('la pagina de activacion sale de variables del servidor y solo acepta https', () => {
  assert.equal(activationRedirect({ VERCEL_ENV: 'production', VITE_SITE_URL: 'https://www.charlitrondigital.com/' }), 'https://www.charlitrondigital.com/aliados/activar');
  assert.equal(activationRedirect({ VERCEL_ENV: 'preview', VERCEL_URL: 'proyecto-abc.vercel.app', VITE_SITE_URL: 'https://www.charlitrondigital.com' }), 'https://proyecto-abc.vercel.app/aliados/activar');
  assert.equal(activationRedirect({ VERCEL_ENV: 'production', VITE_SITE_URL: 'http://www.charlitrondigital.com' }), undefined);
  assert.equal(activationRedirect({ VERCEL_ENV: 'production', VITE_SITE_URL: 'no es una url' }), undefined);
  assert.equal(activationRedirect({}), undefined);
});

function fakeResponse() {
  const state: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const res = {
    setHeader: (key: string, value: string) => {
      state.headers[key] = value;
      return res;
    },
    status: (code: number) => {
      state.status = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
  } as unknown as VercelResponse;
  return { res, state };
}

test('el endpoint exige POST, token Bearer e id valido antes de tocar Supabase', async () => {
  const previous = { url: process.env.ALIADOS_SUPABASE_URL, key: process.env.ALIADOS_SUPABASE_ANON_KEY, service: process.env.ALIADOS_SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.ALIADOS_SUPABASE_URL;
  delete process.env.ALIADOS_SUPABASE_ANON_KEY;
  delete process.env.ALIADOS_SUPABASE_SERVICE_ROLE_KEY;
  try {
    const run = async (req: Partial<VercelRequest>) => {
      const { res, state } = fakeResponse();
      await handler(req as VercelRequest, res);
      return state;
    };
    const get = await run({ method: 'GET', headers: {} });
    assert.equal(get.status, 405);
    assert.equal(get.headers.Allow, 'POST');
    assert.equal(get.headers['Cache-Control'], 'no-store');
    assert.equal((await run({ method: 'POST', headers: {} })).status, 401);
    assert.equal((await run({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { user_id: 'no-uuid' } })).status, 400);
    assert.equal((await run({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { user_id: USER } })).status, 503);
  } finally {
    if (previous.url) process.env.ALIADOS_SUPABASE_URL = previous.url;
    if (previous.key) process.env.ALIADOS_SUPABASE_ANON_KEY = previous.key;
    if (previous.service) process.env.ALIADOS_SUPABASE_SERVICE_ROLE_KEY = previous.service;
  }
});
