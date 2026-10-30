// Auditoría CONTROLADA de permisos de Storage: escribe y borra solo `_audit/<runId>/` en portfolio-drafts y portfolio-published.
// Interactiva y manual. URL y anon key salen de .env.local (VITE_SUPABASE_*); las cuentas se piden por teclado
// (contraseñas con entrada oculta) y no pasan por variables de entorno, archivos ni argumentos.
//
//   npm run audit:portfolio-storage -- --dry-run     (ensayo local: sin red, sin cuentas)
//   PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS npm run audit:portfolio-storage
//
// Piloto parcial (una sola cuenta administradora + sesión anónima; NO es la auditoría completa):
//   npm run audit:portfolio-storage -- --piloto --dry-run
//   PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS npm run audit:portfolio-storage -- --piloto
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FakeStorageServer } from '../src/features/admin/portfolioFakeStorage';
import {
  checkAnonKey,
  PILOT_PENDING,
  runPortfolioStorageAudit,
  runPortfolioStoragePilot,
  type AuditClient,
  type AuditResult,
  type PublicRead,
} from './portfolioStorageAudit';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const EXPECTED_PROJECT_REF = process.env.PORTFOLIO_AUDIT_PROJECT_REF ?? 'rvvqhpbtqgjpzflopflv';

function prompt(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = (action: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      action();
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish(() => resolve(value.trim()));
        if (char === '\u0003') return finish(() => reject(new Error('Cancelado.')));
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0 && !hidden) stdout.write('\b \b');
          value = value.slice(0, -1);
        } else {
          value += char;
          if (!hidden) stdout.write(char);
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function signedInClient(url: string, anonKey: string, label: string) {
  const email = await prompt(`Correo de la cuenta ${label}: `, false);
  const password = await prompt(`Contraseña de la cuenta ${label} (no se muestra): `, true);
  if (!email || !password) throw new Error(`Faltan credenciales de la cuenta ${label}.`);
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesión con la cuenta ${label}.`);
  return { client, email };
}

// scope local: solo cierra la sesión creada aquí, no las sesiones reales de esa cuenta.
async function closeSession(client: SupabaseClient | undefined) {
  try {
    await client?.auth.signOut({ scope: 'local' });
  } catch {
    // La sesión expira sola.
  }
}

function reportPilot(results: AuditResult[], simulated: boolean) {
  const failed = results.filter((result) => !result.passed);
  for (const result of results) console.log(`${result.passed ? (simulated ? 'sim ' : 'PASS') : 'FAIL'}  ${result.name}${result.passed ? '' : ` — ${result.detail}`}`);
  console.log(`\nPILOTO PARCIAL (administradora + anónimo): ${results.length - failed.length}/${results.length} comprobaciones${simulated ? ' simuladas' : ''} correctas.`);
  console.log(`PENDIENTE: ${PILOT_PENDING}`);
  console.log('Esto NO es la auditoría completa de 28 comprobaciones.');
  return failed.length === 0;
}

async function publicRead(url: string, bucket: string, path: string): Promise<PublicRead> {
  const response = await fetch(`${url}/storage/v1/object/public/${bucket}/${path}`);
  return { status: response.status, contentType: response.headers.get('content-type'), bytes: new Uint8Array(await response.arrayBuffer()) };
}

async function pilotDryRun() {
  const server = new FakeStorageServer();
  const runId = 'ensayo-local';
  const results = await runPortfolioStoragePilot({
    anon: server.client('anon'),
    admin: server.client('admin'),
    publicRead: (bucket, path) => server.publicRead(bucket, path),
    runId,
  });
  console.log('ENSAYO LOCAL del piloto con Storage simulado. No se hizo ninguna conexión ni se usaron cuentas.\n');
  const outOfScope = server.log.filter((entry) => !(entry.op === 'list' ? entry.path === `_audit/${runId}` : entry.path.startsWith(`_audit/${runId}/`)));
  const ok = reportPilot(results, true);
  console.log(`Fuera de _audit/: ${outOfScope.length}.`);
  process.exitCode = ok && outOfScope.length === 0 ? 0 : 1;
}

// Ensayo: el mismo núcleo contra un Storage en memoria. No valida Supabase; solo muestra qué se ejecutaría.
async function dryRun() {
  const server = new FakeStorageServer();
  const runId = 'ensayo-local';
  const results = await runPortfolioStorageAudit({
    anon: server.client('anon'),
    user: server.client('user'),
    admin: server.client('admin'),
    publicGet: (bucket, path) => server.publicGet(bucket, path),
    runId,
  });
  console.log('ENSAYO LOCAL con Storage simulado. No se hizo ninguna conexión ni se usaron cuentas.\n');
  console.log('Buckets: portfolio-drafts, portfolio-published. Operaciones: upload, download, remove, list.');
  console.log(`Rutas: solo _audit/<id>/ (ningún archivo de proyecto). Rutas intentadas en el ensayo: ${new Set(server.log.map((entry) => entry.path)).size}.\n`);
  results.forEach((result, index) => console.log(`${String(index + 1).padStart(2)}. ${result.name}`));
  const outOfScope = server.log.filter((entry) => !(entry.op === 'list' ? entry.path === `_audit/${runId}` : entry.path.startsWith(`_audit/${runId}/`)));
  console.log(`\n${results.length} comprobaciones. Fuera de _audit/: ${outOfScope.length}. Simuladas correctas: ${results.filter((result) => result.passed).length}/${results.length}.`);
  process.exitCode = outOfScope.length === 0 && results.every((result) => result.passed) ? 0 : 1;
}

function resolveEnvironment(): { url: string; anonKey: string } {
  const url = (process.env.PORTFOLIO_AUDIT_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anonKey = process.env.PORTFOLIO_AUDIT_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (.env.local).');
  if (new URL(url).hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`) {
    throw new Error(`La URL de Supabase no corresponde al proyecto ${EXPECTED_PROJECT_REF}. No se hizo ninguna conexión.`);
  }
  const key = checkAnonKey(anonKey, EXPECTED_PROJECT_REF);
  if (!key.ok) throw new Error(`La clave pública no es válida para esta auditoría: ${key.detail}. No se hizo ninguna conexión.`);
  return { url, anonKey };
}

