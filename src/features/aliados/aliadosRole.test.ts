import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationFor, loginErrorMessage, resolveAliadosRole, type RoleQueryClient } from './aliadosRole';

type Result = { data: unknown; error: unknown };

function fakeClient(tables: Record<string, Result>, calls: string[] = []): RoleQueryClient {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              calls.push(`${table}:${columns}:${column}=${value}`);
              return { maybeSingle: async () => tables[table] ?? { data: null, error: null } };
            },
          };
        },
      };
    },
  };
}

const none: Result = { data: null, error: null };

test('an admin row makes the account an admin without reading ally_profiles', async () => {
  const calls: string[] = [];
  const role = await resolveAliadosRole(fakeClient({ admin_users: { data: { user_id: 'u1' }, error: null } }, calls), 'u1');
  assert.deepEqual(role, { kind: 'admin' });
  assert.deepEqual(calls, ['admin_users:user_id:user_id=u1']);
});

test('an ally row returns its status and display name', async () => {
  const client = fakeClient({
    admin_users: none,
    ally_profiles: { data: { display_name: 'Aliado de prueba (ficticio)', status: 'pending' }, error: null },
  });
  assert.deepEqual(await resolveAliadosRole(client, 'u2'), {
    kind: 'ally',
    status: 'pending',
    displayName: 'Aliado de prueba (ficticio)',
  });
});

test('an unknown ally status is treated as paused (deny by default)', async () => {
  const client = fakeClient({ admin_users: none, ally_profiles: { data: { display_name: 'X', status: 'superuser' }, error: null } });
  assert.deepEqual(await resolveAliadosRole(client, 'u3'), { kind: 'ally', status: 'paused', displayName: 'X' });
});

test('an authenticated account without rows has no role', async () => {
  assert.deepEqual(await resolveAliadosRole(fakeClient({ admin_users: none, ally_profiles: none }), 'u4'), { kind: 'none' });
});

test('query errors are propagated, never turned into a role', async () => {
  await assert.rejects(resolveAliadosRole(fakeClient({ admin_users: { data: null, error: { code: '42501' } } }), 'u5'));
  await assert.rejects(
    resolveAliadosRole(fakeClient({ admin_users: none, ally_profiles: { data: null, error: { code: 'PGRST301' } } }), 'u5'),
  );
});

test('only an active ally reaches the panel; pending, paused and unknown accounts do not', () => {
  assert.equal(destinationFor({ kind: 'admin' }), 'admin');
  assert.equal(destinationFor({ kind: 'ally', status: 'active', displayName: '' }), 'panel');
  assert.equal(destinationFor({ kind: 'ally', status: 'pending', displayName: '' }), 'pending');
  assert.equal(destinationFor({ kind: 'ally', status: 'paused', displayName: '' }), 'paused');
  assert.equal(destinationFor({ kind: 'none' }), 'denied');
});

test('login errors are generic and never reveal whether the account exists', () => {
  assert.equal(loginErrorMessage(null), '');
  assert.equal(loginErrorMessage({ status: 400, code: 'invalid_credentials' }), 'Correo o contraseña incorrectos.');
  assert.equal(loginErrorMessage({ status: 400, code: 'user_not_found' }), 'Correo o contraseña incorrectos.');
  assert.match(loginErrorMessage({ status: 500 }), /No se pudo iniciar sesión/);
});
