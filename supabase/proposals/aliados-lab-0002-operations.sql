-- ALIADOS CHARLITRON — Migracion incremental 0002 (operaciones) sobre las 4 tablas de 0001.
-- Proyecto Supabase EXCLUSIVO: charlitron-aliados-test. NO ejecutar en ningun otro.
--
-- Requiere 0001 ya instalada. NO toca: auth.users, auth.uid(), public.is_admin(), ally_profiles,
-- account_roles, admin_users, lab_environment, roles de base de datos. No contiene simulaciones.
--
-- Modelo de privacidad: las tablas NO tienen permisos para anon/authenticated. Todo acceso es por
--   * vistas security_barrier (ally_my_* para el aliado, admin_* para administradores) o
--   * funciones SECURITY DEFINER que validan auth.uid() / is_admin().
-- El aliado solo ve vistas ally_my_*, sin montos de venta, cobros, notas internas ni auditoria.
-- Los usuarios Auth NO se crean aqui: los crea el backend (api/aliados-approve-registration.ts) con la
-- Auth Admin API y luego llama admin_finalize_registration.
-- El registro publico queda CERRADO (aliados_settings.registration_open = false) hasta abrirlo a mano.

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0002'));

  IF to_regclass('public.lab_environment') IS NULL
     OR to_regclass('public.ally_profiles') IS NULL
     OR to_regclass('public.account_roles') IS NULL
     OR to_regclass('public.admin_users') IS NULL
     OR to_regprocedure('public.is_admin()') IS NULL
     OR to_regprocedure('public.assert_aliados_lab()') IS NULL THEN
    RAISE EXCEPTION '0001 no esta instalada. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF to_regclass('public.referrals') IS NOT NULL
     OR to_regclass('public.ally_registrations') IS NOT NULL
     OR to_regclass('public.aliados_settings') IS NOT NULL THEN
    RAISE EXCEPTION '0002 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

-- ============================================================================
-- Tablas
-- ============================================================================
CREATE TABLE public.aliados_settings (
  singleton         boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  registration_open boolean NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.aliados_settings DEFAULT VALUES;

CREATE TABLE public.ally_registrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL CHECK (email = lower(btrim(email))
                                        AND char_length(email) BETWEEN 5 AND 254
                                        AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  full_name        text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  phone            text CHECK (phone IS NULL OR char_length(phone) <= 30),
  city             text CHECK (city IS NULL OR char_length(city) <= 80),
  consent_at       timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  rejection_reason text CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500),
  user_id          uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ally_registrations_open_email
  ON public.ally_registrations (email) WHERE status IN ('pending', 'approved');

CREATE TABLE public.referrals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ally_id               uuid NOT NULL REFERENCES public.ally_profiles (user_id) ON DELETE RESTRICT,
  referred_name         text NOT NULL CHECK (char_length(btrim(referred_name)) BETWEEN 2 AND 120),
  referred_email        text CHECK (referred_email IS NULL OR char_length(referred_email) <= 254),
  referred_phone        text CHECK (referred_phone IS NULL OR char_length(referred_phone) <= 30),
  referred_city         text CHECK (referred_city IS NULL OR char_length(referred_city) <= 80),
  referred_organization text CHECK (referred_organization IS NULL OR char_length(referred_organization) <= 120),
  data_share_authorized boolean NOT NULL CHECK (data_share_authorized),
  status                text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'closed', 'duplicate')),
  internal_notes        text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 2000),
  duplicate_key         text NOT NULL,
  duplicate_review      boolean NOT NULL DEFAULT false,
  duplicate_of          uuid REFERENCES public.referrals (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, ally_id),
  UNIQUE (ally_id, duplicate_key),
  CHECK (referred_email IS NOT NULL OR referred_phone IS NOT NULL)
);
CREATE INDEX referrals_duplicate_key ON public.referrals (duplicate_key);

CREATE TABLE public.sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id      uuid NOT NULL,
  ally_id          uuid NOT NULL,
  amount_agreed    numeric(12, 2) NOT NULL CHECK (amount_agreed > 0),
  sale_description text CHECK (sale_description IS NULL OR char_length(sale_description) <= 500),
  internal_notes   text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 2000),
  sale_date        date NOT NULL DEFAULT current_date,
  created_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, ally_id),
  FOREIGN KEY (referral_id, ally_id) REFERENCES public.referrals (id, ally_id) ON DELETE RESTRICT
);

