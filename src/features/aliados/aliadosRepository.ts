/**
 * Repository layer for Aliados Charlitron
 * Manages all database operations with RLS security
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AllyRegistration {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  city?: string;
  share_data_agreed: boolean;
  created_at: string;
  expires_at: string;
  approved_by?: string;
  approved_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
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
}

export interface Referral {
  id: string;
  ally_id: string;
  referred_name: string;
  referred_email?: string;
  referred_phone?: string;
  referred_city?: string;
  referred_organization?: string;
  relationship?: string;
  source?: string;
  data_share_authorized: boolean;
  notes_private?: string;
  status: 'new' | 'contacted' | 'interested' | 'closed' | 'duplicate';
  duplicate_of?: string;
  created_at: string;
  modified_at: string;
}

export interface Sale {
  id: string;
  referral_id?: string;
  ally_id: string;
  sale_date: string;
  amount_agreed: number;
  sale_description?: string;
  recorded_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  reference_number?: string;
  confirmed_at: string;
}

export interface Commission {
  id: string;
  sale_id: string;
  ally_id: string;
  commission_percentage: number;
  commission_amount: number;
  status: 'assigned' | 'approved' | 'partially_paid' | 'paid' | 'cancelled';
  assigned_at: string;
  approved_at?: string;
}

export interface CommissionPayment {
  id: string;
  commission_id: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  authorized_at: string;
  confirmed_at?: string;
}

export class AliadosRepository {
  constructor(private client: SupabaseClient) {}

  // ============================================
  // ALLY PROFILES
  // ============================================

  async listAllies() {
    const { data, error } = await this.client
      .from('ally_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list allies: ${error.message}`);
    return data as AllyProfile[];
  }

  async listRegistrations() {
    const { data, error } = await this.client
      .from('ally_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list registrations: ${error.message}`);
    return data as AllyRegistration[];
  }

  async getAllyById(userId: string) {
    const { data, error } = await this.client
      .from('ally_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(`Failed to get ally: ${error.message}`);
    return data as AllyProfile;
  }

  async updateAllyStatus(userId: string, status: 'pending' | 'active' | 'paused', changedBy: string) {
    const { error } = await this.client
      .from('ally_profiles')
      .update({ status, status_changed_by: changedBy, status_changed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to update ally status: ${error.message}`);
  }

  // ============================================
  // REFERRALS
  // ============================================

  async listReferrals() {
    const { data, error } = await this.client
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list referrals: ${error.message}`);
    return data as Referral[];
  }

  async createReferral(referral: Omit<Referral, 'id' | 'created_at' | 'modified_at'>, createdBy: string) {
    const { data, error } = await this.client
      .from('referrals')
      .insert([{ ...referral, created_by: createdBy, modified_by: createdBy }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create referral: ${error.message}`);
    return data as Referral;
  }

  async listReferralsByAlly(allyId: string) {
    const { data, error } = await this.client
      .from('referrals')
      .select('*')
      .eq('ally_id', allyId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list referrals: ${error.message}`);
    return data as Referral[];
  }

  async getReferralById(referralId: string) {
    const { data, error } = await this.client
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (error) throw new Error(`Failed to get referral: ${error.message}`);
    return data as Referral;
  }

  async updateReferral(referralId: string, updates: Partial<Referral>, modifiedBy: string) {
    const { error } = await this.client
      .from('referrals')
      .update({ ...updates, modified_by: modifiedBy, modified_at: new Date().toISOString() })
      .eq('id', referralId);

    if (error) throw new Error(`Failed to update referral: ${error.message}`);
  }

  async markReferralAsDuplicate(referralId: string, duplicateOf: string, modifiedBy: string) {
    const { error } = await this.client
      .from('referrals')
      .update({ status: 'duplicate', duplicate_of: duplicateOf, modified_by: modifiedBy, modified_at: new Date().toISOString() })
      .eq('id', referralId);

    if (error) throw new Error(`Failed to mark referral as duplicate: ${error.message}`);
  }

  // ============================================
  // SALES
  // ============================================

  async listSales() {
    const { data, error } = await this.client
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });

    if (error) throw new Error(`Failed to list sales: ${error.message}`);
    return data as Sale[];
  }

  async listSalesByAlly(allyId: string) {
    const { data, error } = await this.client
      .from('sales')
      .select('*')
      .eq('ally_id', allyId)
      .order('sale_date', { ascending: false });

    if (error) throw new Error(`Failed to list sales: ${error.message}`);
    return data as Sale[];
  }

  async getSaleById(saleId: string) {
    const { data, error } = await this.client
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (error) throw new Error(`Failed to get sale: ${error.message}`);
    return data as Sale;
  }

  // ============================================
  // PAYMENTS
  // ============================================

  async listPayments() {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) throw new Error(`Failed to list payments: ${error.message}`);
    return data as Payment[];
  }

  async listPaymentsBySale(saleId: string) {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('sale_id', saleId)
      .is('reversed_at', null)
      .order('payment_date', { ascending: false });

    if (error) throw new Error(`Failed to list payments: ${error.message}`);
    return data as Payment[];
  }

  async getTotalPaidBySale(saleId: string): Promise<number> {
    const { data, error } = await this.client
      .from('payments')
      .select('amount_paid')
      .eq('sale_id', saleId)
      .is('reversed_at', null);

    if (error) throw new Error(`Failed to get payments: ${error.message}`);
    return (data as Payment[]).reduce((sum, p) => sum + p.amount_paid, 0);
  }

  // ============================================
  // COMMISSIONS
  // ============================================

  async listCommissions() {
    const { data, error } = await this.client
      .from('commissions')
      .select('*')
      .order('assigned_at', { ascending: false });

    if (error) throw new Error(`Failed to list commissions: ${error.message}`);
    return data as Commission[];
  }

  async listCommissionPayments() {
    const { data, error } = await this.client
      .from('commission_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) throw new Error(`Failed to list commission payments: ${error.message}`);
    return data as CommissionPayment[];
  }

  async listCommissionsByAlly(allyId: string) {
    const { data, error } = await this.client
      .from('commissions')
      .select('*')
      .eq('ally_id', allyId)
      .order('assigned_at', { ascending: false });

    if (error) throw new Error(`Failed to list commissions: ${error.message}`);
    return data as Commission[];
  }

  async getCommissionById(commissionId: string) {
    const { data, error } = await this.client
      .from('commissions')
      .select('*')
      .eq('id', commissionId)
      .single();

    if (error) throw new Error(`Failed to get commission: ${error.message}`);
    return data as Commission;
  }

  async listCommissionPaymentsByCommission(commissionId: string) {
    const { data, error } = await this.client
      .from('commission_payments')
      .select('*')
      .eq('commission_id', commissionId)
      .is('reversed_at', null)
      .order('payment_date', { ascending: false });

    if (error) throw new Error(`Failed to list commission payments: ${error.message}`);
    return data as CommissionPayment[];
  }

  async getTotalCommissionPaid(commissionId: string): Promise<number> {
    const { data, error } = await this.client
      .from('commission_payments')
      .select('amount_paid')
      .eq('commission_id', commissionId)
      .is('reversed_at', null);

    if (error) throw new Error(`Failed to get commission payments: ${error.message}`);
    return (data as CommissionPayment[]).reduce((sum, p) => sum + p.amount_paid, 0);
  }

  // ============================================
  // ADMIN FUNCTIONS (via RLS-secured functions)
  // ============================================

  async approveRegistration(registrationId: string): Promise<void> {
    const { error } = await this.client.rpc('approve_registration', {
      reg_id: registrationId,
      approver_id: (await this.client.auth.getUser()).data.user?.id,
    });

    if (error) throw new Error(`Failed to approve registration: ${error.message}`);
  }

  async rejectRegistration(registrationId: string, reason: string): Promise<void> {
    const { error } = await this.client.rpc('reject_registration', {
      reg_id: registrationId,
      rejector_id: (await this.client.auth.getUser()).data.user?.id,
      reason,
    });

    if (error) throw new Error(`Failed to reject registration: ${error.message}`);
  }

  async recordSale(allyId: string, amount: number, description: string, internalNotes: string): Promise<string> {
    const userId = (await this.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data, error } = await this.client.rpc('record_sale', {
      p_ally_id: allyId,
      p_amount: amount,
      p_description: description,
      p_internal_notes: internalNotes,
      p_recorded_by: userId,
    });

    if (error) throw new Error(`Failed to record sale: ${error.message}`);
    return data as string;
  }

  async recordPayment(saleId: string, amount: number, method: string, reference?: string): Promise<string> {
    const userId = (await this.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data, error } = await this.client.rpc('record_payment', {
      p_sale_id: saleId,
      p_amount: amount,
      p_method: method,
      p_confirmed_by: userId,
      p_reference: reference,
    });

    if (error) throw new Error(`Failed to record payment: ${error.message}`);
    return data as string;
  }

  async assignCommission(saleId: string, percentage: number): Promise<string> {
    const userId = (await this.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data, error } = await this.client.rpc('assign_commission', {
      p_sale_id: saleId,
      p_percentage: percentage,
      p_assigned_by: userId,
    });

    if (error) throw new Error(`Failed to assign commission: ${error.message}`);
    return data as string;
  }

  async payCommission(commissionId: string, amount: number, method: string, reference?: string): Promise<string> {
    const userId = (await this.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data, error } = await this.client.rpc('pay_commission', {
      p_commission_id: commissionId,
      p_amount: amount,
      p_method: method,
      p_authorized_by: userId,
      p_reference: reference,
    });

    if (error) throw new Error(`Failed to pay commission: ${error.message}`);
    return data as string;
  }
}
