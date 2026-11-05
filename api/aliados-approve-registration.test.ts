import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { approveRegistration } from './aliados-approve-registration';

type RpcResult = { data: unknown; error: { code: string; message: string } | null };

function makeClients(options: {
  lookup: RpcResult;
  finalize?: RpcResult;
  invite?: { data: { user: { id: string } | null }; error: { code?: string; status?: number } | null };
}) {
  const calls: string[] = [];
  const asAdmin = {
    rpc: async (name: string) => {
      calls.push(name);
      return name === 'admin_registration_for_approval' ? options.lookup : (options.finalize ?? { data: null, error: null });
    },
  } as unknown as SupabaseClient;
  const authAdmin = {
    auth: {
      admin: {
        inviteUserByEmail: async () => {
          calls.push('invite');
          return options.invite ?? { data: { user: { id: 'user-1' } }, error: null };
        },
        deleteUser: async (id: string) => {
          calls.push(`delete:${id}`);
          return { data: null, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { clients: { asAdmin, authAdmin }, calls };
}

const pending = { data: [{ email: 'nueva@ejemplo.com', full_name: 'Aliada Nueva' }], error: null };

test('un no administrador recibe 403 y no se crea ningun usuario Auth', async () => {
  const { clients, calls } = makeClients({ lookup: { data: null, error: { code: '42501', message: 'x' } } });
  const result = await approveRegistration(clients, 'reg');
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ['admin_registration_for_approval']);
});

test('aprobacion correcta: invita al usuario y luego finaliza con su id', async () => {
  const { clients, calls } = makeClients({ lookup: pending });
  const result = await approveRegistration(clients, 'reg');
  assert.equal(result.status, 200);
  assert.deepEqual(calls, ['admin_registration_for_approval', 'invite', 'admin_finalize_registration']);
});

test('si finalize falla se elimina el usuario recien creado', async () => {
  const { clients, calls } = makeClients({ lookup: pending, finalize: { data: null, error: { code: 'XX000', message: 'x' } } });
  const result = await approveRegistration(clients, 'reg');
  assert.equal(result.status, 500);
  assert.deepEqual(calls, ['admin_registration_for_approval', 'invite', 'admin_finalize_registration', 'delete:user-1']);
});

test('correo ya registrado en Auth: 409 y no se finaliza', async () => {
  const { clients, calls } = makeClients({ lookup: pending, invite: { data: { user: null }, error: { code: 'email_exists', status: 422 } } });
  const result = await approveRegistration(clients, 'reg');
  assert.equal(result.status, 409);
  assert.deepEqual(calls, ['admin_registration_for_approval', 'invite']);
});

test('token invalido: 401', async () => {
  const { clients } = makeClients({ lookup: { data: null, error: { code: 'PGRST301', message: 'jwt' } } });
  assert.equal((await approveRegistration(clients, 'reg')).status, 401);
});
