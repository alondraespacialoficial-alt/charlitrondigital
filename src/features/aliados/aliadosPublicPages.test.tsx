import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { AlliesLanding } from './AllyLanding';
import { AllyActivationPage, AllyLegalPage, AllyRegistrationForm, AllyRegistrationPage } from './AllyPublicPages';
import { LegalPage } from '../../components/LegalPage';
import { LEGAL_ADDRESS_PUBLICATION_AUTHORIZED, LEGAL_FISCAL_ADDRESS, LEGAL_RESPONSIBLE_NAME } from '../../data/legalEntity';
import { CONTACT_EMAIL } from '../../data/content';
import { ALIADOS_LEGAL_APPROVED, LEGAL_DOCUMENTS_DATE, LEGAL_PENDING, PRIVACY_DOCUMENT, PRIVACY_SECTIONS, PRIVACY_VERSION, TERMS_DOCUMENT, TERMS_SECTIONS, TERMS_VERSION } from './aliadosLegal';

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

test('"Volver" ocupa su propia linea y el logotipo no se encima con el', () => {
  const html = render(createElement(AllyRegistrationPage));
  assert.match(html, /<a [^>]*aria-label="Volver a Aliados Charlitron"[^>]*class="[^"]*\bflex w-fit\b/);
  assert.equal(/aria-label="Volver a Aliados Charlitron"[^>]*class="[^"]*inline-flex/.test(html), false);
  const app = readFileSync(new URL('./AliadosApp.tsx', import.meta.url), 'utf8');
  assert.equal(/aria-label="Volver a Aliados Charlitron" className="[^"]*inline-flex/.test(app), false);
});

test('el registro publico sigue cerrado por codigo y los pendientes para operar con prospectos reales constan', () => {
  assert.equal(ALIADOS_LEGAL_APPROVED, false);
  assert.ok(LEGAL_PENDING.length > 0);
  for (const topic of [/abogado/, /Constancia escrita/, /Canal ARCO/, /puesta a disposición del aviso al prospecto/, /consentimiento expreso/, /Plazos de conservación/, /Remisiones y transferencias/, /acuerdo individual de comisión/, /Documentación fiscal/, /Ley aplicable/]) {
    assert.ok(LEGAL_PENDING.some((item) => topic.test(item)), `pendiente: ${topic}`);
  }
});

test('las paginas legales publican los documentos definitivos, completos y sin leyendas de borrador', () => {
  const text = JSON.stringify([...PRIVACY_SECTIONS, ...TERMS_SECTIONS]);
  assert.equal(PRIVACY_SECTIONS.length, 12, 'el aviso tiene 12 apartados');
  assert.equal(TERMS_SECTIONS.length, 14, 'los terminos tienen 14 apartados');
  assert.equal(/RFC|CURP|idCIF|S\.A\. de C\.V\.|aliados@charlitron\.com|privacidad@charlitrondigital\.com/i.test(text), false);

  const privacy = render(createElement(AllyLegalPage, { kind: 'privacy' }));
  const terms = render(createElement(AllyLegalPage, { kind: 'terms' }));
  assert.match(privacy, /Aviso integral de privacidad/);
  assert.match(privacy, /Aliados Charlitron · «Si nos refieres, ganas» · v1\.2 · 5 de noviembre de 2026\./);
  assert.match(terms, /Términos y condiciones del programa/);
  assert.match(terms, /Aliados Charlitron · «Si nos refieres, ganas» · v1\.0 · 5 de noviembre de 2026\./);
  for (const html of [privacy, terms]) {
    assert.equal(/borrador|Borrador|pendiente de validaci/i.test(html), false, 'sin leyendas de borrador');
  }
  for (const phrase of ['Identidad, alcance y responsable', 'Derechos ARCO', 'Invitación administrativa y aceptación de documentos', 'Contacto, cambios y vigencia']) assert.match(privacy, new RegExp(phrase));
  for (const phrase of ['Comisiones: acuerdo individual necesario', 'Aceptación y condiciones de inicio', 'Cambios, avisos y controversias']) assert.match(terms, new RegExp(phrase));
  assert.match(privacy, /20 días hábiles/);
  assert.match(privacy, /sin atribuirle consentimiento por silencio/);
  assert.match(terms, /Si no acepta, no debe comenzar a registrar recomendaciones/);
});

test('las paginas legales y las versiones del codigo coinciden con los documentos aprobados', () => {
  assert.equal(TERMS_VERSION, '1.0');
  assert.equal(PRIVACY_VERSION, '1.2');
  assert.equal(LEGAL_DOCUMENTS_DATE, '2026-11-05');
  assert.equal(TERMS_DOCUMENT.version, TERMS_VERSION);
  assert.equal(PRIVACY_DOCUMENT.version, PRIVACY_VERSION);
});

test('las rutas nuevas estan registradas y el acceso enlaza al registro', () => {
  const app = readFileSync(new URL('./AliadosApp.tsx', import.meta.url), 'utf8');
  for (const route of ['/aliados/registrarse', '/aliados/activar', '/aliados/aceptar', '/aliados/privacidad', '/aliados/terminos', '/aliados/ingresar']) {
    assert.match(app, route === '/aliados/aceptar' ? /path === ACCEPTANCE_ROUTE/ : new RegExp(`path === '${route}'`));
  }
  assert.match(app, /to="\/aliados\/registrarse"[^>]*>Solicita tu registro/);
});

