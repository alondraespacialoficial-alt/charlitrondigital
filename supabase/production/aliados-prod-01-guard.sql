-- ALIADOS CHARLITRON — PRODUCTION, paso 1: marcador de Production y guarda de instalacion.
-- Sustituye, SOLO en Production, la guarda assert_aliados_lab() del laboratorio por assert_aliados_production().
-- NO toca datos ni el esquema de 0001-0005. Crea tres objetos nuevos y nada mas:
--   * public.aliados_production_marker   (una fila: Reference ID confirmado por dos personas)
--   * public.assert_aliados_production() (guarda que usan 0006, 0007 y la reversion de Production)
--   * public.aliados_production_snapshot() (cantidades y huellas de los datos, para comparar antes y despues)
--
-- ANTES DE EJECUTAR (docs/aliados-production-runbook.md, paso 1):
--   1. Dashboard > Project Settings > General: copia el Reference ID del proyecto de Aliados de Production.
--   2. Debe coincidir con el host de ALIADOS_SUPABASE_URL en Vercel (Production) y NO ser rvvqhpbtqgjpzflopflv
--      (editorial) ni el Reference ID de charlitron-aliados-test.
--   3. Una segunda persona lo confirma. Reemplaza los dos marcadores 'REEMPLAZAR_...' de abajo.
-- La base no conoce su Reference ID: el ritual humano sigue siendo la identificacion; esta guarda lo deja
-- registrado y rechaza proyectos que se parezcan al editorial o al laboratorio.

BEGIN;

DO $install$
DECLARE
  v_ref          constant text := 'REEMPLAZAR_REFERENCE_ID_PRODUCTION';
  v_confirmed_by constant text := 'REEMPLAZAR_NOMBRE_SEGUNDA_PERSONA';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-prod-0001'));

  IF v_ref !~ '^[a-z]{20}$' OR v_ref = 'rvvqhpbtqgjpzflopflv' THEN
    RAISE EXCEPTION 'Reference ID invalido, sin reemplazar o es el proyecto editorial. No se modifico nada.';
  END IF;
  IF v_confirmed_by !~ '^[^_]{3,80}$' OR v_confirmed_by LIKE 'REEMPLAZAR%' THEN
    RAISE EXCEPTION 'Falta el nombre de la segunda persona que confirmo el proyecto. No se modifico nada.';
  END IF;

  IF to_regclass('public.aliados_production_marker') IS NOT NULL THEN
    RAISE EXCEPTION 'El marcador de Production ya existe. No se modifico nada.';
  END IF;
  IF to_regclass('public.articles') IS NOT NULL OR to_regclass('public.categories') IS NOT NULL
     OR to_regclass('public.content_ideas') IS NOT NULL OR to_regclass('public.page_views') IS NOT NULL THEN
    RAISE EXCEPTION 'Esta base tiene tablas del sitio editorial: NO es el proyecto de Aliados. No se modifico nada.';
  END IF;
  IF to_regclass('public.lab_environment') IS NOT NULL OR to_regprocedure('public.assert_aliados_lab()') IS NOT NULL THEN
    RAISE EXCEPTION 'Esta base conserva el marcador del laboratorio (charlitron-aliados-test): NO es Production. No se modifico nada.';
  END IF;
  IF to_regclass('public.ally_profiles') IS NULL OR to_regclass('public.referrals') IS NULL
     OR to_regprocedure('public.admin_invite_ally(text, text, text, text)') IS NULL
     OR to_regprocedure('public.aliados_registration_open()') IS NULL THEN
    RAISE EXCEPTION '0001 a 0005 no estan instaladas en esta base. No se modifico nada.';
  END IF;
  IF to_regclass('public.ally_acceptances') IS NOT NULL OR to_regclass('public.ally_legal_documents') IS NOT NULL THEN
    RAISE EXCEPTION '0006 ya esta instalada en esta base. No se modifico nada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.aliados_settings WHERE registration_open = false)
     OR EXISTS (SELECT 1 FROM public.aliados_settings WHERE registration_open) THEN
    RAISE EXCEPTION 'El registro publico no esta cerrado. No se modifico nada.';
  END IF;

  CREATE TABLE public.aliados_production_marker (
    singleton    boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    environment  text NOT NULL CHECK (environment = 'charlitron-aliados-production'),
    project_ref  text NOT NULL CHECK (project_ref ~ '^[a-z]{20}$' AND project_ref != 'rvvqhpbtqgjpzflopflv'),
    confirmed_by text NOT NULL CHECK (char_length(btrim(confirmed_by)) >= 3),
    pre_snapshot jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.aliados_production_marker ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.aliados_production_marker FROM PUBLIC, anon, authenticated;

  CREATE FUNCTION public.aliados_production_snapshot()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path = public
  AS $fn$
    SELECT jsonb_build_object(
      'auth_users', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(u.id::text, ',' ORDER BY u.id::text), ''))) FROM auth.users u),
      'account_roles', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.account_roles t),
      'ally_profiles', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE t.status = 'active'), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.ally_profiles t),
      'ally_registrations', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.ally_registrations t),
      'referrals', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.referrals t),
      'sales', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.sales t),
      'payments', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.payments t),
      'commissions', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.commissions t),
      'commission_payments', (SELECT jsonb_build_object('count', count(*), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.commission_payments t),
      'aliados_settings', (SELECT jsonb_build_object('count', count(*), 'registration_open', bool_or(t.registration_open), 'hash', md5(COALESCE(string_agg(t::text, '|' ORDER BY t::text), ''))) FROM public.aliados_settings t),
      'aliados_audit_log_count', (SELECT count(*) FROM public.aliados_audit_log)
    )
  $fn$;
  REVOKE ALL ON FUNCTION public.aliados_production_snapshot() FROM PUBLIC, anon, authenticated;

  CREATE FUNCTION public.assert_aliados_production()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path = public
  AS $fn$
  BEGIN
    IF to_regclass('public.aliados_production_marker') IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.aliados_production_marker
                       WHERE environment = 'charlitron-aliados-production'
                         AND project_ref ~ '^[a-z]{20}$' AND project_ref != 'rvvqhpbtqgjpzflopflv')
       OR to_regclass('public.lab_environment') IS NOT NULL
       OR to_regclass('public.articles') IS NOT NULL
       OR to_regclass('public.categories') IS NOT NULL
       OR to_regclass('public.ally_profiles') IS NULL THEN
      RAISE EXCEPTION 'Esta base no esta marcada como Aliados Production (o parece el laboratorio o el editorial). Script abortado.';
    END IF;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.assert_aliados_production() FROM PUBLIC, anon, authenticated;

  INSERT INTO public.aliados_production_marker (environment, project_ref, confirmed_by, pre_snapshot)
  VALUES ('charlitron-aliados-production', v_ref, v_confirmed_by, public.aliados_production_snapshot());
END
$install$;

COMMIT;

-- Evidencia "antes": guardar este resultado junto con la salida del paso 0.
SELECT project_ref, confirmed_by, created_at, jsonb_pretty(pre_snapshot) AS snapshot_antes
FROM public.aliados_production_marker;

-- Reversion de este paso (solo si 0006 NO esta instalada y se aborta todo el despliegue):
--   DROP FUNCTION public.assert_aliados_production();
--   DROP FUNCTION public.aliados_production_snapshot();
--   DROP TABLE public.aliados_production_marker;
