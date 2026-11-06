-- ALIADOS CHARLITRON — Migracion incremental 0006: aceptacion electronica verificable y bloqueo de acceso.
-- Proyecto Supabase EXCLUSIVO de Aliados (independiente del editorial). NO ejecutar en ningun otro.
--
-- Requiere 0001 a 0005 YA instaladas. NO modifica Auth, roles, ventas, cobros, comisiones, porcentajes ni
-- aliados_settings (registration_open no se toca: el registro publico sigue cerrado).
--
-- Que agrega:
--   * ally_legal_documents: versiones de los documentos legales (inmutable; huella SHA-256 del texto). Las versiones
--     concretas las publica 0007 (generada desde src/features/aliados/aliadosLegal.ts).
--   * ally_acceptances: evidencia de aceptacion (inmutable, solo anexar, auditada). Fecha y hora las fija el servidor.
--   * ally_accept_terms(...): UNICA via de escritura. Usa auth.uid(); el navegador no envia identidad, fecha ni origen.
--   * ally_acceptance_state(): estado de aceptacion del usuario autenticado y versiones vigentes (para la pantalla).
--   * ally_current_acceptance: vista con la aceptacion vigente del usuario autenticado.
--   * admin_ally_acceptances: vista de auditoria para administradores.
-- Bloqueo en la base: un aliado SIN aceptacion vigente no puede usar submit_referral ni leer ally_my_referrals,
--   ally_my_commissions ni ally_my_commission_payments (se redefinen con CREATE OR REPLACE; mismas columnas y permisos).
--   Los administradores no se ven afectados (sus funciones admin_* no cambian).
-- Vigencia: la aceptacion sigue vigente mientras sus versiones sean iguales o posteriores a la ultima version publicada
--   con requires_reacceptance = true (cambio sustancial). Un cambio no sustancial no pide nueva aceptacion.
-- Esta migracion NO registra aceptaciones: ni al invitar, ni al aprobar, ni al crear la contrasena.
-- Reversion: aliados-lab-0006-acceptance-rollback.sql (conserva las tablas con la evidencia).

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0006'));

  IF to_regprocedure('public.admin_invite_ally(text, text, text, text)') IS NULL
     OR to_regprocedure('public.submit_referral(text, text, text, text, text, boolean)') IS NULL
     OR to_regclass('public.ally_my_referrals') IS NULL THEN
    RAISE EXCEPTION '0001 a 0005 deben estar instaladas. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF to_regclass('public.ally_acceptances') IS NOT NULL
     OR to_regclass('public.ally_legal_documents') IS NOT NULL
     OR to_regprocedure('public.ally_accept_terms(text, text, boolean, boolean)') IS NOT NULL THEN
    RAISE EXCEPTION '0006 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

-- ============================================================================
-- Versiones documentales (inmutables)
-- ============================================================================
CREATE TABLE public.ally_legal_documents (
  ordinal              bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  doc_type             text NOT NULL CHECK (doc_type IN ('terms', 'privacy')),
  version              text NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  effective_date       date NOT NULL,
  title                text NOT NULL CHECK (char_length(btrim(title)) > 0),
  content              text NOT NULL CHECK (char_length(content) > 0),
  content_sha256       text NOT NULL CHECK (content_sha256 = encode(sha256(convert_to(content, 'UTF8')), 'hex')),
  requires_reacceptance boolean NOT NULL DEFAULT true,
  published_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, version)
);