test('"Quiero ser aliado" informa que el programa funciona por invitacion y la pagina de registro no ofrece formulario', () => {
  const landing = render(createElement(AlliesLanding));
  assert.match(landing, /solo por invitación/);
  assert.match(landing, /funciona por invitación de Charlitron; el registro público está cerrado/);
  assert.equal(/Registro gratuito/.test(landing), false);
  const page = render(createElement(AllyRegistrationPage));
  assert.match(page, /funciona por invitación/);
  assert.match(page, /WhatsApp es solo un aviso complementario/);
  assert.equal(/name="email"|Solicitar registro/.test(page), false);
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
  assert.match(render(createElement(AllyLegalPage, { kind: 'terms' })), /operado por Carlos Leonardo Álvarez Cedillo bajo la marca Charlitron Digital/);
});

test('José Adrián figura solo como administrador de Aliados; nunca como responsable ni con la razón social anterior', () => {
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  assert.equal(/Jos(é|&eacute;) Adri/.test(general), false);
  assert.equal(/S\.A\. de C\.V\./.test(ALL_LEGAL_TEXT()), false);
  const aliados = render(createElement(AllyLegalPage, { kind: 'privacy' }));
  assert.match(aliados, /José Adrián Álvarez Carlos es administrador comercial y operativo, sin sustituir al responsable/);
});

test('un solo correo de contacto y ninguno ficticio o sin confirmar', () => {
  const emails = new Set((ALL_LEGAL_TEXT().match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []).map((email) => email.toLowerCase().replace(/\.$/, '')));
  assert.deepEqual([...emails], [CONTACT_EMAIL]);
});

test('el domicilio fiscal autorizado aparece solo en los dos avisos de privacidad y nunca junto a CURP, idCIF ni RFC', () => {
  assert.ok(LEGAL_ADDRESS_PUBLICATION_AUTHORIZED);
  assert.equal(LEGAL_FISCAL_ADDRESS, 'Calle Lanzagorta 330, colonia San Sebastián, C.P. 78349, San Luis Potosí, San Luis Potosí, México');
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  const aliados = render(createElement(AllyLegalPage, { kind: 'privacy' }));
  assert.ok(general.includes(LEGAL_FISCAL_ADDRESS ?? ''), 'aviso general');
  assert.match(aliados, /calle Lanzagorta 330, colonia San Sebastián, C\. P\. 78349, San Luis Potosí, San Luis Potosí, México/);
  assert.equal(/domicilio fiscal por confirmar/.test(aliados), false);

  const elsewhere = [
    render(createElement(LegalPage, { initialTab: 'terminos', onBack: () => {} })),
    render(createElement(LegalPage, { initialTab: 'cookies', onBack: () => {} })),
    render(createElement(AllyLegalPage, { kind: 'terms' })),
    render(createElement(AlliesLanding)),
    render(createElement(AllyRegistrationPage)),
    JSON.stringify(TERMS_SECTIONS),
  ];
  for (const html of elsewhere) assert.equal(/Lanzagorta|78349|San Sebasti/.test(html), false, 'el domicilio solo va en los avisos de privacidad');

  const text = ALL_LEGAL_TEXT();
  assert.equal(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/.test(text), false, 'CURP');
  assert.equal(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/.test(text), false, 'RFC');
  assert.equal(/idCIF|constancia de situaci/i.test(text), false);
  assert.equal(/CURP|idCIF|RFC/i.test(LEGAL_FISCAL_ADDRESS ?? ''), false);
});



test('los tratamientos del aviso general y del aviso de Aliados permanecen separados', () => {
  const general = render(createElement(LegalPage, { initialTab: 'privacidad', onBack: () => {} }));
  assert.equal(/aliad|recomend|comisi/i.test(general), false, 'el aviso general no menciona el programa Aliados');
  const aliados = JSON.stringify(PRIVACY_SECTIONS);
  assert.match(aliados, /no sustituye el aviso general de los demás servicios de Charlitron Digital/);
});

test('las comisiones se acuerdan por proyecto: sin porcentajes ni promesas', () => {
  const terms = JSON.stringify(TERMS_SECTIONS);
  assert.match(terms, /No existe porcentaje general ni ingreso garantizado/);
  assert.match(terms, /Cada comisión requiere acuerdo individual documentado/);
  assert.match(terms, /Charlitron no garantiza ventas, aceptación de referidos ni ingresos/);
  assert.equal(/\d+\s?%/.test(terms), false);
});

test('conservacion y datos de referidos: sin promesa de eliminacion inmediata ni propiedad de datos', () => {
  const privacy = JSON.stringify(PRIVACY_SECTIONS);
  assert.match(privacy, /No se ofrece eliminación inmediata o automática de todos los registros/);
  assert.match(privacy, /Una invitación no equivale a aceptación de términos/);
  assert.match(JSON.stringify(TERMS_SECTIONS), /Ningún aliado tendrá propiedad sobre datos personales o prospectos/);
  assert.equal(/propiedad de Charlitron/i.test(JSON.stringify([...PRIVACY_SECTIONS, ...TERMS_SECTIONS])), false);
});
