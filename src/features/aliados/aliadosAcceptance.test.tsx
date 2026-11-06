import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AllyAcceptanceScreen } from './AllyAcceptance';
import { AllyRegistrationPage } from './AllyPublicPages';
import {
  ACCEPT_BUTTON_LABEL,
  PRIVACY_CHECKBOX_LABEL,
  TERMS_CHECKBOX_LABEL,
  canSubmitAcceptance,
  fetchAcceptanceState,
  recordAcceptance,
  type AcceptanceClient,
} from './aliadosAcceptance';
import { ALIADOS_LEGAL_APPROVED } from './aliadosLegal';
import { destinationFor, resolveAliadosRole, type RoleQueryClient } from './aliadosRole';

type Call = { fn: string; args?: Record<string, unknown> };

// Modela el comportamiento de la base: solo ally_accept_terms puede pasar el estado a "aceptado".
function fakeDatabase(options: { saveError?: { code?: string; message?: string }; saveThrows?: boolean; neverVisible?: boolean; stateError?: boolean } = {}) {
  const calls: Call[] = [];
  let accepted = false;
  const client: AcceptanceClient = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === 'ally_accept_terms') {
        if (options.saveThrows) throw new TypeError('Failed to fetch');
        if (options.saveError) return { data: null, error: options.saveError };
        accepted = !options.neverVisible;
        return { data: 'evidencia-1', error: null };
      }
      if (fn === 'ally_acceptance_state') {
        if (options.stateError) return { data: null, error: { code: '500' } };
        return { data: [{ accepted, current_terms_version: '1.0', current_privacy_version: '1.2', accepted_at: null }], error: null };
      }
      return { data: null, error: { code: '42883' } };
    },
  };
  return { client, calls, isAccepted: () => accepted };
}

const both = { terms: true, privacy: true };

function roleClient(db: AcceptanceClient): RoleQueryClient {
  return {
    rpc: (fn, args) => db.rpc(fn, args),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'ally_profiles' ? { data: { display_name: 'Ana', status: 'active' }, error: null } : { data: null, error: null },
        }),
      }),
    }),
  };
}

const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, element));

// ------------------------------------------------------------------ Pantalla

test('la pantalla de aceptacion tiene dos casillas independientes y desmarcadas, con los textos exactos', () => {
  const html = render(createElement(AllyAcceptanceScreen, { onAccept: async () => '' }));
  assert.equal(TERMS_CHECKBOX_LABEL, 'He leído y acepto los Términos y Condiciones de Aliados Charlitron, versión 1.0, y entiendo que las comisiones se acuerdan por proyecto y no están garantizadas');
  assert.equal(PRIVACY_CHECKBOX_LABEL, 'Confirmo que el Aviso Integral de Privacidad, versión 1.2, fue puesto a mi disposición y pude consultarlo');
  assert.ok(html.includes(TERMS_CHECKBOX_LABEL));
  assert.ok(html.includes(PRIVACY_CHECKBOX_LABEL));
  const checkboxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
  assert.equal(checkboxes.length, 2);
  assert.deepEqual(checkboxes.map((box) => /name="([^"]+)"/.exec(box)?.[1]), ['accept_terms', 'accept_privacy']);
  for (const box of checkboxes) assert.equal(/\bchecked\b/.test(box), false, 'nacen desmarcadas');
});

test('el boton nace deshabilitado y su texto es el indicado', () => {
  const html = render(createElement(AllyAcceptanceScreen, { onAccept: async () => '' }));
  assert.equal(ACCEPT_BUTTON_LABEL, 'Aceptar condiciones y entrar al panel');
  const button = /<button[^>]*type="submit"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(button, /disabled/);
  assert.match(html, /Aceptar condiciones y entrar al panel/);
});

test('el boton solo se habilita con ambas casillas marcadas', () => {
  assert.equal(canSubmitAcceptance({ terms: false, privacy: false }), false);
  assert.equal(canSubmitAcceptance({ terms: true, privacy: false }), false);
  assert.equal(canSubmitAcceptance({ terms: false, privacy: true }), false);
  assert.equal(canSubmitAcceptance(both), true);
});

test('la pantalla enlaza a los documentos completos y aclara que el aviso no es consentimiento para datos financieros', () => {
  const html = render(createElement(AllyAcceptanceScreen, { onAccept: async () => '' }));
  assert.match(html, /href="\/aliados\/terminos"/);
  assert.match(html, /href="\/aliados\/privacidad"/);
  assert.match(html, /solo confirma que el aviso estuvo a tu disposición; no es un consentimiento para tratar datos fiscales o bancarios/);
});

