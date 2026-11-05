-- SOLO PARA PRUEBAS LOCALES (Docker). No forma parte de la migracion.
-- Emula las piezas de la plataforma Supabase que 0001/0002 asumen. Ejecutar como postgres.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- Misma logica que GoTrue/PostgREST: el JWT llega por settings de sesion.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Supabase otorga ALL a anon/authenticated/service_role sobre todo objeto nuevo de public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Funcion y event trigger de la plataforma que 0001 exige conservar.
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
             WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
               AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    END IF;
  END LOOP;
END $$;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- Los dos usuarios de prueba que 0001 exige.
INSERT INTO auth.users (email) VALUES ('nadrian18@gmail.com'), ('integrandotugente@hotmail.com');

-- Utilidades de prueba (fuera de public).
CREATE SCHEMA harness;
GRANT USAGE ON SCHEMA harness TO PUBLIC;

CREATE FUNCTION harness.as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION harness.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
END $$;

-- Ejecuta una sentencia que DEBE fallar con el SQLSTATE indicado; cualquier otro resultado aborta.
CREATE FUNCTION harness.expect_error(p_sql text, p_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> p_state THEN
      RAISE EXCEPTION 'SQLSTATE esperado % pero fue % (%): %', p_state, SQLSTATE, SQLERRM, p_sql;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Debia fallar con % pero tuvo exito: %', p_state, p_sql;
END $$;

CREATE FUNCTION harness.must(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'AFIRMACION FALLIDA: %', p_msg;
  END IF;
  RAISE NOTICE 'ok  %', p_msg;
END $$;

CREATE TABLE harness.ids (k text PRIMARY KEY, v uuid NOT NULL);
GRANT SELECT ON harness.ids TO PUBLIC;
CREATE FUNCTION harness.put(p_k text, p_v uuid) RETURNS void LANGUAGE sql AS $$
  INSERT INTO harness.ids VALUES (p_k, p_v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v
$$;
CREATE FUNCTION harness.id(p_k text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT v FROM harness.ids WHERE k = p_k
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA harness TO PUBLIC;
