import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Copia local de scripts/portfolioPreviewPolicy.ts: Vercel no resuelve imports relativos sin extensión en ESM.
function isPortfolioProductionMainEnvironment(environment: Record<string, string | undefined>): boolean {
  return environment.VERCEL_ENV === 'production' && environment.VERCEL_GIT_COMMIT_REF === 'main';
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim() || null;
}

export async function callPortfolioDeployHook(
  hookUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetcher(hookUrl, { method: 'POST' });
  return { ok: response.ok, status: response.status };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!isPortfolioProductionMainEnvironment(process.env)) {
    res.status(503).json({ ok: false, error: 'production_main_only' });
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

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ ok: false, error: 'invalid_token' });
    return;
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminError) {
    res.status(503).json({ ok: false, error: 'admin_check_failed' });
    return;
  }
  if (!adminRow) {
    res.status(403).json({ ok: false, error: 'admin_required' });
    return;
  }

  const hookUrl = process.env.PORTFOLIO_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    res.status(503).json({ ok: false, error: 'portfolio_hook_not_configured' });
    return;
  }

  try {
    const result = await callPortfolioDeployHook(hookUrl);
    if (!result.ok) {
      res.status(502).json({ ok: false, error: 'portfolio_hook_failed', status: result.status });
      return;
    }
  } catch {
    res.status(502).json({ ok: false, error: 'portfolio_hook_failed' });
    return;
  }
  res.status(200).json({ ok: true });
}