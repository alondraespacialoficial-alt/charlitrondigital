-- ALIADOS CHARLITRON — Laboratorio: limpieza dirigida de objetos del blog (BORRADOR, SIN EJECUTAR)
-- Aplica SOLO a charlitron-aliados-test. NO ejecutar en el proyecto del blog (rvvqhpbtqgjpzflopflv),
-- en Eventos 360 ni en ningun otro. NO AUTORIZADO para ejecutarse; sin validar aun en PostgreSQL.
-- No es una migracion del repo; no moverlo a supabase/migrations/.
--
-- Origen del problema: se ejecuto supabase/migrations/0001_init.sql (Motor de Autoridad del blog) en el
-- laboratorio. Esta limpieza retira unicamente lo que ese archivo instala.
-- Reglas: sin DROP SCHEMA, sin CASCADE, sin tocar auth, storage (esquema), extensiones, permisos por
-- defecto, event triggers ni la funcion rls_auto_enable. Cada guarda ABORTA sin modificar nada.
--
-- LIMITE DE LA IDENTIFICACION: la base no conoce el nombre ni el Reference ID de su proyecto. Las guardas
-- (inventario exacto + UID fijados) reducen el riesgo, pero NO sustituyen el ritual humano:
--   1. Dashboard > Project Settings > General: nombre "charlitron-aliados-test" y su Reference ID.
--   2. Ese Reference ID es el de la URL del SQL Editor que se usa y es DISTINTO de rvvqhpbtqgjpzflopflv.
--   3. Una segunda persona lo confirma.
--
-- NOTA SOBRE EL SQL EDITOR: solo muestra el resultado de la ultima sentencia; ejecuta cada parte por separado.
-- Orden: PARTE 0 (identificar rls_auto_enable) -> PARTE 1 (verificacion previa, lectura)
--        -> PARTE 2 (limpieza, una transaccion) -> PARTE 4 (bucket, Dashboard) -> PARTE 3 (verificacion posterior, lectura).

-- ============================================================================
-- PARTE 0. Identificar la funcion public.rls_auto_enable (SOLO LECTURA)
-- CONFIRMADO en el laboratorio real: funcion SECURITY DEFINER propiedad de postgres, sin extension, con el
-- event trigger ensure_rls habilitado que activa RLS en las tablas nuevas de public. SE CONSERVAN ambos.
-- ============================================================================
SELECT 'funcion' AS tipo, s.nspname || '.' || p.proname AS nombre,
       'propietario=' || pg_get_userbyid(p.proowner) || ' | definer=' || p.prosecdef::text
       || ' | retorna=' || pg_get_function_result(p.oid)
       || ' | config=' || coalesce(p.proconfig::text, '-') || ' | acl=' || coalesce(p.proacl::text, '-') AS detalle
FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
WHERE p.proname = 'rls_auto_enable'
UNION ALL
SELECT 'definicion', p.proname::text, pg_get_functiondef(p.oid)
FROM pg_proc AS p WHERE p.proname = 'rls_auto_enable'
UNION ALL
SELECT 'comentario', p.proname::text, coalesce(obj_description(p.oid, 'pg_proc'), '(sin comentario)')
FROM pg_proc AS p WHERE p.proname = 'rls_auto_enable'
UNION ALL
SELECT 'extension', p.proname::text, coalesce(x.extname::text, '(no pertenece a ninguna extension)')
FROM pg_proc AS p
LEFT JOIN pg_depend AS d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
LEFT JOIN pg_extension AS x ON x.oid = d.refobjid
WHERE p.proname = 'rls_auto_enable'
UNION ALL
SELECT 'event trigger', e.evtname::text,
       'evento=' || e.evtevent || ' | funcion=' || e.evtfoid::regproc::text
       || ' | propietario=' || pg_get_userbyid(e.evtowner) || ' | habilitado=' || e.evtenabled::text
       || ' | tags=' || coalesce(e.evttags::text, '(todos)')
