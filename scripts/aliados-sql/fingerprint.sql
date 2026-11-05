-- SOLO PARA PRUEBAS LOCALES. Se ejecuta DESPUES de 0001 y ANTES de 0002.
-- Huellas de lo que la migracion 0002 NO debe alterar.
CREATE FUNCTION harness.compute_fp() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'auth_uid', (SELECT md5(pg_get_functiondef('auth.uid()'::regprocedure))),
    'is_admin', (SELECT md5(pg_get_functiondef('public.is_admin()'::regprocedure))),
    'base_columns', (SELECT md5(string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || a.attnotnull::text,
                            ',' ORDER BY c.relname, a.attnum))
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE c.relkind = 'r'
         AND ((n.nspname = 'public' AND c.relname IN ('ally_profiles', 'account_roles', 'admin_users', 'lab_environment'))
           OR (n.nspname = 'auth' AND c.relname = 'users'))),
    'base_constraints', (SELECT md5(string_agg(conrelid::regclass::text || pg_get_constraintdef(oid), ',' ORDER BY conrelid::regclass::text, conname))
       FROM pg_constraint
       WHERE conrelid IN ('public.ally_profiles'::regclass, 'public.account_roles'::regclass,
                          'public.admin_users'::regclass, 'public.lab_environment'::regclass, 'auth.users'::regclass)),
    'ally_profiles_triggers', (SELECT md5(string_agg(tgname || pg_get_triggerdef(oid), ',' ORDER BY tgname))
       FROM pg_trigger WHERE tgrelid = 'public.ally_profiles'::regclass AND NOT tgisinternal),
    'base_policies', (SELECT md5(string_agg(polname, ',' ORDER BY polrelid::regclass::text, polname))
       FROM pg_policy WHERE polrelid IN ('public.ally_profiles'::regclass, 'public.admin_users'::regclass)),
    'roles', (SELECT string_agg(rolname, ',' ORDER BY rolname) FROM pg_roles WHERE rolname !~ '^pg_')
  )
$$;
CREATE TABLE harness.fingerprint AS SELECT harness.compute_fp() AS fp;
