import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AliadosRepository } from './aliadosRepository';
import {
  AlliesSection,
  CommissionsSection,
  ReferralsSection,
  SalesSection,
  type AdminPanelData,
  type Run,
} from './AliadosAdminSections';

const data: AdminPanelData = {
  registrations: [
    { id: 'reg1', email: 'nueva@ejemplo.com', full_name: 'Aliada Nueva', city: 'SLP', consent_at: '2026-11-01', created_at: '2026-11-01', status: 'pending' },
  ],
  allies: [{ user_id: 'a1', display_name: 'Aliado Uno', email: 'a1@ejemplo.com', status: 'active', created_at: '2026-10-01' }],
  referrals: [
    {
      id: 'r1', ally_id: 'a1', referred_name: 'Cliente Uno', referred_phone: '4440000000', data_share_authorized: true, status: 'new',
      created_at: '2026-11-02', updated_at: '2026-11-02', duplicate_review: true, internal_notes: 'nota privada',
    },
  ],
  sales: [{ id: 's1', referral_id: 'r1', ally_id: 'a1', sale_date: '2026-11-03', amount_agreed: 1000, sale_description: 'Sitio web' }],
  payments: [{ id: 'p1', sale_id: 's1', payment_date: '2026-11-04', amount_paid: 400, payment_method: 'Transferencia' }],
  commissions: [
    { id: 'c1', sale_id: 's1', ally_id: 'a1', commission_amount: 100, status: 'assigned', assigned_at: '2026-11-05', net_collected: 400, release_limit: 40, paid_total: 0 },
  ],
  commissionPayments: [],
};

const props = { data, repo: {} as AliadosRepository, run: (async () => true) as Run, busy: false };

test('Aliados: solicitud pendiente con aprobar/rechazar y aliados con su estado', () => {
  const html = renderToStaticMarkup(createElement(AlliesSection, props));
  assert.match(html, /Aliada Nueva/);
  assert.match(html, /Aprobar y enviar invitación/);
  assert.match(html, /Rechazar/);
  assert.match(html, /Aliado Uno/);
  assert.match(html, /Activo/);
});

test('Referidos: estado, notas internas, duplicado y registrar venta', () => {
  const html = renderToStaticMarkup(createElement(ReferralsSection, props));
  assert.match(html, /Cliente Uno/);
  assert.match(html, /Posible duplicado: revisar/);
  assert.match(html, /nota privada/);
  assert.match(html, /Guardar cambios/);
  assert.match(html, /Registrar venta/);
});

test('Ventas: cobros, formulario de cobro parcial y asignar comision', () => {
  const html = renderToStaticMarkup(createElement(SalesSection, props));
  assert.match(html, /Sitio web/);
  assert.match(html, /Transferencia/);
  assert.match(html, /Registrar cobro/);
  assert.match(html, /Revertir/);
  assert.match(html, /Asignar comisión|se gestiona en la pestaña Comisiones/);
});

test('Comisiones: muestra los valores de la base y autorizacion separada del pago', () => {
  const html = renderToStaticMarkup(createElement(CommissionsSection, props));
  assert.match(html, /Liberable por cobros/);
  assert.match(html, /\$40\.00/);
  assert.match(html, /Autorizar comisión/);
  assert.equal(/Registrar pago de comisión/.test(html), false, 'no se puede pagar antes de autorizar');

  const authorized = { ...data, commissions: [{ ...data.commissions[0]!, status: 'authorized' as const }] };
  const html2 = renderToStaticMarkup(createElement(CommissionsSection, { ...props, data: authorized }));
  assert.match(html2, /Registrar pago de comisión/);
  assert.equal(/Autorizar comisión/.test(html2), false);
});
