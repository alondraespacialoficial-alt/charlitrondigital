// Prueba con sesiones REALES de Supabase Auth contra el proyecto de Aliados (laboratorio o pila local).
// Lee todo del entorno y nunca imprime correos, contrasenas ni claves. Uso: npm run smoke:aliados-auth
//   ALIADOS_SMOKE_URL, ALIADOS_SMOKE_ANON_KEY (clave publica anon)
//   ALIADOS_SMOKE_ADMIN_EMAIL, ALIADOS_SMOKE_ADMIN_PASSWORD
//   ALIADOS_SMOKE_ALLY_EMAIL, ALIADOS_SMOKE_ALLY_PASSWORD
// Opcionales: ALIADOS_SMOKE_PROBE_SIGNUP=1 (intenta registrar un correo .invalid; solo si el registro
//   debe estar desactivado), ALIADOS_SMOKE_MUTATE=1 (aprueba y pausa al aliado: solo en pila local).
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
const editorialHost = (() => {
  try {
    return new URL(env.VITE_SUPABASE_URL ?? '').host;
  } catch {
    return '';
  }
})();
if (url.includes('rvvqhpbtqgjpzflopflv') || (editorialHost && new URL(url).host === editorialHost)) {
  console.error('ALIADOS_SMOKE_URL apunta al proyecto editorial: no permitido.');
  process.exit(2);
}
if (anonKey.startsWith('sb_secret_')) {
  console.error('ALIADOS_SMOKE_ANON_KEY parece una clave secreta: no permitido.');
  process.exit(2);
}

const mutate = env.ALIADOS_SMOKE_MUTATE === '1';
const probeSignup = env.ALIADOS_SMOKE_PROBE_SIGNUP === '1';

const newClient = (): SupabaseClient =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

let failures = 0;
function report(name: string, ok: boolean) {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASA  ' : 'FALLA '} ${name}`);
}

interface Failure {
  code?: string;
  status?: number;
  message?: string;
}
const isPrivilegeError = (error: Failure | null | undefined) =>
  Boolean(error) && (error!.code === '42501' || error!.status === 401 || error!.status === 403 || /permission denied/i.test(error!.message ?? ''));

async function denied(label: string, run: () => PromiseLike<{ error: Failure | null }>) {
  const { error } = await run();
  report(label, isPrivilegeError(error));
}