CREATE TABLE public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         uuid NOT NULL REFERENCES public.sales (id) ON DELETE RESTRICT,
  amount_paid     numeric(12, 2) NOT NULL CHECK (amount_paid > 0),
  payment_date    date NOT NULL DEFAULT current_date,
  payment_method  text NOT NULL CHECK (char_length(btrim(payment_method)) BETWEEN 2 AND 40),
  reference_number text CHECK (reference_number IS NULL OR char_length(reference_number) BETWEEN 1 AND 80),
  internal_notes  text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 2000),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 80),
  created_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reversal_reason text CHECK (reversal_reason IS NULL OR char_length(reversal_reason) BETWEEN 3 AND 500),
  CHECK ((reversed_at IS NULL) = (reversal_reason IS NULL)),
  UNIQUE (sale_id, idempotency_key)
);
CREATE UNIQUE INDEX payments_live_reference
  ON public.payments (sale_id, reference_number) WHERE reference_number IS NOT NULL AND reversed_at IS NULL;

CREATE TABLE public.commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           uuid NOT NULL UNIQUE,
  ally_id           uuid NOT NULL,
  commission_amount numeric(12, 2) NOT NULL CHECK (commission_amount > 0),
  status            text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'authorized')),
  assigned_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  authorized_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  authorized_at     timestamptz,
  CHECK ((status = 'authorized') = (authorized_at IS NOT NULL)),
  FOREIGN KEY (sale_id, ally_id) REFERENCES public.sales (id, ally_id) ON DELETE RESTRICT
);

CREATE TABLE public.commission_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id   uuid NOT NULL REFERENCES public.commissions (id) ON DELETE RESTRICT,
  amount_paid     numeric(12, 2) NOT NULL CHECK (amount_paid > 0),
  payment_date    date NOT NULL DEFAULT current_date,
  payment_method  text NOT NULL CHECK (char_length(btrim(payment_method)) BETWEEN 2 AND 40),
  reference_number text CHECK (reference_number IS NULL OR char_length(reference_number) BETWEEN 1 AND 80),
  internal_notes  text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 2000),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 80),
  authorized_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reversal_reason text CHECK (reversal_reason IS NULL OR char_length(reversal_reason) BETWEEN 3 AND 500),
  CHECK ((reversed_at IS NULL) = (reversal_reason IS NULL)),
  UNIQUE (commission_id, idempotency_key)
);
CREATE UNIQUE INDEX commission_payments_live_reference
  ON public.commission_payments (commission_id, reference_number) WHERE reference_number IS NOT NULL AND reversed_at IS NULL;

CREATE TABLE public.aliados_audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      uuid,
  table_name text NOT NULL,
  op         text NOT NULL,
  row_id     text,
  reason     text,
  old_row    jsonb,
  new_row    jsonb
);

-- Sin permisos directos para nadie salvo el propietario: se reafirma por tabla (los default privileges de
-- Supabase otorgan ALL a anon/authenticated a toda tabla nueva en public).
REVOKE ALL ON public.aliados_settings, public.ally_registrations, public.referrals, public.sales,
              public.payments, public.commissions, public.commission_payments, public.aliados_audit_log
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.aliados_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ally_registrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliados_audit_log     ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Triggers: auditoria, contabilidad inmutable
-- ============================================================================
CREATE FUNCTION public.aliados_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
BEGIN
  INSERT INTO public.aliados_audit_log (actor, table_name, op, row_id, reason, old_row, new_row)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, COALESCE(v_new, v_old) ->> 'id',
          NULLIF(current_setting('aliados.reason', true), ''), v_old, v_new);
  RETURN NULL;
END
$fn$;

CREATE FUNCTION public.aliados_audit_append_only()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'La auditoria es de solo anexar.' USING ERRCODE = 'insufficient_privilege';
END
$fn$;

CREATE FUNCTION public.aliados_ledger_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los registros contables no se eliminan: use una reversion.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.reversed_at IS NOT NULL
     OR NEW.reversed_at IS NULL
     OR (to_jsonb(NEW) - 'reversed_at' - 'reversed_by' - 'reversal_reason')
        IS DISTINCT FROM (to_jsonb(OLD) - 'reversed_at' - 'reversed_by' - 'reversal_reason') THEN
    RAISE EXCEPTION 'Los registros contables solo admiten una reversion; no se editan.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE FUNCTION public.aliados_no_delete()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'Este registro no se elimina.' USING ERRCODE = 'insufficient_privilege';
