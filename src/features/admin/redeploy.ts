// Cliente del endpoint /api/redeploy-blog.
//
// El Deploy Hook de Vercel vive SOLO en el servidor (BLOG_DEPLOY_HOOK_URL,
// sin prefijo VITE_): desde aquí jamás se ve la URL. Se envía el
// access_token de la sesión admin para que el endpoint valide identidad y
// rol en Supabase antes de disparar el redeploy.
import { supabase } from '../../lib/supabaseClient';

export { shouldTriggerBlogRedeploy } from './redeployPolicy';

export type RedeployResult = { ok: true } | { ok: false; error: string };

export async function requestBlogRedeploy(): Promise<RedeployResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, error: 'no_session' };

    const resp = await fetch('/api/redeploy-blog', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!resp.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? `http_${resp.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
