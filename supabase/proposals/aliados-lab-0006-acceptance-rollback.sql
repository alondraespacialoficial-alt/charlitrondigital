-- ALIADOS CHARLITRON — Reversion de 0006 (y 0007): retira el bloqueo por aceptacion y las funciones nuevas.
-- Proyecto Supabase EXCLUSIVO de Aliados. NO ejecutar en ningun otro.
--
-- Parte A (se ejecuta): restaura ally_my_* y submit_referral a su definicion de 0002 (sin exigir aceptacion), y retira
--   ally_accept_terms, ally_acceptance_state y las vistas ally_current_acceptance / admin_ally_acceptances.
--   CONSERVA las tablas ally_acceptances y ally_legal_documents: son evidencia y no se borran por defecto.
-- Parte B (comentada): elimina tambien las tablas. Solo si NO hay aceptaciones registradas o si el responsable lo
--   autoriza por escrito. Se rehusa a borrar si existen filas en ally_acceptances.
-- Aviso: al revertir, los aliados activos recuperan acceso sin aceptacion vigente. Revertir solo con autorizacion expresa.

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0006'));
  IF to_regprocedure('public.ally_accept_terms(text, text, boolean, boolean)') IS NULL THEN
    RAISE EXCEPTION '0006 no esta instalada. No se modifico nada.';
  END IF;
  PERFORM public.assert_aliados_lab();
END
$guard$;

CREATE OR REPLACE VIEW public.ally_my_referrals WITH (security_barrier = true) AS
  SELECT r.id, r.referred_name, r.referred_email, r.referred_phone, r.referred_city, r.referred_organization,
         r.data_share_authorized,
         CASE WHEN r.status = 'duplicate' THEN 'closed' ELSE r.status END AS status,
         r.created_at, r.updated_at
  FROM public.referrals r
  WHERE r.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = r.ally_id AND p.status = 'active');

CREATE OR REPLACE VIEW public.ally_my_commissions WITH (security_barrier = true) AS
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

CREATE OR REPLACE VIEW public.ally_my_commission_payments WITH (security_barrier = true) AS
  SELECT cp.id, cp.commission_id, cp.amount_paid, cp.payment_date
  FROM public.commission_payments cp
  JOIN public.commissions c ON c.id = cp.commission_id
  WHERE cp.reversed_at IS NULL
    AND c.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = c.ally_id AND p.status = 'active');

CREATE OR REPLACE FUNCTION public.submit_referral(
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

DROP FUNCTION public.ally_accept_terms(text, text, boolean, boolean);
DROP FUNCTION public.ally_acceptance_state();
DROP VIEW public.admin_ally_acceptances;
DROP VIEW public.ally_current_acceptance;

COMMIT;

-- ============================================================================
-- PARTE B (opcional, destructiva): descomentar SOLO con autorizacion expresa. Borra la evidencia.
-- ============================================================================
-- BEGIN;
-- DO $drop$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM public.ally_acceptances) THEN
--     RAISE EXCEPTION 'Existen aceptaciones registradas: no se eliminan las tablas.';
--   END IF;
-- END
-- $drop$;
-- DROP TABLE public.ally_acceptances;
-- DROP TABLE public.ally_legal_documents;
-- DROP FUNCTION public.aliados_immutable();
-- COMMIT;
