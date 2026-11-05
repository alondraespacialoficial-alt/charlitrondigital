import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler, { inviteAlly, parseInviteInput } from './aliados-invite-ally';

const REG = '3f2b8c1e-0d4a-4b7e-9a51-6c2d8e7f1a90';
const USER = '9b1c7d2e-5a3f-4c68-8e10-2f4a6b8c0d1e';
const INPUT = { email: 'ana@ejemplo.com', full_name: 'Ana Perez' };

function makeClients(options: {
  invited?: { error: { code?: string; status?: number } | null };
  finalize?: { error: { code?: string } | null };
  created: { data: unknown; error: { code?: string } | null };
}) {
  const calls: string[] = [];
  const asAdmin = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push(`rpc:${name}:${JSON.stringify(params)}`);
      return name === 'admin_invite_ally' ? options.created : (options.finalize ?? { error: null });
    },
  } as unknown as SupabaseClient;
  const authAdmin = {
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, invite?: { redirectTo?: string }) => {
          calls.push(`invite:${email}:${invite?.redirectTo ?? ''}`);
          return options.invited?.error ? { data: {}, error: options.invited.error } : { data: { user: { id: USER } }, error: null };
        },
        deleteUser: async (id: string) => {
          calls.push(`delete:${id}`);
          return { error: null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { clients: { asAdmin, authAdmin }, calls };
}

test('correo nuevo: crea la solicitud, invita con la pagina de activacion y luego crea rol y perfil', async () => {
  const { clients, calls } = makeClients({ created: { data: [{ registration_id: REG, auth_user_id: null }], error: null } });
  const result = await inviteAlly(clients, { ...INPUT, phone: '4441234567' }, 'https://www.charlitrondigital.com/aliados/activar');
  assert.deepEqual(result, { status: 200, body: { ok: true, outcome: 'invited' } });
  assert.deepEqual(calls, [
    `rpc:admin_invite_ally:${JSON.stringify({ p_email: 'ana@ejemplo.com', p_full_name: 'Ana Perez', p_phone: '4441234567', p_city: null })}`,
    'invite:ana@ejemplo.com:https://www.charlitrondigital.com/aliados/activar',
    `rpc:admin_finalize_registration:${JSON.stringify({ p_registration_id: REG, p_user_id: USER })}`,
  ]);
});

test('cuenta ya existente: se vincula sin enviar otra invitacion ni duplicar el usuario', async () => {
  const { clients, calls } = makeClients({ created: { data: [{ registration_id: REG, auth_user_id: USER }], error: null } });
  const result = await inviteAlly(clients, { email: 'merkatingadmon@hotmail.com', full_name: 'Merkating Admon' });
  assert.deepEqual(result, { status: 200, body: { ok: true, outcome: 'linked' } });
  assert.equal(calls.some((call) => call.startsWith('invite') || call.startsWith('delete')), false);
  assert.equal(calls[1], `rpc:admin_finalize_registration:${JSON.stringify({ p_registration_id: REG, p_user_id: USER })}`);
});

test('si finalizar falla se borra al usuario recien invitado, nunca a uno preexistente', async () => {
  const fresh = makeClients({ created: { data: [{ registration_id: REG, auth_user_id: null }], error: null }, finalize: { error: { code: 'XX000' } } });
  assert.equal((await inviteAlly(fresh.clients, INPUT)).status, 500);
  assert.equal(fresh.calls.includes(`delete:${USER}`), true);
  const existing = makeClients({ created: { data: [{ registration_id: REG, auth_user_id: USER }], error: null }, finalize: { error: { code: 'XX000' } } });
  assert.equal((await inviteAlly(existing.clients, INPUT)).status, 500);
  assert.equal(existing.calls.some((call) => call.startsWith('delete')), false);
});

test('errores: no administrador 403 sin invitar, ya aliado 409, datos 400, token 401, Auth 502/409', async () => {
  const forbidden = makeClients({ created: { data: null, error: { code: '42501' } } });
  assert.equal((await inviteAlly(forbidden.clients, INPUT)).status, 403);
  assert.equal(forbidden.calls.some((call) => call.startsWith('invite') || call.includes('finalize')), false);
  assert.equal((await inviteAlly(makeClients({ created: { data: null, error: { code: '23505' } } }).clients, INPUT)).body.error, 'already_ally');
  assert.equal((await inviteAlly(makeClients({ created: { data: null, error: { code: '23514' } } }).clients, INPUT)).status, 400);
  assert.equal((await inviteAlly(makeClients({ created: { data: null, error: { code: 'PGRST301' } } }).clients, INPUT)).status, 401);
  const base = { created: { data: [{ registration_id: REG, auth_user_id: null }], error: null } };
  assert.equal((await inviteAlly(makeClients({ ...base, invited: { error: { code: 'unexpected_failure', status: 500 } } }).clients, INPUT)).status, 502);
  assert.equal((await inviteAlly(makeClients({ ...base, invited: { error: { code: 'email_exists', status: 422 } } }).clients, INPUT)).status, 409);
});

test('la entrada se normaliza y se valida antes de tocar Supabase', () => {
  assert.deepEqual(parseInviteInput({ email: ' Ana@Ejemplo.com ', full_name: ' Ana Perez ', phone: ' ', city: 'SLP' }), {
    email: 'ana@ejemplo.com', full_name: 'Ana Perez', city: 'SLP',
  });
  assert.equal(parseInviteInput({ email: 'sin-arroba', full_name: 'Ana Perez' }), null);
  assert.equal(parseInviteInput({ email: 'a@b.co', full_name: 'A' }), null);
  assert.equal(parseInviteInput({ email: 'a@b.co', full_name: 'Ana', phone: '1'.repeat(31) }), null);
  assert.equal(parseInviteInput(null), null);
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

test('el endpoint exige POST, token Bearer y datos validos antes de tocar Supabase', async () => {
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
    assert.equal((await run({ method: 'POST', headers: {}, body: INPUT })).status, 401);
    assert.equal((await run({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { email: 'x' } })).status, 400);
    assert.equal((await run({ method: 'POST', headers: { authorization: 'Bearer t' }, body: INPUT })).status, 503);
  } finally {
    if (previous.url) process.env.ALIADOS_SUPABASE_URL = previous.url;
    if (previous.key) process.env.ALIADOS_SUPABASE_ANON_KEY = previous.key;
    if (previous.service) process.env.ALIADOS_SUPABASE_SERVICE_ROLE_KEY = previous.service;
  }
});
