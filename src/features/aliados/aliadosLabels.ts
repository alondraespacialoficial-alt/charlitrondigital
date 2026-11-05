// Textos de interfaz y traduccion de errores. Sin logica financiera: los limites y saldos los decide la base de datos.

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'En contacto',
  interested: 'Con interés',
  closed: 'Cerrado',
  duplicate: 'Duplicado',
};

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  assigned: 'Pendiente de autorización',
  authorized: 'Autorizada',
};

export const PAYMENT_METHODS = ['Transferencia', 'Depósito', 'Efectivo', 'Tarjeta', 'Otro'] as const;

export function statusLabel(labels: Record<string, string>, status: string): string {
  return labels[status] ?? status;
}

// Los mensajes que escribe la base (funciones SECURITY DEFINER) ya vienen en español y se muestran tal cual.
// Los errores tecnicos de red, sesion o permisos se traducen a algo comprensible.
export function errorText(error: unknown, fallback = 'No se pudo completar la acción. No se hizo ningún cambio.'): string {
  const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (!message) return fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  if (/jwt|token|expired/i.test(message)) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (/permission denied|insufficient_privilege|row-level security/i.test(message)) return 'No tienes permiso para esta acción.';
  if (/duplicate key|unique constraint/i.test(message)) return 'Ese registro ya existe.';
  if (/violates check constraint|invalid input syntax/i.test(message)) return 'Revisa los datos: alguno no es válido.';
  return message;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Solo valida el formato escrito (positivo, maximo 2 decimales) para avisar antes de enviar; la base valida de nuevo.
export function parseAmount(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return amount > 0 ? amount : null;
}
