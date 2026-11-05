import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchRegistrationAvailability,
  normalizeRegistration,
  registrationErrorMessage,
  submitAllyRegistration,
  validateRegistration,
  type RegistrationInput,
} from './aliadosRegistration';

const valid: RegistrationInput = {
  name: '  Ana   Pérez ',
  email: ' Ana@Ejemplo.COM ',
  whatsapp: '444 123 4567',
  city: ' San Luis   Potosí ',
  accepted: true,
};

type Reply = { data: unknown; error: { message?: string; code?: string } | null };

function mockClient(reply: Reply | (() => never)) {
  const calls: { name: string; params?: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      rpc: (name: string, params?: Record<string, unknown>) => {
        calls.push({ name, params });
        if (typeof reply === 'function') reply();
        return Promise.resolve(reply as Reply);
      },
    },
  };
}

test('un formulario completo es valido y se normaliza', () => {
  assert.deepEqual(validateRegistration(valid), {});
  assert.deepEqual(normalizeRegistration(valid), {
    name: 'Ana Pérez',
    email: 'ana@ejemplo.com',
    whatsapp: '444 123 4567',
    city: 'San Luis Potosí',
    accepted: true,
  });
});

test('cada campo obligatorio se valida y la aceptacion explicita es indispensable', () => {
  const errors = validateRegistration({ name: 'A', email: 'no-es-correo', whatsapp: '123', city: '', accepted: false });
  assert.deepEqual(Object.keys(errors).sort(), ['accepted', 'city', 'email', 'name', 'whatsapp']);
  assert.match(errors.accepted ?? '', /Aviso de Privacidad y los Términos/);
  assert.ok(validateRegistration({ ...valid, whatsapp: 'abcdefghij' }).whatsapp);
  assert.ok(validateRegistration({ ...valid, whatsapp: '5551234567890123' }).whatsapp);
  assert.equal(validateRegistration({ ...valid, whatsapp: '+52 (444) 123-4567' }).whatsapp, undefined);
});

test('registrar llama solo a submit_ally_registration con los datos normalizados', async () => {
  const { client, calls } = mockClient({ data: null, error: null });
  assert.equal(await submitAllyRegistration(client, valid), '');
  assert.deepEqual(calls, [
    {
      name: 'submit_ally_registration',
      params: { p_email: 'ana@ejemplo.com', p_full_name: 'Ana Pérez', p_phone: '444 123 4567', p_city: 'San Luis Potosí', p_consent: true },
    },
  ]);
});

test('datos invalidos o sin aceptar no llegan a la base', async () => {
  const { client, calls } = mockClient({ data: null, error: null });
  assert.notEqual(await submitAllyRegistration(client, { ...valid, accepted: false }), '');
  assert.notEqual(await submitAllyRegistration(client, { ...valid, email: 'x' }), '');
  assert.equal(calls.length, 0);
});

test('la respuesta de exito no depende de si el correo ya existe (no revela cuentas)', async () => {
  const first = mockClient({ data: null, error: null });
  const second = mockClient({ data: null, error: null });
  assert.equal(await submitAllyRegistration(first.client, valid), await submitAllyRegistration(second.client, valid));
});

test('los errores de la base se traducen sin exponer detalles tecnicos', async () => {
  assert.match(registrationErrorMessage({ message: 'El registro de aliados aun no esta abierto.' }), /todavía no está abierto/);
  assert.match(registrationErrorMessage({ code: '54000', message: 'Hay demasiadas solicitudes en este momento.' }), /muchas solicitudes/);
  assert.match(registrationErrorMessage({ message: 'TypeError: Failed to fetch' }), /Sin conexión/);
  assert.match(registrationErrorMessage({ message: 'relation "x" does not exist' }), /No se pudo enviar/);
  const limited = mockClient({ data: null, error: { code: '54000', message: 'Hay demasiadas solicitudes' } });
  assert.match(await submitAllyRegistration(limited.client, valid), /muchas solicitudes/);
  const thrown = mockClient(() => {
    throw new Error('Failed to fetch');
  });
  assert.match(await submitAllyRegistration(thrown.client, valid), /Sin conexión/);
});

test('la disponibilidad solo es "open" si la base lo confirma; ante cualquier duda es cerrada o desconocida', async () => {
  assert.equal(await fetchRegistrationAvailability(mockClient({ data: true, error: null }).client), 'open');
  assert.equal(await fetchRegistrationAvailability(mockClient({ data: false, error: null }).client), 'closed');
  assert.equal(await fetchRegistrationAvailability(mockClient({ data: null, error: null }).client), 'closed');
  assert.equal(await fetchRegistrationAvailability(mockClient({ data: null, error: { message: 'function does not exist' } }).client), 'unknown');
  const thrown = mockClient(() => {
    throw new Error('red');
  });
  assert.equal(await fetchRegistrationAvailability(thrown.client), 'unknown');
});