async function main() {
  const anon = newClient();
  await denied('anon: no lee ally_profiles', () => anon.from('ally_profiles').select('user_id'));
  await denied('anon: no lee admin_users', () => anon.from('admin_users').select('user_id'));
  await denied('anon: no lee account_roles', () => anon.from('account_roles').select('user_id'));
  await denied('anon: no lee lab_environment', () => anon.from('lab_environment').select('environment'));
  await denied('anon: no ejecuta is_admin()', () => anon.rpc('is_admin'));

  const wrong = await newClient().auth.signInWithPassword({ email: env.ALIADOS_SMOKE_ADMIN_EMAIL!, password: `${env.ALIADOS_SMOKE_ADMIN_PASSWORD}-x` });
  report('contrasena incorrecta: rechazada sin sesion', Boolean(wrong.error) && !wrong.data.session);

  if (probeSignup) {
    const probe = await newClient().auth.signUp({ email: `aliados-sondeo-${Date.now()}@example.invalid`, password: `Sondeo-${Date.now()}-Aa1!` });
    report('registro publico desactivado (signUp rechazado)', Boolean(probe.error) && !probe.data.session);
  } else {
    console.log('OMITIDA registro publico (ALIADOS_SMOKE_PROBE_SIGNUP=1 para sondearlo)');
  }

  // ---- Administrador ----
  const admin = newClient();
  const adminLogin = await admin.auth.signInWithPassword({ email: env.ALIADOS_SMOKE_ADMIN_EMAIL!, password: env.ALIADOS_SMOKE_ADMIN_PASSWORD! });
  report('administrador: inicia sesion', !adminLogin.error && Boolean(adminLogin.data.session));
  if (adminLogin.error) throw new Error('Sin sesion de administrador; se detiene.');
  const adminId = adminLogin.data.user.id;

  const adminRpc = await admin.rpc('is_admin');
  report('administrador: is_admin() = true', adminRpc.data === true);
  const ownAdminRow = await admin.from('admin_users').select('user_id');
  report('administrador: ve solo su fila de admin_users', (ownAdminRow.data ?? []).length === 1 && ownAdminRow.data?.[0].user_id === adminId);
  const allProfiles = await admin.from('ally_profiles').select('user_id,status');
  report('administrador: ve los perfiles de aliados', (allProfiles.data ?? []).length >= 1);
  await denied('administrador: no lee account_roles', () => admin.from('account_roles').select('user_id'));
  await denied('administrador: no lee lab_environment', () => admin.from('lab_environment').select('environment'));
  await denied('administrador: no edita display_name', () => admin.from('ally_profiles').update({ display_name: 'xx' }).neq('user_id', adminId));
  await denied('administrador: no inserta en admin_users', () => admin.from('admin_users').insert({ user_id: adminId }));
  await denied('administrador: no borra perfiles', () => admin.from('ally_profiles').delete().neq('user_id', adminId));
  const allyRow = (allProfiles.data ?? [])[0] as { user_id: string; status: string } | undefined;
  if (allyRow) {
    const bogus = await admin.from('ally_profiles').update({ status: 'bogus' }).eq('user_id', allyRow.user_id).select();
    const after = await admin.from('ally_profiles').select('status').eq('user_id', allyRow.user_id).single();
    report('administrador: un estado invalido es rechazado y no cambia nada', Boolean(bogus.error) && after.data?.status === allyRow.status);
  }

  // ---- Aliado (pendiente) ----
  const ally = newClient();
  const allyLogin = await ally.auth.signInWithPassword({ email: env.ALIADOS_SMOKE_ALLY_EMAIL!, password: env.ALIADOS_SMOKE_ALLY_PASSWORD! });
  report('aliado: inicia sesion', !allyLogin.error && Boolean(allyLogin.data.session));
  if (allyLogin.error) throw new Error('Sin sesion de aliado; se detiene.');
  const allyId = allyLogin.data.user.id;

  const allyRpc = await ally.rpc('is_admin');
  report('aliado: is_admin() = false', allyRpc.data === false);
  const allyAdminRows = await ally.from('admin_users').select('user_id');
  report('aliado: no ve filas de admin_users', !allyAdminRows.error && (allyAdminRows.data ?? []).length === 0);
  const ownProfile = await ally.from('ally_profiles').select('user_id,status,display_name');
  report('aliado: ve exactamente su perfil', (ownProfile.data ?? []).length === 1 && ownProfile.data?.[0].user_id === allyId);
  const startStatus = (ownProfile.data?.[0] as { status?: string } | undefined)?.status;
  await denied('aliado: no lee account_roles', () => ally.from('account_roles').select('user_id'));
  await denied('aliado: no lee lab_environment', () => ally.from('lab_environment').select('environment'));
  await denied('aliado: no ejecuta assert_aliados_lab()', () => ally.rpc('assert_aliados_lab'));
  await denied('aliado: no edita display_name', () => ally.from('ally_profiles').update({ display_name: 'xx' }).eq('user_id', allyId));
  await denied('aliado: no escribe approved_by', () => ally.from('ally_profiles').update({ approved_by: allyId }).eq('user_id', allyId));
  await denied('aliado: no inserta en ally_profiles', () => ally.from('ally_profiles').insert({ user_id: allyId, display_name: 'dup' }));
  await denied('aliado: no borra su perfil', () => ally.from('ally_profiles').delete().eq('user_id', allyId));
  await denied('aliado: no se hace administrador', () => ally.from('admin_users').insert({ user_id: allyId }));
  const selfActivate = await ally.from('ally_profiles').update({ status: 'active' }).eq('user_id', allyId).select();
  const recheck = await ally.from('ally_profiles').select('status').eq('user_id', allyId).single();
  report('aliado: no puede activarse a si mismo (0 filas, estado sin cambios)', (selfActivate.data ?? []).length === 0 && recheck.data?.status === startStatus);
  if (startStatus === 'pending') report('aliado pendiente: sin acceso a funciones administrativas (is_admin false, sin datos admin)', allyRpc.data === false && (allyAdminRows.data ?? []).length === 0);

  // ---- Flujo de aprobacion (solo con MUTATE, pila local) ----
  if (mutate && startStatus === 'pending') {
    const activate = await admin.from('ally_profiles').update({ status: 'active' }).eq('user_id', allyId).select('status,approved_by,approved_at');
    const row = activate.data?.[0] as { status: string; approved_by: string | null; approved_at: string | null } | undefined;
    report('administrador: aprueba al aliado (pending a active) con auditoria', row?.status === 'active' && row.approved_by === adminId && Boolean(row.approved_at));
    const pause = await admin.from('ally_profiles').update({ status: 'paused' }).eq('user_id', allyId).select('status,approved_at');
    report('administrador: pausa al aliado y conserva la aprobacion', pause.data?.[0]?.status === 'paused' && pause.data?.[0]?.approved_at === row?.approved_at);
    const toPending = await admin.from('ally_profiles').update({ status: 'pending' }).eq('user_id', allyId).select();
    report('administrador: no puede devolver a pending', Boolean(toPending.error));
    const reactivate = await admin.from('ally_profiles').update({ status: 'active' }).eq('user_id', allyId).select('status');
    report('administrador: reactiva al aliado', reactivate.data?.[0]?.status === 'active');
    const seen = await ally.from('ally_profiles').select('status');
    report('aliado: ve su estado actualizado (active)', seen.data?.[0]?.status === 'active');
  } else if (mutate) {
    console.log('OMITIDA flujo de aprobacion (el aliado no esta en pending)');
  } else {
    console.log('OMITIDA flujo de aprobacion (ALIADOS_SMOKE_MUTATE=1; modifica datos, solo en pila local)');
  }

  // ---- Cierre de sesion ----
  if (mutate) {
    await ally.auth.updateUser({ data: { role: 'admin', is_admin: true } });
    await ally.auth.refreshSession();
    const elevated = await ally.rpc('is_admin');
    const elevatedRows = await ally.from('admin_users').select('user_id');
    report('aliado: editar user_metadata no otorga rol de administrador', elevated.data === false && (elevatedRows.data ?? []).length === 0);
  }
  await ally.auth.signOut();
  const after = await ally.auth.getSession();
  report('aliado: cierre de sesion elimina la sesion', after.data.session === null);
  await denied('aliado tras cerrar sesion: pierde el acceso a ally_profiles', () => ally.from('ally_profiles').select('user_id'));
  await admin.auth.signOut();
  const adminAfter = await admin.auth.getSession();
  report('administrador: cierre de sesion elimina la sesion', adminAfter.data.session === null);
  await denied('administrador tras cerrar sesion: pierde el acceso', () => admin.from('admin_users').select('user_id'));
}

main()
  .catch((error: unknown) => {
    failures += 1;
    console.log(`FALLA  ${error instanceof Error ? error.message : 'error inesperado'}`);
  })
  .finally(() => {
    console.log(`\nRESULTADO GLOBAL: ${failures === 0 ? 'PASA' : `FALLA (${failures})`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
