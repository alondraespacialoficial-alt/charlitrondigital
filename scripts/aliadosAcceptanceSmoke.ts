// Prueba REAL de aceptacion electronica con sesiones de Supabase Auth contra el proyecto de LABORATORIO de Aliados
// (charlitron-aliados-test) con 0006 y 0007 instaladas. Nunca imprime correos, contrasenas ni claves.
// Uso: npm run smoke:aliados-acceptance
//   ALIADOS_SMOKE_URL, ALIADOS_SMOKE_ANON_KEY (clave publica anon)
//   ALIADOS_SMOKE_ADMIN_EMAIL, ALIADOS_SMOKE_ADMIN_PASSWORD
//   ALIADOS_SMOKE_ALLY_EMAIL, ALIADOS_SMOKE_ALLY_PASSWORD  -> aliado FICTICIO invitado, activado y SIN aceptacion previa
// Escribe una aceptacion y una recomendacion ficticia (@example.invalid) en el laboratorio; no toca ventas ni comisiones.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const REQUIRED = [
  'ALIADOS_SMOKE_URL',
  'ALIADOS_SMOKE_ANON_KEY',
  'ALIADOS_SMOKE_ADMIN_EMAIL',
  'ALIADOS_SMOKE_ADMIN_PASSWORD',
  'ALIADOS_SMOKE_ALLY_EMAIL',
  'ALIADOS_SMOKE_ALLY_PASSWORD',
] as const;

const env = process.env;
const missing = REQUIRED.filter((name) => !env[name]);
if (missing.length > 0) {
  console.error(`Faltan variables: ${missing.join(', ')}`);
  process.exit(2);
}
const url = env.ALIADOS_SMOKE_URL!.replace(/\/+$/, '');
const anonKey = env.ALIADOS_SMOKE_ANON_KEY!;
if (url.includes('rvvqhpbtqgjpzflopflv')) {
  console.error('ALIADOS_SMOKE_URL apunta al proyecto editorial: no permitido.');
  process.exit(2);
}
if (anonKey.startsWith('sb_secret_')) {
  console.error('ALIADOS_SMOKE_ANON_KEY parece una clave secreta: no permitido.');
  process.exit(2);
}

const TERMS_VERSION = '1.0';
const PRIVACY_VERSION = '1.2';
const newClient = (): SupabaseClient =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

let failures = 0;
function report(name: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASA  ' : 'FALLA '} ${name}`);
}
const privilege = (error: { code?: string; status?: number; message?: string } | null) =>
  Boolean(error) && (error!.code === '42501' || error!.status === 401 || error!.status === 403 || /permission denied/i.test(error!.message ?? ''));

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error('No se pudo iniciar sesion con una de las cuentas de prueba.');
  return client;
}