-- ============================================================================
-- Evidencia de aceptacion (inmutable)
-- ============================================================================
CREATE TABLE public.ally_acceptances (
  id                                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                            uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  terms_doc_type                     text NOT NULL DEFAULT 'terms' CHECK (terms_doc_type = 'terms'),
  terms_version                      text NOT NULL,
  terms_sha256                       text NOT NULL,
  privacy_doc_type                   text NOT NULL DEFAULT 'privacy' CHECK (privacy_doc_type = 'privacy'),
  privacy_version                    text NOT NULL,
  privacy_sha256                     text NOT NULL,
  -- Casilla 1: acepta los terminos. Casilla 2: confirma que el aviso estuvo a su disposicion. La casilla 2 NO es
  -- consentimiento expreso para datos fiscales, bancarios u otros tratamientos que lo requieran.
  terms_accepted                     boolean NOT NULL CHECK (terms_accepted),
  privacy_notice_available_confirmed boolean NOT NULL CHECK (privacy_notice_available_confirmed),
  action                             text NOT NULL CHECK (action = 'checkbox_accept_and_enter'),
  source                             text NOT NULL CHECK (source = 'aliados_web_acceptance_screen'),
  accepted_at                        timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Cadena completa de x-forwarded-for tal como llego (sin verificar: el cliente puede anteponer valores).
  forwarded_for                      text CHECK (forwarded_for IS NULL OR char_length(forwarded_for) <= 200),
  user_agent                         text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  FOREIGN KEY (terms_doc_type, terms_version) REFERENCES public.ally_legal_documents (doc_type, version),
  FOREIGN KEY (privacy_doc_type, privacy_version) REFERENCES public.ally_legal_documents (doc_type, version)
);
CREATE INDEX ally_acceptances_user ON public.ally_acceptances (user_id, accepted_at DESC);

REVOKE ALL ON public.ally_legal_documents, public.ally_acceptances FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ally_legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ally_acceptances     ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.aliados_immutable()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'Este registro es evidencia documental: no se modifica ni se elimina.' USING ERRCODE = 'insufficient_privilege';
END
$fn$;
REVOKE ALL ON FUNCTION public.aliados_immutable() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER aliados_immutable_row BEFORE UPDATE OR DELETE ON public.ally_legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.aliados_immutable();
CREATE TRIGGER aliados_immutable_truncate BEFORE TRUNCATE ON public.ally_legal_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.aliados_immutable();
CREATE TRIGGER aliados_immutable_row BEFORE UPDATE OR DELETE ON public.ally_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.aliados_immutable();
CREATE TRIGGER aliados_immutable_truncate BEFORE TRUNCATE ON public.ally_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION public.aliados_immutable();

CREATE TRIGGER aliados_audit AFTER INSERT ON public.ally_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.aliados_audit();

-- ============================================================================
-- Aceptacion vigente del usuario autenticado (vista security_barrier; las demas vistas y funciones la leen con permisos del propietario)
-- ============================================================================
-- Vigente = existe una aceptacion propia cuyas versiones (terminos y aviso) son iguales o posteriores a la ultima
-- version publicada con requires_reacceptance. Sin ninguna version publicada o sin sesion: nada es vigente.
CREATE VIEW public.ally_current_acceptance WITH (security_barrier = true) AS
  SELECT a.id, a.terms_version, a.privacy_version, a.accepted_at
  FROM public.ally_acceptances a
  JOIN public.ally_legal_documents t ON t.doc_type = 'terms' AND t.version = a.terms_version
  JOIN public.ally_legal_documents p ON p.doc_type = 'privacy' AND p.version = a.privacy_version
  WHERE a.user_id = (SELECT auth.uid())
    AND t.ordinal >= (SELECT max(d.ordinal) FROM public.ally_legal_documents d
                      WHERE d.doc_type = 'terms' AND d.requires_reacceptance)
    AND p.ordinal >= (SELECT max(d.ordinal) FROM public.ally_legal_documents d
                      WHERE d.doc_type = 'privacy' AND d.requires_reacceptance);

CREATE VIEW public.admin_ally_acceptances WITH (security_barrier = true) AS
  SELECT a.id, a.user_id, u.email, a.terms_version, a.terms_sha256, a.privacy_version, a.privacy_sha256,
         a.terms_accepted, a.privacy_notice_available_confirmed, a.action, a.source, a.accepted_at,
         a.forwarded_for, a.user_agent
  FROM public.ally_acceptances a JOIN auth.users u ON u.id = a.user_id
  WHERE (SELECT public.is_admin());

