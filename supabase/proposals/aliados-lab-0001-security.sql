-- ALIADOS CHARLITRON — Laboratorio: primera migracion de seguridad (v3, lista para instalar)
-- Proyecto Supabase EXCLUSIVO: charlitron-aliados-test. NO ejecutar en ningun otro.
-- No es una migracion del repo; no moverlo a supabase/migrations/.
--
-- Estado de partida (confirmado): limpieza del blog terminada; auth.users con los 2 usuarios de prueba;
-- public solo con la funcion rls_auto_enable y el event trigger ensure_rls (de la plataforma, se CONSERVAN).
-- Contenido: marcador del laboratorio, account_roles, admin_users + is_admin(), ally_profiles, triggers de
-- aprobacion, y asignacion de roles por CORREO (sin escribir UID). Sin referidos, ventas, cobros ni comisiones.
--
-- LIMITE DE LA IDENTIFICACION: la base no conoce su Reference ID. Las guardas (estado limpio, exactamente dos
-- usuarios, correos unicos, rls_auto_enable/ensure_rls con la configuracion confirmada) reducen el riesgo, pero
-- NO sustituyen el ritual: Dashboard > Project Settings > General, nombre "charlitron-aliados-test" y
-- Reference ID distinto de rvvqhpbtqgjpzflopflv, confirmado por una segunda persona.
--
-- PASO 1 es UNA sola sentencia DO (atomica: si algo falla, no queda nada) seguida de una consulta de resultado.
-- Pegar todo el bloque de una vez. PASO 2 son las pruebas (no dejan cambios: terminan en una excepcion
-- intencional cuyo mensaje es el reporte).

