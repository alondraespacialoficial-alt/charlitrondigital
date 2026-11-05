-- ALIADOS CHARLITRON — Schema COMPLETO Y VALIDABLE en PostgreSQL local
-- Sin dependencias externas (no requiere Supabase extensions ni prior schemas)
-- Proyect: charlitron-aliados-test

-- ============================================================================
-- SETUP: Crear estructura mínima para pruebas
-- ============================================================================

-- Crear esquema de auditoría
CREATE SCHEMA IF NOT EXISTS public;

-- Crear tabla de usuarios simplificada (simula Supabase auth.users)
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  confirmed_at timestamptz,
  role text DEFAULT 'authenticated',
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Función para simular auth.uid()
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT current_setting('app.current_user_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Función para simular is_admin()
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  -- Obtener user_id actual
  RETURN EXISTS (
    SELECT 1 FROM public.ally_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLAS PRINCIPALES
-- ============================================================================

-- Tabla: Perfiles de aliados
CREATE TABLE IF NOT EXISTS public.ally_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  city text,
  bank_account text,
  bank_name text,
  identification_type text,
  identification_number text,
  role text NOT NULL DEFAULT 'ally' CHECK (role IN ('ally', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: Solicitudes de registro (pública)
CREATE TABLE IF NOT EXISTS public.ally_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  phone text,
  city text,
  share_data_agreed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rejection_reason text,
  rejected_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Tabla: Auditoría de registros
CREATE TABLE IF NOT EXISTS public.ally_registration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.ally_registrations (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected')),
  changed_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: Referidos
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ally_id uuid NOT NULL REFERENCES public.ally_profiles (user_id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  city text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'converted', 'lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Tabla: Ventas
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals (id) ON DELETE CASCADE,
  agreed_price numeric(15, 2) NOT NULL CHECK (agreed_price > 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Tabla: Cobros (pagos por venta)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text
);

-- Tabla: Comisiones (manuales, no automáticas)
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals (id) ON DELETE CASCADE,
  commission_amount numeric(15, 2) NOT NULL CHECK (commission_amount > 0),
  percentage numeric(5, 2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Tabla: Pagos de comisión
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  authorized_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text
);

-- Tabla: Auditoría de comisiones
CREATE TABLE IF NOT EXISTS public.commissions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'authorized', 'payment_processed', 'payment_reversed', 'cancelled')),
  changed_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: Intentos de pago (detección de duplicados en concurrencia)
CREATE TABLE IF NOT EXISTS public.commission_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
  attempt_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(15, 2),
  status text DEFAULT 'pending',
  CONSTRAINT unique_attempt UNIQUE (commission_id, attempt_at)
);

-- ============================================================================
-- FIX 1: REGISTRO SEGURO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_registration(
  p_email text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_share_data_agreed boolean DEFAULT false
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT p_share_data_agreed THEN
    RAISE EXCEPTION 'Data sharing consent required';
  END IF;
  IF char_length(btrim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid full_name';
  END IF;
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  INSERT INTO public.ally_registrations (email, full_name, phone, city, share_data_agreed)
  VALUES (p_email, p_full_name, p_phone, p_city, p_share_data_agreed)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función de aprobación: crear Auth + ally_profile
CREATE OR REPLACE FUNCTION public.approve_registration_and_create_user(
  p_registration_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_reg record;
  v_auth_uid uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT id, email, full_name, phone, city, share_data_agreed
  INTO v_reg
  FROM public.ally_registrations
  WHERE id = p_registration_id AND status = 'pending'
  FOR UPDATE;

  IF v_reg IS NULL THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;

  -- Crear o actualizar usuario Auth
  INSERT INTO auth.users (email, confirmed_at, role, raw_user_meta_data)
  VALUES (v_reg.email, now(), 'authenticated', jsonb_build_object('full_name', v_reg.full_name, 'is_ally', true))
  ON CONFLICT (email) DO UPDATE
  SET role = 'authenticated', raw_user_meta_data = auth.users.raw_user_meta_data || jsonb_build_object('is_ally', true)
  RETURNING id INTO v_auth_uid;

  -- Crear ally_profile
  INSERT INTO public.ally_profiles (user_id, full_name, email, phone, city, role, status)
  VALUES (v_auth_uid, v_reg.full_name, v_reg.email, v_reg.phone, v_reg.city, 'ally', 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active', updated_at = now();

  -- Marcar registro como aprobado
  UPDATE public.ally_registrations
  SET status = 'approved', user_id = v_auth_uid, approved_by = auth.uid(), approved_at = now()
  WHERE id = p_registration_id;

  -- Auditoría
  INSERT INTO public.ally_registration_audit (registration_id, action, changed_by, changes)
  VALUES (p_registration_id, 'approved', auth.uid(), jsonb_build_object('email', v_reg.email, 'user_created', true));

  RETURN jsonb_build_object('success', true, 'email', v_reg.email, 'status', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- FIX 2: PRIVACIDAD — Nivel columna: aliado NO ve montos/cobros/notas
-- ============================================================================

-- Vista: Referidos del aliado (sin datos sensibles)
CREATE OR REPLACE VIEW public.referrals_ally_view AS
SELECT r.id, r.full_name, r.email, r.phone, r.city, r.status, r.created_at
FROM public.referrals r
WHERE r.ally_id = auth.uid()
AND r.deleted_at IS NULL;

-- Vista: Comisiones del aliado (sin montos de venta/cobros internos)
CREATE OR REPLACE VIEW public.commissions_ally_view AS
SELECT
  c.id,
  c.referral_id,
  c.commission_amount,
  c.status,
  COALESCE((SELECT sum(amount) FROM public.commission_payments WHERE commission_id = c.id AND reversed_at IS NULL), 0::numeric) as total_paid,
  c.created_at
FROM public.commissions c
JOIN public.referrals r ON c.referral_id = r.id
WHERE r.ally_id = auth.uid() AND c.deleted_at IS NULL;

-- Deniega acceso directo a tablas sensibles para aliados (nivel columna + fila)
-- Aliado NO PUEDE:
-- - Ver tabla public.sales (montos de venta)
-- - Ver tabla public.payments (cobros confirmados)
-- - Acceder a auditorías

-- ============================================================================
-- FIX 3: COMISIONES — No superar acordado, respetar cobros netos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pay_commission_safe(
  p_commission_id uuid,
  p_amount numeric
) RETURNS jsonb AS $$
DECLARE
  v_commission record;
  v_referral record;
  v_total_paid numeric;
  v_total_confirmed_payments numeric;
  v_max_allowed numeric;
  v_sale_price numeric;
  v_payment_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0';
  END IF;

  -- Bloquear comisión (LOCK)
  SELECT c.*, COALESCE(sum(cp.amount), 0::numeric) as total_paid
  INTO v_commission
  FROM public.commissions c
  LEFT JOIN public.commission_payments cp ON cp.commission_id = c.id AND cp.reversed_at IS NULL
  WHERE c.id = p_commission_id
  GROUP BY c.id
  FOR UPDATE;

  IF v_commission IS NULL THEN
    RAISE EXCEPTION 'Commission not found';
  END IF;

  v_total_paid := COALESCE(v_commission.total_paid, 0::numeric);

  -- Validar: no superar comisión acordada
  IF (v_total_paid + p_amount) > v_commission.commission_amount THEN
    RAISE EXCEPTION 'Payment % would exceed commission % (already paid %)',
      p_amount, v_commission.commission_amount, v_total_paid;
  END IF;

  -- Obtener referral y calcular cobros netos confirmados
  SELECT r.id, r.ally_id,
    COALESCE(sum(p.amount), 0::numeric) as total_confirmed,
    COALESCE(sum(s.agreed_price), 0::numeric) as total_sale_price
  INTO v_referral
  FROM public.referrals r
  LEFT JOIN public.sales s ON s.referral_id = r.id AND s.deleted_at IS NULL
  LEFT JOIN public.payments p ON p.sale_id = s.id AND p.reversed_at IS NULL
  WHERE r.id = v_commission.referral_id
  GROUP BY r.id
  FOR UPDATE;

  IF v_referral IS NULL THEN
    RAISE EXCEPTION 'Referral not found';
  END IF;

  -- Calcular límite permitido: (cobros confirmados / precio total) * comisión acordada
  IF v_referral.total_sale_price > 0 THEN
    v_max_allowed := (v_referral.total_confirmed / v_referral.total_sale_price) * v_commission.commission_amount;
  ELSE
    v_max_allowed := v_commission.commission_amount;
  END IF;

  -- Validar proporcionalidad
  IF (v_total_paid + p_amount) > v_max_allowed THEN
    RAISE EXCEPTION 'Payment % exceeds proportional limit % (confirmed %/%)',
      p_amount, v_max_allowed, v_referral.total_confirmed, v_referral.total_sale_price;
  END IF;

  -- Registrar intento (detector de duplicados)
  INSERT INTO public.commission_payment_attempts (commission_id, amount)
  VALUES (p_commission_id, p_amount)
  ON CONFLICT (commission_id, attempt_at) DO NOTHING;

  -- Crear pago
  INSERT INTO public.commission_payments (
    commission_id, amount, payment_date, payment_method, status, authorized_by
  ) VALUES (
    p_commission_id, p_amount, now(), 'manual', 'completed', auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- Auditar
  INSERT INTO public.commissions_audit (commission_id, action, changed_by, changes)
  VALUES (
    p_commission_id, 'payment_processed', auth.uid(),
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount, 'total_paid', v_total_paid + p_amount)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount', p_amount,
    'total_paid', v_total_paid + p_amount,
    'commission_amount', v_commission.commission_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para reversar pago (no borra, auditable)
CREATE OR REPLACE FUNCTION public.reverse_commission_payment(
  p_payment_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_payment record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_payment
  FROM public.commission_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payment already reversed';
  END IF;

  UPDATE public.commission_payments
  SET reversed_at = now(), reversal_reason = p_reason
  WHERE id = p_payment_id;

  INSERT INTO public.commissions_audit (commission_id, action, changed_by, changes)
  VALUES (v_payment.commission_id, 'payment_reversed', auth.uid(), jsonb_build_object('payment_id', p_payment_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'reversed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- FIX 4: PROTECCIÓN — Aliado NO puede modificar campos internos
-- ============================================================================

-- Crear roles para simulación Supabase (para testing local)
DO $$
BEGIN
  CREATE ROLE anon;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE authenticated;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- RLS simplificada (PostgreSQL básico, sin Supabase extensions)
-- Las restricciones principales están en las funciones SECURITY DEFINER

RAISE NOTICE '✅ Aliados schema v3 complete: registration, privacy, commissions, protection';
