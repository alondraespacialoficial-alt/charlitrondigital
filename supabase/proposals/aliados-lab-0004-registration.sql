-- ALIADOS CHARLITRON — Migracion incremental 0004: registro publico con limites anti-abuso.
-- Proyecto Supabase EXCLUSIVO de Aliados (independiente del editorial). NO ejecutar en ningun otro.
--
-- Requiere 0001, 0002 y 0003 YA instaladas. NO modifica 0001/0002/0003, Auth, roles, ventas, cobros ni comisiones.
-- Efectos:
--   * submit_ally_registration (misma firma): agrega validacion de WhatsApp, enfriamiento tras un rechazo
--     y limites de solicitudes (por hora, por dia y pendientes). Sigue cerrada mientras registration_open = false.
--   * aliados_registration_open(): permite a la pagina publica saber si el registro esta abierto (sin abrirlo).
--   * admin_allies: agrega al final la columna confirmed_at para distinguir invitaciones pendientes.
-- Esta migracion NO abre el registro: registration_open no se toca.

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0004'));

  IF to_regclass('public.ally_registrations') IS NULL
     OR to_regprocedure('public.submit_ally_registration(text, text, text, text, boolean)') IS NULL
     OR to_regprocedure('public.admin_set_ally_status(uuid, text)') IS NULL THEN
    RAISE EXCEPTION '0001, 0002 y 0003 deben estar instaladas. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF to_regprocedure('public.aliados_registration_open()') IS NOT NULL THEN
    RAISE EXCEPTION '0004 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

CREATE FUNCTION public.aliados_registration_open()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT COALESCE((SELECT registration_open FROM public.aliados_settings), false)
$fn$;

REVOKE ALL ON FUNCTION public.aliados_registration_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aliados_registration_open() TO anon, authenticated;

-- Limites: 10 solicitudes nuevas por hora, 30 por dia, 100 pendientes. Se cuentan filas reales (incluidas
-- las rechazadas), asi que un correo repetido no consume cupo. Enfriamiento: 30 dias tras un rechazo.
CREATE OR REPLACE FUNCTION public.submit_ally_registration(
  p_email text, p_full_name text, p_phone text, p_city text, p_consent boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_digits int := length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'));
BEGIN
  IF NOT (SELECT registration_open FROM public.aliados_settings) THEN
    RAISE EXCEPTION 'El registro de aliados aun no esta abierto.';
  END IF;
  IF p_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Debes aceptar el aviso de privacidad y los terminos.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_phone IS NOT NULL AND (v_phone !~ '^[0-9 ()+.-]+$' OR v_digits NOT BETWEEN 10 AND 15) THEN
    RAISE EXCEPTION 'El numero de WhatsApp no es valido.' USING ERRCODE = 'check_violation';
  END IF;

  -- Serializa el conteo para que solicitudes simultaneas no rebasen los limites.
  PERFORM pg_advisory_xact_lock(hashtext('aliados-registration-submit'));
  IF (SELECT count(*) FROM public.ally_registrations WHERE created_at > now() - interval '1 hour') >= 10
     OR (SELECT count(*) FROM public.ally_registrations WHERE created_at > now() - interval '24 hours') >= 30
     OR (SELECT count(*) FROM public.ally_registrations WHERE status = 'pending') >= 100 THEN
    RAISE EXCEPTION 'Hay demasiadas solicitudes en este momento. Intenta mas tarde.' USING ERRCODE = 'program_limit_exceeded';
  END IF;

  -- Misma respuesta si el correo ya existe o fue rechazado hace poco: no revela quien tiene cuenta o solicitud.
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ally_registrations
             WHERE email = v_email AND status = 'rejected' AND reviewed_at > now() - interval '30 days') THEN
    RETURN;
  END IF;
  INSERT INTO public.ally_registrations (email, full_name, phone, city)
  VALUES (v_email, btrim(COALESCE(p_full_name, '')), v_phone, NULLIF(btrim(COALESCE(p_city, '')), ''))
  ON CONFLICT (email) WHERE status IN ('pending', 'approved') DO NOTHING;
END
$fn$;

CREATE OR REPLACE VIEW public.admin_allies WITH (security_barrier = true) AS
  SELECT p.user_id, p.display_name, p.phone, p.city, p.status, p.approved_at, p.created_at, u.email,
         u.email_confirmed_at AS confirmed_at
  FROM public.ally_profiles p JOIN auth.users u ON u.id = p.user_id
  WHERE (SELECT public.is_admin());

COMMIT;

-- Verificacion de catalogo posterior a la instalacion (solo lectura)
WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'aliados_registration_open existe; anon y authenticated la ejecutan',
         has_function_privilege('anon', 'public.aliados_registration_open()', 'EXECUTE')
         AND has_function_privilege('authenticated', 'public.aliados_registration_open()', 'EXECUTE')
  UNION ALL
  SELECT 2, 'submit_ally_registration sigue siendo la unica funcion de escritura para anon',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
  UNION ALL
  SELECT 3, 'el registro sigue en el estado en que estaba (esta migracion no lo abre)',
         EXISTS (SELECT 1 FROM public.aliados_settings)
  UNION ALL
  SELECT 4, 'admin_allies expone confirmed_at y anon no puede leerla',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'admin_allies' AND column_name = 'confirmed_at')
         AND NOT has_table_privilege('anon', 'public.admin_allies', 'SELECT')
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;
