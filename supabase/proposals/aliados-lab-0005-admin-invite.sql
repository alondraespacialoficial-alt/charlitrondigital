-- ALIADOS CHARLITRON — Migracion incremental 0005: invitacion directa de aliados por un administrador.
-- Proyecto Supabase EXCLUSIVO de Aliados (independiente del editorial). NO ejecutar en ningun otro.
--
-- Requiere 0001 a 0004 YA instaladas. NO modifica 0001-0004, Auth, roles existentes, ventas, cobros ni comisiones.
-- Efecto: agrega admin_invite_ally, que deja una solicitud pendiente a nombre del administrador (auditada con su
-- identidad y el motivo) y avisa si el correo ya existe en Auth. El rol y el perfil NO se crean aqui: los crea
-- admin_finalize_registration (0002) cuando el backend la llama con el JWT del administrador.
-- Consentimiento: una invitacion de administrador NO registra aceptacion alguna. Para ello agrega ally_registrations.origin
-- ('public' por defecto, asi que las filas existentes no cambian) y permite consent_at NULL solo cuando origin = 'admin_invite'.
-- consent_at sigue siendo la aceptacion real del interesado en el registro publico.
-- Esta migracion NO abre el registro publico: registration_open no se toca.

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0005'));

  IF to_regprocedure('public.aliados_registration_open()') IS NULL
     OR to_regprocedure('public.admin_finalize_registration(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION '0001 a 0004 deben estar instaladas. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF to_regprocedure('public.admin_invite_ally(text, text, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION '0005 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

ALTER TABLE public.ally_registrations
  ADD COLUMN origin text NOT NULL DEFAULT 'public' CHECK (origin IN ('public', 'admin_invite')),
  ALTER COLUMN consent_at DROP NOT NULL,
  ADD CONSTRAINT ally_registrations_consent_matches_origin CHECK ((origin = 'admin_invite') = (consent_at IS NULL));

CREATE FUNCTION public.admin_invite_ally(p_email text, p_full_name text, p_phone text, p_city text)
RETURNS TABLE (registration_id uuid, auth_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_digits int := length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'));
  v_user uuid;
  v_reg uuid;
BEGIN
  PERFORM public.aliados_assert_admin();
  IF v_phone IS NOT NULL AND (v_phone !~ '^[0-9 ()+.-]+$' OR v_digits NOT BETWEEN 10 AND 15) THEN
    RAISE EXCEPTION 'El numero de WhatsApp no es valido.' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('aliados-admin-invite'));
  SELECT u.id INTO v_user FROM auth.users u WHERE lower(u.email) = v_email;
  IF v_user IS NOT NULL AND EXISTS (SELECT 1 FROM public.account_roles r WHERE r.user_id = v_user) THEN
    RAISE EXCEPTION 'Ese correo ya pertenece a un aliado o administrador.' USING ERRCODE = 'unique_violation';
  END IF;

  SELECT r.id INTO v_reg FROM public.ally_registrations r WHERE r.email = v_email AND r.status = 'pending';
  IF v_reg IS NULL THEN
    PERFORM set_config('aliados.reason', 'invitacion directa de administrador', true);
    INSERT INTO public.ally_registrations (email, full_name, phone, city, origin, consent_at)
    VALUES (v_email, btrim(COALESCE(p_full_name, '')), v_phone, NULLIF(btrim(COALESCE(p_city, '')), ''), 'admin_invite', NULL)
    RETURNING id INTO v_reg;
    PERFORM set_config('aliados.reason', '', true);
  END IF;

  RETURN QUERY SELECT v_reg, v_user;
END
$fn$;

REVOKE ALL ON FUNCTION public.admin_invite_ally(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_ally(text, text, text, text) TO authenticated;

COMMIT;

-- Verificacion de catalogo posterior a la instalacion (solo lectura)
WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'admin_invite_ally existe; authenticated la ejecuta y anon no',
         has_function_privilege('authenticated', 'public.admin_invite_ally(text, text, text, text)', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.admin_invite_ally(text, text, text, text)', 'EXECUTE')
  UNION ALL
  SELECT 2, 'anon sigue ejecutando solo las dos funciones publicas de registro',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
  UNION ALL
  SELECT 3, 'el registro publico sigue cerrado (registration_open = false)',
         EXISTS (SELECT 1 FROM public.aliados_settings WHERE registration_open = false)
  UNION ALL
  SELECT 4, 'consent_at admite NULL solo con origin = admin_invite (restriccion validada)',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ally_registrations'::regclass
                 AND conname = 'ally_registrations_consent_matches_origin' AND convalidated)
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;
