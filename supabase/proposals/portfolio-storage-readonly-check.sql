-- CHARLITRON DIGITAL — Preflight de solo lectura para Storage del portafolio
--
-- Este archivo es solo de inspeccion. Todas las sentencias son SELECT y leen
-- catalogos/metadata; no crean ni modifican tablas, buckets, policies,
-- funciones, permisos o datos. No incluye BEGIN/COMMIT ni DDL/DML.
-- Ejecutar antes de revisar/aplicar portfolio-storage.sql.
--
-- Revisar los resultados completos. Si aparece una incompatibilidad o una
-- politica amplia, detenerse y analizarla antes de ejecutar el SQL de setup.

-- 1. Buckets actuales con ids o nombres reservados.
-- Esperado: cero filas (todavia no creados), o exactamente:
--   portfolio-drafts: public=false, 5242880 bytes, application/json + image/webp
--   portfolio-published: public=true, 5242880 bytes, mismos MIME types
-- Cualquier bucket existente con valores distintos requiere decision manual.
SELECT
  bucket.id,
  bucket.name,
  bucket.public,
  bucket.file_size_limit,
  bucket.allowed_mime_types
FROM storage.buckets AS bucket
WHERE bucket.id IN ('portfolio-drafts', 'portfolio-published')
   OR bucket.name IN ('portfolio-drafts', 'portfolio-published')
ORDER BY bucket.id;

-- 2. Todas las policies existentes en storage.objects.
-- Esperado: las policies del blog deben quedar restringidas a article-images.
-- Revisar cualquier policy ALL, cualquier rol anon/public y los filtros USING
-- / WITH CHECK. Las policies actuales del blog no se deben cambiar.
SELECT
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual AS using_expression,
  policy.with_check
FROM pg_policies AS policy
WHERE policy.schemaname = 'storage'
  AND policy.tablename = 'objects'
ORDER BY policy.policyname;

-- 3. Policies generales/potencialmente conflictivas.
-- Devuelve policies aplicables a anon, public o authenticated cuyo filtro no
-- identifica un bucket por igualdad literal, o usa OR. Una policy que combine
-- bucket_id = 'article-images' con AND y condiciones admin queda aislada.
-- Esperado: cero filas, o investigarlas antes del setup: Supabase combina las
-- policies permisivas con OR y una policy general podria ampliar el alcance.
SELECT
  policy.policyname,
  policy.roles,
  policy.cmd,
  policy.permissive,
  policy.qual AS using_expression,
  policy.with_check,
  (coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')) AS combined_filter
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
ORDER BY policy.policyname;

-- 4. Policies que ya mencionen uno de los buckets propuestos o un nombre
-- reservado. Esperado antes del setup: cero filas. Si existen, comprobar si
-- son semantica equivalente (se puede evitar duplicarlas) o incompatible.
SELECT
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual AS using_expression,
  policy.with_check
FROM pg_policies AS policy
WHERE policy.schemaname = 'storage'
  AND policy.tablename = 'objects'
  AND (
    coalesce(policy.qual, '') ILIKE '%portfolio-drafts%'
    OR coalesce(policy.with_check, '') ILIKE '%portfolio-drafts%'
    OR coalesce(policy.qual, '') ILIKE '%portfolio-published%'
    OR coalesce(policy.with_check, '') ILIKE '%portfolio-published%'
    OR policy.policyname IN (
      'portfolio_drafts_select_admin',
      'portfolio_drafts_insert_admin',
      'portfolio_drafts_update_admin',
      'portfolio_drafts_delete_admin',
      'portfolio_published_select_admin',
      'portfolio_published_insert_admin',
      'portfolio_published_update_admin',
      'portfolio_published_delete_admin'
    )
  )
ORDER BY policy.policyname;

-- 5. RLS de storage.objects.
-- Esperado: existe la relacion y row_level_security_enabled=true.
-- Si es false, detenerse: policies existentes no protegen la tabla mientras
-- RLS este deshabilitado.
SELECT
  namespace.nspname AS schema_name,
  relation.relname AS table_name,
  relation.relrowsecurity AS row_level_security_enabled,
  relation.relforcerowsecurity AS row_level_security_forced
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'storage'
  AND relation.relname = 'objects';

-- 6. Existencia e identidad de public.is_admin().
-- Esperado: admin_function no es NULL. prosecdef=true indica SECURITY DEFINER;
-- revisar con el equipo si el proyecto utiliza otro diseño de autorizacion.
SELECT
  to_regprocedure('public.is_admin()') AS admin_function,
  function_catalog.prosecdef AS security_definer,
  function_catalog.provolatile AS volatility,
  pg_get_userbyid(function_catalog.proowner) AS owner
FROM (SELECT to_regprocedure('public.is_admin()')::oid AS function_oid) AS target
LEFT JOIN pg_proc AS function_catalog
  ON function_catalog.oid = target.function_oid;

-- 7. Policies SELECT que permitirian listar objetos anon/public para esos
-- buckets. Esperado: cero filas. La lectura del bucket publico por URL directa
-- no requiere policy SELECT sobre storage.objects.
SELECT
  policy.policyname,
  policy.roles,
  policy.cmd,
  policy.qual AS using_expression
FROM pg_policies AS policy
WHERE policy.schemaname = 'storage'
  AND policy.tablename = 'objects'
  AND policy.cmd IN ('SELECT', 'ALL')
  AND policy.roles && ARRAY['public', 'anon']::name[]
  AND (
    coalesce(policy.qual, '') ILIKE '%portfolio-drafts%'
    OR coalesce(policy.qual, '') ILIKE '%portfolio-published%'
    OR coalesce(policy.qual, '') !~* $pattern$bucket_id[[:space:]]*=[[:space:]]*'[^']+'$pattern$
    OR coalesce(policy.qual, '') ~* $pattern$(^|[[:space:]])OR([[:space:]]|$)$pattern$
  )
