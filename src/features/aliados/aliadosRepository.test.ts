import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AliadosRepository } from './aliadosRepository';

interface Call {
  kind: 'from' | 'rpc';
  name: string;
  params?: Record<string, unknown>;
}

function mockClient(options: { token?: string | null; rpcError?: string } = {}) {
  const calls: Call[] = [];
  const query = (): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'is', 'eq']) q[method] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
    return q;
  };
  const client = {
    from: (name: string) => {
      calls.push({ kind: 'from', name });
      return query();
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.push({ kind: 'rpc', name, params });
      return Promise.resolve(options.rpcError ? { data: null, error: { message: options.rpcError } } : { data: 'id-1', error: null });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: options.token === null ? null : { access_token: options.token ?? 'jwt-admin' } } }),
    },
  } as unknown as SupabaseClient;
  return { repo: new AliadosRepository(client), calls };
}

test('las lecturas usan solo vistas admin_*, ally_my_* y el perfil propio: nunca tablas base', async () => {
  const { repo, calls } = mockClient();
  await Promise.all([
    repo.listAllies(), repo.listRegistrations(), repo.listReferrals(), repo.listSales(), repo.listPayments(),
    repo.listCommissions(), repo.listCommissionPayments(), repo.listMyReferrals(), repo.listMyCommissions(), repo.getOwnProfile('u1'),
  ]);
  const names = calls.map((call) => call.name).sort();
  assert.deepEqual(names, [
    'admin_allies', 'admin_commission_payments', 'admin_commissions', 'admin_payments', 'admin_referrals',
    'admin_registrations', 'admin_sales', 'ally_my_commissions', 'ally_my_referrals', 'ally_profiles',
  ]);
});

test('las lecturas del aliado solo consultan ally_my_*', async () => {
  const { repo, calls } = mockClient();
  await repo.listMyReferrals();
  await repo.listMyCommissions();
  assert.deepEqual(calls.map((call) => call.name), ['ally_my_referrals', 'ally_my_commissions']);
});

test('toda escritura es una funcion de la base; ninguna toca tablas', async () => {
  const { repo, calls } = mockClient();
  await repo.submitReferral({ name: 'Cliente', phone: '4440000000', authorized: true });
  await repo.rejectRegistration('r', 'motivo');
  await repo.setAllyStatus('u', 'paused');
  await repo.setReferralStatus('r', 'duplicate', 'nota', 'orig');
  await repo.recordSale('r', 1000, 'desc', 'nota');
  await repo.correctSale('s', 900, 'motivo');
  await repo.recordPayment('s', 400, 'key-0000001', 'Transferencia', 'REF');
  await repo.reversePayment('p', 'motivo');
  await repo.assignCommission('s', 100);
  await repo.authorizeCommission('c');
  await repo.payCommission('c', 40, 'key-0000002', 'Transferencia');
  await repo.reverseCommissionPayment('cp', 'motivo');
  assert.equal(calls.some((call) => call.kind === 'from'), false);
  assert.deepEqual(calls.map((call) => call.name), [
    'submit_referral', 'admin_reject_registration', 'admin_set_ally_status', 'admin_set_referral_status', 'admin_record_sale', 'admin_correct_sale',
    'admin_record_payment', 'admin_reverse_payment', 'admin_assign_commission', 'admin_authorize_commission',
    'admin_pay_commission', 'admin_reverse_commission_payment',
  ]);
});

test('cobros y pagos envian la llave de idempotencia y no calculan montos en el cliente', async () => {
  const { repo, calls } = mockClient();
  await repo.payCommission('c', 40.1, 'key-0000002', 'Transferencia', 'REF', 'nota');
  assert.deepEqual(calls[0]?.params, {
    p_commission_id: 'c', p_amount: 40.1, p_idempotency_key: 'key-0000002', p_method: 'Transferencia', p_reference: 'REF', p_notes: 'nota',
  });
  await repo.recordPayment('s', 400, 'key-0000001', 'Efectivo');
  assert.equal(calls[1]?.params?.p_idempotency_key, 'key-0000001');
});

test('el error de la base llega al usuario con su mensaje', async () => {
  const { repo } = mockClient({ rpcError: 'El pago excede lo liberable (40.00).' });
  await assert.rejects(() => repo.payCommission('c', 50, 'key-0000003', 'Transferencia'), /excede lo liberable/);
});

test('aprobar llama al backend con el JWT del administrador y traduce los errores', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init: RequestInit }[] = [];
  let status = 200;
  let body: unknown = { ok: true };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  try {
    const { repo } = mockClient({ token: 'jwt-admin' });
    await repo.approveRegistration('reg-1');
    assert.equal(requests[0]?.url, '/api/aliados-approve-registration');
    assert.equal((requests[0]?.init.headers as Record<string, string>).Authorization, 'Bearer jwt-admin');
    assert.equal(requests[0]?.init.body, JSON.stringify({ registration_id: 'reg-1' }));

    status = 409;
    body = { ok: false, error: 'email_already_registered' };
    await assert.rejects(() => repo.approveRegistration('reg-1'), /ya tiene una cuenta/);
    status = 403;
    body = { ok: false, error: 'forbidden' };
    await assert.rejects(() => repo.approveRegistration('reg-1'), /administrador/);
    status = 503;
    body = { ok: false, error: 'auth_admin_not_configured' };
    await assert.rejects(() => repo.approveRegistration('reg-1'), /clave de administración/);

    const noSession = mockClient({ token: null });
    await assert.rejects(() => noSession.repo.approveRegistration('reg-1'), /Sesión no válida/);
    assert.equal(requests.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