REVOKE ALL ON public.ally_current_acceptance, public.admin_ally_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ally_current_acceptance, public.admin_ally_acceptances TO authenticated;

-- ============================================================================
-- Estado y registro de la aceptacion
-- ============================================================================
CREATE FUNCTION public.ally_acceptance_state()
RETURNS TABLE (accepted boolean, current_terms_version text, current_privacy_version text, accepted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT EXISTS (SELECT 1 FROM public.ally_current_acceptance),
           (SELECT d.version FROM public.ally_legal_documents d WHERE d.doc_type = 'terms' ORDER BY d.ordinal DESC LIMIT 1),
           (SELECT d.version FROM public.ally_legal_documents d WHERE d.doc_type = 'privacy' ORDER BY d.ordinal DESC LIMIT 1),
           (SELECT max(c.accepted_at) FROM public.ally_current_acceptance c);
END
$fn$;

-- Unica via de escritura. La identidad sale de auth.uid(); versiones, huellas, fecha, accion y origen las fija el
-- servidor. Solo aliados activos pueden aceptar; las versiones enviadas deben ser las vigentes.
CREATE FUNCTION public.ally_accept_terms(
  p_terms_version text, p_privacy_version text, p_terms_accepted boolean, p_privacy_confirmed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_terms public.ally_legal_documents;
  v_privacy public.ally_legal_documents;
  v_headers json;
  v_fwd text;
  v_ua text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.ally_profiles WHERE user_id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'Tu cuenta de aliado no esta activa.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_terms_accepted IS DISTINCT FROM true OR p_privacy_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Debes marcar ambas casillas para continuar.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_terms FROM public.ally_legal_documents WHERE doc_type = 'terms' ORDER BY ordinal DESC LIMIT 1;
  SELECT * INTO v_privacy FROM public.ally_legal_documents WHERE doc_type = 'privacy' ORDER BY ordinal DESC LIMIT 1;
  IF v_terms.version IS NULL OR v_privacy.version IS NULL THEN
    RAISE EXCEPTION 'No hay documentos legales publicados.' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_terms_version IS DISTINCT FROM v_terms.version OR p_privacy_version IS DISTINCT FROM v_privacy.version THEN
    RAISE EXCEPTION 'Las versiones mostradas ya no son las vigentes. Recarga la pagina.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('aliados-acceptance:' || v_uid::text));
  -- Repetir con las mismas versiones no duplica evidencia.
  SELECT a.id INTO v_id FROM public.ally_acceptances a
  WHERE a.user_id = v_uid AND a.terms_version = v_terms.version AND a.privacy_version = v_privacy.version
  ORDER BY a.accepted_at LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Evidencia tecnica que observa el servidor (cabeceras de PostgREST). Es mejor esfuerzo y NO verificada: el cliente
  -- puede enviar sus propias cabeceras, asi que no prueba identidad ni ubicacion.
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  v_fwd := NULLIF(btrim(COALESCE(v_headers ->> 'x-forwarded-for', '')), '');
  v_ua := NULLIF(btrim(COALESCE(v_headers ->> 'user-agent', '')), '');

  INSERT INTO public.ally_acceptances (
    user_id, terms_version, terms_sha256, privacy_version, privacy_sha256,
    terms_accepted, privacy_notice_available_confirmed, action, source, forwarded_for, user_agent)
  VALUES (
    v_uid, v_terms.version, v_terms.content_sha256, v_privacy.version, v_privacy.content_sha256,
    true, true, 'checkbox_accept_and_enter', 'aliados_web_acceptance_screen', left(v_fwd, 200), left(v_ua, 300))
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

REVOKE ALL ON FUNCTION public.ally_acceptance_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ally_accept_terms(text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ally_acceptance_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ally_accept_terms(text, text, boolean, boolean) TO authenticated;

-- ============================================================================
-- Bloqueo: sin aceptacion vigente no hay operacion comercial del aliado
-- ============================================================================
-- Misma definicion que 0002 (mismas columnas, orden y permisos) mas la condicion de aceptacion vigente.
CREATE OR REPLACE VIEW public.ally_my_referrals WITH (security_barrier = true) AS
  SELECT r.id, r.referred_name, r.referred_email, r.referred_phone, r.referred_city, r.referred_organization,
         r.data_share_authorized,
         CASE WHEN r.status = 'duplicate' THEN 'closed' ELSE r.status END AS status,
         r.created_at, r.updated_at
  FROM public.referrals r
  WHERE r.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = r.ally_id AND p.status = 'active')
    AND EXISTS (SELECT 1 FROM public.ally_current_acceptance);

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
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = c.ally_id AND p.status = 'active')
    AND EXISTS (SELECT 1 FROM public.ally_current_acceptance);

CREATE OR REPLACE VIEW public.ally_my_commission_payments WITH (security_barrier = true) AS
  SELECT cp.id, cp.commission_id, cp.amount_paid, cp.payment_date
  FROM public.commission_payments cp
  JOIN public.commissions c ON c.id = cp.commission_id
  WHERE cp.reversed_at IS NULL
    AND c.ally_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.ally_profiles p WHERE p.user_id = c.ally_id AND p.status = 'active')
    AND EXISTS (SELECT 1 FROM public.ally_current_acceptance);

