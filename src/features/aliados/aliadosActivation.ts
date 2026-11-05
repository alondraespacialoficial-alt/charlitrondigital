// Activacion de cuenta por enlace de invitacion de Supabase Auth: lee el resultado del enlace, valida la
// contrasena y la establece. El rol y el acceso al panel siguen decidiendose despues, por RLS (aliadosRole).

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 72;

export type AuthLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: 'invite' | 'recovery' }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'none' };

// Supabase entrega el resultado en el fragmento (#...) o, segun la configuracion, en la consulta (?...).
export function parseAuthLink(hash: string, search = ''): AuthLink {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const get = (key: string) => params.get(key) ?? query.get(key) ?? '';

  const code = get('error_code') || get('error');
  if (code) return { kind: 'error', code, description: get('error_description') };

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const type = get('type');
  if (accessToken && refreshToken && (type === 'invite' || type === 'recovery')) {
    return { kind: 'tokens', accessToken, refreshToken, type };
  }
  return { kind: 'none' };
}

export function linkErrorMessage(code: string): string {
  if (code === 'otp_expired' || code === 'access_denied') {
    return 'El enlace expiró o ya fue usado. Pide a Charlitron que te envíe una nueva invitación.';
  }
  return 'El enlace de invitación no es válido. Pide a Charlitron que te envíe una nueva invitación.';
}

export function passwordIssue(password: string, confirmation: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Usa letras y al menos un número.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return '';
}

interface AuthError {
  status?: number;
  code?: string;
  message?: string;
}

export interface ActivationClient {
  auth: {
    setSession(tokens: { access_token: string; refresh_token: string }): PromiseLike<{ error: AuthError | null }>;
    updateUser(attributes: { password: string }): PromiseLike<{ error: AuthError | null }>;
    signOut(): PromiseLike<unknown>;
  };
}

export function activationErrorMessage(error: AuthError | null | undefined): string {
  if (!error) return '';
  const code = error.code ?? '';
  if (code === 'weak_password') return 'La contraseña es demasiado débil. Usa una más larga y difícil de adivinar.';
  if (code === 'same_password') return 'Elige una contraseña distinta a la anterior.';
  if (/otp_expired|session_not_found|refresh_token|bad_jwt|session_expired/.test(code) || error.status === 401 || error.status === 403) {
    return linkErrorMessage('otp_expired');
  }
  if (/failed to fetch|networkerror|load failed/i.test(error.message ?? '')) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  return 'No se pudo guardar tu contraseña. Intenta de nuevo.';
}

// Devuelve '' si todo salio bien. La sesion solo se abre aqui, con la contrasena ya validada.
export async function activateAccount(
  client: ActivationClient,
  link: Extract<AuthLink, { kind: 'tokens' }>,
  password: string,
  confirmation: string,
): Promise<string> {
  const issue = passwordIssue(password, confirmation);
  if (issue) return issue;

  const session = await client.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
  if (session.error) {
    const message = activationErrorMessage(session.error);
    return message.startsWith('Sin conexión') ? message : linkErrorMessage('otp_expired');
  }

  const update = await client.auth.updateUser({ password });
  if (update.error) {
    const message = activationErrorMessage(update.error);
    if (message === linkErrorMessage('otp_expired')) await client.auth.signOut();
    return message;
  }
  return '';
}