ORDER BY policy.policyname;

-- 8. Policies INSERT/UPDATE/DELETE anon/public que podrian permitir escritura
-- publica en cualquier bucket o en los buckets del portafolio. Esperado: cero
-- filas. SELECT no autoriza mutaciones, y las politicas de setup asignan todas
-- las escrituras unicamente a authenticated + public.is_admin().
SELECT
  policy.policyname,
  policy.roles,
  policy.cmd,
  policy.qual AS using_expression,
  policy.with_check
FROM pg_policies AS policy
WHERE policy.schemaname = 'storage'
  AND policy.tablename = 'objects'
  AND policy.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND policy.roles && ARRAY['public', 'anon']::name[]
ORDER BY policy.policyname;

-- 9. Grants de tabla (metadata de privilegios, no lectura de objetos).
-- Esta consulta complementa RLS: los grants por si solos no revelan contenido,
-- pero deben revisarse junto con las policies anteriores.
SELECT
  role_name,
  has_table_privilege(role_name, 'storage.objects', 'SELECT') AS can_select_table,
  has_table_privilege(role_name, 'storage.objects', 'INSERT') AS can_insert_table,
  has_table_privilege(role_name, 'storage.objects', 'UPDATE') AS can_update_table,
  has_table_privilege(role_name, 'storage.objects', 'DELETE') AS can_delete_table
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name);

-- Criterios para detenerse y pedir revision:
-- - falta public.is_admin() o RLS de storage.objects esta deshabilitado;
-- - un bucket con id/nombre reservado existe con visibilidad, limite o MIME
--   distinto de la propuesta;
-- - hay policies existentes incompatibles, ALL, OR o filtros generales que
--   puedan alcanzar los buckets del portafolio;
-- - aparecen grants/policies anon/public que no se entienden o permiten
--   mutaciones/listado;
-- - no se puede distinguir la policy del blog confinada a article-images.
--
-- Todas las sentencias anteriores son SELECT. No ejecutar aqui el archivo de
-- configuracion portfolio-storage.sql hasta revisar los resultados.