END
$fn$;

CREATE TRIGGER aliados_audit_append_only_row BEFORE UPDATE OR DELETE ON public.aliados_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit_append_only();
CREATE TRIGGER aliados_audit_append_only_truncate BEFORE TRUNCATE ON public.aliados_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.aliados_audit_append_only();

CREATE TRIGGER aliados_ledger_guard BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.aliados_ledger_guard();
CREATE TRIGGER aliados_ledger_guard BEFORE UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.aliados_ledger_guard();
CREATE TRIGGER aliados_no_delete BEFORE DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.aliados_no_delete();
CREATE TRIGGER aliados_no_delete BEFORE DELETE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.aliados_no_delete();

CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.ally_registrations
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();
CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();
CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();
CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();
CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();
CREATE TRIGGER aliados_audit AFTER INSERT OR UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();

-- ============================================================================
-- Ayudantes internos (sin EXECUTE para anon/authenticated; solo los invocan funciones definer)
-- ============================================================================
CREATE FUNCTION public.aliados_assert_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Operacion reservada a administradores.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END
$fn$;

CREATE FUNCTION public.aliados_assert_money(p_amount numeric)
RETURNS void LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) OR p_amount > 9999999999.99 THEN
    RAISE EXCEPTION 'Monto invalido: debe ser positivo y con maximo 2 decimales.' USING ERRCODE = 'check_violation';
  END IF;
END
$fn$;

