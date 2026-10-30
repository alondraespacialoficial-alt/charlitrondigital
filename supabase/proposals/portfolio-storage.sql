-- CHARLITRON DIGITAL — Storage del portafolio
-- BLOQUE 1: instalacion unica en una sola transaccion. Ejecutar una sola vez.
-- BLOQUE 2 (al final): verificacion, se ejecuta aparte despues del COMMIT.
-- No es una migracion; no moverlo a supabase/migrations/.
--
-- Requiere el helper existente public.is_admin() de la migracion 0001.
-- No crea tablas ni toca Auth, blog, BTL, article-images ni sus politicas.
--
-- Buckets y objetos:
--   portfolio-drafts (privado): drafts/<slug>/<draft-id>/...
--   portfolio-published (publico por URL):
--     projects/<slug>/versions/<version>/cover.webp
--     projects/<slug>/versions/<version>/gallery-*.webp
--     projects/<slug>/versions/<version>/manifest.json
--     projects/<slug>/current.json
--
-- Los originales se limitan a 12 MiB en la aplicacion. Cada WebP ya
-- optimizado debe quedar en <= 5 MiB; el limite de Storage es 5 MiB por
-- objeto, no por proyecto. El cliente debe comprobar Blob.size despues de
-- optimizar y rechazar un resultado mayor antes de subirlo.
-- Manifiestos JSON tambien quedan bajo el mismo limite (su tamano esperado
-- es mucho menor).

BEGIN;

-- Precheck: aborta sin modificar nada si falta una precondicion o algo ya existe.
DO $$
DECLARE
  portfolio_policy_names text[] := ARRAY[
    'portfolio_drafts_select_admin',
    'portfolio_drafts_insert_admin',
    'portfolio_drafts_update_admin',
    'portfolio_drafts_delete_admin',
    'portfolio_published_select_admin',
    'portfolio_published_insert_admin',
    'portfolio_published_update_admin',
    'portfolio_published_delete_admin'
  ];
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.is_admin(). No se modifico Storage.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'storage'
      AND relation.relname = 'objects'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS no esta habilitado en storage.objects. No se modifico Storage.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.buckets AS bucket
    WHERE bucket.id IN ('portfolio-drafts', 'portfolio-published')
       OR bucket.name IN ('portfolio-drafts', 'portfolio-published')
  ) THEN
    RAISE EXCEPTION
      'Ya existe un bucket portfolio-drafts o portfolio-published. No se modifico Storage.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'storage'
      AND policy.tablename = 'objects'
      AND (
        policy.policyname = ANY (portfolio_policy_names)
        OR coalesce(policy.qual, '') ILIKE '%portfolio-drafts%'
        OR coalesce(policy.with_check, '') ILIKE '%portfolio-drafts%'
        OR coalesce(policy.qual, '') ILIKE '%portfolio-published%'
        OR coalesce(policy.with_check, '') ILIKE '%portfolio-published%'
      )
  ) THEN
    RAISE EXCEPTION
      'Ya existe una politica con un nombre del portafolio o que referencia sus buckets. No se modifico Storage.';
  END IF;

  -- Las politicas permisivas se combinan con OR: una sin filtro bucket_id literal
  -- (o con OR) podria alcanzar los buckets nuevos. article-images no coincide.
  IF EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'storage'
      AND policy.tablename = 'objects'
      AND policy.roles && ARRAY['public', 'anon', 'authenticated']::name[]
      AND (
        (coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, ''))
          !~* $pattern$bucket_id[[:space:]]*=[[:space:]]*'[^']+'$pattern$
        OR (coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, ''))
          ~* $pattern$(^|[[:space:]])OR([[:space:]]|$)$pattern$
      )
  ) THEN
    RAISE EXCEPTION
      'Existe una politica amplia o ambigua en storage.objects aplicable a public/anon/authenticated. Revisarla manualmente; no se modifico Storage.';
  END IF;
END;
$$;

INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('portfolio-drafts', 'portfolio-drafts', false, 5242880, ARRAY['image/webp', 'application/json']),
  ('portfolio-published', 'portfolio-published', true, 5242880, ARRAY['image/webp', 'application/json']);

CREATE POLICY portfolio_drafts_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio-drafts' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_drafts_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-drafts' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_drafts_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio-drafts' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'portfolio-drafts' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_drafts_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-drafts' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_published_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio-published' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_published_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-published' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_published_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio-published' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'portfolio-published' AND (SELECT public.is_admin()));

CREATE POLICY portfolio_published_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-published' AND (SELECT public.is_admin()));

COMMIT;

-- ============================================================================
-- BLOQUE 2: verificacion (solo lectura). Ejecutar aparte, despues del COMMIT.
-- ============================================================================

-- 1. Configuracion de ambos buckets. Esperado: drafts=false, published=true,
--    file_size_limit=5242880 y MIME image/webp + application/json.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('portfolio-drafts', 'portfolio-published')
ORDER BY id;

-- 2. Politicas relacionadas con estos buckets, incluidos conflictos remanentes.
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    coalesce(qual, '') ILIKE '%portfolio-drafts%'
    OR coalesce(with_check, '') ILIKE '%portfolio-drafts%'
    OR coalesce(qual, '') ILIKE '%portfolio-published%'
    OR coalesce(with_check, '') ILIKE '%portfolio-published%'
  )
ORDER BY policyname;

-- 3. Esperado: 8 filas, todas con roles={authenticated}; 4 por bucket.
SELECT
  count(*) AS portfolio_policies,
  count(*) FILTER (WHERE roles = ARRAY['authenticated']::name[]) AS authenticated_only,
  count(*) FILTER (WHERE qual ILIKE '%portfolio-drafts%' OR with_check ILIKE '%portfolio-drafts%') AS drafts_policies,
  count(*) FILTER (WHERE qual ILIKE '%portfolio-published%' OR with_check ILIKE '%portfolio-published%') AS published_policies
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'portfolio\_%\_admin';

-- 4. Esperado: cero filas (sin politicas anon/public sobre los buckets nuevos).
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND roles && ARRAY['anon', 'public']::name[]
  AND (
    coalesce(qual, '') ILIKE '%portfolio-%'
    OR coalesce(with_check, '') ILIKE '%portfolio-%'
  );

-- 5. Esperado: las 3 politicas administrativas de article-images, sin cambios.
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    coalesce(qual, '') ILIKE '%article-images%'
    OR coalesce(with_check, '') ILIKE '%article-images%'
  )
ORDER BY policyname;

-- 6. Esperado: row_level_security_enabled = true.
SELECT namespace.nspname AS schema_name, relation.relname AS table_name,
       relation.relrowsecurity AS row_level_security_enabled
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'storage' AND relation.relname = 'objects';

-- 7. Esperado: admin_function no es NULL.
SELECT to_regprocedure('public.is_admin()') AS admin_function;

-- 8. Verificacion HTTP fuera de SQL (no lista objetos):
--    GET /storage/v1/object/public/portfolio-published/projects/<slug>/current.json
--    debe devolver 200 si existe un manifiesto publicado.
--    Con anon: listar, subir, reemplazar o borrar debe fallar.
--    Repetir con un usuario autenticado no admin (debe fallar) y con admin.