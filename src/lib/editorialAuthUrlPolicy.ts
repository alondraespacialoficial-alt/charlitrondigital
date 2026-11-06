// El Supabase editorial solo inicia sesion con correo y contrasena: nunca necesita leer tokens de la URL.
// Los enlaces de invitacion o recuperacion de Aliados pertenecen a otro proyecto y solo los procesa el
// cliente de Aliados (aliadosActivation.parseAuthLink). Esta politica impide que el cliente editorial los
// detecte, los envie a su proyecto o limpie el fragmento antes de que Aliados lo lea.

const ALLY_LINK_TYPES = new Set(['invite', 'recovery', 'signup', 'magiclink', 'email_change']);

export function isAliadosPath(pathname: string): boolean {
  return pathname === '/aliados' || pathname.startsWith('/aliados/');
}

export function editorialShouldDetectSessionInUrl(url: URL, params: Record<string, string>): boolean {
  if (isAliadosPath(url.pathname)) return false;
  if (ALLY_LINK_TYPES.has(params.type ?? '')) return false;
  return Boolean(params.access_token || params.error || params.error_description || params.error_code);
}
