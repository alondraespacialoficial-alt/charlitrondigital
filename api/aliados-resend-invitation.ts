import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Reenvio de la invitacion a un aliado que aun no creo su contrasena (por ejemplo, si el enlace expiro).
// 1) El JWT del administrador consulta admin_allies: la vista solo devuelve filas a administradores.
// 2) La Auth Admin API vuelve a invitar al correo; si la cuenta ya esta confirmada, Supabase lo rechaza (409).
// La clave de servicio solo existe aqui (servidor): nunca llega al bundle.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResendClients {
  asAdmin: SupabaseClient;
  authAdmin: SupabaseClient;
}

export interface ResendResult {
  status: number;
  body: { ok: boolean; error?: string };
}

const fail = (status: number, error: string): ResendResult => ({ status, body: { ok: false, error } });

// Misma regla que en aliados-approve-registration.ts (cada funcion de api/ es independiente).
export function activationRedirect(env: Record<string, string | undefined>): string | undefined {
  const base = env.VERCEL_ENV === 'preview' && env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.VITE_SITE_URL?.trim();
  if (!base) return undefined;
  try {
    const url = new URL(base);
    return url.protocol === 'https:' ? `${url.origin}/aliados/activar` : undefined;
  } catch {
    return undefined;
  }
}

export async function resendInvitation(clients: ResendClients, userId: string, redirectTo?: string): Promise<ResendResult> {
  const lookup = await clients.asAdmin.from('admin_allies').select('email,confirmed_at').eq('user_id', userId).maybeSingle();
  if (lookup.error) {
    const code = (lookup.error as { code?: string }).code;
    if (code === 'PGRST301' || code === 'PGRST303') return fail(401, 'invalid_token');
    return fail(503, 'lookup_failed');
  }
  const ally = lookup.data as { email?: string; confirmed_at?: string | null } | null;
  // Para quien no es administrador la vista no devuelve filas: no se distingue de un aliado inexistente.
  if (!ally?.email) return fail(404, 'ally_not_found');
  if (ally.confirmed_at) return fail(409, 'already_active');

  const invited = await clients.authAdmin.auth.admin.inviteUserByEmail(ally.email, redirectTo ? { redirectTo } : undefined);
  if (invited.error) {
    const code = 'code' in invited.error ? String(invited.error.code) : '';
    if (code === 'email_exists' || invited.error.status === 422) return fail(409, 'already_active');
    return fail(502, 'auth_invite_failed');
  }
  return { status: 200, body: { ok: true } };
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim() || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
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

  const userId = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
  if (!UUID.test(userId)) {
    res.status(400).json({ ok: false, error: 'invalid_user_id' });
    return;
  }

  const url = process.env.ALIADOS_SUPABASE_URL;
  const anonKey = process.env.ALIADOS_SUPABASE_ANON_KEY;
  const serviceKey = process.env.ALIADOS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' });
    return;
  }
  if (!serviceKey) {
    res.status(503).json({ ok: false, error: 'auth_admin_not_configured' });
    return;
  }

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const asAdmin = createClient(url, anonKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const authAdmin = createClient(url, serviceKey, options);

  const result = await resendInvitation({ asAdmin, authAdmin }, userId, activationRedirect(process.env));
  res.status(result.status).json(result.body);
}
