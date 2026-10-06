import type { QuoteDraft, QuoteTotals } from './types';

function decimalToUnits(value: string, decimalPlaces: number): number {
  const normalized = value.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d*))?$/.exec(normalized);
  if (!match) return 0;

  const factor = 10 ** decimalPlaces;
  const fraction = match[2] ?? '';
  const retained = Number(fraction.slice(0, decimalPlaces).padEnd(decimalPlaces, '0'));
  const rounded = Number(fraction[decimalPlaces] ?? '0') >= 5 ? 1 : 0;
  const units = Number(match[1]) * factor + retained + rounded;
  return Number.isSafeInteger(units) ? units : Number.MAX_SAFE_INTEGER;
}

export function calculateQuote(quote: QuoteDraft): QuoteTotals {
  const lineTotalsCents = quote.concepts.map((concept) => {
    const quantityMilliunits = decimalToUnits(concept.quantity, 3);
    const unitPriceCents = decimalToUnits(concept.unitPrice, 2);
    return Math.round((quantityMilliunits * unitPriceCents) / 1000);
  });
  const subtotalCents = lineTotalsCents.reduce((sum, lineTotal) => sum + lineTotal, 0);

  const requestedDiscount = quote.discountMode === 'percentage'
    ? Math.round((subtotalCents * Math.min(decimalToUnits(quote.discountValue, 2), 10000)) / 10000)
    : decimalToUnits(quote.discountValue, 2);
  const discountCents = Math.min(subtotalCents, requestedDiscount);
  const taxableBaseCents = subtotalCents - discountCents;
  const ivaCents = quote.ivaEnabled ? Math.round((taxableBaseCents * 16) / 100) : 0;

  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    taxableBaseCents,
    ivaCents,
    totalCents: taxableBaseCents + ivaCents,
  };
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(cents / 100);
}

export function amountToCents(value: string): number {
  return decimalToUnits(value, 2);
}