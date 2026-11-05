import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateAccount,
  activationErrorMessage,
  linkErrorMessage,
  parseAuthLink,
  passwordIssue,
  type ActivationClient,
  type AuthLink,
} from './aliadosActivation';

const link: Extract<AuthLink, { kind: 'tokens' }> = { kind: 'tokens', accessToken: 'acc', refreshToken: 'ref', type: 'invite' };
const GOOD = 'ClaveSegura2026';

function mockClient(options: { session?: { code?: string; status?: number }; update?: { code?: string; status?: number } } = {}) {
  const calls: string[] = [];
  const client: ActivationClient = {
    auth: {
      setSession: async (tokens) => {
        calls.push(`setSession:${tokens.access_token}:${tokens.refresh_token}`);
        return { error: options.session ?? null };
      },
      updateUser: async (attributes) => {
        calls.push(`updateUser:${attributes.password.length}`);
        return { error: options.update ?? null };
      },
      signOut: async () => {
        calls.push('signOut');
        return {};
      },
    },
  };
  return { client, calls };
}

test('el enlace de invitacion se lee del fragmento y del query', () => {
  assert.deepEqual(parseAuthLink('#access_token=acc&refresh_token=ref&expires_in=3600&token_type=bearer&type=invite'), link);
  assert.deepEqual(parseAuthLink('', '?access_token=acc&refresh_token=ref&type=recovery'), { ...link, type: 'recovery' });
});

test('un enlace expirado o con error se reconoce y nunca se trata como sesion', () => {
  const expired = parseAuthLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.deepEqual(expired, { kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' });
  assert.match(linkErrorMessage('otp_expired'), /expiró o ya fue usado/);
  assert.equal(parseAuthLink('#error=server_error').kind, 'error');
});

test('sin tokens completos o con un tipo ajeno no hay activacion', () => {
  assert.equal(parseAuthLink('').kind, 'none');
  assert.equal(parseAuthLink('#access_token=acc&type=invite').kind, 'none');
  assert.equal(parseAuthLink('#access_token=acc&refresh_token=ref&type=magiclink').kind, 'none');
  assert.equal(parseAuthLink('#access_token=acc&refresh_token=ref').kind, 'none');
});

test('la contrasena exige longitud, letras y numero, y que coincida', () => {
  assert.match(passwordIssue('Corta1', 'Corta1'), /al menos 10/);
  assert.match(passwordIssue('SoloLetrasLargas', 'SoloLetrasLargas'), /letras y al menos un número/);
  assert.match(passwordIssue('1234567890123', '1234567890123'), /letras y al menos un número/);
  assert.match(passwordIssue(GOOD, 'Otra2026Clave'), /no coinciden/);
  assert.match(passwordIssue('a1'.repeat(40), 'a1'.repeat(40)), /no puede superar/);
  assert.equal(passwordIssue(GOOD, GOOD), '');
});

test('activar: abre la sesion con los tokens y despues fija la contrasena', async () => {
  const { client, calls } = mockClient();
  assert.equal(await activateAccount(client, link, GOOD, GOOD), '');
  assert.deepEqual(calls, ['setSession:acc:ref', `updateUser:${GOOD.length}`]);
});

test('una contrasena invalida no abre ninguna sesion', async () => {
  const { client, calls } = mockClient();
  assert.notEqual(await activateAccount(client, link, 'corta', 'corta'), '');
  assert.notEqual(await activateAccount(client, link, GOOD, 'distinta12345'), '');
  assert.deepEqual(calls, []);
});

test('enlace vencido al abrir la sesion: mensaje de expiracion y no se cambia nada', async () => {
  const { client, calls } = mockClient({ session: { code: 'bad_jwt', status: 401 } });
  assert.match(await activateAccount(client, link, GOOD, GOOD), /expiró o ya fue usado/);
  assert.deepEqual(calls, ['setSession:acc:ref']);
});

test('errores al guardar la contrasena: debil, repetida y sesion vencida', async () => {
  const weak = mockClient({ update: { code: 'weak_password' } });
  assert.match(await activateAccount(weak.client, link, GOOD, GOOD), /demasiado débil/);
  assert.equal(weak.calls.includes('signOut'), false, 'se puede reintentar sin perder la sesion');

  const same = mockClient({ update: { code: 'same_password' } });
  assert.match(await activateAccount(same.client, link, GOOD, GOOD), /distinta/);

  const expired = mockClient({ update: { code: 'session_expired', status: 401 } });
  assert.match(await activateAccount(expired.client, link, GOOD, GOOD), /expiró o ya fue usado/);
  assert.ok(expired.calls.includes('signOut'), 'una sesion invalida se cierra');
});

test('los mensajes de error no exponen detalles tecnicos ni tokens', () => {
  assert.equal(activationErrorMessage(null), '');
  const message = activationErrorMessage({ message: 'JWT acc.def.ghi inválido: stack trace', code: 'unexpected' });
  assert.equal(/acc|stack|JWT/.test(message), false);
  assert.match(activationErrorMessage({ message: 'Failed to fetch' }), /Sin conexión/);
});
