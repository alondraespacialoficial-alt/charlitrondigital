-- ALIADOS CHARLITRON — Correcciones críticas (v3)
-- Arregla: 1) Registro seguro, 2) Privacidad columna, 3) Comisiones (no superar), 4) Validación real
-- Proyecto EXCLUSIVO: charlitron-aliados-test

DO $fix$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0003-fixes'));

  -- ======================================================================
  -- FIX 1: REGISTRO SEGURO — Solicitud pública sin acceso a tablas internas
  -- ======================================================================

  -- Función segura para insertar solicitud (usuario anónimo/auth)
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

  -- Función segura para aprobación: crear user Auth + ally_profile + auditoría
  CREATE OR REPLACE FUNCTION public.approve_registration_and_create_user(
    p_registration_id uuid
  ) RETURNS jsonb AS $$
  DECLARE
    v_reg record;
    v_auth_uid uuid;
    v_result jsonb;
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

    -- Crear usuario Auth: NO EXPONER ID AQUÍ, solo confirmar creación
    INSERT INTO auth.users (email, confirmed_at, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_reg.email,
      now(),
      'authenticated',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_reg.full_name, 'is_ally', true)
    )
    RETURNING id INTO v_auth_uid
    ON CONFLICT (email) DO UPDATE
    SET role = 'authenticated', raw_user_meta_data = raw_user_meta_data || jsonb_build_object('is_ally', true)
    RETURNING id INTO v_auth_uid;

    -- Crear ally_profile con rol y datos
    INSERT INTO public.ally_profiles (user_id, full_name, email, phone, city, status)
    VALUES (v_auth_uid, v_reg.full_name, v_reg.email, v_reg.phone, v_reg.city, 'active')
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'active', updated_at = now();

    -- Actualizar registro con aprobación
    UPDATE public.ally_registrations
    SET status = 'approved', user_id = v_auth_uid, approved_by = auth.uid(), approved_at = now()
    WHERE id = p_registration_id;

    -- Auditar
    INSERT INTO public.ally_registration_audit (registration_id, action, changed_by, changes)
    VALUES (
      p_registration_id,
      'approved',
      auth.uid(),
      jsonb_build_object('user_created', true, 'email', v_reg.email)
    );

    v_result := jsonb_build_object('success', true, 'email', v_reg.email, 'status', 'active');
    RETURN v_result;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- ======================================================================
  -- FIX 2: PRIVACIDAD — Nivel columna: aliado nunca ve montos/cobros/notas
  -- ======================================================================

  -- Vista segura: Aliado ve SOLO referidos propios (ID, nombre, estado)
  CREATE OR REPLACE VIEW public.referrals_ally_view AS
  SELECT r.id, r.full_name, r.email, r.status, r.created_at
  FROM public.referrals r
  WHERE r.ally_id = auth.uid()
  AND r.deleted_at IS NULL;

  -- Vista segura: Aliado ve SOLO sus comisiones (monto acordado, pago total, nada de cobros internos)
  CREATE OR REPLACE VIEW public.commissions_ally_view AS
  SELECT
    c.id,
    c.referral_id,
    c.commission_amount,
    c.status,
    COALESCE((SELECT COALESCE(sum(amount), 0::numeric)
      FROM public.commission_payments
      WHERE commission_id = c.id AND reversed_at IS NULL), 0::numeric) as total_paid,
    c.created_at
  FROM public.commissions c
  JOIN public.referrals r ON c.referral_id = r.id
  WHERE r.ally_id = auth.uid() AND c.deleted_at IS NULL;

  -- Revocar acceso directo a tablas sensibles para aliado (authenticated)
  REVOKE SELECT ON public.sales FROM authenticated;
  REVOKE SELECT ON public.payments FROM authenticated;
  REVOKE SELECT ON public.sales_audit FROM authenticated;
  REVOKE SELECT ON public.payments_audit FROM authenticated;

  -- Otorgar acceso SOLO a vistas seguras
  GRANT SELECT ON public.referrals_ally_view TO authenticated;
  GRANT SELECT ON public.commissions_ally_view TO authenticated;

  -- RLS: deniega acceso directo a tablas (línea de defensa extra)
  CREATE POLICY sales_no_ally ON public.sales
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

  CREATE POLICY payments_no_ally ON public.payments
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

  -- ======================================================================
  -- FIX 3: COMISIONES — No superar acordado, respetar cobros netos, concurrencia
  -- ======================================================================

  -- Tabla de intentos de pago (para detectar duplicados en concurrencia)
  CREATE TABLE IF NOT EXISTS public.commission_payment_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
    attempt_at timestamptz NOT NULL DEFAULT now(),
    amount numeric(15, 2),
    status text DEFAULT 'pending',
    CONSTRAINT unique_attempt UNIQUE (commission_id, attempt_at)
  );
  ALTER TABLE public.commission_payment_attempts ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.commission_payment_attempts FROM PUBLIC, anon, authenticated;

  -- Función SECURITY DEFINER: Pagar comisión con validaciones estrictas
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
    v_payment_id uuid;
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Admin only';
    END IF;

    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'Amount must be > 0';
    END IF;

    -- Bloquear comisión para evitar race condition
    SELECT c.*, (SELECT COALESCE(sum(amount), 0::numeric)
      FROM public.commission_payments
      WHERE commission_id = c.id AND reversed_at IS NULL)
    INTO v_commission
    FROM public.commissions c
    WHERE id = p_commission_id
    FOR UPDATE;

    IF v_commission IS NULL THEN
      RAISE EXCEPTION 'Commission not found';
    END IF;

    v_total_paid := COALESCE(v_commission.sum, 0::numeric);

    -- Validar: no superar comisión acordada
    IF (v_total_paid + p_amount) > v_commission.commission_amount THEN
      RAISE EXCEPTION 'Payment % would exceed commission %', p_amount, v_commission.commission_amount;
    END IF;

    -- Obtener referral y calcular cobros netos confirmados
    SELECT r.id, r.ally_id,
      COALESCE((SELECT sum(p.amount)
        FROM public.payments p
        WHERE p.sale_id IN (SELECT id FROM public.sales WHERE referral_id = r.id)
        AND p.reversed_at IS NULL), 0::numeric)
    INTO v_referral
    FROM public.referrals r
    WHERE id = v_commission.referral_id
    FOR UPDATE;

    -- Calcular máximo permitido: proporcional a cobros netos confirmados
    v_max_allowed := v_referral.coalesce * (v_commission.commission_amount / NULLIF(
      (SELECT COALESCE(sum(p.agreed_price), 1::numeric)
        FROM public.sales s
        JOIN public.payments p ON p.sale_id = s.id
        WHERE s.referral_id = v_referral.id), 1::numeric));

    IF v_max_allowed IS NULL THEN
      v_max_allowed := v_commission.commission_amount;
    END IF;

    IF (v_total_paid + p_amount) > v_max_allowed THEN
      RAISE EXCEPTION 'Payment % exceeds proportional limit % (confirmed payments %)',
        p_amount, v_max_allowed, v_referral.coalesce;
    END IF;

    -- Registrar intento (detector de duplicados)
    INSERT INTO public.commission_payment_attempts (commission_id, amount)
    VALUES (p_commission_id, p_amount)
    ON CONFLICT (commission_id, attempt_at) DO NOTHING;

    -- Crear pago
    INSERT INTO public.commission_payments (
      commission_id,
      amount,
      payment_date,
      payment_method,
      status,
      authorized_by
    ) VALUES (
      p_commission_id,
      p_amount,
      now(),
      'manual',
      'completed',
      auth.uid()
    )
    RETURNING id INTO v_payment_id;

    -- Auditar
    INSERT INTO public.commissions_audit (commission_id, action, changed_by, changes)
    VALUES (
      p_commission_id,
      'payment_processed',
      auth.uid(),
      jsonb_build_object(
        'payment_id', v_payment_id,
        'amount', p_amount,
        'total_paid', v_total_paid + p_amount,
        'commission_amount', v_commission.commission_amount
      )
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

  -- Función para reversar pago (auditable, no permite borrar)
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

    INSERT INTO public.commissions_audit (
      commission_id,
      action,
      changed_by,
      changes
    ) VALUES (
      v_payment.commission_id,
      'payment_reversed',
      auth.uid(),
      jsonb_build_object('payment_id', p_payment_id, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'reversed', true);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  -- ======================================================================
  -- FIX 4: PROTECCIÓN CONTRA MODIFICACIÓN DE CAMPOS INTERNOS
  -- ======================================================================

  -- Aliado NO PUEDE actualizar comisión ni pago
  CREATE POLICY commissions_no_ally_update ON public.commissions
    FOR UPDATE TO authenticated
    USING (false)
    WITH CHECK (false);

  CREATE POLICY commission_payments_no_ally_update ON public.commission_payments
    FOR UPDATE TO authenticated
    USING (false)
    WITH CHECK (false);

  RAISE NOTICE 'Aliados fixes v3 applied: registration, privacy, commissions, protection';
END $fix$;
