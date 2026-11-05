import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { AlliesLanding } from './AllyLanding';
import { AllyActivationPage, AllyLegalPage, AllyRegistrationForm, AllyRegistrationPage } from './AllyPublicPages';
import { ALIADOS_LEGAL_APPROVED, LEGAL_PENDING, PRIVACY_SECTIONS, TERMS_SECTIONS } from './aliadosLegal';

const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, element));

test('/aliados muestra el boton "Quiero ser aliado" que lleva a /aliados/registrarse', () => {
  const html = render(createElement(AlliesLanding));
  assert.match(html, /<a [^>]*href="\/aliados\/registrarse"[^>]*>\s*Quiero ser aliado/);
});

test('el formulario pide nombre, correo, WhatsApp, ciudad y aceptacion explicita enlazada a los textos', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AllyRegistrationForm, { onSubmit: async () => '' })));
  for (const name of ['name', 'email', 'whatsapp', 'city', 'accepted']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /type="checkbox"[^>]*name="accepted"|name="accepted"[^>]*type="checkbox"/);
  assert.equal(/name="accepted"[^>]*checked/.test(html), false, 'la casilla nace sin marcar');
  assert.match(html, /href="\/aliados\/privacidad"/);
  assert.match(html, /href="\/aliados\/terminos"/);
  assert.match(html, /Solicitar registro/);
  assert.equal(/type="(password|hidden)"/.test(html), false);
});

test('sin conexion confirmada con la base la pagina de registro NO ofrece el formulario', () => {
  const html = render(createElement(AllyRegistrationPage));
  assert.match(html, /todavía no está abierto/);
  assert.equal(/name="email"|Solicitar registro/.test(html), false);
});

test('mientras falten datos legales el registro sigue cerrado por codigo', () => {
  assert.ok(LEGAL_PENDING.length > 0);
  if (ALIADOS_LEGAL_APPROVED) assert.equal(LEGAL_PENDING.length, 0, 'no se puede aprobar el texto con datos legales pendientes');
});

test('los textos legales cubren lo esencial y no inventan datos del responsable', () => {
  const text = JSON.stringify([...PRIVACY_SECTIONS, ...TERMS_SECTIONS]);
  for (const topic of ['Responsable', 'Datos que recabamos', 'ARCO', 'Consentimiento', 'Conservación']) assert.match(text, new RegExp(topic));
  for (const topic of ['Registro y aprobación', 'Ventas y comisiones', 'Conducta del aliado', 'Cambios y baja']) assert.match(text, new RegExp(topic));
  assert.equal(/RFC|\bCP\b|calle|aliados@charlitron\.com|privacidad@charlitrondigital\.com/i.test(text), false);

  const privacy = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AllyLegalPage, { kind: 'privacy' })));
  const terms = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AllyLegalPage, { kind: 'terms' })));
  assert.match(privacy, /Aviso de Privacidad del Programa Aliados/);
  assert.match(terms, /Términos del Programa Aliados/);
  assert.match(privacy, /Borrador pendiente de validación legal/);
  assert.match(terms, /Borrador pendiente de validación legal/);
});

test('las rutas nuevas estan registradas y el acceso enlaza al registro', () => {
  const app = readFileSync(new URL('./AliadosApp.tsx', import.meta.url), 'utf8');
  for (const route of ['/aliados/registrarse', '/aliados/activar', '/aliados/privacidad', '/aliados/terminos', '/aliados/ingresar']) {
    assert.match(app, new RegExp(`path === '${route}'`));
  }
  assert.match(app, /to="\/aliados\/registrarse"[^>]*>Solicita tu registro/);
});

test('la activacion sin configuracion o sin enlace no ofrece cambiar contrasenas', () => {
  const html = render(createElement(AllyActivationPage));
  assert.equal(/type="password"/.test(html), false);
  assert.match(html, /no está configurado/);
});