-- ============================================================================
-- PASO 1. Instalacion
-- ============================================================================
DO $install$
DECLARE
  v_admin uuid;
  v_ally uuid;
  v_rls_md5 text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0001'));

  IF to_regclass('public.lab_environment') IS NOT NULL THEN
    RAISE EXCEPTION 'El marcador ya existe: la instalacion ya se ejecuto. No se modifico nada.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class AS c
             JOIN pg_namespace AS s ON s.oid = c.relnamespace
             WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')) THEN
    RAISE EXCEPTION 'public contiene tablas o vistas: no es el laboratorio limpio. No se modifico nada.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc AS p
             JOIN pg_namespace AS s ON s.oid = p.pronamespace
             WHERE s.nspname = 'public' AND p.proname != 'rls_auto_enable') THEN
    RAISE EXCEPTION 'public contiene funciones distintas de rls_auto_enable. No se modifico nada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc AS p
                 JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'
                   AND p.prosecdef
                   AND pg_get_userbyid(p.proowner) = 'postgres'
                   AND p.prorettype = 'event_trigger'::regtype
                   AND NOT EXISTS (SELECT 1 FROM pg_depend AS d
                                   WHERE d.classid = 'pg_proc'::regclass
                                     AND d.objid = p.oid AND d.deptype = 'e'))
     OR NOT EXISTS (SELECT 1 FROM pg_event_trigger AS e
                    WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
                      AND e.evtfoid IN (SELECT p.oid FROM pg_proc AS p
                                        JOIN pg_namespace AS s ON s.oid = p.pronamespace
                                        WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable')) THEN
    RAISE EXCEPTION 'rls_auto_enable o el event trigger ensure_rls no tienen la configuracion esperada. No se modifico nada.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects')) THEN
    RAISE EXCEPTION 'Existen politicas en public o en storage.objects. No se modifico nada.';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets) THEN
    RAISE EXCEPTION 'Existen buckets de Storage. No se modifico nada.';
  END IF;

  IF (SELECT count(*) FROM auth.users) != 2
     OR (SELECT count(*) FROM auth.users WHERE lower(email) = 'nadrian18@gmail.com') != 1
     OR (SELECT count(*) FROM auth.users WHERE lower(email) = 'integrandotugente@hotmail.com') != 1 THEN
    RAISE EXCEPTION 'auth.users debe tener exactamente los 2 usuarios de prueba, cada correo una sola vez. No se modifico nada.';
  END IF;

  SELECT id INTO v_admin FROM auth.users WHERE lower(email) = 'nadrian18@gmail.com';
  SELECT id INTO v_ally FROM auth.users WHERE lower(email) = 'integrandotugente@hotmail.com';
  SELECT md5(pg_get_functiondef(p.oid)) INTO v_rls_md5
  FROM pg_proc AS p
  JOIN pg_namespace AS s ON s.oid = p.pronamespace
  WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable';

  CREATE TABLE public.lab_environment (
    singleton       boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    environment     text NOT NULL CHECK (environment = 'charlitron-aliados-test'),
    admin_uid       uuid NOT NULL,
    admin_email     text NOT NULL CHECK (admin_email = 'nadrian18@gmail.com'),
    ally_uid        uuid NOT NULL,
    ally_email      text NOT NULL CHECK (ally_email = 'integrandotugente@hotmail.com'),
    rls_fingerprint text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (admin_uid != ally_uid)
  );
  ALTER TABLE public.lab_environment ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.lab_environment FROM PUBLIC, anon, authenticated;
  INSERT INTO public.lab_environment (environment, admin_uid, admin_email, ally_uid, ally_email, rls_fingerprint)
  VALUES ('charlitron-aliados-test', v_admin, 'nadrian18@gmail.com', v_ally,
          'integrandotugente@hotmail.com', v_rls_md5);

  CREATE FUNCTION public.assert_aliados_lab()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path = public
  AS $fn$
  BEGIN
    IF to_regclass('public.lab_environment') IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.lab_environment AS e
         JOIN auth.users AS a ON a.id = e.admin_uid AND lower(a.email) = e.admin_email
         JOIN auth.users AS b ON b.id = e.ally_uid AND lower(b.email) = e.ally_email
         WHERE e.environment = 'charlitron-aliados-test'
       ) THEN
      RAISE EXCEPTION 'Esta base no es charlitron-aliados-test (marcador o usuarios de prueba no coinciden). Script abortado.';
    END IF;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.assert_aliados_lab() FROM PUBLIC, anon, authenticated;

  CREATE TABLE public.account_roles (
    user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('admin', 'ally')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
  );
  ALTER TABLE public.account_roles ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.account_roles FROM PUBLIC, anon, authenticated;

  CREATE TABLE public.admin_users (
    user_id    uuid PRIMARY KEY,
    role       text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, role) REFERENCES public.account_roles (user_id, role) ON DELETE CASCADE
  );
  ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.admin_users TO authenticated;
  CREATE POLICY admin_users_select_own ON public.admin_users
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

  CREATE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
  $fn$;
  REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

  CREATE TABLE public.ally_profiles (
    user_id           uuid PRIMARY KEY,
    role              text NOT NULL DEFAULT 'ally' CHECK (role = 'ally'),
    display_name      text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 120),
    phone             text CHECK (phone IS NULL OR char_length(phone) BETWEEN 0 AND 30),
    city              text CHECK (city IS NULL OR char_length(city) BETWEEN 0 AND 80),
    status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused')),
    approved_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    approved_at       timestamptz,
    status_changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    status_changed_at timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, role) REFERENCES public.account_roles (user_id, role) ON DELETE CASCADE
  );
  ALTER TABLE public.ally_profiles ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.ally_profiles FROM PUBLIC, anon, authenticated;
  GRANT SELECT ON public.ally_profiles TO authenticated;
  GRANT UPDATE (status) ON public.ally_profiles TO authenticated;

  CREATE POLICY ally_profiles_select_own ON public.ally_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  CREATE POLICY ally_profiles_select_admin ON public.ally_profiles
    FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));
  CREATE POLICY ally_profiles_update_status_admin ON public.ally_profiles
    FOR UPDATE TO authenticated
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

  CREATE FUNCTION public.ally_profiles_guard_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $fn$
  BEGIN
    IF NEW.status != 'pending'
       OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NEW.status_changed_by IS NOT NULL OR NEW.status_changed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Un perfil de aliado solo puede crearse como pending y sin datos de aprobacion.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.ally_profiles_guard_insert() FROM PUBLIC, anon, authenticated;
  CREATE TRIGGER ally_profiles_guard_insert
    BEFORE INSERT ON public.ally_profiles
    FOR EACH ROW EXECUTE FUNCTION public.ally_profiles_guard_insert();

  CREATE FUNCTION public.ally_profiles_guard_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $fn$
  BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.status_changed_by IS DISTINCT FROM OLD.status_changed_by
       OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at THEN
      RAISE EXCEPTION 'Los campos de identidad y auditoria de ally_profiles no son editables.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Cambiar el estado exige un administrador identificado.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      IF NOT ((OLD.status = 'pending' AND NEW.status IN ('active', 'paused'))
           OR (OLD.status = 'active' AND NEW.status = 'paused')
           OR (OLD.status = 'paused' AND NEW.status = 'active')) THEN
        RAISE EXCEPTION 'Transicion de estado no permitida: % a %.', OLD.status, NEW.status
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.status_changed_by := auth.uid();
      NEW.status_changed_at := now();
      IF NEW.status = 'active' AND OLD.approved_at IS NULL THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.ally_profiles_guard_update() FROM PUBLIC, anon, authenticated;
  CREATE TRIGGER ally_profiles_guard_update
    BEFORE UPDATE ON public.ally_profiles
    FOR EACH ROW EXECUTE FUNCTION public.ally_profiles_guard_update();

  INSERT INTO public.account_roles (user_id, role) VALUES (v_admin, 'admin'), (v_ally, 'ally');
  INSERT INTO public.admin_users (user_id) VALUES (v_admin);
  INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_ally, 'Aliado de prueba (ficticio)');

  PERFORM public.assert_aliados_lab();
