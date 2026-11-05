/**
 * Capa de datos de Aliados Charlitron.
 * Las tablas no tienen permisos directos: el aliado lee solo vistas ally_my_*, el administrador vistas admin_*,
 * y toda escritura pasa por funciones SECURITY DEFINER (ver supabase/proposals/aliados-lab-0002-operations.sql).
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AllyRegistration {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  city?: string;
  // null = invitacion creada por un administrador: el interesado aun no acepta el aviso.
  consent_at: string | null;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id?: string;
}

export interface AllyProfile {
  user_id: string;
  display_name: string;
  email?: string;
  phone?: string;
  city?: string;
  status: 'pending' | 'active' | 'paused';
  approved_at?: string;
  created_at: string;
  // null = invitacion sin aceptar; ausente = la base aun no expone la columna (migracion 0004).
  confirmed_at?: string | null;
}

// Lo que ve el aliado (ally_my_referrals): sin notas internas ni datos de revision.
export interface Referral {
  id: string;
  referred_name: string;
  referred_email?: string;
  referred_phone?: string;
  referred_city?: string;
  referred_organization?: string;
  data_share_authorized: boolean;
  status: 'new' | 'contacted' | 'interested' | 'closed' | 'duplicate';
  created_at: string;
  updated_at: string;
}

// Lo que ve el administrador (admin_referrals).
export interface AdminReferral extends Referral {
  ally_id: string;
  internal_notes?: string;
  duplicate_review: boolean;
  duplicate_of?: string;
}

export interface Sale {
  id: string;
  referral_id: string;
  ally_id: string;
  sale_date: string;
  amount_agreed: number;
  sale_description?: string;
  internal_notes?: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  reference_number?: string;
  reversed_at?: string;
}

export interface AdminCommission {
  id: string;
  sale_id: string;
  ally_id: string;
  commission_amount: number;
  status: 'assigned' | 'authorized';
  assigned_at: string;
  authorized_at?: string;
  net_collected: number;
  release_limit: number;
  paid_total: number;
}

// Lo que ve el aliado (ally_my_commissions): sin cobros, limites ni datos de la venta.
export interface Commission {
  id: string;
  referral_id: string;
  referred_name: string;
  commission_amount: number;
  status: 'assigned' | 'authorized';
  paid_total: number;
  balance: number;
  assigned_at: string;
}

export interface CommissionPayment {
  id: string;
  commission_id: string;
  payment_date: string;
  amount_paid: number;
  payment_method?: string;
  reference_number?: string;
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar ${what}: ${error.message}`);
  return (data ?? []) as T[];
}

async function call<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export class AliadosRepository {
  constructor(private client: SupabaseClient) {}

  // ---------------- Administrador (vistas admin_*) ----------------

  listAllies() {
    return rows<AllyProfile>(this.client.from('admin_allies').select('*').order('created_at', { ascending: false }), 'aliados');
  }

  async getOwnProfile(userId: string): Promise<AllyProfile | null> {
    const { data, error } = await this.client
      .from('ally_profiles')
      .select('user_id,display_name,phone,city,status,approved_at,created_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`No se pudo cargar tu perfil: ${error.message}`);
    return (data as AllyProfile | null) ?? null;
  }

  listRegistrations() {
    return rows<AllyRegistration>(
      this.client.from('admin_registrations').select('*').order('created_at', { ascending: false }),
      'solicitudes',
    );
  }

  listReferrals() {
    return rows<AdminReferral>(this.client.from('admin_referrals').select('*').order('created_at', { ascending: false }), 'referidos');
  }

  listSales() {
    return rows<Sale>(this.client.from('admin_sales').select('*').order('sale_date', { ascending: false }), 'ventas');
  }

  listPayments() {
    return rows<Payment>(this.client.from('admin_payments').select('*').order('payment_date', { ascending: false }), 'cobros');
  }

  listCommissions() {
    return rows<AdminCommission>(
      this.client.from('admin_commissions').select('*').order('assigned_at', { ascending: false }),
      'comisiones',
    );
  }

  listCommissionPayments() {
    return rows<CommissionPayment>(
      this.client.from('admin_commission_payments').select('*').is('reversed_at', null).order('payment_date', { ascending: false }),
      'pagos de comision',
    );
  }

  // ---------------- Aliado (vistas ally_my_*) ----------------

  listMyReferrals() {
    return rows<Referral>(this.client.from('ally_my_referrals').select('*').order('created_at', { ascending: false }), 'tus referidos');
  }

  listMyCommissions() {
    return rows<Commission>(
      this.client.from('ally_my_commissions').select('*').order('assigned_at', { ascending: false }),
      'tus comisiones',
    );
  }

  // ---------------- Escrituras: solo funciones ----------------

  async submitReferral(input: {
    name: string;
    email?: string;
    phone?: string;
    city?: string;
    organization?: string;
    authorized: boolean;
  }): Promise<string> {
    return call<string>(
      this.client.rpc('submit_referral', {
        p_name: input.name,
        p_email: input.email ?? null,
        p_phone: input.phone ?? null,
        p_city: input.city ?? null,
        p_organization: input.organization ?? null,
        p_authorized: input.authorized,
      }),
    );
  }

  // La cuenta Auth se crea en el backend con la Auth Admin API; el navegador nunca ve la service role key.
  async approveRegistration(registrationId: string): Promise<void> {
    await this.callBackend('/api/aliados-approve-registration', { registration_id: registrationId });
  }

  // Vuelve a enviar la invitacion a un aliado que aun no crea su contrasena (enlace vencido o perdido).
  async resendInvitation(userId: string): Promise<void> {
    await this.callBackend('/api/aliados-resend-invitation', { user_id: userId });
  }

  // Incorpora a un aliado con el registro publico cerrado. 'linked' = ya tenia cuenta: se vincula sin otra invitacion.
  async inviteAlly(input: { email: string; full_name: string; phone?: string; city?: string }): Promise<'invited' | 'linked'> {
    const result = await this.callBackend('/api/aliados-invite-ally', input);
    return result.outcome === 'linked' ? 'linked' : 'invited';
  }

  private async callBackend(path: string, body: Record<string, string | undefined>): Promise<{ outcome?: string }> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const failure = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(approvalErrorMessage(failure.error));
    }
    return (await response.json().catch(() => ({}))) as { outcome?: string };
  }

  // Aprobar (pending -> active), pausar (active -> paused) o reactivar (paused -> active). Solo por funcion segura.
  setAllyStatus(userId: string, status: 'active' | 'paused') {
    return call<void>(this.client.rpc('admin_set_ally_status', { p_user_id: userId, p_status: status }));
  }

  rejectRegistration(registrationId: string, reason: string) {
    return call<void>(this.client.rpc('admin_reject_registration', { p_registration_id: registrationId, p_reason: reason }));
  }

  setReferralStatus(referralId: string, status: AdminReferral['status'], notes?: string, duplicateOf?: string) {
    return call<void>(
      this.client.rpc('admin_set_referral_status', {
        p_referral_id: referralId,
        p_status: status,
        p_notes: notes ?? null,
        p_duplicate_of: duplicateOf ?? null,
      }),
    );
  }

  recordSale(referralId: string, amount: number, description?: string, internalNotes?: string) {
    return call<string>(
      this.client.rpc('admin_record_sale', {
        p_referral_id: referralId,
        p_amount: amount,
        p_description: description ?? null,
        p_notes: internalNotes ?? null,
      }),
    );
  }

  correctSale(saleId: string, newAmount: number, reason: string) {
    return call<void>(this.client.rpc('admin_correct_sale', { p_sale_id: saleId, p_new_amount: newAmount, p_reason: reason }));
  }

  // idempotencyKey: genera una por envío del formulario (crypto.randomUUID()) para que un reintento no duplique.
  recordPayment(saleId: string, amount: number, idempotencyKey: string, method: string, reference?: string, notes?: string) {
    return call<string>(
      this.client.rpc('admin_record_payment', {
        p_sale_id: saleId,
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
        p_method: method,
        p_reference: reference ?? null,
        p_notes: notes ?? null,
      }),
    );
  }

  reversePayment(paymentId: string, reason: string) {
    return call<void>(this.client.rpc('admin_reverse_payment', { p_payment_id: paymentId, p_reason: reason }));
  }

  assignCommission(saleId: string, amount: number) {
    return call<string>(this.client.rpc('admin_assign_commission', { p_sale_id: saleId, p_amount: amount }));
  }

  authorizeCommission(commissionId: string) {
    return call<void>(this.client.rpc('admin_authorize_commission', { p_commission_id: commissionId }));
  }

  payCommission(commissionId: string, amount: number, idempotencyKey: string, method: string, reference?: string, notes?: string) {
    return call<string>(
      this.client.rpc('admin_pay_commission', {
        p_commission_id: commissionId,
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
        p_method: method,
        p_reference: reference ?? null,
        p_notes: notes ?? null,
      }),
    );
  }

  reverseCommissionPayment(paymentId: string, reason: string) {
    return call<void>(this.client.rpc('admin_reverse_commission_payment', { p_payment_id: paymentId, p_reason: reason }));
  }
}

function approvalErrorMessage(code?: string): string {
  switch (code) {
    case 'forbidden':
      return 'Solo un administrador puede aprobar solicitudes.';
    case 'invalid_token':
      return 'Sesión no válida. Vuelve a iniciar sesión.';
    case 'registration_not_found':
      return 'La solicitud ya no está pendiente.';
    case 'ally_not_found':
      return 'No se encontró al aliado.';
    case 'already_active':
      return 'Esa cuenta ya creó su contraseña; no necesita otra invitación.';
    case 'auth_invite_failed':
      return 'No se pudo enviar el correo de invitación. Revisa la configuración de correo de Supabase.';
    case 'email_already_registered':
      return 'Ese correo ya tiene una cuenta. Revísalo en Supabase Auth.';
    case 'already_ally':
      return 'Ese correo ya pertenece a un aliado o administrador.';
    case 'invalid_data':
      return 'Revisa los datos: nombre, correo y, si lo escribes, un WhatsApp válido.';
    case 'auth_admin_not_configured':
      return 'El servidor aún no tiene configurada la clave de administración de Auth.';
    default:
      return 'No se pudo aprobar la solicitud. No se hizo ningún cambio.';
  }
}