-- Misma funcion que 0002 con una comprobacion adicional (CREATE OR REPLACE conserva sus permisos).
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
  IF NOT EXISTS (SELECT 1 FROM public.ally_current_acceptance) THEN
    RAISE EXCEPTION 'Debes aceptar los terminos vigentes antes de registrar recomendaciones.' USING ERRCODE = 'insufficient_privilege';
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

COMMIT;

-- Verificacion de catalogo posterior a la instalacion (solo lectura)
WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'ally_legal_documents y ally_acceptances existen con RLS activo y sin permisos para anon/authenticated',
         (SELECT count(*) FROM pg_class c WHERE c.oid IN ('public.ally_legal_documents'::regclass, 'public.ally_acceptances'::regclass)
                AND c.relrowsecurity) = 2
         AND NOT has_table_privilege('authenticated', 'public.ally_acceptances', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
         AND NOT has_table_privilege('anon', 'public.ally_acceptances', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
         AND NOT has_table_privilege('authenticated', 'public.ally_legal_documents', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
         AND NOT has_table_privilege('anon', 'public.ally_legal_documents', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  UNION ALL
  SELECT 2, 'authenticated ejecuta ally_accept_terms y ally_acceptance_state; anon no',
         has_function_privilege('authenticated', 'public.ally_accept_terms(text, text, boolean, boolean)', 'EXECUTE')
         AND has_function_privilege('authenticated', 'public.ally_acceptance_state()', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.ally_accept_terms(text, text, boolean, boolean)', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.ally_acceptance_state()', 'EXECUTE')
  UNION ALL
  SELECT 3, 'anon sigue ejecutando solo las dos funciones publicas de registro',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_|ally_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
  UNION ALL
  SELECT 4, 'el registro publico sigue cerrado (registration_open = false)',
         EXISTS (SELECT 1 FROM public.aliados_settings WHERE registration_open = false)
  UNION ALL
  SELECT 5, 'las vistas ally_my_* exigen aceptacion vigente',
         (SELECT count(*) FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'ally\_my\_%'
                AND definition LIKE '%ally_current_acceptance%') = 3
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
UNION ALL
SELECT 100, 'SIGUIENTE', 'Instala 0007 para publicar las versiones de los documentos; hasta entonces ningun aliado tiene aceptacion vigente.'
ORDER BY orden;
