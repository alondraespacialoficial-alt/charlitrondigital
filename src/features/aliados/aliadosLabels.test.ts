import assert from 'node:assert/strict';
import test from 'node:test';
import { errorText, parseAmount, statusLabel, REFERRAL_STATUS_LABELS } from './aliadosLabels';

test('parseAmount acepta montos positivos con hasta 2 decimales y rechaza el resto', () => {
  assert.equal(parseAmount('40'), 40);
  assert.equal(parseAmount(' 40.10 '), 40.1);
  for (const bad of ['', '0', '0.00', '-5', '10.005', 'abc', '1e3', '1,000']) assert.equal(parseAmount(bad), null, bad);
});

test('errorText muestra los mensajes de la base y traduce los tecnicos', () => {
  assert.equal(errorText({ message: 'El pago excede lo liberable (40.00).' }), 'El pago excede lo liberable (40.00).');
  assert.match(errorText({ message: 'permission denied for table sales' }), /permiso/);
  assert.match(errorText(new Error('TypeError: Failed to fetch')), /conexión/);
  assert.match(errorText({ message: 'JWT expired' }), /sesión expiró/);
  assert.match(errorText(null), /No se hizo ningún cambio/);
});

test('statusLabel traduce estados conocidos y conserva los desconocidos', () => {
  assert.equal(statusLabel(REFERRAL_STATUS_LABELS, 'contacted'), 'En contacto');
  assert.equal(statusLabel(REFERRAL_STATUS_LABELS, 'otro'), 'otro');
});
