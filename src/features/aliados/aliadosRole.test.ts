import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationFor, loginErrorMessage, resolveAliadosRole, type RoleQueryClient } from './aliadosRole';

type Result = { data: unknown; error: unknown };

const acceptedRow: Result = { data: [{ accepted: true, current_terms_version: '1.0', current_privacy_version: '1.2' }], error: null };
const notAcceptedRow: Result = { data: [{ accepted: false, current_terms_version: '1.0', current_privacy_version: '1.2' }], error: null };

function fakeClient(tables: Record<string, Result>, calls: string[] = [], acceptance: Result = notAcceptedRow): RoleQueryClient {
  return {
    rpc: async (fn: string) => {
      calls.push(`rpc:${fn}`);
      return acceptance;
    },
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

test('an ally row returns its status and display name; pending allies never query acceptance', async () => {
  const calls: string[] = [];
  const client = fakeClient({
    admin_users: none,
    ally_profiles: { data: { display_name: 'Aliado de prueba (ficticio)', status: 'pending' }, error: null },
  }, calls);
  assert.deepEqual(await resolveAliadosRole(client, 'u2'), {
    kind: 'ally',
    status: 'pending',
    displayName: 'Aliado de prueba (ficticio)',
    accepted: false,
  });
  assert.equal(calls.some((call) => call.startsWith('rpc:')), false);
});

test('an active ally without a current acceptance is not accepted; with one it is (the database decides)', async () => {
  const tables = { admin_users: none, ally_profiles: { data: { display_name: 'Ana', status: 'active' }, error: null } };
  const calls: string[] = [];
  assert.deepEqual(await resolveAliadosRole(fakeClient(tables, calls, notAcceptedRow), 'u6'), { kind: 'ally', status: 'active', displayName: 'Ana', accepted: false });
  assert.deepEqual(calls.at(-1), 'rpc:ally_acceptance_state');
  assert.deepEqual(await resolveAliadosRole(fakeClient(tables, [], acceptedRow), 'u6'), { kind: 'ally', status: 'active', displayName: 'Ana', accepted: true });
});

test('an error verifying the acceptance blocks the session instead of granting access', async () => {
  const tables = { admin_users: none, ally_profiles: { data: { display_name: 'Ana', status: 'active' }, error: null } };
  await assert.rejects(resolveAliadosRole(fakeClient(tables, [], { data: null, error: { code: '42883' } }), 'u7'));
  await assert.rejects(resolveAliadosRole(fakeClient(tables, [], { data: [{}], error: null }), 'u7'));
});

test('an admin never needs an acceptance', async () => {
  const calls: string[] = [];
  const role = await resolveAliadosRole(fakeClient({ admin_users: { data: { user_id: 'u1' }, error: null } }, calls), 'u1');
  assert.deepEqual(role, { kind: 'admin' });
  assert.equal(calls.some((call) => call.startsWith('rpc:')), false);
});

test('an unknown ally status is treated as paused (deny by default)', async () => {
  const client = fakeClient({ admin_users: none, ally_profiles: { data: { display_name: 'X', status: 'superuser' }, error: null } });
  assert.deepEqual(await resolveAliadosRole(client, 'u3'), { kind: 'ally', status: 'paused', displayName: 'X', accepted: false });
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

test('only an active ally WITH a current acceptance reaches the panel; the rest do not', () => {
  assert.equal(destinationFor({ kind: 'admin' }), 'admin');
  assert.equal(destinationFor({ kind: 'ally', status: 'active', displayName: '', accepted: true }), 'panel');
  assert.equal(destinationFor({ kind: 'ally', status: 'active', displayName: '', accepted: false }), 'acceptance');
  assert.equal(destinationFor({ kind: 'ally', status: 'pending', displayName: '', accepted: false }), 'pending');
  assert.equal(destinationFor({ kind: 'ally', status: 'paused', displayName: '', accepted: true }), 'paused');
  assert.equal(destinationFor({ kind: 'none' }), 'denied');
});

test('login errors are generic and never reveal whether the account exists', () => {
  assert.equal(loginErrorMessage(null), '');
  assert.equal(loginErrorMessage({ status: 400, code: 'invalid_credentials' }), 'Correo o contraseña incorrectos.');
  assert.equal(loginErrorMessage({ status: 400, code: 'user_not_found' }), 'Correo o contraseña incorrectos.');
  assert.match(loginErrorMessage({ status: 500 }), /No se pudo iniciar sesión/);
});
