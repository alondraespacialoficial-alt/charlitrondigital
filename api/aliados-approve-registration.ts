import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Aprobacion de solicitudes de Aliados. La clave de servicio solo existe aqui (servidor): nunca llega al bundle.
// 1) El JWT del administrador consulta la solicitud (la BD verifica que sea admin).
// 2) La Auth Admin API invita al usuario: Supabase envia el correo de confirmacion.
// 3) El mismo JWT de administrador llama admin_finalize_registration (rol + perfil + auditoria).
// Si el paso 3 falla, el usuario recien creado se elimina para no dejar cuentas huerfanas.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApprovalClients {
  asAdmin: SupabaseClient;
  authAdmin: SupabaseClient;
}

export interface ApprovalResult {
  status: number;
  body: { ok: boolean; error?: string };
}

const fail = (status: number, error: string): ApprovalResult => ({ status, body: { ok: false, error } });

export async function approveRegistration(clients: ApprovalClients, registrationId: string): Promise<ApprovalResult> {
  const lookup = await clients.asAdmin.rpc('admin_registration_for_approval', { p_registration_id: registrationId });
  if (lookup.error) {
    if (lookup.error.code === '42501') return fail(403, 'forbidden');
    if (lookup.error.code === 'P0002') return fail(404, 'registration_not_found');
    if (lookup.error.code === 'PGRST301' || lookup.error.code === 'PGRST303') return fail(401, 'invalid_token');
    return fail(503, 'lookup_failed');
  }
  const registration = (Array.isArray(lookup.data) ? lookup.data[0] : lookup.data) as
    | { email: string; full_name: string }
    | undefined;
  if (!registration?.email) return fail(404, 'registration_not_found');

  const invited = await clients.authAdmin.auth.admin.inviteUserByEmail(registration.email, {
    data: { full_name: registration.full_name },
  });
  if (invited.error || !invited.data.user) {
    const code = invited.error && 'code' in invited.error ? String(invited.error.code) : '';
    if (code === 'email_exists' || invited.error?.status === 422) return fail(409, 'email_already_registered');
    return fail(502, 'auth_invite_failed');
  }

  const userId = invited.data.user.id;
  const finalize = await clients.asAdmin.rpc('admin_finalize_registration', {
    p_registration_id: registrationId,
    p_user_id: userId,
  });
  if (finalize.error) {
    await clients.authAdmin.auth.admin.deleteUser(userId);
    return fail(finalize.error.code === 'P0002' ? 404 : 500, 'finalize_failed');
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

  const registrationId = typeof req.body?.registration_id === 'string' ? req.body.registration_id : '';
  if (!UUID.test(registrationId)) {
    res.status(400).json({ ok: false, error: 'invalid_registration_id' });
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

  const result = await approveRegistration({ asAdmin, authAdmin }, registrationId);
  res.status(result.status).json(result.body);
}
