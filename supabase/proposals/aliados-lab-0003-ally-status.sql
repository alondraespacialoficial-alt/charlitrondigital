-- ALIADOS CHARLITRON — Migracion incremental 0003: cambio de estado de aliados (aprobar / pausar / reactivar).
-- Proyecto Supabase EXCLUSIVO: charlitron-aliados-test. NO ejecutar en ningun otro.
--
-- Requiere 0001 y 0002 YA instaladas. NO vuelve a ejecutar ni modifica 0002. NO toca Auth, roles ni
-- las definiciones de las tablas de 0001. Unico efecto sobre lo instalado: se retira al rol authenticated
-- el permiso de columna UPDATE (status) sobre ally_profiles, para que el navegador no pueda cambiar el
-- estado directamente; el cambio solo ocurre por admin_set_ally_status, que respeta el trigger de 0001
-- (transiciones permitidas, aprobador y fecha).

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0003'));

  IF to_regclass('public.ally_profiles') IS NULL
     OR to_regclass('public.referrals') IS NULL
     OR to_regprocedure('public.aliados_assert_admin()') IS NULL THEN
    RAISE EXCEPTION '0001 y 0002 deben estar instaladas. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF to_regprocedure('public.admin_set_ally_status(uuid, text)') IS NOT NULL THEN
    RAISE EXCEPTION '0003 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

CREATE FUNCTION public.admin_set_ally_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_old text;
BEGIN
  PERFORM public.aliados_assert_admin();
  IF p_status IS NULL OR p_status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'Estado no permitido: solo active o paused.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_old FROM public.ally_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aliado no encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_old = p_status THEN
    RAISE EXCEPTION 'El aliado ya esta en ese estado.' USING ERRCODE = 'check_violation';
  END IF;
  -- El trigger ally_profiles_guard_update (0001) valida la transicion y registra aprobador y fecha.
  UPDATE public.ally_profiles SET status = p_status WHERE user_id = p_user_id;
END
$fn$;

REVOKE ALL ON FUNCTION public.admin_set_ally_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ally_status(uuid, text) TO authenticated;

REVOKE UPDATE (status) ON public.ally_profiles FROM authenticated;

COMMIT;

-- Verificacion de catalogo posterior a la instalacion (solo lectura)
WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'admin_set_ally_status existe y es SECURITY DEFINER',
         EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'admin_set_ally_status' AND p.prosecdef)
  UNION ALL
  SELECT 2, 'authenticated puede ejecutarla; anon no',
         has_function_privilege('authenticated', 'public.admin_set_ally_status(uuid, text)', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.admin_set_ally_status(uuid, text)', 'EXECUTE')
  UNION ALL
  SELECT 3, 'authenticated ya no puede actualizar ally_profiles directamente',
         NOT has_any_column_privilege('authenticated', 'public.ally_profiles', 'UPDATE')
         AND NOT has_any_column_privilege('anon', 'public.ally_profiles', 'UPDATE')
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;
