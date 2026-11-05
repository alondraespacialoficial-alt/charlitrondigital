import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Incorporacion directa de un aliado por un administrador, con el registro publico cerrado. La clave de servicio
// solo existe aqui (servidor): nunca llega al bundle.
// 1) El JWT del administrador llama admin_invite_ally: la BD verifica que sea admin, deja una solicitud pendiente
//    auditada y avisa si el correo ya existe en Auth.
// 2) Correo nuevo: la Auth Admin API invita (Supabase envia el correo). Correo ya existente sin rol: no se invita
//    otra vez ni se duplica el usuario; solo se vincula.
// 3) El mismo JWT llama admin_finalize_registration (rol + perfil activo + auditoria). Solo aqui nace el rol de aliado.
// Si el paso 3 falla, un usuario recien invitado se elimina; uno preexistente nunca se toca.

export interface InviteInput {
  email: string;
  full_name: string;
  phone?: string;
  city?: string;
}

export interface InviteClients {
  asAdmin: SupabaseClient;
  authAdmin: SupabaseClient;
}

export interface InviteResult {
  status: number;
  body: { ok: boolean; error?: string; outcome?: 'invited' | 'linked' };
}

const fail = (status: number, error: string): InviteResult => ({ status, body: { ok: false, error } });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parseInviteInput(body: unknown): InviteInput | null {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const email = text(raw.email).toLowerCase();
  const full_name = text(raw.full_name);
  const phone = text(raw.phone);
  const city = text(raw.city);
  if (email.length < 5 || email.length > 254 || !EMAIL.test(email)) return null;
  if (full_name.length < 2 || full_name.length > 120) return null;
  if (phone.length > 30 || city.length > 80) return null;
  return { email, full_name, ...(phone ? { phone } : {}), ...(city ? { city } : {}) };
}

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

export async function inviteAlly(clients: InviteClients, input: InviteInput, redirectTo?: string): Promise<InviteResult> {
  const created = await clients.asAdmin.rpc('admin_invite_ally', {
    p_email: input.email,
    p_full_name: input.full_name,
    p_phone: input.phone ?? null,
    p_city: input.city ?? null,
  });
  if (created.error) {
    const code = created.error.code;
    if (code === '42501') return fail(403, 'forbidden');
    if (code === '23505') return fail(409, 'already_ally');
    if (code === '23514') return fail(400, 'invalid_data');
    if (code === 'PGRST301' || code === 'PGRST303') return fail(401, 'invalid_token');
    return fail(503, 'invite_failed');
  }
  const row = (Array.isArray(created.data) ? created.data[0] : created.data) as
    | { registration_id?: string; auth_user_id?: string | null }
    | undefined;
  if (!row?.registration_id) return fail(503, 'invite_failed');

  let userId = row.auth_user_id ?? null;
  const preexisting = userId !== null;
  if (!userId) {
    const invited = await clients.authAdmin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (invited.error || !invited.data.user) {
      const code = invited.error && 'code' in invited.error ? String(invited.error.code) : '';
      if (code === 'email_exists' || invited.error?.status === 422) return fail(409, 'email_already_registered');
      return fail(502, 'auth_invite_failed');
    }
    userId = invited.data.user.id;
  }

  const finalize = await clients.asAdmin.rpc('admin_finalize_registration', {
    p_registration_id: row.registration_id,
    p_user_id: userId,
  });
  if (finalize.error) {
    if (!preexisting) await clients.authAdmin.auth.admin.deleteUser(userId);
    return fail(finalize.error.code === 'P0002' ? 404 : 500, 'finalize_failed');
  }
  return { status: 200, body: { ok: true, outcome: preexisting ? 'linked' : 'invited' } };
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

  const input = parseInviteInput(req.body);
  if (!input) {
    res.status(400).json({ ok: false, error: 'invalid_data' });
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

  const result = await inviteAlly({ asAdmin, authAdmin }, input, activationRedirect(process.env));
  res.status(result.status).json(result.body);
}
