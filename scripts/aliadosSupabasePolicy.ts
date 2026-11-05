export const ALIADOS_PREVIEW_BRANCH = 'feat/aliados-charlitron';

// Referencia del proyecto editorial (produccion): nunca puede usarse para Aliados.
const EDITORIAL_PROJECT_REF = 'rvvqhpbtqgjpzflopflv';

type Environment = Record<string, string | undefined>;

export interface AliadosBuildConfig {
  url: string;
  anonKey: string;
}

const EMPTY: AliadosBuildConfig = { url: '', anonKey: '' };

// Fuera de Vercel (desarrollo local) se permite; en Vercel solo en Production y en Preview de la rama de Aliados.
export function isAliadosAuthBuildAllowed(environment: Environment): boolean {
  const onVercel = Boolean(environment.VERCEL || environment.VERCEL_ENV);
  if (!onVercel) return true;
  if (environment.VERCEL_ENV === 'production') return true;
  return environment.VERCEL_ENV === 'preview' && environment.VERCEL_GIT_COMMIT_REF === ALIADOS_PREVIEW_BRANCH;
}

// En Production, Aliados es obligatorio: sin variables el build falla en vez de publicar un modulo desconectado.
export function isAliadosRequired(environment: Environment): boolean {
  return environment.VERCEL_ENV === 'production';
}

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).host.toLowerCase();
  } catch {
    return null;
  }
}

function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

// Valida las variables ALIADOS_SUPABASE_* y devuelve lo unico que puede entrar al bundle.
// Lanza (rompe el build) ante una configuracion peligrosa; fuera de los entornos permitidos las ignora.
export function aliadosSupabaseBuildConfig(environment: Environment): AliadosBuildConfig {
  if (!isAliadosAuthBuildAllowed(environment)) return EMPTY;

  const url = (environment.ALIADOS_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = (environment.ALIADOS_SUPABASE_ANON_KEY ?? '').trim();
  if (!url && !anonKey) {
    if (isAliadosRequired(environment)) {
      throw new Error('Production requiere ALIADOS_SUPABASE_URL y ALIADOS_SUPABASE_ANON_KEY: faltan ambas.');
    }
    return EMPTY;
  }
  if (!url || !anonKey) {
    throw new Error('ALIADOS_SUPABASE_URL y ALIADOS_SUPABASE_ANON_KEY deben definirse juntas.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('ALIADOS_SUPABASE_URL no es una URL valida.');
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const onVercel = Boolean(environment.VERCEL || environment.VERCEL_ENV);
  if (parsed.protocol !== 'https:' && !(local && !onVercel)) {
    throw new Error('ALIADOS_SUPABASE_URL debe usar https (http solo en desarrollo local).');
  }

  if (parsed.host.toLowerCase().includes(EDITORIAL_PROJECT_REF)) {
    throw new Error('ALIADOS_SUPABASE_URL apunta al proyecto editorial: no esta permitido.');
  }
  const editorialHost = hostOf(environment.VITE_SUPABASE_URL);
  if (editorialHost && editorialHost === parsed.host.toLowerCase()) {
    throw new Error('ALIADOS_SUPABASE_URL coincide con VITE_SUPABASE_URL (proyecto editorial): no esta permitido.');
  }

  if (anonKey.startsWith('sb_secret_')) {
    throw new Error('ALIADOS_SUPABASE_ANON_KEY parece una clave secreta: nunca debe ir al frontend.');
  }
  if (!anonKey.startsWith('sb_publishable_')) {
    const role = jwtRole(anonKey);
    if (role !== 'anon') {
      throw new Error('ALIADOS_SUPABASE_ANON_KEY debe ser la clave publica anon (rol distinto o formato desconocido).');
    }
  }

  return { url, anonKey };
}

// Hay variables de Aliados definidas pero este entorno no puede usarlas.
export function aliadosSupabaseWasIgnored(environment: Environment): boolean {
  return (
    !isAliadosAuthBuildAllowed(environment) &&
    Boolean(environment.ALIADOS_SUPABASE_URL || environment.ALIADOS_SUPABASE_ANON_KEY)
  );
}
