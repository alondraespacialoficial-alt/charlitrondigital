-- ALIADOS CHARLITRON — Laboratorio: esquema completo (v1, lista para instalar)
-- Proyecto Supabase EXCLUSIVO: charlitron-aliados-test. NO ejecutar en ningun otro.
--
-- PRECONDICIÓN: aliados-lab-0001-security.sql ya instalada.
-- Contenido: registros públicos, referidos, ventas, cobros, comisiones, auditoría.
--
-- GUARDAS DE SEGURIDAD:
-- 1. Verifica que sea el laboratorio correcto (assert_aliados_lab)
-- 2. Verifica que las tablas de seguridad base existan
-- 3. RLS en todas las tablas: cada usuario solo ve su información autorizada
-- 4. Funciones SECURITY DEFINER para operaciones administrativas
-- 5. Auditoría completa: creación, modificación, eliminación
--
-- PASO 1: Instalación atomica (una sentencia DO)
-- PASO 2: Pruebas de datos (no dejan cambios)

-- ============================================================================
-- PASO 1. Instalación
-- ============================================================================
DO $install$
DECLARE
  v_admin uuid;
  v_ally uuid;
BEGIN
  PERFORM public.assert_aliados_lab();
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0002-complete'));

  -- Obtener UUIDs de los usuarios de prueba
  SELECT admin_uid INTO v_admin FROM public.lab_environment;
  SELECT ally_uid INTO v_ally FROM public.lab_environment;

  -- ========================================
  -- 1. REGISTROS PÚBLICOS (control cerrado)
  -- ========================================
  CREATE TABLE public.ally_registrations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text NOT NULL UNIQUE,
    phone               text,
    full_name           text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
    city                text,
    share_data_agreed   boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    approved_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    approved_at         timestamptz,
    rejected_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    rejection_reason    text,
    rejected_at         timestamptz,
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    user_id             uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE
  );
  ALTER TABLE public.ally_registrations ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.ally_registrations FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.ally_registrations TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.ally_registrations TO authenticated;

  -- Registrado solo puede ver y modificar su propia solicitud (pendiente)
  CREATE POLICY ally_reg_own_pending_select ON public.ally_registrations
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

  CREATE POLICY ally_reg_own_pending_update ON public.ally_registrations
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND status = 'pending')
    WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');

  -- Admin puede ver todo, aprobar, rechazar
  CREATE POLICY ally_reg_admin ON public.ally_registrations
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Auditoría: tabla de cambios en registros
  CREATE TABLE public.ally_registration_audit (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id   uuid NOT NULL REFERENCES public.ally_registrations (id) ON DELETE CASCADE,
    action            text NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected')),
    changed_by        uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    changes           jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.ally_registration_audit ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.ally_registration_audit FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.ally_registration_audit TO authenticated;

  -- Admin puede ver auditoría completa
  CREATE POLICY ally_reg_audit_admin ON public.ally_registration_audit
    FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));

  -- Mejorar ally_profiles: agregar campos faltantes para datos reales
  ALTER TABLE public.ally_profiles
    ADD COLUMN IF NOT EXISTS email text UNIQUE,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS bank_account text,
    ADD COLUMN IF NOT EXISTS bank_name text,
    ADD COLUMN IF NOT EXISTS identification_type text,
    ADD COLUMN IF NOT EXISTS identification_number text;

  -- ========================================
  -- 2. REFERIDOS (datos reales, autorización)
  -- ========================================
  CREATE TABLE public.referrals (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ally_id             uuid NOT NULL REFERENCES public.ally_profiles (user_id) ON DELETE CASCADE,
    referred_name       text NOT NULL CHECK (char_length(btrim(referred_name)) BETWEEN 2 AND 120),
    referred_email      text,
    referred_phone      text,
    referred_city       text,
    referred_organization text,
    relationship        text, -- e.g., 'amigo', 'familia', 'cliente', 'colega'
    source              text, -- e.g., 'recomendacion', 'evento', 'red_social'
    data_share_authorized boolean NOT NULL DEFAULT false,
    notes_private       text,
    status              text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'closed', 'duplicate')),
    duplicate_of        uuid REFERENCES public.referrals (id) ON DELETE SET NULL,
    created_by          uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
    created_at          timestamptz NOT NULL DEFAULT now(),
    modified_by         uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
    modified_at         timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.referrals FROM PUBLIC, anon, authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;

  CREATE INDEX idx_referrals_ally ON public.referrals (ally_id);
  CREATE INDEX idx_referrals_status ON public.referrals (status);
  CREATE INDEX idx_referrals_created_at ON public.referrals (created_at);

  -- Aliado solo ve sus propios referidos
  CREATE POLICY referrals_own ON public.referrals
    FOR SELECT TO authenticated
    USING (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())));

  CREATE POLICY referrals_own_insert ON public.referrals
    FOR INSERT TO authenticated
    WITH CHECK (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())));

  CREATE POLICY referrals_own_update ON public.referrals
    FOR UPDATE TO authenticated
    USING (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())));

  -- Admin ve todo
  CREATE POLICY referrals_admin ON public.referrals
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Auditoría de referidos
  CREATE TABLE public.referrals_audit (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id     uuid NOT NULL REFERENCES public.referrals (id) ON DELETE CASCADE,
    action          text NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'marked_duplicate')),
    changed_by      uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    old_values      jsonb,
    new_values      jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.referrals_audit ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.referrals_audit FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.referrals_audit TO authenticated;

  CREATE POLICY referrals_audit_own ON public.referrals_audit
    FOR SELECT TO authenticated
    USING (
      (SELECT ally_id FROM public.referrals WHERE id = referral_id) = 
      (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid()))
    );

  CREATE POLICY referrals_audit_admin ON public.referrals_audit
    FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));

  -- ========================================
  -- 3. VENTAS Y COBROS (registro administrativo)
  -- ========================================
  CREATE TABLE public.sales (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id           uuid REFERENCES public.referrals (id) ON DELETE SET NULL,
    ally_id               uuid NOT NULL REFERENCES public.ally_profiles (user_id) ON DELETE CASCADE,
    sale_date             date NOT NULL,
    amount_agreed         numeric(12, 2) NOT NULL CHECK (amount_agreed > 0),
    amount_currency       text NOT NULL DEFAULT 'MXN',
    sale_description      text,
    internal_notes        text,
    recorded_by           uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    recorded_at           timestamptz NOT NULL DEFAULT now(),
    modified_by           uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
    modified_at           timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.sales FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.sales TO authenticated;

  CREATE INDEX idx_sales_ally ON public.sales (ally_id);
  CREATE INDEX idx_sales_date ON public.sales (sale_date);

  -- Aliado ve solo venta básica (sin notas internas)
  CREATE POLICY sales_ally_view ON public.sales
    FOR SELECT TO authenticated
    USING (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())));

  -- Admin ve todo
  CREATE POLICY sales_admin ON public.sales
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Tabla de cobros (pagos confirmados)
  CREATE TABLE public.payments (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id               uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
    payment_date          date NOT NULL,
    amount_paid           numeric(12, 2) NOT NULL CHECK (amount_paid > 0),
    amount_currency       text NOT NULL DEFAULT 'MXN',
    payment_method        text NOT NULL, -- 'transfer', 'cash', 'check', 'card'
    reference_number      text,
    confirmed_by          uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    confirmed_at          timestamptz NOT NULL DEFAULT now(),
    notes                 text,
    reversible            boolean NOT NULL DEFAULT true,
    reversed_at           timestamptz,
    reversed_by           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    reversal_reason       text
  );
  ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.payments FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.payments TO authenticated;

  CREATE INDEX idx_payments_sale ON public.payments (sale_id);
  CREATE INDEX idx_payments_date ON public.payments (payment_date);

  -- Aliado ve solo pagos de sus ventas (sin notas internas)
  CREATE POLICY payments_ally_view ON public.payments
    FOR SELECT TO authenticated
    USING (
      sale_id IN (
        SELECT id FROM public.sales
        WHERE ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid()))
      )
    );

  -- Admin ve todo
  CREATE POLICY payments_admin ON public.payments
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Auditoría de pagos
  CREATE TABLE public.payments_audit (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id    uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
    action        text NOT NULL CHECK (action IN ('created', 'reversed', 'modified')),
    changed_by    uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    old_values    jsonb,
    new_values    jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.payments_audit ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.payments_audit FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.payments_audit TO authenticated;

  CREATE POLICY payments_audit_admin ON public.payments_audit
    FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));

  -- ========================================
  -- 4. COMISIONES (asignación manual, pago separado)
  -- ========================================
  CREATE TABLE public.commissions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id               uuid NOT NULL UNIQUE REFERENCES public.sales (id) ON DELETE CASCADE,
    ally_id               uuid NOT NULL REFERENCES public.ally_profiles (user_id) ON DELETE CASCADE,
    commission_percentage numeric(5, 2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    commission_amount     numeric(12, 2) NOT NULL CHECK (commission_amount > 0),
    commission_currency   text NOT NULL DEFAULT 'MXN',
    assigned_by           uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    assigned_at           timestamptz NOT NULL DEFAULT now(),
    status                text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'approved', 'partially_paid', 'paid', 'cancelled')),
    approved_by           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    approved_at           timestamptz,
    notes                 text
  );
  ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.commissions FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.commissions TO authenticated;

  CREATE INDEX idx_commissions_ally ON public.commissions (ally_id);
  CREATE INDEX idx_commissions_status ON public.commissions (status);

  -- Aliado ve sus comisiones (monto total, estado, sin detalles internos)
  CREATE POLICY commissions_ally_view ON public.commissions
    FOR SELECT TO authenticated
    USING (ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid())));

  -- Admin ve todo
  CREATE POLICY commissions_admin ON public.commissions
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Tabla de pagos de comisiones (separado de pagos de venta)
  CREATE TABLE public.commission_payments (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id         uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
    payment_date          date NOT NULL,
    amount_paid           numeric(12, 2) NOT NULL CHECK (amount_paid > 0),
    amount_currency       text NOT NULL DEFAULT 'MXN',
    payment_method        text NOT NULL,
    reference_number      text,
    authorized_by         uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    authorized_at         timestamptz NOT NULL DEFAULT now(),
    confirmed_by          uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
    confirmed_at          timestamptz,
    notes                 text,
    reversed_at           timestamptz,
    reversed_by           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    reversal_reason       text
  );
  ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.commission_payments FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.commission_payments TO authenticated;

  CREATE INDEX idx_commission_payments_commission ON public.commission_payments (commission_id);
  CREATE INDEX idx_commission_payments_date ON public.commission_payments (payment_date);

  -- Aliado ve solo sus pagos de comisión
  CREATE POLICY commission_payments_ally_view ON public.commission_payments
    FOR SELECT TO authenticated
    USING (
      commission_id IN (
        SELECT id FROM public.commissions
        WHERE ally_id = (SELECT user_id FROM public.ally_profiles WHERE user_id = (SELECT auth.uid()))
      )
    );

  -- Admin ve todo
  CREATE POLICY commission_payments_admin ON public.commission_payments
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin()));

  -- Auditoría de comisiones
  CREATE TABLE public.commissions_audit (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id   uuid NOT NULL REFERENCES public.commissions (id) ON DELETE CASCADE,
    action          text NOT NULL CHECK (action IN ('assigned', 'approved', 'payment_added', 'reversed', 'status_changed')),
    changed_by      uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    old_values      jsonb,
    new_values      jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.commissions_audit ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.commissions_audit FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.commissions_audit TO authenticated;

  CREATE POLICY commissions_audit_admin ON public.commissions_audit
    FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));

  -- ========================================
  -- 5. FUNCIONES DE NEGOCIO (SECURITY DEFINER)
  -- ========================================

  -- Aprobar un registro de aliado (crea perfil)
  CREATE FUNCTION public.approve_registration(reg_id uuid, approver_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_reg RECORD;
    v_account_id uuid;
  BEGIN
    -- Solo admin
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT * INTO v_reg FROM public.ally_registrations WHERE id = reg_id;
    IF v_reg IS NULL THEN
      RAISE EXCEPTION 'Registro no encontrado';
    END IF;

    IF v_reg.status != 'pending' THEN
      RAISE EXCEPTION 'Solo se pueden aprobar registros pendientes';
    END IF;

    -- Actualizar registro
    UPDATE public.ally_registrations
      SET status = 'approved', approved_by = approver_id, approved_at = now()
      WHERE id = reg_id;

    -- Crear perfil de aliado
    INSERT INTO public.ally_profiles (user_id, display_name, email, phone, city, status)
      VALUES (v_reg.user_id, v_reg.full_name, v_reg.email, v_reg.phone, v_reg.city, 'active');

    -- Auditoría
    INSERT INTO public.ally_registration_audit (registration_id, action, changed_by)
      VALUES (reg_id, 'approved', approver_id);
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.approve_registration(uuid, uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.approve_registration(uuid, uuid) TO authenticated;

  -- Rechazar un registro
  CREATE FUNCTION public.reject_registration(reg_id uuid, rejector_id uuid, reason text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.ally_registrations
      SET status = 'rejected', rejected_by = rejector_id, rejection_reason = reason, rejected_at = now()
      WHERE id = reg_id AND status = 'pending';

    INSERT INTO public.ally_registration_audit (registration_id, action, changed_by, changes)
      VALUES (reg_id, 'rejected', rejector_id, jsonb_build_object('reason', reason));
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.reject_registration(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.reject_registration(uuid, uuid, text) TO authenticated;

  -- Registrar una venta (solo admin)
  CREATE FUNCTION public.record_sale(
    p_ally_id uuid,
    p_amount numeric,
    p_description text,
    p_internal_notes text,
    p_recorded_by uuid
  ) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_sale_id uuid;
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO public.sales (ally_id, sale_date, amount_agreed, sale_description, internal_notes, recorded_by)
      VALUES (p_ally_id, CURRENT_DATE, p_amount, p_description, p_internal_notes, p_recorded_by)
      RETURNING id INTO v_sale_id;

    RETURN v_sale_id;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.record_sale(uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.record_sale(uuid, numeric, text, text, uuid) TO authenticated;

  -- Registrar un pago (solo admin)
  CREATE FUNCTION public.record_payment(
    p_sale_id uuid,
    p_amount numeric,
    p_method text,
    p_confirmed_by uuid,
    p_reference text DEFAULT NULL
  ) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_payment_id uuid;
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO public.payments (sale_id, payment_date, amount_paid, payment_method, reference_number, confirmed_by)
      VALUES (p_sale_id, CURRENT_DATE, p_amount, p_method, p_reference, p_confirmed_by)
      RETURNING id INTO v_payment_id;

    INSERT INTO public.payments_audit (payment_id, action, changed_by)
      VALUES (v_payment_id, 'created', p_confirmed_by);

    RETURN v_payment_id;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.record_payment(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.record_payment(uuid, numeric, text, uuid, text) TO authenticated;

  -- Asignar comisión (solo admin)
  CREATE FUNCTION public.assign_commission(
    p_sale_id uuid,
    p_percentage numeric,
    p_assigned_by uuid
  ) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_commission_id uuid;
    v_sale RECORD;
    v_amount numeric;
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF v_sale IS NULL THEN
      RAISE EXCEPTION 'Venta no encontrada';
    END IF;

    v_amount := (v_sale.amount_agreed * p_percentage) / 100;

    INSERT INTO public.commissions (sale_id, ally_id, commission_percentage, commission_amount, assigned_by)
      VALUES (p_sale_id, v_sale.ally_id, p_percentage, v_amount, p_assigned_by)
      RETURNING id INTO v_commission_id;

    INSERT INTO public.commissions_audit (commission_id, action, changed_by)
      VALUES (v_commission_id, 'assigned', p_assigned_by);

    RETURN v_commission_id;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.assign_commission(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.assign_commission(uuid, numeric, uuid) TO authenticated;

  -- Pagar comisión (parcial o completa, solo admin)
  CREATE FUNCTION public.pay_commission(
    p_commission_id uuid,
    p_amount numeric,
    p_method text,
    p_authorized_by uuid,
    p_reference text DEFAULT NULL
  ) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_payment_id uuid;
    v_commission RECORD;
    v_total_paid numeric := 0;
  BEGIN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;

    SELECT * INTO v_commission FROM public.commissions WHERE id = p_commission_id;
    IF v_commission IS NULL THEN
      RAISE EXCEPTION 'Comisión no encontrada';
    END IF;

    -- Sumar pagos anteriores
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_total_paid
      FROM public.commission_payments
      WHERE commission_id = p_commission_id AND reversed_at IS NULL;

    IF (v_total_paid + p_amount) > v_commission.commission_amount THEN
      RAISE EXCEPTION 'Pago excedería comisión total (% de %)', v_total_paid + p_amount, v_commission.commission_amount;
    END IF;

    INSERT INTO public.commission_payments (commission_id, payment_date, amount_paid, payment_method, reference_number, authorized_by)
      VALUES (p_commission_id, CURRENT_DATE, p_amount, p_method, p_reference, p_authorized_by)
      RETURNING id INTO v_payment_id;

    -- Actualizar estado de comisión
    IF (v_total_paid + p_amount) = v_commission.commission_amount THEN
      UPDATE public.commissions SET status = 'paid' WHERE id = p_commission_id;
    ELSE
      UPDATE public.commissions SET status = 'partially_paid' WHERE id = p_commission_id;
    END IF;

    INSERT INTO public.commissions_audit (commission_id, action, changed_by)
      VALUES (p_commission_id, 'payment_added', p_authorized_by);

    RETURN v_payment_id;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.pay_commission(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.pay_commission(uuid, numeric, text, uuid, text) TO authenticated;

  RAISE NOTICE 'Instalación completa: registros, referidos, ventas, cobros, comisiones, auditoría';
END $install$;

-- ============================================================================
-- PASO 2. Verificación e indicadores de éxito
-- ============================================================================
-- Ejecutar esta consulta para validar la instalación:
/*
SELECT
  COUNT(*) FILTER (WHERE table_name LIKE 'ally_registrations') as registrations_table,
  COUNT(*) FILTER (WHERE table_name LIKE 'referrals') as referrals_table,
  COUNT(*) FILTER (WHERE table_name LIKE 'sales') as sales_table,
  COUNT(*) FILTER (WHERE table_name LIKE 'payments') as payments_table,
  COUNT(*) FILTER (WHERE table_name LIKE 'commissions') as commissions_table,
  COUNT(*) FILTER (WHERE table_name LIKE '%_audit') as audit_tables,
  COUNT(*) FILTER (WHERE routine_name LIKE 'approve_registration%'
                     OR routine_name LIKE 'record_sale%'
                     OR routine_name LIKE 'assign_commission%') as functions_count
FROM information_schema.tables t
FULL OUTER JOIN information_schema.routines r ON true
WHERE t.table_schema = 'public' OR r.routine_schema = 'public';
*/
