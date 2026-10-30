// ============================================================================
// POST /api/redeploy-blog — dispara un redeploy de producción en Vercel
// llamando al Deploy Hook definido en BLOG_DEPLOY_HOOK_URL.
//
// Seguridad:
//   - BLOG_DEPLOY_HOOK_URL vive SOLO en el servidor (env de Vercel, sin
//     prefijo VITE_). Nunca se devuelve ni se registra en la respuesta.
//   - Solo acepta POST.
//   - Requiere admin autenticado: el frontend envía el access_token de
//     Supabase en `Authorization: Bearer <token>`; aquí se valida el JWT y
//     se verifica la fila en admin_users usando la ANON key, por lo que las
//     políticas RLS se aplican igual que en el navegador. NUNCA se usa la
//     service_role key.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Copia local de scripts/portfolioPreviewPolicy.ts: Vercel no resuelve imports relativos sin extensión en ESM.
const PORTFOLIO_PREVIEW_BRANCH = 'feat/portafolio-proyectos-v2';
function isPortfolioPreviewEnvironment(environment: Record<string, string | undefined>): boolean {
  return (
    environment.VERCEL_ENV === 'preview' &&
    environment.VERCEL_GIT_COMMIT_REF === PORTFOLIO_PREVIEW_BRANCH
  );
}

type AdminCheck = 'admin' | 'not_admin' | 'invalid_token';

/** Extrae el Bearer token del header Authorization. */
function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Valida que el token pertenezca a un usuario admin autenticado.
 * Usa anon key + JWT del usuario: admin_users solo expone la fila propia
 * por RLS, así que una fila encontrada confirma el rol de admin.
 */
async function checkAdmin(token: string): Promise<AdminCheck> {
  // En Vercel ya existen VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; se
  // aceptan las variantes sin prefijo por si se configuran dedicadas.
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('supabase_not_configured');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return 'invalid_token';

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminError) throw new Error('admin_check_failed');
  return adminRow ? 'admin' : 'not_admin';
}

/**
 * Llama al Deploy Hook de Vercel con POST. Devuelve solo ok/status;
 * la URL del hook jamás sale de esta función.
 */
export async function callDeployHook(hookUrl: string): Promise<{ ok: boolean; status: number }> {
  const resp = await fetch(hookUrl, { method: 'POST' });
  return { ok: resp.ok, status: resp.status };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (isPortfolioPreviewEnvironment(process.env)) {
    res.status(503).json({ ok: false, error: 'preview_disabled' });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'missing_token' });
    return;
  }

  let check: AdminCheck;
  try {
    check = await checkAdmin(token);
  } catch {
    res.status(500).json({ ok: false, error: 'auth_check_failed' });
    return;
  }
  if (check === 'invalid_token') {
    res.status(401).json({ ok: false, error: 'invalid_token' });
    return;
  }
  if (check === 'not_admin') {
    res.status(403).json({ ok: false, error: 'admin_required' });
    return;
  }

  const hookUrl = process.env.BLOG_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    res.status(500).json({ ok: false, error: 'deploy_hook_not_configured' });
    return;
  }

  try {
    const result = await callDeployHook(hookUrl);
    if (!result.ok) {
      res.status(502).json({ ok: false, error: 'deploy_hook_failed', status: result.status });
      return;
    }
  } catch {
    res.status(502).json({ ok: false, error: 'deploy_hook_failed' });
    return;
  }

  res.status(200).json({ ok: true });
}