// ------------------------------------------------------------------ Casos de aceptacion

test('1. invitado sin aceptacion: acceso bloqueado (ruta a la pantalla de aceptacion, nunca al panel)', async () => {
  const db = fakeDatabase();
  const role = await resolveAliadosRole(roleClient(db.client), 'u1');
  assert.deepEqual(role, { kind: 'ally', status: 'active', displayName: 'Ana', accepted: false });
  assert.equal(destinationFor(role), 'acceptance');
  assert.notEqual(destinationFor(role), 'panel');
  assert.equal(db.calls.some((call) => call.fn === 'ally_accept_terms'), false, 'activar la cuenta no registra aceptaciones');
});

test('2. ambas casillas aceptadas: se envia a la base solo versiones y casillas, y el acceso se abre tras verificarlo', async () => {
  const db = fakeDatabase();
  const result = await recordAcceptance(db.client, both);
  assert.deepEqual(result, { ok: true });
  const save = db.calls.find((call) => call.fn === 'ally_accept_terms');
  assert.deepEqual(save?.args, { p_terms_version: '1.0', p_privacy_version: '1.2', p_terms_accepted: true, p_privacy_confirmed: true });
  assert.equal(db.calls.at(-1)?.fn, 'ally_acceptance_state', 'se verifica el estado despues de guardar');
  const role = await resolveAliadosRole(roleClient(db.client), 'u1');
  assert.equal(destinationFor(role), 'panel');
});

test('2b. con una sola casilla (o ninguna) no se llama a la base', async () => {
  for (const input of [{ terms: true, privacy: false }, { terms: false, privacy: true }, { terms: false, privacy: false }]) {
    const db = fakeDatabase();
    const result = await recordAcceptance(db.client, input);
    assert.equal(result.ok, false);
    assert.equal(db.calls.length, 0);
    assert.equal(db.isAccepted(), false);
  }
});

test('3. error al guardar: acceso bloqueado y mensaje claro', async () => {
  for (const options of [{ saveError: { code: 'XX000' } }, { saveThrows: true }, { saveError: { code: '42501' } }, { saveError: { code: '22023' } }]) {
    const db = fakeDatabase(options);
    const result = await recordAcceptance(db.client, both);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Recarga|autorizada|conexión|No tienes acceso al panel/);
    const role = await resolveAliadosRole(roleClient(db.client), 'u1');
    assert.equal(destinationFor(role), 'acceptance', 'sigue bloqueado');
  }
});

test('3b. si guardar "funciona" pero la base no confirma la aceptacion, o falla la verificacion, no hay acceso', async () => {
  for (const options of [{ neverVisible: true }, { stateError: true }]) {
    const db = fakeDatabase(options);
    const result = await recordAcceptance(db.client, both);
    assert.equal(result.ok, false);
  }
  await assert.rejects(fetchAcceptanceState(fakeDatabase({ stateError: true }).client));
});

test('4. aliado activo con aceptacion vigente: acceso permitido', async () => {
  const db = fakeDatabase();
  await recordAcceptance(db.client, both);
  const role = await resolveAliadosRole(roleClient(db.client), 'u1');
  assert.deepEqual(role, { kind: 'ally', status: 'active', displayName: 'Ana', accepted: true });
  assert.equal(destinationFor(role), 'panel');
});

test('5. usuario no autorizado: sin rol, pendiente o pausado nunca llega al panel ni a la aceptacion', async () => {
  const none = await resolveAliadosRole(
    { rpc: fakeDatabase().client.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) },
    'u2',
  );
  assert.equal(destinationFor(none), 'denied');
  assert.equal(destinationFor({ kind: 'ally', status: 'pending', displayName: '', accepted: true }), 'pending');
  assert.equal(destinationFor({ kind: 'ally', status: 'paused', displayName: '', accepted: true }), 'paused');
  const db = fakeDatabase({ saveError: { code: '42501' } });
  const result = await recordAcceptance(db.client, both);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /no está autorizada/);
});

test('6. registro publico: permanece cerrado en codigo y en la pagina', () => {
  assert.equal(ALIADOS_LEGAL_APPROVED, false);
  const html = render(createElement(AllyRegistrationPage));
  assert.match(html, /funciona por invitación/);
  assert.equal(/name="email"|Solicitar registro/.test(html), false);
});

test('un administrador conserva su acceso sin aceptacion de aliado', async () => {
  const db = fakeDatabase();
  const role = await resolveAliadosRole(
    { rpc: db.client.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: 'a' }, error: null }) }) }) }) },
    'a',
  );
  assert.equal(destinationFor(role), 'admin');
  assert.equal(db.calls.length, 0);
});