END
$install$;

WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'Marcador charlitron-aliados-test creado',
         EXISTS (SELECT 1 FROM public.lab_environment WHERE environment = 'charlitron-aliados-test')
  UNION ALL
  SELECT 2, 'Roles asignados por correo: 1 administrador y 1 aliado',
         (SELECT count(*) FROM public.account_roles) = 2
         AND EXISTS (SELECT 1 FROM public.account_roles AS r
                     JOIN auth.users AS u ON u.id = r.user_id
                     WHERE r.role = 'admin' AND lower(u.email) = 'nadrian18@gmail.com')
         AND EXISTS (SELECT 1 FROM public.account_roles AS r
                     JOIN auth.users AS u ON u.id = r.user_id
                     WHERE r.role = 'ally' AND lower(u.email) = 'integrandotugente@hotmail.com')
  UNION ALL
  SELECT 3, 'El aliado de prueba queda en estado pending',
         EXISTS (SELECT 1 FROM public.ally_profiles WHERE status = 'pending' AND approved_at IS NULL)
  UNION ALL
  SELECT 4, 'RLS activo en las 4 tablas nuevas',
         (SELECT count(*) FROM pg_class AS c
          JOIN pg_namespace AS s ON s.oid = c.relnamespace
          WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) = 4
  UNION ALL
  SELECT 5, 'rls_auto_enable intacta (misma huella que antes de instalar)',
         (SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc AS p
          JOIN pg_namespace AS s ON s.oid = p.pronamespace
          WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable')
         = (SELECT rls_fingerprint FROM public.lab_environment)
  UNION ALL
  SELECT 6, 'ensure_rls sigue habilitado',
         EXISTS (SELECT 1 FROM pg_event_trigger AS e WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O')
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion
FROM checks
UNION ALL
SELECT 98, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL'
FROM checks
UNION ALL
SELECT 99, 'SIGUIENTE', 'Ejecuta el bloque de pruebas (PASO 2).'
ORDER BY orden;

-- ============================================================================
-- PASO 2. Pruebas SQL con JWT SIMULADO: PASA / FALLA (no dejan ningun cambio)
-- Requiere el PASO 1. Lee el reporte en el mensaje de error. No prueba PostgREST, GoTrue, firma ni caducidad
-- del JWT (ver PASO 3).
-- ============================================================================
DO $test$
DECLARE
  P constant text := 'PASA   ';
  F constant text := 'FALLA  ';
  res text[] := ARRAY[]::text[];
  ok boolean;
  n integer;
  v_admin uuid;
  v_ally uuid;
  v_start_pending boolean;
  v_by uuid;
  v_at timestamptz;
  v_at_first timestamptz;
  v_chgby uuid;
  v_chgat timestamptz;
  v_target text;
  v_fails integer;
BEGIN
  PERFORM public.assert_aliados_lab();
  SELECT admin_uid, ally_uid INTO v_admin, v_ally FROM public.lab_environment;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_admin)
     OR NOT EXISTS (SELECT 1 FROM public.ally_profiles WHERE user_id = v_ally) THEN
    RAISE EXCEPTION 'Ejecuta el PASO 1 antes de estas pruebas.';
  END IF;
  SELECT (status = 'pending' AND approved_at IS NULL) INTO v_start_pending
  FROM public.ally_profiles WHERE user_id = v_ally;

  ok := (SELECT array_agg(c.relname::text ORDER BY c.relname::text COLLATE "C")
         FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
         WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f'))
        = ARRAY['account_roles', 'admin_users', 'ally_profiles', 'lab_environment'];
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A1 public contiene solo las 4 tablas esperadas');

  ok := NOT EXISTS (SELECT 1 FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
                    WHERE s.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity);
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A2 RLS activo en todas las tablas');

  SELECT NOT COALESCE(bool_or(
           has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')), false)
  INTO ok
  FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r';
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A3 anon sin ningun privilegio sobre las tablas');

  SELECT NOT COALESCE(bool_or(
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')), false)
  INTO ok
  FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('lab_environment', 'account_roles');
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A4 authenticated sin acceso a lab_environment ni account_roles');

  ok := has_table_privilege('authenticated', 'public.admin_users', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.admin_users', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT has_any_column_privilege('authenticated', 'public.admin_users', 'INSERT,UPDATE,REFERENCES');
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A5 authenticated: solo SELECT en admin_users');

  ok := has_table_privilege('authenticated', 'public.ally_profiles', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.ally_profiles', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT has_any_column_privilege('authenticated', 'public.ally_profiles', 'INSERT,REFERENCES')
        AND has_column_privilege('authenticated', 'public.ally_profiles', 'status', 'UPDATE');
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A6 authenticated: SELECT y UPDATE(status) en ally_profiles; sin INSERT/DELETE');

  SELECT NOT COALESCE(bool_or(has_column_privilege('authenticated', 'public.ally_profiles', a, 'UPDATE')), false)
  INTO ok
  FROM unnest(ARRAY['user_id', 'role', 'display_name', 'phone', 'city', 'approved_by', 'approved_at',
                    'status_changed_by', 'status_changed_at', 'created_at']) AS a;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A7 ninguna otra columna de ally_profiles es actualizable por authenticated');

  ok := NOT EXISTS (SELECT 1 FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
                    CROSS JOIN LATERAL aclexplode(c.relacl) AS a
                    WHERE s.nspname = 'public' AND c.relkind = 'r' AND a.grantee = 0);
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A8 PUBLIC sin privilegios sobre las tablas');

  ok := (SELECT array_agg(fn.proname::text ORDER BY fn.proname::text COLLATE "C")
         FROM pg_proc AS fn JOIN pg_namespace AS s ON s.oid = fn.pronamespace WHERE s.nspname = 'public')
        = ARRAY['ally_profiles_guard_insert', 'ally_profiles_guard_update', 'assert_aliados_lab',
                'is_admin', 'rls_auto_enable'];
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A9 public contiene las 4 funciones esperadas mas rls_auto_enable');

  SELECT COALESCE(bool_and(fn.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(fn.proacl) AS a WHERE a.grantee = 0)), false)
  INTO ok
  FROM pg_proc AS fn JOIN pg_namespace AS s ON s.oid = fn.pronamespace
  WHERE s.nspname = 'public' AND fn.proname != 'rls_auto_enable';
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A10 PUBLIC sin EXECUTE en nuestras funciones');

  SELECT COALESCE(bool_and(
           NOT has_function_privilege('anon', fn.oid, 'EXECUTE')
           AND has_function_privilege('authenticated', fn.oid, 'EXECUTE') = (fn.proname = 'is_admin')), false)
  INTO ok
  FROM pg_proc AS fn JOIN pg_namespace AS s ON s.oid = fn.pronamespace
  WHERE s.nspname = 'public' AND fn.proname != 'rls_auto_enable';
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A11 EXECUTE en nuestras funciones: anon ninguna; authenticated solo is_admin()');

  SELECT COALESCE(bool_and(fn.proconfig::text LIKE '%search_path=public%'
                           AND (fn.prosecdef = (fn.proname = 'is_admin'))), false)
  INTO ok
  FROM pg_proc AS fn JOIN pg_namespace AS s ON s.oid = fn.pronamespace
  WHERE s.nspname = 'public' AND fn.proname != 'rls_auto_enable';
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A12 search_path fijo en nuestras funciones; SECURITY DEFINER solo en is_admin()');

  ok := (SELECT array_agg(policyname::text ORDER BY policyname::text COLLATE "C") FROM pg_policies WHERE schemaname = 'public')
        = ARRAY['admin_users_select_own', 'ally_profiles_select_admin', 'ally_profiles_select_own',
                'ally_profiles_update_status_admin'];
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A13 el conjunto de politicas RLS es exactamente el esperado');

  ok := (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = 'public.ally_profiles'::regclass AND NOT tgisinternal AND tgenabled = 'O'
           AND tgname IN ('ally_profiles_guard_insert', 'ally_profiles_guard_update')) = 2;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A14 triggers de alta y cambio activos en ally_profiles');

  ok := EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_roles'::regclass AND contype = 'p'
                AND array_length(conkey, 1) = 1)
        AND (SELECT count(*) FROM pg_constraint
             WHERE contype = 'f' AND confrelid = 'public.account_roles'::regclass
               AND conrelid IN ('public.admin_users'::regclass, 'public.ally_profiles'::regclass)
               AND array_length(conkey, 1) = 2) = 2;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A15 un rol por usuario: PK en account_roles y FK compuestas (seguro ante concurrencia)');

  ok := (SELECT md5(pg_get_functiondef(fn.oid)) FROM pg_proc AS fn
         JOIN pg_namespace AS s ON s.oid = fn.pronamespace
         WHERE s.nspname = 'public' AND fn.proname = 'rls_auto_enable')
        = (SELECT rls_fingerprint FROM public.lab_environment);
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A16 rls_auto_enable conserva la huella guardada al instalar');

  ok := EXISTS (SELECT 1 FROM pg_event_trigger AS e
                WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
                  AND e.evtfoid IN (SELECT fn.oid FROM pg_proc AS fn
                                    JOIN pg_namespace AS s ON s.oid = fn.pronamespace
                                    WHERE s.nspname = 'public' AND fn.proname = 'rls_auto_enable'));
  res := res || (CASE WHEN ok THEN P ELSE F END || 'A17 ensure_rls sigue habilitado y ejecuta rls_auto_enable');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ally::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_ally::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ok := (SELECT count(*) FROM public.ally_profiles) = 1;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.1 aliado ve exactamente 1 fila de ally_profiles');
  ok := (SELECT count(*) FROM public.admin_users) = 0;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.2 aliado no ve filas de admin_users');
  ok := NOT public.is_admin();
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.3 is_admin() = false para el aliado');

  ok := false; BEGIN PERFORM 1 FROM public.account_roles; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.4 aliado no puede leer account_roles');
  ok := false; BEGIN PERFORM 1 FROM public.lab_environment; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.5 aliado no puede leer lab_environment');
  ok := false; BEGIN PERFORM public.assert_aliados_lab(); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.6 aliado no puede ejecutar assert_aliados_lab()');
  ok := false; BEGIN PERFORM public.ally_profiles_guard_update(); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.7 aliado no puede invocar funciones de trigger');

  UPDATE public.ally_profiles SET status = 'active' WHERE user_id = v_ally;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0);
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.8 aliado no puede activarse (0 filas actualizadas por RLS)');
  ok := false; BEGIN UPDATE public.ally_profiles SET display_name = 'x' WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.9 aliado no puede editar display_name');
  ok := false; BEGIN UPDATE public.ally_profiles SET approved_by = v_ally WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.10 aliado no puede escribir approved_by');
  ok := false; BEGIN INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_ally, 'dup'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.11 aliado no puede insertar en ally_profiles');
  ok := false; BEGIN DELETE FROM public.ally_profiles WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.12 aliado no puede borrar su perfil');
  ok := false; BEGIN INSERT INTO public.admin_users (user_id) VALUES (v_ally); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.13 aliado no puede hacerse administrador');
  ok := false; BEGIN DELETE FROM public.admin_users; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B1.14 aliado no puede borrar admin_users');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ok := public.is_admin();
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.1 is_admin() = true para el administrador');
  ok := (SELECT count(*) FROM public.admin_users) = 1;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.2 administrador ve solo su fila de admin_users');
  ok := (SELECT count(*) FROM public.ally_profiles) = 1;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.3 administrador ve los perfiles de aliados');
  ok := false; BEGIN PERFORM 1 FROM public.account_roles; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.4 administrador tampoco lee account_roles desde la API');
  ok := false; BEGIN UPDATE public.ally_profiles SET display_name = 'x' WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.5 administrador no edita display_name desde la API');
  ok := false; BEGIN UPDATE public.ally_profiles SET approved_by = v_admin WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.6 administrador no escribe approved_by directamente');
  ok := false; BEGIN INSERT INTO public.admin_users (user_id) VALUES (v_admin); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.7 administrador no inserta en admin_users desde la API');
  ok := false; BEGIN DELETE FROM public.ally_profiles WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.8 administrador no borra perfiles desde la API');

  IF v_start_pending THEN
    UPDATE public.ally_profiles SET status = 'active' WHERE user_id = v_ally;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT approved_by, approved_at, status_changed_by INTO v_by, v_at, v_chgby FROM public.ally_profiles WHERE user_id = v_ally;
    ok := (n = 1 AND v_by = v_admin AND v_at IS NOT NULL AND v_chgby = v_admin);
    res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.9 pending a active registra quien aprobo y cuando');
    v_at_first := v_at;

    UPDATE public.ally_profiles SET status = 'paused' WHERE user_id = v_ally;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT approved_by, approved_at, status_changed_at INTO v_by, v_at, v_chgat FROM public.ally_profiles WHERE user_id = v_ally;
    ok := (n = 1 AND v_by = v_admin AND v_at = v_at_first AND v_chgat IS NOT NULL);
    res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.10 active a paused conserva la aprobacion original');

    UPDATE public.ally_profiles SET status = 'active' WHERE user_id = v_ally;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT approved_by, approved_at INTO v_by, v_at FROM public.ally_profiles WHERE user_id = v_ally;
    ok := (n = 1 AND v_by = v_admin AND v_at = v_at_first);
    res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.11 paused a active no reescribe approved_by ni approved_at');

    ok := false; BEGIN UPDATE public.ally_profiles SET status = 'pending' WHERE user_id = v_ally; EXCEPTION WHEN check_violation THEN ok := true; END;
    res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.12 no se permite volver a pending');
    ok := false; BEGIN UPDATE public.ally_profiles SET status = 'bogus' WHERE user_id = v_ally; EXCEPTION WHEN check_violation THEN ok := true; END;
    res := res || (CASE WHEN ok THEN P ELSE F END || 'B2.13 no se permite un estado inexistente');
  ELSE
    res := res || 'OMITIDA B2.9-B2.13 (el aliado no esta en pending sin aprobacion al iniciar)';
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  EXECUTE 'SET LOCAL ROLE anon';
  ok := false; BEGIN PERFORM 1 FROM public.ally_profiles; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B3.1 anon no puede leer ally_profiles');
  ok := false; BEGIN PERFORM 1 FROM public.admin_users; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B3.2 anon no puede leer admin_users');
  ok := false; BEGIN PERFORM public.is_admin(); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B3.3 anon no puede ejecutar is_admin()');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ok := (SELECT count(*) FROM public.ally_profiles) = 0 AND (SELECT count(*) FROM public.admin_users) = 0 AND NOT public.is_admin();
  res := res || (CASE WHEN ok THEN P ELSE F END || 'B4.1 usuario autenticado sin rol no ve nada y no es admin');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  SELECT CASE WHEN status = 'active' THEN 'paused' ELSE 'active' END INTO v_target
  FROM public.ally_profiles WHERE user_id = v_ally;
  ok := false; BEGIN INSERT INTO public.admin_users (user_id) VALUES (v_ally); EXCEPTION WHEN foreign_key_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C1 un aliado no puede registrarse tambien como administrador');
  ok := false; BEGIN INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_admin, 'xx'); EXCEPTION WHEN foreign_key_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C2 un administrador no puede registrarse tambien como aliado');
  ok := false; BEGIN INSERT INTO public.account_roles (user_id, role) VALUES (v_ally, 'admin'); EXCEPTION WHEN unique_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C3 un usuario no puede tener dos filas en account_roles');
  ok := false; BEGIN UPDATE public.account_roles SET role = 'ally' WHERE user_id = v_admin; EXCEPTION WHEN foreign_key_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C4 no se puede cambiar el rol de una cuenta con perfil asociado');
  ok := false; BEGIN INSERT INTO public.ally_profiles (user_id, display_name, status) VALUES (gen_random_uuid(), 'x', 'active'); EXCEPTION WHEN check_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C5 un perfil solo puede crearse como pending');
  ok := false; BEGIN UPDATE public.ally_profiles SET approved_by = v_ally WHERE user_id = v_ally; EXCEPTION WHEN check_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C6 approved_by es inmutable incluso para el rol de mantenimiento');
  ok := false; BEGIN UPDATE public.ally_profiles SET user_id = gen_random_uuid() WHERE user_id = v_ally; EXCEPTION WHEN check_violation THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C7 user_id es inmutable');
  ok := false; BEGIN UPDATE public.ally_profiles SET status = v_target WHERE user_id = v_ally; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  res := res || (CASE WHEN ok THEN P ELSE F END || 'C8 un cambio de estado sin administrador identificado es rechazado');

  v_fails := (SELECT count(*) FROM unnest(res) AS x WHERE x LIKE 'FALLA%');
  RAISE EXCEPTION E'\n=== REPORTE DE PRUEBAS SQL (JWT simulado) ===\nRESULTADO GLOBAL: %\n\n%\n\n(Excepcion intencional: revierte todo; no queda ningun cambio persistente.)',
    CASE WHEN v_fails = 0 THEN 'PASA' ELSE 'FALLA (' || v_fails || ' pruebas)' END,
    array_to_string(res, E'\n');
END
$test$;

-- ============================================================================
-- PASO 3. PRUEBAS FUTURAS (solo comentarios: NO se ejecutan en esta fase)
--
-- 3.A Sesiones reales de Supabase Auth con las dos cuentas ficticias:
--   - signInWithPassword real; el registro publico sigue desactivado (signUp debe fallar).
--   - Aliado via PostgREST: GET ally_profiles -> 1 fila; GET admin_users -> []; PATCH status -> sin filas
--     o 403; PATCH de otra columna -> 403; rpc is_admin -> false; rpc assert_aliados_lab -> 403/404.
--   - Administrador via PostgREST: rpc is_admin -> true; PATCH status con transiciones validas y la invalida.
--   - anon (sin sesion): todas las lecturas y rpc rechazadas.
--   - Data API: confirmar en Settings > API que solo se exponen los esquemas previstos.
--   - user_metadata editable por el usuario NO debe otorgar nada (la autorizacion sale de admin_users).
--   - Caducidad y renovacion del token; cierre de sesion; usuario pausado.
--
-- 3.B Concurrencia (dos sesiones SQL con un tercer usuario ficticio creado aparte y aprobado por separado):
--   - Sesion 1: BEGIN; INSERT INTO public.account_roles (user_id, role) VALUES ('<UID_3>', 'admin');
--   - Sesion 2: INSERT INTO public.account_roles (user_id, role) VALUES ('<UID_3>', 'ally');  -> se bloquea.
--   - Sesion 1: COMMIT;  -> la sesion 2 falla con unique_violation.
--   - Cambio de estado simultaneo del mismo perfil por dos administradores: el segundo se evalua sobre el
--     estado ya confirmado. Limpiar al terminar.
-- ============================================================================
