// Registro publico de aliados: valida en el navegador (solo para guiar) y guarda mediante la funcion segura.
// Los limites, el consentimiento y la apertura del registro los decide la base de datos.

export interface RegistrationInput {
  name: string;
  email: string;
  whatsapp: string;
  city: string;
  accepted: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeRegistration(input: RegistrationInput): RegistrationInput {
  return {
    name: input.name.trim().replace(/\s+/g, ' '),
    email: input.email.trim().toLowerCase(),
    whatsapp: input.whatsapp.trim(),
    city: input.city.trim().replace(/\s+/g, ' '),
    accepted: input.accepted,
  };
}

export function validateRegistration(raw: RegistrationInput): RegistrationErrors {
  const input = normalizeRegistration(raw);
  const errors: RegistrationErrors = {};
  if (input.name.length < 2 || input.name.length > 120) errors.name = 'Escribe tu nombre completo.';
  if (input.email.length < 5 || input.email.length > 254 || !EMAIL.test(input.email)) errors.email = 'Escribe un correo válido.';
  const digits = input.whatsapp.replace(/\D/g, '').length;
  if (!/^[0-9 ()+.-]+$/.test(input.whatsapp) || digits < 10 || digits > 15 || input.whatsapp.length > 30) {
    errors.whatsapp = 'Escribe un número de WhatsApp de 10 dígitos.';
  }
  if (input.city.length < 2 || input.city.length > 80) errors.city = 'Escribe tu ciudad.';
  if (!input.accepted) errors.accepted = 'Debes aceptar el Aviso de Privacidad y los Términos para continuar.';
  return errors;
}

interface RpcClient {
  rpc(name: string, params?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

export type RegistrationAvailability = 'open' | 'closed' | 'unknown';

// Cualquier fallo (funcion ausente, red) se trata como "no disponible": ante la duda no se ofrece el formulario.
export async function fetchRegistrationAvailability(client: RpcClient): Promise<RegistrationAvailability> {
  try {
    const { data, error } = await client.rpc('aliados_registration_open');
    if (error) return 'unknown';
    return data === true ? 'open' : 'closed';
  } catch {
    return 'unknown';
  }
}

export function registrationErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (/aun no esta abierto|no esta abierto/i.test(message)) return 'El registro de nuevos aliados todavía no está abierto.';
  if (error?.code === '54000' || /demasiadas solicitudes/i.test(message)) return 'Estamos recibiendo muchas solicitudes. Intenta de nuevo más tarde.';
  if (/whatsapp/i.test(message)) return 'Revisa tu número de WhatsApp.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  if (error?.code === '23514' || /check constraint/i.test(message)) return 'Revisa los datos: alguno no es válido.';
  return 'No se pudo enviar tu solicitud. Intenta de nuevo.';
}

// La respuesta es la misma si el correo ya existe: nunca revela quien tiene cuenta o solicitud.
export async function submitAllyRegistration(client: RpcClient, raw: RegistrationInput): Promise<string> {
  const errors = validateRegistration(raw);
  const first = Object.values(errors)[0];
  if (first) return first;
  const input = normalizeRegistration(raw);
  try {
    const { error } = await client.rpc('submit_ally_registration', {
      p_email: input.email,
      p_full_name: input.name,
      p_phone: input.whatsapp,
      p_city: input.city,
      p_consent: input.accepted,
    });
    return error ? registrationErrorMessage(error) : '';
  } catch (error) {
    return registrationErrorMessage(error as { message?: string });
  }
}
