import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { AlliesLanding } from './AllyLanding';
import { AllyActivationPage, AllyLegalPage, AllyRegistrationForm, AllyRegistrationPage } from './AllyPublicPages';
import { LegalPage } from '../../components/LegalPage';
import { LEGAL_FISCAL_ADDRESS, LEGAL_RESPONSIBLE_NAME } from '../../data/legalEntity';
import { CONTACT_EMAIL } from '../../data/content';
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
  assert.equal(/RFC|CURP|idCIF|\bCP\b|calle|S\.A\. de C\.V\.|aliados@charlitron\.com|privacidad@charlitrondigital\.com/i.test(text), false);

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

const ALL_LEGAL_TEXT = () =>
  JSON.stringify([...PRIVACY_SECTIONS, ...TERMS_SECTIONS]) +
  renderToStaticMarkup(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} })) +
  renderToStaticMarkup(createElement(LegalPage, { initialTab: 'terminos', onBack: () => {} }));

test('el responsable legal es Carlos Leonardo Álvarez Cedillo en el aviso general y en el de Aliados', () => {
  assert.equal(LEGAL_RESPONSIBLE_NAME, 'Carlos Leonardo Álvarez Cedillo');
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  const aliados = render(createElement(AllyLegalPage, { kind: 'privacy' }));
  assert.match(general, /Carlos Leonardo Álvarez Cedillo/);
  assert.match(aliados, /Carlos Leonardo Álvarez Cedillo/);
  assert.match(render(createElement(AllyLegalPage, { kind: 'terms' })), /responsable legal es Carlos Leonardo Álvarez Cedillo/);
});

test('José Adrián figura solo como administrador de Aliados; nunca como responsable ni con la razón social anterior', () => {
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  assert.equal(/Jos(é|&eacute;) Adri/.test(general), false);
  assert.equal(/S\.A\. de C\.V\./.test(ALL_LEGAL_TEXT()), false);
  const aliados = render(createElement(AllyLegalPage, { kind: 'privacy' }));
  assert.match(aliados, /administra José Adrián Álvarez Carlos, director comercial y administrador de Aliados Charlitron/);
});

test('un solo correo de contacto y ninguno ficticio o sin confirmar', () => {
  const emails = new Set((ALL_LEGAL_TEXT().match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []).map((email) => email.toLowerCase()));
  assert.deepEqual([...emails], [CONTACT_EMAIL]);
});

test('no se publican CURP, idCIF ni RFC, y el domicilio fiscal pendiente consta en la lista de pendientes', () => {
  const text = ALL_LEGAL_TEXT();
  assert.equal(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/.test(text), false, 'CURP');
  assert.equal(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/.test(text), false, 'RFC');
  assert.equal(/idCIF/i.test(text), false);
  if (LEGAL_FISCAL_ADDRESS === null) assert.ok(LEGAL_PENDING.some((item) => /Domicilio fiscal/.test(item)));
  else assert.equal(/CURP|idCIF|RFC/i.test(LEGAL_FISCAL_ADDRESS), false);
});

test('los tratamientos del aviso general y del aviso de Aliados permanecen separados', () => {
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  assert.equal(/aliad|recomend|comisi/i.test(general), false, 'el aviso general no menciona el programa Aliados');
  const aliados = JSON.stringify(PRIVACY_SECTIONS);
  assert.match(aliados, /independiente del aviso de privacidad general/);
  assert.match(aliados, /Finalidades sobre tus datos como aliado/);
  assert.match(aliados, /Finalidades sobre los datos de las personas que recomiendas/);
});

test('las comisiones son montos acordados por proyecto: sin porcentajes fijos ni promesas', () => {
  const terms = JSON.stringify(TERMS_SECTIONS);
  assert.match(terms, /monto acordado por escrito para cada proyecto/);
  assert.match(terms, /No hay porcentajes fijos ni ingresos garantizados/);
  assert.equal(/\d+\s?%/.test(terms), false);
});

test('conservacion y datos de referidos describen el comportamiento real y dejan pendiente lo no validado', () => {
  const privacy = JSON.stringify(PRIVACY_SECTIONS);
  assert.match(privacy, /rechazadas se conservan al menos 30 días/);
  assert.equal(/7 días/.test(privacy), false);
  assert.match(privacy, /no se eliminan por su naturaleza contable/);
  assert.equal(/propiedad de Charlitron/i.test(JSON.stringify([...PRIVACY_SECTIONS, ...TERMS_SECTIONS])), false);
  for (const topic of [/Transferencias/, /ARCO/, /Conservación/, /Documentación fiscal/]) {
    assert.ok(LEGAL_PENDING.some((item) => topic.test(item)), `pendiente: ${topic}`);
  }
});