async function main() {
  const ally = await signIn(env.ALIADOS_SMOKE_ALLY_EMAIL!, env.ALIADOS_SMOKE_ALLY_PASSWORD!);
  const admin = await signIn(env.ALIADOS_SMOKE_ADMIN_EMAIL!, env.ALIADOS_SMOKE_ADMIN_PASSWORD!);
  const anon = newClient();
  const stamp = Date.now();

  // 1. Registro publico cerrado.
  const open = await anon.rpc('aliados_registration_open');
  report('registro publico: aliados_registration_open = false', !open.error && open.data === false);
  const signup = await anon.rpc('submit_ally_registration', {
    p_email: `cerrado-${stamp}@example.invalid`, p_full_name: 'Registro Cerrado', p_phone: null, p_city: null, p_consent: true,
  });
  report('registro publico: submit_ally_registration rechaza el alta', Boolean(signup.error));

  // 2. Sin aceptacion: bloqueado en la base.
  const before = await ally.rpc('ally_acceptance_state');
  const state0 = Array.isArray(before.data) ? before.data[0] : before.data;
  report('invitado: estado = no aceptado (precondicion; versiones vigentes 1.0 / 1.2)',
    !before.error && state0?.accepted === false && state0?.current_terms_version === TERMS_VERSION && state0?.current_privacy_version === PRIVACY_VERSION);
  const blocked = await ally.rpc('submit_referral', {
    p_name: 'Prospecto Ficticio', p_email: `bloqueado-${stamp}@example.invalid`, p_phone: null, p_city: null, p_organization: null, p_authorized: true,
  });
  report('sin aceptacion: submit_referral rechazado', privilege(blocked.error));
  const views = await Promise.all([ally.from('ally_my_referrals').select('id'), ally.from('ally_my_commissions').select('id'), ally.from('ally_my_commission_payments').select('id')]);
  report('sin aceptacion: vistas ally_my_* vacias', views.every((view) => !view.error && (view.data ?? []).length === 0));

  // 3. Evidencia no falsificable desde el navegador.
  const forged = await ally.from('ally_acceptances').insert({ user_id: '00000000-0000-0000-0000-000000000000', terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
  report('el navegador no puede escribir ally_acceptances', Boolean(forged.error));
  const half = await ally.rpc('ally_accept_terms', { p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION, p_terms_accepted: true, p_privacy_confirmed: false });
  report('una sola casilla: la base rechaza y no registra', Boolean(half.error));
  const wrongVersion = await ally.rpc('ally_accept_terms', { p_terms_version: '0.9', p_privacy_version: PRIVACY_VERSION, p_terms_accepted: true, p_privacy_confirmed: true });
  report('version no vigente: la base rechaza', Boolean(wrongVersion.error));

  // 4. Aceptacion valida y verificable.
  const accepted = await ally.rpc('ally_accept_terms', { p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION, p_terms_accepted: true, p_privacy_confirmed: true });
  report('ambas casillas: ally_accept_terms registra la aceptacion', !accepted.error && typeof accepted.data === 'string');
  const after = await ally.rpc('ally_acceptance_state');
  const state1 = Array.isArray(after.data) ? after.data[0] : after.data;
  report('verificacion posterior: estado = aceptado', !after.error && state1?.accepted === true);
  const okReferral = await ally.rpc('submit_referral', {
    p_name: 'Prospecto Ficticio', p_email: `aceptado-${stamp}@example.invalid`, p_phone: null, p_city: null, p_organization: null, p_authorized: true,
  });
  report('con aceptacion: submit_referral funciona', !okReferral.error);
  const mine = await ally.from('ally_my_referrals').select('id');
  report('con aceptacion: el aliado ve su recomendacion', !mine.error && (mine.data ?? []).length >= 1);

  // 5. Evidencia visible solo para el administrador.
  const rows = await admin.from('admin_ally_acceptances').select('terms_version,privacy_version,terms_accepted,privacy_notice_available_confirmed,action,source,accepted_at,terms_sha256,privacy_sha256').eq('id', accepted.data);
  const row = rows.data?.[0];
  report('admin: la evidencia existe con versiones, huellas, accion, origen y fecha del servidor',
    !rows.error && row?.terms_version === TERMS_VERSION && row?.privacy_version === PRIVACY_VERSION && row?.terms_accepted === true
    && row?.privacy_notice_available_confirmed === true && row?.action === 'checkbox_accept_and_enter'
    && row?.source === 'aliados_web_acceptance_screen' && Boolean(row?.accepted_at) && /^[0-9a-f]{64}$/.test(row?.terms_sha256 ?? '') && /^[0-9a-f]{64}$/.test(row?.privacy_sha256 ?? ''));
  const own = await ally.from('admin_ally_acceptances').select('id');
  report('el aliado no ve la vista de auditoria', !own.error && (own.data ?? []).length === 0);

  // 6. Administrador sin regresiones (solo lectura).
  for (const view of ['admin_registrations', 'admin_allies', 'admin_referrals', 'admin_sales', 'admin_payments', 'admin_commissions', 'admin_commission_payments', 'admin_audit_log']) {
    const result = await admin.from(view).select('*', { count: 'exact', head: true });
    report(`admin: ${view} accesible`, !result.error);
  }
  const adminReferral = await admin.rpc('submit_referral', { p_name: 'X Persona', p_email: `admin-${stamp}@example.invalid`, p_phone: null, p_city: null, p_organization: null, p_authorized: true });
  report('admin: submit_referral sigue reservado a aliados', privilege(adminReferral.error));

  // 7. El registro publico sigue cerrado al terminar.
  const closed = await anon.rpc('aliados_registration_open');
  report('registro publico: sigue cerrado al terminar', !closed.error && closed.data === false);

  console.log(failures === 0 ? '\nTODAS LAS VERIFICACIONES PASARON' : `\n${failures} verificacion(es) fallaron`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