// Verificación previa: solo mira el entorno. Sin red, sin cuentas, sin escribir nada.
function preflight(pilot: boolean) {
  const { url, anonKey } = resolveEnvironment();
  console.log('VERIFICACIÓN PREVIA (sin red, sin cuentas, sin escritura)\n');
  console.log(`Proyecto esperado : ${EXPECTED_PROJECT_REF}`);
  console.log(`URL configurada   : ${new URL(url).origin}  -> corresponde`);
  console.log(`Clave pública     : ${checkAnonKey(anonKey, EXPECTED_PROJECT_REF).detail} (no se imprime)`);
  console.log(`Vercel/CI         : ${process.env.VERCEL || process.env.CI ? 'DETECTADO (la auditoría se negará)' : 'no detectado'}`);
  console.log(`Terminal interact.: ${process.stdin.isTTY && process.stdout.isTTY ? 'sí' : 'no (ejecuta el comando real en una terminal propia)'}`);
  console.log('Alcance           : portfolio-drafts y portfolio-published, solo _audit/<runId>/');
  console.log(`\nComando real: PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS npm run audit:portfolio-storage -- ${pilot ? '--piloto' : ''}`.trimEnd());
}

async function main() {
  const pilot = process.argv.includes('--piloto');
  if (process.argv.includes('--dry-run')) return pilot ? pilotDryRun() : dryRun();
  if (process.argv.includes('--preflight')) return preflight(pilot);
  if (process.env.PORTFOLIO_AUDIT_CONFIRM !== 'WRITE_AUDIT_OBJECTS') {
    throw new Error('Define PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS para confirmar que se escribirá en Storage real.');
  }
  if (process.env.VERCEL || process.env.CI) {
    throw new Error('La auditoría solo se ejecuta manualmente desde una máquina local.');
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('La auditoría es interactiva: ejecútala en una terminal propia para escribir las contraseñas.');
  }

  const { url, anonKey } = resolveEnvironment();
  console.log(`Proyecto confirmado: ${EXPECTED_PROJECT_REF} (${new URL(url).hostname}). Se pedirán las credenciales a continuación.\n`);
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let admin: SupabaseClient | undefined;
  let user: SupabaseClient | undefined;
  try {
    const adminSession = await signedInClient(url, anonKey, 'ADMINISTRADORA');
    admin = adminSession.client;
    if (pilot) {
      const { data: pilotAdminRow } = await admin.from('admin_users').select('user_id').maybeSingle();
      if (!pilotAdminRow) throw new Error('La cuenta administradora no figura en admin_users.');
      const pilotRunId = `${new Date().toISOString().replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
      console.log(`\nProyecto ${EXPECTED_PROJECT_REF}. PILOTO: rutas de prueba solo en _audit/${pilotRunId}/ en portfolio-drafts y portfolio-published.\n`);
      const pilotResults = await runPortfolioStoragePilot({
        anon: anon.storage as unknown as AuditClient,
        admin: admin.storage as unknown as AuditClient,
        publicRead: (bucket, path) => publicRead(url, bucket, path),
        runId: pilotRunId,
      });
      process.exitCode = reportPilot(pilotResults, false) ? 0 : 1;
      return;
    }
    const userSession = await signedInClient(url, anonKey, 'AUTENTICADA SIN ROL ADMINISTRATIVO');
    user = userSession.client;
    if (adminSession.email.toLowerCase() === userSession.email.toLowerCase()) {
      throw new Error('Las dos cuentas deben ser distintas.');
    }

    // Lectura de la propia fila: la RLS de admin_users solo muestra la del usuario autenticado.
    const { data: adminRow } = await admin.from('admin_users').select('user_id').maybeSingle();
    const { data: userRow } = await user.from('admin_users').select('user_id').maybeSingle();
    if (!adminRow) throw new Error('La cuenta administradora no figura en admin_users.');
    if (userRow) throw new Error('La cuenta "sin rol" figura en admin_users; usa otra cuenta.');

    const runId = `${new Date().toISOString().replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\nProyecto ${EXPECTED_PROJECT_REF}. Rutas de prueba: _audit/${runId}/ en portfolio-drafts y portfolio-published.\n`);
    const results = await runPortfolioStorageAudit({
      anon: anon.storage as unknown as AuditClient,
      user: user.storage as unknown as AuditClient,
      admin: admin.storage as unknown as AuditClient,
      publicGet: async (bucket, path) => (await fetch(`${url}/storage/v1/object/public/${bucket}/${path}`)).status,
      runId,
    });

    for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.name}${result.passed ? '' : ` — ${result.detail}`}`);
    const failed = results.filter((result) => !result.passed);
    console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas.`);
    process.exitCode = failed.length === 0 ? 0 : 1;
  } finally {
    await closeSession(admin);
    await closeSession(user);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