FROM pg_event_trigger AS e
UNION ALL
SELECT 'objeto que depende de ella', pg_describe_object(d.classid, d.objid, d.objsubid), d.deptype::text
FROM pg_depend AS d JOIN pg_proc AS p ON p.oid = d.refobjid AND d.refclassid = 'pg_proc'::regclass
WHERE p.proname = 'rls_auto_enable'
ORDER BY 1, 2;
-- Que mirar: propietario (supabase_admin/postgres), si hay un event trigger que la invoca, evento
-- (ddl_command_end con CREATE TABLE ...), su definicion y si menciona tablas del blog.
-- Si es de la plataforma, se CONSERVA y ademas explica por que las tablas nuevas ya salen con RLS.

-- ============================================================================
-- PARTE 1. Verificacion previa (SOLO LECTURA). Debe dar RESULTADO GLOBAL = PASA antes de la PARTE 2.
-- REEMPLAZADA por aliados-lab-cleanup-parte1-verificacion.sql (UID obtenidos de auth.users, sin pegar nada).
-- Pendiente de alinear con esa version: las guardas de la PARTE 2 y la PARTE 3 aun piden UID a mano.
-- ============================================================================
WITH pin AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS admin_uid,  -- UID de nadrian18@gmail.com
         '00000000-0000-0000-0000-000000000000'::uuid AS ally_uid    -- UID de integrandotugente@hotmail.com
),
tablas AS (
  SELECT c.oid, c.relname::text AS nombre
  FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public'
    AND c.relname = ANY (ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                               'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views'])
),
funcs AS (
  SELECT p.oid
  FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
  WHERE s.nspname = 'public'
    AND p.proname = ANY (ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at'])
),
conteo AS (
  SELECT t.nombre,
         (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.nombre), false, true, '')))[1]::text::int AS filas
  FROM tablas AS t
),
act AS (
  SELECT
    COALESCE((SELECT array_agg(c.relname::text)
              FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
              WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')), '{}') AS objetos,
    COALESCE((SELECT array_agg(p.proname::text)
              FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
              WHERE s.nspname = 'public'), '{}') AS funciones,
    COALESCE((SELECT array_agg(c.relname::text || '.' || t.tgname::text)
              FROM pg_trigger AS t JOIN pg_class AS c ON c.oid = t.tgrelid
              JOIN pg_namespace AS s ON s.oid = c.relnamespace
              WHERE s.nspname = 'public' AND NOT t.tgisinternal), '{}') AS triggers,
    COALESCE((SELECT array_agg(tablename::text || '.' || policyname::text)
              FROM pg_policies WHERE schemaname = 'public'), '{}') AS pol_public,
    COALESCE((SELECT array_agg(policyname::text)
              FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'), '{}') AS pol_storage,
    COALESCE((SELECT array_agg(id::text) FROM storage.buckets), '{}') AS buckets
),
checks (orden, verificacion, ok, detalle) AS (
  SELECT 1, 'UID fijados (no son ceros y son distintos)',
         (p.admin_uid <> '00000000-0000-0000-0000-000000000000'::uuid
          AND p.ally_uid <> '00000000-0000-0000-0000-000000000000'::uuid
          AND p.admin_uid <> p.ally_uid), ''::text
  FROM pin AS p
  UNION ALL
  SELECT 2, 'auth.users: exactamente los 2 usuarios de prueba (UID y correo)',
         (SELECT count(*) FROM auth.users) = 2
         AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.admin_uid AND lower(u.email) = 'nadrian18@gmail.com')
         AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.ally_uid AND lower(u.email) = 'integrandotugente@hotmail.com'),
         ''
  UNION ALL
  SELECT 3, 'public contiene exactamente las 9 tablas de 0001_init y nada mas',
         a.objetos @> ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                            'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views']
         AND a.objetos <@ ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                                'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views'],
         array_to_string(a.objetos, ', ')
  FROM act AS a
  UNION ALL
  SELECT 4, 'public contiene exactamente las 4 funciones de 0001_init mas rls_auto_enable',
         a.funciones @> ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at', 'rls_auto_enable']
         AND a.funciones <@ ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at', 'rls_auto_enable'],
         array_to_string(a.funciones, ', ')
  FROM act AS a
  UNION ALL
  SELECT 5, 'Triggers de public: exactamente los 6 de 0001_init',
         a.triggers @> ARRAY['articles.articles_set_updated_at', 'articles.articles_set_published_at_insert',
                             'articles.articles_set_published_at_update', 'articles.articles_revision_after_update',
                             'articles.articles_revision_after_delete', 'content_ideas.ideas_set_updated_at']
         AND a.triggers <@ ARRAY['articles.articles_set_updated_at', 'articles.articles_set_published_at_insert',
                                 'articles.articles_set_published_at_update', 'articles.articles_revision_after_update',
                                 'articles.articles_revision_after_delete', 'content_ideas.ideas_set_updated_at'],
         array_to_string(a.triggers, ', ')
  FROM act AS a
  UNION ALL
  SELECT 6, 'Politicas de public: exactamente las 24 de 0001_init (version actual, sin articles_admin_delete)',
         a.pol_public @> ARRAY[
           'admin_users.admin_users_select_own',
           'categories.categories_public_read', 'categories.categories_admin_insert',
           'categories.categories_admin_update', 'categories.categories_admin_delete',
           'articles.articles_public_read_published', 'articles.articles_admin_read_all',
           'articles.articles_admin_insert', 'articles.articles_admin_update',
           'article_revisions.revisions_admin_select',
           'content_ideas.ideas_admin_select', 'content_ideas.ideas_admin_insert',
           'content_ideas.ideas_admin_update', 'content_ideas.ideas_admin_delete',
           'article_sources.sources_public_read', 'article_sources.sources_admin_read_all',
           'article_sources.sources_admin_insert', 'article_sources.sources_admin_update',
           'article_sources.sources_admin_delete',
           'admin_audit_log.audit_admin_insert', 'admin_audit_log.audit_admin_select',
           'feature_flags.flags_admin_select', 'feature_flags.flags_admin_update',
           'page_views.page_views_admin_select']
         AND a.pol_public <@ ARRAY[
           'admin_users.admin_users_select_own',
           'categories.categories_public_read', 'categories.categories_admin_insert',
           'categories.categories_admin_update', 'categories.categories_admin_delete',
           'articles.articles_public_read_published', 'articles.articles_admin_read_all',
           'articles.articles_admin_insert', 'articles.articles_admin_update',
           'article_revisions.revisions_admin_select',
           'content_ideas.ideas_admin_select', 'content_ideas.ideas_admin_insert',
           'content_ideas.ideas_admin_update', 'content_ideas.ideas_admin_delete',
           'article_sources.sources_public_read', 'article_sources.sources_admin_read_all',
           'article_sources.sources_admin_insert', 'article_sources.sources_admin_update',
           'article_sources.sources_admin_delete',
           'admin_audit_log.audit_admin_insert', 'admin_audit_log.audit_admin_select',
           'feature_flags.flags_admin_select', 'feature_flags.flags_admin_update',
           'page_views.page_views_admin_select'],
         cardinality(a.pol_public)::text || ' politicas'
  FROM act AS a
  UNION ALL
  SELECT 7, 'storage.objects: exactamente las 3 politicas de article-images',
         a.pol_storage @> ARRAY['article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete']
         AND a.pol_storage <@ ARRAY['article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete'],
         array_to_string(a.pol_storage, ', ')
  FROM act AS a
  UNION ALL
  SELECT 8, 'Las 8 tablas del blog (todas menos feature_flags) tienen 0 filas',
         (SELECT count(*) FROM conteo WHERE nombre <> 'feature_flags') = 8
         AND NOT EXISTS (SELECT 1 FROM conteo WHERE nombre <> 'feature_flags' AND filas <> 0),
         (SELECT string_agg(nombre || '=' || filas::text, ', ' ORDER BY nombre) FROM conteo)
  UNION ALL
  SELECT 9, 'feature_flags: 3 filas originales, todas desactivadas',
         (SELECT count(*) FROM public.feature_flags) = 3
         AND NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE enabled)
         AND (SELECT array_agg(key::text) FROM public.feature_flags) @> ARRAY['ai_draft_assist', 'auto_publish', 'auto_social_share'],
         ''
  UNION ALL
  SELECT 10, 'Storage: solo el bucket article-images y 0 objetos en todo storage.objects',
         a.buckets @> ARRAY['article-images'] AND a.buckets <@ ARRAY['article-images']
         AND (SELECT count(*) FROM storage.objects) = 0,
         array_to_string(a.buckets, ', ')
  FROM act AS a
  UNION ALL
  SELECT 11, 'Ninguna FK externa apunta a las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_constraint AS k
                     WHERE k.contype = 'f' AND k.confrelid IN (SELECT oid FROM tablas)
                       AND k.conrelid NOT IN (SELECT oid FROM tablas)), ''
  UNION ALL
  SELECT 12, 'Ninguna vista ni regla externa depende de las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d
                     JOIN pg_rewrite AS r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                     WHERE d.refobjid IN (SELECT oid FROM tablas) AND r.ev_class NOT IN (SELECT oid FROM tablas)), ''
  UNION ALL
  SELECT 13, 'Ninguna publicacion incluye las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_publication_rel AS pr WHERE pr.prrelid IN (SELECT oid FROM tablas)), ''
  UNION ALL
  SELECT 14, 'Ninguna tabla ni funcion objetivo pertenece a una extension',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d
                     WHERE d.deptype = 'e'
                       AND ((d.classid = 'pg_class'::regclass AND d.objid IN (SELECT oid FROM tablas))
                         OR (d.classid = 'pg_proc'::regclass AND d.objid IN (SELECT oid FROM funcs)))), ''
  UNION ALL
  SELECT 15, 'Ningun event trigger usa las funciones objetivo',
         NOT EXISTS (SELECT 1 FROM pg_event_trigger AS e WHERE e.evtfoid IN (SELECT oid FROM funcs)), ''
  UNION ALL
  SELECT 16, 'Ninguna politica ni trigger ajeno depende de las funciones objetivo',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d JOIN pg_policy AS pl ON pl.oid = d.objid AND d.classid = 'pg_policy'::regclass
                     WHERE d.refclassid = 'pg_proc'::regclass AND d.refobjid IN (SELECT oid FROM funcs)
                       AND pl.polrelid NOT IN (SELECT oid FROM tablas)
                       AND NOT (pl.polrelid = 'storage.objects'::regclass
                                AND pl.polname IN ('article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete')))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger AS t
                         WHERE t.tgfoid IN (SELECT oid FROM funcs) AND NOT t.tgisinternal AND t.tgrelid NOT IN (SELECT oid FROM tablas)),
         ''
  UNION ALL
  SELECT 17, 'rls_auto_enable: SECURITY DEFINER, propiedad de postgres, tipo event_trigger y fuera de extensiones',
         EXISTS (SELECT 1 FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'
                   AND p.prosecdef AND pg_get_userbyid(p.proowner) = 'postgres'
                   AND p.prorettype = 'event_trigger'::regtype
                   AND NOT EXISTS (SELECT 1 FROM pg_depend AS d
                                   WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')), ''
  UNION ALL
  SELECT 18, 'Event trigger ensure_rls: habilitado y ejecuta public.rls_auto_enable',
         EXISTS (SELECT 1 FROM pg_event_trigger AS e
                 WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
                   AND e.evtfoid IN (SELECT p.oid FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                                     WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable')), ''
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion, detalle FROM checks
UNION ALL
SELECT 90 + (row_number() OVER (ORDER BY e.evtname))::int, 'INFO', 'event trigger (se conserva): ' || e.evtname,
       e.evtevent || ' -> ' || e.evtfoid::regproc::text || ' | habilitado=' || e.evtenabled::text
FROM pg_event_trigger AS e
UNION ALL
SELECT 97, 'INFO', 'huella de rls_auto_enable (debe ser igual en la PARTE 3)',
       coalesce((SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'), '(no existe)')
UNION ALL
SELECT 98, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL', '' FROM checks
UNION ALL
SELECT 99, 'AVISO', 'PASA no prueba que este sea charlitron-aliados-test: falta el ritual del Dashboard (Reference ID).', ''
ORDER BY orden;

-- ============================================================================
-- PARTE 2. Limpieza (UNA transaccion). NO EJECUTAR sin aprobacion de Alondra y PARTE 1 en PASA.
-- REEMPLAZADA por aliados-lab-cleanup-parte2-limpieza.sql (UID automaticos, una sola sentencia atomica).
-- Repite las guardas de la PARTE 1 (mismos UID) y aborta sin cambios si alguna falla. Sin CASCADE.
-- Orden: politicas de storage -> tablas (de hojas a raiz) -> funciones. Las funciones van al final
-- porque las politicas y triggers dependen de ellas.
-- ============================================================================
BEGIN;

SELECT pg_advisory_xact_lock(hashtext('aliados-lab-cleanup'));

DO $cleanup$
DECLARE
  r record;
  fallos text := '';
BEGIN
  FOR r IN
    WITH pin AS (
      SELECT '00000000-0000-0000-0000-000000000000'::uuid AS admin_uid,  -- UID de nadrian18@gmail.com
             '00000000-0000-0000-0000-000000000000'::uuid AS ally_uid    -- UID de integrandotugente@hotmail.com
    ),
    tablas AS (
      SELECT c.oid, c.relname::text AS nombre
      FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
      WHERE s.nspname = 'public'
        AND c.relname = ANY (ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                                   'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views'])
    ),
    funcs AS (
      SELECT p.oid
      FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
      WHERE s.nspname = 'public'
        AND p.proname = ANY (ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at'])
    ),
    conteo AS (
      SELECT t.nombre,
             (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.nombre), false, true, '')))[1]::text::int AS filas
      FROM tablas AS t
    ),
    act AS (
      SELECT
        COALESCE((SELECT array_agg(c.relname::text)
                  FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
                  WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')), '{}') AS objetos,
        COALESCE((SELECT array_agg(p.proname::text)
                  FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                  WHERE s.nspname = 'public'), '{}') AS funciones,
        COALESCE((SELECT array_agg(c.relname::text || '.' || t.tgname::text)
                  FROM pg_trigger AS t JOIN pg_class AS c ON c.oid = t.tgrelid
                  JOIN pg_namespace AS s ON s.oid = c.relnamespace
                  WHERE s.nspname = 'public' AND NOT t.tgisinternal), '{}') AS triggers,
        COALESCE((SELECT array_agg(tablename::text || '.' || policyname::text)
                  FROM pg_policies WHERE schemaname = 'public'), '{}') AS pol_public,
        COALESCE((SELECT array_agg(policyname::text)
                  FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'), '{}') AS pol_storage,
        COALESCE((SELECT array_agg(id::text) FROM storage.buckets), '{}') AS buckets
    ),
    checks (orden, verificacion, ok, detalle) AS (
      SELECT 1, 'UID fijados (no son ceros y son distintos)',
             (p.admin_uid <> '00000000-0000-0000-0000-000000000000'::uuid
              AND p.ally_uid <> '00000000-0000-0000-0000-000000000000'::uuid
              AND p.admin_uid <> p.ally_uid), ''::text
      FROM pin AS p
      UNION ALL
      SELECT 2, 'auth.users: exactamente los 2 usuarios de prueba (UID y correo)',
             (SELECT count(*) FROM auth.users) = 2
             AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.admin_uid AND lower(u.email) = 'nadrian18@gmail.com')
             AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.ally_uid AND lower(u.email) = 'integrandotugente@hotmail.com'),
             ''
      UNION ALL
      SELECT 3, 'public contiene exactamente las 9 tablas de 0001_init y nada mas',
             a.objetos @> ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                                'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views']
             AND a.objetos <@ ARRAY['admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                                    'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views'],
             array_to_string(a.objetos, ', ')
      FROM act AS a
      UNION ALL
      SELECT 4, 'public contiene exactamente las 4 funciones de 0001_init mas rls_auto_enable',
             a.funciones @> ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at', 'rls_auto_enable']
             AND a.funciones <@ ARRAY['is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at', 'rls_auto_enable'],
             array_to_string(a.funciones, ', ')
      FROM act AS a
      UNION ALL
      SELECT 5, 'Triggers de public: exactamente los 6 de 0001_init',
             a.triggers @> ARRAY['articles.articles_set_updated_at', 'articles.articles_set_published_at_insert',
                                 'articles.articles_set_published_at_update', 'articles.articles_revision_after_update',
                                 'articles.articles_revision_after_delete', 'content_ideas.ideas_set_updated_at']
             AND a.triggers <@ ARRAY['articles.articles_set_updated_at', 'articles.articles_set_published_at_insert',
                                     'articles.articles_set_published_at_update', 'articles.articles_revision_after_update',
                                     'articles.articles_revision_after_delete', 'content_ideas.ideas_set_updated_at'],
             array_to_string(a.triggers, ', ')
      FROM act AS a
      UNION ALL
      SELECT 6, 'Politicas de public: exactamente las 24 de 0001_init (version actual, sin articles_admin_delete)',
             a.pol_public @> ARRAY[
               'admin_users.admin_users_select_own',
               'categories.categories_public_read', 'categories.categories_admin_insert',
               'categories.categories_admin_update', 'categories.categories_admin_delete',
               'articles.articles_public_read_published', 'articles.articles_admin_read_all',
               'articles.articles_admin_insert', 'articles.articles_admin_update',
               'article_revisions.revisions_admin_select',
               'content_ideas.ideas_admin_select', 'content_ideas.ideas_admin_insert',
               'content_ideas.ideas_admin_update', 'content_ideas.ideas_admin_delete',
               'article_sources.sources_public_read', 'article_sources.sources_admin_read_all',
               'article_sources.sources_admin_insert', 'article_sources.sources_admin_update',
               'article_sources.sources_admin_delete',
               'admin_audit_log.audit_admin_insert', 'admin_audit_log.audit_admin_select',
               'feature_flags.flags_admin_select', 'feature_flags.flags_admin_update',
               'page_views.page_views_admin_select']
             AND a.pol_public <@ ARRAY[
               'admin_users.admin_users_select_own',
               'categories.categories_public_read', 'categories.categories_admin_insert',
               'categories.categories_admin_update', 'categories.categories_admin_delete',
               'articles.articles_public_read_published', 'articles.articles_admin_read_all',
               'articles.articles_admin_insert', 'articles.articles_admin_update',
               'article_revisions.revisions_admin_select',
               'content_ideas.ideas_admin_select', 'content_ideas.ideas_admin_insert',
               'content_ideas.ideas_admin_update', 'content_ideas.ideas_admin_delete',
               'article_sources.sources_public_read', 'article_sources.sources_admin_read_all',
               'article_sources.sources_admin_insert', 'article_sources.sources_admin_update',
               'article_sources.sources_admin_delete',
               'admin_audit_log.audit_admin_insert', 'admin_audit_log.audit_admin_select',
               'feature_flags.flags_admin_select', 'feature_flags.flags_admin_update',
               'page_views.page_views_admin_select'],
             cardinality(a.pol_public)::text || ' politicas'
      FROM act AS a
      UNION ALL
      SELECT 7, 'storage.objects: exactamente las 3 politicas de article-images',
             a.pol_storage @> ARRAY['article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete']
             AND a.pol_storage <@ ARRAY['article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete'],
             array_to_string(a.pol_storage, ', ')
      FROM act AS a
      UNION ALL
      SELECT 8, 'Las 8 tablas del blog (todas menos feature_flags) tienen 0 filas',
             (SELECT count(*) FROM conteo WHERE nombre <> 'feature_flags') = 8
             AND NOT EXISTS (SELECT 1 FROM conteo WHERE nombre <> 'feature_flags' AND filas <> 0),
             (SELECT string_agg(nombre || '=' || filas::text, ', ' ORDER BY nombre) FROM conteo)
      UNION ALL
      SELECT 9, 'feature_flags: 3 filas originales, todas desactivadas',
             (SELECT count(*) FROM public.feature_flags) = 3
             AND NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE enabled)
             AND (SELECT array_agg(key::text) FROM public.feature_flags) @> ARRAY['ai_draft_assist', 'auto_publish', 'auto_social_share'],
             ''
      UNION ALL
      SELECT 10, 'Storage: solo el bucket article-images y 0 objetos en todo storage.objects',
             a.buckets @> ARRAY['article-images'] AND a.buckets <@ ARRAY['article-images']
             AND (SELECT count(*) FROM storage.objects) = 0,
             array_to_string(a.buckets, ', ')
      FROM act AS a
      UNION ALL
      SELECT 11, 'Ninguna FK externa apunta a las tablas objetivo',
             NOT EXISTS (SELECT 1 FROM pg_constraint AS k
                         WHERE k.contype = 'f' AND k.confrelid IN (SELECT oid FROM tablas)
                           AND k.conrelid NOT IN (SELECT oid FROM tablas)), ''
      UNION ALL
      SELECT 12, 'Ninguna vista ni regla externa depende de las tablas objetivo',
             NOT EXISTS (SELECT 1 FROM pg_depend AS d
                         JOIN pg_rewrite AS rw ON rw.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                         WHERE d.refobjid IN (SELECT oid FROM tablas) AND rw.ev_class NOT IN (SELECT oid FROM tablas)), ''
      UNION ALL
      SELECT 13, 'Ninguna publicacion incluye las tablas objetivo',
             NOT EXISTS (SELECT 1 FROM pg_publication_rel AS pr WHERE pr.prrelid IN (SELECT oid FROM tablas)), ''
      UNION ALL
      SELECT 14, 'Ninguna tabla ni funcion objetivo pertenece a una extension',
             NOT EXISTS (SELECT 1 FROM pg_depend AS d
                         WHERE d.deptype = 'e'
                           AND ((d.classid = 'pg_class'::regclass AND d.objid IN (SELECT oid FROM tablas))
                             OR (d.classid = 'pg_proc'::regclass AND d.objid IN (SELECT oid FROM funcs)))), ''
      UNION ALL
      SELECT 15, 'Ningun event trigger usa las funciones objetivo',
             NOT EXISTS (SELECT 1 FROM pg_event_trigger AS e WHERE e.evtfoid IN (SELECT oid FROM funcs)), ''
      UNION ALL
      SELECT 16, 'Ninguna politica ni trigger ajeno depende de las funciones objetivo',
             NOT EXISTS (SELECT 1 FROM pg_depend AS d JOIN pg_policy AS pl ON pl.oid = d.objid AND d.classid = 'pg_policy'::regclass
                         WHERE d.refclassid = 'pg_proc'::regclass AND d.refobjid IN (SELECT oid FROM funcs)
                           AND pl.polrelid NOT IN (SELECT oid FROM tablas)
                           AND NOT (pl.polrelid = 'storage.objects'::regclass
                                    AND pl.polname IN ('article_images_admin_insert', 'article_images_admin_update', 'article_images_admin_delete')))
             AND NOT EXISTS (SELECT 1 FROM pg_trigger AS t
                             WHERE t.tgfoid IN (SELECT oid FROM funcs) AND NOT t.tgisinternal AND t.tgrelid NOT IN (SELECT oid FROM tablas)),
             ''
      UNION ALL
      SELECT 17, 'rls_auto_enable: SECURITY DEFINER, propiedad de postgres, tipo event_trigger y fuera de extensiones',
             EXISTS (SELECT 1 FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                     WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'
                       AND p.prosecdef AND pg_get_userbyid(p.proowner) = 'postgres'
                       AND p.prorettype = 'event_trigger'::regtype
                       AND NOT EXISTS (SELECT 1 FROM pg_depend AS d
                                       WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')), ''
      UNION ALL
      SELECT 18, 'Event trigger ensure_rls: habilitado y ejecuta public.rls_auto_enable',
             EXISTS (SELECT 1 FROM pg_event_trigger AS e
                     WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
                       AND e.evtfoid IN (SELECT p.oid FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                                         WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable')), ''
    )
    SELECT orden, verificacion, ok, detalle FROM checks ORDER BY orden
  LOOP
    IF r.ok IS NOT TRUE THEN
      fallos := fallos || E'\n - [' || r.orden || '] ' || r.verificacion || ' ' || coalesce(r.detalle, '');
    END IF;
  END LOOP;

  IF fallos <> '' THEN
    RAISE EXCEPTION E'Guardas fallidas; no se modifico nada:%', fallos;
  END IF;

  -- Retiro dirigido (sin CASCADE).
  DROP POLICY article_images_admin_insert ON storage.objects;
  DROP POLICY article_images_admin_update ON storage.objects;
  DROP POLICY article_images_admin_delete ON storage.objects;

  DROP TABLE public.article_sources;
  DROP TABLE public.content_ideas;
  DROP TABLE public.article_revisions;
  DROP TABLE public.admin_audit_log;
  DROP TABLE public.feature_flags;
  DROP TABLE public.page_views;
  DROP TABLE public.articles;
  DROP TABLE public.categories;
  DROP TABLE public.admin_users;

  DROP FUNCTION public.save_article_revision();
  DROP FUNCTION public.set_published_at();
  DROP FUNCTION public.set_updated_at();
  DROP FUNCTION public.is_admin();

  -- Comprobacion final dentro de la transaccion: si no cuadra, todo se revierte.
  IF EXISTS (SELECT 1 FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
             WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f'))
     OR (SELECT COALESCE(array_agg(p.proname::text), '{}') FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
         WHERE s.nspname = 'public') IS DISTINCT FROM ARRAY['rls_auto_enable']::text[]
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname IN ('public', 'storage'))
     OR (SELECT count(*) FROM auth.users) <> 2 THEN
    RAISE EXCEPTION 'Estado final inesperado; se revierte todo.';
  END IF;
END
$cleanup$;

COMMIT;

-- ============================================================================
-- PARTE 4. Bucket article-images (manual, por el Dashboard; NO por SQL)
-- Supabase suele bloquear el borrado directo en storage.buckets/objects por SQL; se usa la interfaz.
-- Dashboard > Storage > article-images: comprobar que esta vacio (0 objetos) y eliminarlo.
-- Si no estuviera vacio, detenerse y reportarlo.
-- ============================================================================

-- ============================================================================
-- PARTE 3. Verificacion posterior (SOLO LECTURA). Ejecutar despues de la PARTE 2 y de la PARTE 4.
-- Reemplaza los dos UUID de ceros por los mismos UID.
-- ============================================================================
WITH pin AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS admin_uid,  -- UID de nadrian18@gmail.com
         '00000000-0000-0000-0000-000000000000'::uuid AS ally_uid    -- UID de integrandotugente@hotmail.com
),
checks (orden, verificacion, ok, detalle) AS (
  SELECT 1, 'public no contiene tablas ni vistas',
         NOT EXISTS (SELECT 1 FROM pg_class AS c JOIN pg_namespace AS s ON s.oid = c.relnamespace
                     WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')), ''::text
  UNION ALL
  SELECT 2, 'public conserva solo la funcion rls_auto_enable',
         COALESCE((SELECT array_agg(p.proname::text) FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                   WHERE s.nspname = 'public'), '{}') = ARRAY['rls_auto_enable']::text[], ''
  UNION ALL
  SELECT 3, 'Sin politicas en public ni en storage.objects',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname IN ('public', 'storage')), ''
  UNION ALL
  SELECT 4, 'auth.users intacto: los 2 usuarios con su UID y correo',
         (SELECT count(*) FROM auth.users) = 2
         AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.admin_uid AND lower(u.email) = 'nadrian18@gmail.com')
         AND EXISTS (SELECT 1 FROM auth.users AS u, pin AS p WHERE u.id = p.ally_uid AND lower(u.email) = 'integrandotugente@hotmail.com'),
         ''
  UNION ALL
  SELECT 5, 'UID fijados validos (no ceros y distintos)',
         (SELECT p.admin_uid <> '00000000-0000-0000-0000-000000000000'::uuid
                 AND p.ally_uid <> '00000000-0000-0000-0000-000000000000'::uuid
                 AND p.admin_uid <> p.ally_uid FROM pin AS p), ''
  UNION ALL
  SELECT 7, 'rls_auto_enable y el event trigger ensure_rls siguen intactos y habilitados',
         EXISTS (SELECT 1 FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'
                   AND p.prosecdef AND pg_get_userbyid(p.proowner) = 'postgres')
         AND EXISTS (SELECT 1 FROM pg_event_trigger AS e WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'), ''
),
bucket AS (
  SELECT count(*) AS n FROM storage.buckets
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion, detalle FROM checks
UNION ALL
SELECT 6, CASE WHEN n = 0 THEN 'PASA' ELSE 'PENDIENTE' END, 'Bucket eliminado desde el Dashboard (PARTE 4)', n::text || ' buckets' FROM bucket
UNION ALL
SELECT 90 + (row_number() OVER (ORDER BY e.evtname))::int, 'INFO', 'event trigger (debe ser igual que en la PARTE 1): ' || e.evtname,
       e.evtevent || ' -> ' || e.evtfoid::regproc::text || ' | habilitado=' || e.evtenabled::text
FROM pg_event_trigger AS e
UNION ALL
SELECT 97, 'INFO', 'huella de rls_auto_enable (debe ser igual a la de la PARTE 1)',
       coalesce((SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc AS p JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'), '(no existe)')
UNION ALL
SELECT 98, CASE WHEN (SELECT bool_and(ok) FROM checks) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL (base de datos)', ''
UNION ALL
SELECT 99, 'AVISO', 'Con todo en PASA y el bucket eliminado, se puede ejecutar el Paso 0 de Aliados.', ''
ORDER BY orden;