CREATE FUNCTION public.aliados_net_collected(p_sale_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT COALESCE(sum(amount_paid), 0) FROM public.payments WHERE sale_id = p_sale_id AND reversed_at IS NULL;
$fn$;

CREATE FUNCTION public.aliados_commission_paid(p_commission_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT COALESCE(sum(amount_paid), 0) FROM public.commission_payments
  WHERE commission_id = p_commission_id AND reversed_at IS NULL;
$fn$;

-- Limite de liberacion: comision acordada * (cobros netos / venta acordada), truncado a centavos.
CREATE FUNCTION public.aliados_release_limit(p_commission_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT trunc(c.commission_amount * public.aliados_net_collected(c.sale_id) / s.amount_agreed, 2)
  FROM public.commissions c JOIN public.sales s ON s.id = c.sale_id
  WHERE c.id = p_commission_id;
$fn$;

-- Invariante: comisiones pagadas <= limite por cobros netos. Quien la invoca ya bloqueo la venta.
CREATE FUNCTION public.aliados_assert_commission_invariant(p_sale_id uuid)
RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_c public.commissions;
BEGIN
  SELECT * INTO v_c FROM public.commissions WHERE sale_id = p_sale_id FOR UPDATE;
  IF FOUND AND public.aliados_commission_paid(v_c.id) > public.aliados_release_limit(v_c.id) THEN
    RAISE EXCEPTION 'La operacion dejaria comisiones pagadas por encima de lo permitido por los cobros netos. Primero revierta pagos de comision.'
      USING ERRCODE = 'check_violation';
  END IF;
END
$fn$;

-- ============================================================================
-- Registro publico y aprobacion
-- ============================================================================
CREATE FUNCTION public.submit_ally_registration(
  p_email text, p_full_name text, p_phone text, p_city text, p_consent boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF NOT (SELECT registration_open FROM public.aliados_settings) THEN
    RAISE EXCEPTION 'El registro de aliados aun no esta abierto.';
  END IF;
  IF p_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Debes aceptar el aviso de privacidad y los terminos.' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT count(*) FROM public.ally_registrations WHERE status = 'pending') >= 500 THEN
    RAISE EXCEPTION 'Hay demasiadas solicitudes pendientes. Intenta mas tarde.';
  END IF;
  -- Misma respuesta si el correo ya existe: no revela quien tiene cuenta o solicitud.
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RETURN;
  END IF;
  INSERT INTO public.ally_registrations (email, full_name, phone, city)
  VALUES (v_email, btrim(COALESCE(p_full_name, '')), NULLIF(btrim(COALESCE(p_phone, '')), ''), NULLIF(btrim(COALESCE(p_city, '')), ''))
  ON CONFLICT (email) WHERE status IN ('pending', 'approved') DO NOTHING;
END
$fn$;

CREATE FUNCTION public.admin_registration_for_approval(p_registration_id uuid)
RETURNS TABLE (email text, full_name text, phone text, city text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.aliados_assert_admin();
  RETURN QUERY
    SELECT r.email, r.full_name, r.phone, r.city
    FROM public.ally_registrations r WHERE r.id = p_registration_id AND r.status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya procesada.' USING ERRCODE = 'no_data_found';
  END IF;
END
$fn$;

-- Se invoca DESPUES de que el backend creo el usuario con la Auth Admin API.
CREATE FUNCTION public.admin_finalize_registration(p_registration_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_reg public.ally_registrations;
  v_auth_email text;
BEGIN
  PERFORM public.aliados_assert_admin();
  SELECT * INTO v_reg FROM public.ally_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND OR v_reg.status <> 'pending' THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya procesada.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT email INTO v_auth_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND OR lower(v_auth_email) <> v_reg.email THEN
    RAISE EXCEPTION 'El usuario Auth no coincide con el correo de la solicitud.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_roles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Ese usuario ya tiene un rol asignado.' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.account_roles (user_id, role) VALUES (p_user_id, 'ally');
  INSERT INTO public.ally_profiles (user_id, display_name, phone, city)
  VALUES (p_user_id, v_reg.full_name, v_reg.phone, v_reg.city);
  -- El trigger de 0001 exige un admin identificado y registra aprobacion.
  UPDATE public.ally_profiles SET status = 'active' WHERE user_id = p_user_id;
  UPDATE public.ally_registrations
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), user_id = p_user_id
  WHERE id = p_registration_id;
END
$fn$;

CREATE FUNCTION public.admin_reject_registration(p_registration_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.aliados_assert_admin();
  UPDATE public.ally_registrations
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '')
  WHERE id = p_registration_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya procesada.' USING ERRCODE = 'no_data_found';
  END IF;
END
$fn$;

-- ============================================================================
-- Referidos
-- ============================================================================
CREATE FUNCTION public.submit_referral(
  p_name text, p_email text, p_phone text, p_city text, p_organization text, p_authorized boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_email text := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_key text;
  v_first uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.ally_profiles WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'Tu cuenta de aliado no esta activa.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_authorized IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Necesitas la autorizacion de la persona para compartir sus datos.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Correo del referido invalido.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_email IS NULL AND char_length(v_digits) < 7 THEN
    RAISE EXCEPTION 'Indica un correo o un telefono valido del referido.' USING ERRCODE = 'check_violation';
  END IF;
  v_key := COALESCE(v_email, v_digits);

  PERFORM pg_advisory_xact_lock(hashtext('aliados-referral:' || v_key));
  IF EXISTS (SELECT 1 FROM public.referrals WHERE ally_id = auth.uid() AND duplicate_key = v_key) THEN
    RAISE EXCEPTION 'Ya registraste a este contacto.' USING ERRCODE = 'unique_violation';
  END IF;
  SELECT id INTO v_first FROM public.referrals WHERE duplicate_key = v_key ORDER BY created_at LIMIT 1;

  INSERT INTO public.referrals (ally_id, referred_name, referred_email, referred_phone, referred_city,
                                referred_organization, data_share_authorized, duplicate_key,
                                duplicate_review, duplicate_of)
  VALUES (auth.uid(), btrim(COALESCE(p_name, '')), v_email, v_phone, NULLIF(btrim(COALESCE(p_city, '')), ''),
          NULLIF(btrim(COALESCE(p_organization, '')), ''), true, v_key, v_first IS NOT NULL, v_first)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

CREATE FUNCTION public.admin_set_referral_status(
  p_referral_id uuid, p_status text, p_notes text DEFAULT NULL, p_duplicate_of uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.aliados_assert_admin();
  IF p_status = 'duplicate' AND (p_duplicate_of IS NULL OR p_duplicate_of = p_referral_id) THEN
    RAISE EXCEPTION 'Para marcar un duplicado indica el referido original.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.referrals
  SET status = p_status,
      internal_notes = COALESCE(p_notes, internal_notes),
      duplicate_of = CASE WHEN p_status = 'duplicate' THEN p_duplicate_of ELSE duplicate_of END,
      duplicate_review = false,
      updated_at = now()
  WHERE id = p_referral_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referido no encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
END
$fn$;

-- ============================================================================
-- Ventas y cobros
-- ============================================================================
CREATE FUNCTION public.admin_record_sale(
  p_referral_id uuid, p_amount numeric, p_description text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_ref public.referrals;
  v_id uuid;
BEGIN
  PERFORM public.aliados_assert_admin();
  PERFORM public.aliados_assert_money(p_amount);
  SELECT * INTO v_ref FROM public.referrals WHERE id = p_referral_id FOR SHARE;
  IF NOT FOUND OR v_ref.status = 'duplicate' THEN
    RAISE EXCEPTION 'Referido no encontrado o marcado como duplicado.' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO public.sales (referral_id, ally_id, amount_agreed, sale_description, internal_notes, sale_date, created_by)
  VALUES (p_referral_id, v_ref.ally_id, p_amount, p_description, p_notes, COALESCE(p_sale_date, current_date), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

CREATE FUNCTION public.admin_correct_sale(p_sale_id uuid, p_new_amount numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_sale public.sales;
  v_commission numeric;
BEGIN
  PERFORM public.aliados_assert_admin();
  PERFORM public.aliados_assert_money(p_new_amount);
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indica el motivo de la correccion.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_new_amount < public.aliados_net_collected(p_sale_id) THEN
    RAISE EXCEPTION 'El nuevo monto es menor que lo ya cobrado.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT commission_amount INTO v_commission FROM public.commissions WHERE sale_id = p_sale_id;
  IF v_commission IS NOT NULL AND p_new_amount < v_commission THEN
    RAISE EXCEPTION 'El nuevo monto es menor que la comision acordada.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('aliados.reason', left(btrim(p_reason), 500), true);
  UPDATE public.sales SET amount_agreed = p_new_amount WHERE id = p_sale_id;
  PERFORM public.aliados_assert_commission_invariant(p_sale_id);
END
$fn$;

CREATE FUNCTION public.admin_record_payment(
  p_sale_id uuid, p_amount numeric, p_idempotency_key text, p_method text,
  p_reference text DEFAULT NULL, p_notes text DEFAULT NULL, p_payment_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_sale public.sales;
  v_existing uuid;
  v_id uuid;
BEGIN
  PERFORM public.aliados_assert_admin();
  PERFORM public.aliados_assert_money(p_amount);
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT id INTO v_existing FROM public.payments WHERE sale_id = p_sale_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;
  IF public.aliados_net_collected(p_sale_id) + p_amount > v_sale.amount_agreed THEN
    RAISE EXCEPTION 'El cobro excede el saldo pendiente de la venta.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.payments (sale_id, amount_paid, payment_date, payment_method, reference_number,
                               internal_notes, idempotency_key, created_by)
  VALUES (p_sale_id, p_amount, COALESCE(p_payment_date, current_date), btrim(COALESCE(p_method, '')),
          NULLIF(btrim(COALESCE(p_reference, '')), ''), p_notes, p_idempotency_key, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

CREATE FUNCTION public.admin_reverse_payment(p_payment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_sale uuid;
  v_p public.payments;
BEGIN
  PERFORM public.aliados_assert_admin();
  SELECT sale_id INTO v_sale FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobro no encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM 1 FROM public.sales WHERE id = v_sale FOR UPDATE;
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_p.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ese cobro ya fue revertido.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.payments
  SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(COALESCE(p_reason, ''))
  WHERE id = p_payment_id;
  PERFORM public.aliados_assert_commission_invariant(v_sale);
END
$fn$;

-- ============================================================================
-- Comisiones (manuales: asignar, autorizar y pagar son pasos separados)
-- ============================================================================
CREATE FUNCTION public.admin_assign_commission(p_sale_id uuid, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_sale public.sales;
  v_id uuid;
BEGIN
  PERFORM public.aliados_assert_admin();
  PERFORM public.aliados_assert_money(p_amount);
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_amount > v_sale.amount_agreed THEN
    RAISE EXCEPTION 'La comision no puede superar la venta acordada.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.commissions (sale_id, ally_id, commission_amount, assigned_by)
  VALUES (p_sale_id, v_sale.ally_id, p_amount, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Esta venta ya tiene una comision asignada.' USING ERRCODE = 'unique_violation';
END
$fn$;

CREATE FUNCTION public.admin_authorize_commission(p_commission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.aliados_assert_admin();
  UPDATE public.commissions
  SET status = 'authorized', authorized_by = auth.uid(), authorized_at = now()
  WHERE id = p_commission_id AND status = 'assigned';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comision no encontrada o ya autorizada.' USING ERRCODE = 'no_data_found';
  END IF;
END
$fn$;

CREATE FUNCTION public.admin_pay_commission(
  p_commission_id uuid, p_amount numeric, p_idempotency_key text, p_method text,
  p_reference text DEFAULT NULL, p_notes text DEFAULT NULL, p_payment_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_sale uuid;
  v_s public.sales;
  v_c public.commissions;
  v_existing uuid;
  v_limit numeric;
  v_id uuid;
BEGIN
  PERFORM public.aliados_assert_admin();
  PERFORM public.aliados_assert_money(p_amount);
  SELECT sale_id INTO v_sale FROM public.commissions WHERE id = p_commission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comision no encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  -- Orden de bloqueo fijo (venta, luego comision) en todas las funciones: sin interbloqueos.
  SELECT * INTO v_s FROM public.sales WHERE id = v_sale FOR UPDATE;
  SELECT * INTO v_c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;

  SELECT id INTO v_existing FROM public.commission_payments
  WHERE commission_id = p_commission_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF v_c.status <> 'authorized' THEN
    RAISE EXCEPTION 'La comision aun no esta autorizada.' USING ERRCODE = 'check_violation';
  END IF;
  v_limit := LEAST(v_c.commission_amount, public.aliados_release_limit(p_commission_id));
  IF public.aliados_commission_paid(p_commission_id) + p_amount > v_limit THEN
    RAISE EXCEPTION 'El pago excede lo liberable (% de la comision acordada, proporcional a cobros netos).', v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.commission_payments (commission_id, amount_paid, payment_date, payment_method,
                                          reference_number, internal_notes, idempotency_key, authorized_by)
  VALUES (p_commission_id, p_amount, COALESCE(p_payment_date, current_date), btrim(COALESCE(p_method, '')),
          NULLIF(btrim(COALESCE(p_reference, '')), ''), p_notes, p_idempotency_key, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

CREATE FUNCTION public.admin_reverse_commission_payment(p_payment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_commission uuid;
  v_sale uuid;
  v_p public.commission_payments;
BEGIN
  PERFORM public.aliados_assert_admin();
  SELECT commission_id INTO v_commission FROM public.commission_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago de comision no encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT sale_id INTO v_sale FROM public.commissions WHERE id = v_commission;
  PERFORM 1 FROM public.sales WHERE id = v_sale FOR UPDATE;
  PERFORM 1 FROM public.commissions WHERE id = v_commission FOR UPDATE;
  SELECT * INTO v_p FROM public.commission_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_p.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ese pago ya fue revertido.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.commission_payments
  SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(COALESCE(p_reason, ''))
  WHERE id = p_payment_id;
END
$fn$;

-- ============================================================================
-- Vistas. Administrador: admin_*. Aliado: ally_my_* (sin montos de venta, cobros, notas ni auditoria).
-- security_barrier evita que predicados del usuario se evaluen antes del filtro de acceso.
-- ============================================================================
CREATE VIEW public.admin_registrations WITH (security_barrier = true) AS
  SELECT r.* FROM public.ally_registrations r WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_allies WITH (security_barrier = true) AS
  SELECT p.user_id, p.display_name, p.phone, p.city, p.status, p.approved_at, p.created_at, u.email
  FROM public.ally_profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_referrals WITH (security_barrier = true) AS
  SELECT r.* FROM public.referrals r WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_sales WITH (security_barrier = true) AS
  SELECT s.* FROM public.sales s WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_payments WITH (security_barrier = true) AS
  SELECT p.* FROM public.payments p WHERE (SELECT public.is_admin());

-- Las vistas no llaman a los ayudantes aliados_*: PostgreSQL comprueba EXECUTE contra quien consulta,
-- y esos ayudantes no deben ser ejecutables por authenticated. La formula replica aliados_release_limit.
CREATE VIEW public.admin_commissions WITH (security_barrier = true) AS
  SELECT c.*,
         COALESCE(pay.net, 0) AS net_collected,
         trunc(c.commission_amount * COALESCE(pay.net, 0) / s.amount_agreed, 2) AS release_limit,
         COALESCE(cp.paid, 0) AS paid_total
  FROM public.commissions c
  JOIN public.sales s ON s.id = c.sale_id
  LEFT JOIN LATERAL (SELECT sum(p.amount_paid) AS net FROM public.payments p
                     WHERE p.sale_id = c.sale_id AND p.reversed_at IS NULL) pay ON true
  LEFT JOIN LATERAL (SELECT sum(x.amount_paid) AS paid FROM public.commission_payments x
                     WHERE x.commission_id = c.id AND x.reversed_at IS NULL) cp ON true
  WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_commission_payments WITH (security_barrier = true) AS
  SELECT p.* FROM public.commission_payments p WHERE (SELECT public.is_admin());

CREATE VIEW public.admin_audit_log WITH (security_barrier = true) AS
  SELECT a.* FROM public.aliados_audit_log a WHERE (SELECT public.is_admin());

-- 'duplicate' se muestra como 'closed' para no revelar que otro aliado registro al mismo contacto.
CREATE VIEW public.ally_my_referrals WITH (security_barrier = true) AS
  SELECT r.id, r.referred_name, r.referred_email, r.referred_phone, r.referred_city, r.referred_organization,
         r.data_share_authorized,
         CASE WHEN r.status = 'duplicate' THEN 'closed' ELSE r.status END AS status,
         r.created_at, r.updated_at
  FROM public.referrals r
  WHERE r.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = r.ally_id AND p.status = 'active');

CREATE VIEW public.ally_my_commissions WITH (security_barrier = true) AS
  SELECT c.id, s.referral_id, r.referred_name, c.commission_amount, c.status,
         COALESCE(cp.paid, 0) AS paid_total,
         c.commission_amount - COALESCE(cp.paid, 0) AS balance,
         c.assigned_at
  FROM public.commissions c
  JOIN public.sales s ON s.id = c.sale_id
  JOIN public.referrals r ON r.id = s.referral_id
  LEFT JOIN LATERAL (SELECT sum(x.amount_paid) AS paid FROM public.commission_payments x
                     WHERE x.commission_id = c.id AND x.reversed_at IS NULL) cp ON true
  WHERE c.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = c.ally_id AND p.status = 'active');

CREATE VIEW public.ally_my_commission_payments WITH (security_barrier = true) AS
  SELECT cp.id, cp.commission_id, cp.amount_paid, cp.payment_date
  FROM public.commission_payments cp
  JOIN public.commissions c ON c.id = cp.commission_id
  WHERE cp.reversed_at IS NULL
    AND c.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = c.ally_id AND p.status = 'active');

-- ============================================================================
-- Permisos de ejecucion y lectura (lista cerrada)
-- ============================================================================
DO $grants$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;

  FOR r IN SELECT c.oid::regclass AS rel
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'v' LOOP
    EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated', r.rel);
    EXECUTE format('GRANT SELECT ON %s TO authenticated', r.rel);
  END LOOP;
END
$grants$;

GRANT EXECUTE ON FUNCTION public.submit_ally_registration(text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_referral(text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_registration_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_registration(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_registration(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_status(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_sale(uuid, numeric, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_correct_sale(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_payment(uuid, numeric, text, text, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reverse_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_commission(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_authorize_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pay_commission(uuid, numeric, text, text, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reverse_commission_payment(uuid, text) TO authenticated;

COMMIT;

-- ============================================================================
-- Verificacion de catalogo posterior a la instalacion (solo lectura)
-- ============================================================================
WITH new_tables AS (
  SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('aliados_settings', 'ally_registrations', 'referrals', 'sales', 'payments',
                      'commissions', 'commission_payments', 'aliados_audit_log')
), checks (orden, verificacion, ok) AS (
  SELECT 1, 'Las 8 tablas nuevas existen con RLS activo',
         (SELECT count(*) FROM new_tables) = 8
         AND NOT EXISTS (SELECT 1 FROM new_tables t JOIN pg_class c ON c.oid = t.oid WHERE NOT c.relrowsecurity)
  UNION ALL
  SELECT 2, 'anon/authenticated sin ningun permiso sobre las tablas nuevas',
         NOT EXISTS (SELECT 1 FROM new_tables t
                     WHERE has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                        OR has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                        OR has_any_column_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
                        OR has_any_column_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
  UNION ALL
  SELECT 3, 'anon solo puede ejecutar submit_ally_registration',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
            AND p.proname ~ '^(admin_|aliados_|submit_|ally_|is_admin|assert_)')
         = ARRAY['submit_ally_registration']
  UNION ALL
  SELECT 4, 'Las vistas no son legibles por anon',
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relkind = 'v' AND has_table_privilege('anon', c.oid, 'SELECT'))
  UNION ALL
  SELECT 5, 'Registro publico cerrado',
         (SELECT NOT registration_open FROM public.aliados_settings)
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;
