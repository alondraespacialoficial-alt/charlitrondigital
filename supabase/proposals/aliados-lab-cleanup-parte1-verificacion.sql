WITH usuarios AS (
  SELECT u.id, lower(u.email) AS correo
  FROM auth.users AS u
),
esperados (rol, correo) AS (
  VALUES ('administrador', 'nadrian18@gmail.com'),
         ('aliado', 'integrandotugente@hotmail.com')
),
pin AS (
  SELECT e.rol, e.correo,
         (SELECT count(*) FROM usuarios AS u WHERE u.correo = e.correo) AS coincidencias,
         (SELECT u.id FROM usuarios AS u WHERE u.correo = e.correo ORDER BY u.id LIMIT 1) AS uid
  FROM esperados AS e
),
tablas AS (
  SELECT c.oid, c.relname::text AS nombre
  FROM pg_class AS c
  JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public'
    AND c.relname IN ('admin_audit_log', 'admin_users', 'article_revisions', 'article_sources',
                      'articles', 'categories', 'content_ideas', 'feature_flags', 'page_views')
),
funcs AS (
  SELECT p.oid
  FROM pg_proc AS p
  JOIN pg_namespace AS s ON s.oid = p.pronamespace
  WHERE s.nspname = 'public'
    AND p.proname IN ('is_admin', 'save_article_revision', 'set_published_at', 'set_updated_at')
),
conteo AS (
  SELECT t.nombre,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from public.%I', t.nombre), false, true, '')))[1]::text::int AS filas
  FROM tablas AS t
),
ff AS (
  SELECT t.nombre,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from public.%I where enabled', t.nombre),
                             false, true, '')))[1]::text::int AS activas,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from public.%I where key = any (%L::text[])',
                                    t.nombre, '{ai_draft_assist,auto_publish,auto_social_share}'),
                             false, true, '')))[1]::text::int AS claves_ok
  FROM tablas AS t
  WHERE t.nombre = 'feature_flags'
),
esperado (tipo, nombre) AS (
  VALUES
    ('tabla', 'admin_audit_log'), ('tabla', 'admin_users'), ('tabla', 'article_revisions'),
    ('tabla', 'article_sources'), ('tabla', 'articles'), ('tabla', 'categories'),
    ('tabla', 'content_ideas'), ('tabla', 'feature_flags'), ('tabla', 'page_views'),
    ('funcion', 'is_admin'), ('funcion', 'save_article_revision'), ('funcion', 'set_published_at'),
    ('funcion', 'set_updated_at'), ('funcion', 'rls_auto_enable'),
    ('trigger', 'articles.articles_set_updated_at'),
    ('trigger', 'articles.articles_set_published_at_insert'),
    ('trigger', 'articles.articles_set_published_at_update'),
    ('trigger', 'articles.articles_revision_after_update'),
    ('trigger', 'articles.articles_revision_after_delete'),
    ('trigger', 'content_ideas.ideas_set_updated_at'),
    ('politica', 'admin_users.admin_users_select_own'),
    ('politica', 'categories.categories_public_read'),
    ('politica', 'categories.categories_admin_insert'),
    ('politica', 'categories.categories_admin_update'),
    ('politica', 'categories.categories_admin_delete'),
    ('politica', 'articles.articles_public_read_published'),
    ('politica', 'articles.articles_admin_read_all'),
    ('politica', 'articles.articles_admin_insert'),
    ('politica', 'articles.articles_admin_update'),
    ('politica', 'article_revisions.revisions_admin_select'),
    ('politica', 'content_ideas.ideas_admin_select'),
    ('politica', 'content_ideas.ideas_admin_insert'),
    ('politica', 'content_ideas.ideas_admin_update'),
    ('politica', 'content_ideas.ideas_admin_delete'),
    ('politica', 'article_sources.sources_public_read'),
    ('politica', 'article_sources.sources_admin_read_all'),
    ('politica', 'article_sources.sources_admin_insert'),
    ('politica', 'article_sources.sources_admin_update'),
    ('politica', 'article_sources.sources_admin_delete'),
    ('politica', 'admin_audit_log.audit_admin_insert'),
    ('politica', 'admin_audit_log.audit_admin_select'),
    ('politica', 'feature_flags.flags_admin_select'),
    ('politica', 'feature_flags.flags_admin_update'),
    ('politica', 'page_views.page_views_admin_select'),
    ('politica_storage', 'article_images_admin_insert'),
    ('politica_storage', 'article_images_admin_update'),
    ('politica_storage', 'article_images_admin_delete'),
    ('bucket', 'article-images')
),
actual (tipo, nombre) AS (
  SELECT 'tabla', c.relname::text
  FROM pg_class AS c
  JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  UNION ALL
  SELECT 'funcion', p.proname::text
  FROM pg_proc AS p
  JOIN pg_namespace AS s ON s.oid = p.pronamespace
  WHERE s.nspname = 'public'
  UNION ALL
  SELECT 'trigger', c.relname::text || '.' || t.tgname::text
  FROM pg_trigger AS t
  JOIN pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_namespace AS s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND NOT t.tgisinternal
  UNION ALL
  SELECT 'politica', pol.tablename::text || '.' || pol.policyname::text
  FROM pg_policies AS pol
  WHERE pol.schemaname = 'public'
  UNION ALL
  SELECT 'politica_storage', pol.policyname::text
  FROM pg_policies AS pol
  WHERE pol.schemaname = 'storage' AND pol.tablename = 'objects'
  UNION ALL
  SELECT 'bucket', b.id::text
  FROM storage.buckets AS b
),
diferencias AS (
  SELECT f.tipo, f.nombre, 'falta' AS estado
  FROM (SELECT tipo, nombre FROM esperado EXCEPT SELECT tipo, nombre FROM actual) AS f
  UNION ALL
  SELECT s.tipo, s.nombre, 'sobra' AS estado
  FROM (SELECT tipo, nombre FROM actual EXCEPT SELECT tipo, nombre FROM esperado) AS s
),
checks (orden, verificacion, ok, detalle) AS (
  SELECT 1, 'Los 2 correos esperados existen una sola vez en auth.users (UID obtenido automaticamente)',
         (SELECT count(*) FROM pin WHERE coincidencias = 1) = 2
         AND (SELECT count(DISTINCT uid) FROM pin) = 2,
         ''::text
  UNION ALL
  SELECT 2, 'auth.users contiene exactamente esos 2 usuarios y ningun otro',
         (SELECT count(*) FROM usuarios) = 2
         AND NOT EXISTS (SELECT 1 FROM usuarios AS u
                         WHERE u.correo IS NULL OR u.correo NOT IN (SELECT correo FROM esperados)),
         (SELECT count(*) FROM usuarios)::text || ' usuarios'
  UNION ALL
  SELECT 3, 'public contiene exactamente las 9 tablas de 0001_init y nada mas',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'tabla'),
         coalesce((SELECT string_agg(estado || ' ' || nombre, ', ' ORDER BY nombre)
                   FROM diferencias WHERE tipo = 'tabla'), '')
  UNION ALL
  SELECT 4, 'public contiene exactamente las 4 funciones de 0001_init mas rls_auto_enable',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'funcion'),
         coalesce((SELECT string_agg(estado || ' ' || nombre, ', ' ORDER BY nombre)
                   FROM diferencias WHERE tipo = 'funcion'), '')
  UNION ALL
  SELECT 5, 'Triggers de public: exactamente los 6 de 0001_init',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'trigger'),
         coalesce((SELECT string_agg(estado || ' ' || nombre, ', ' ORDER BY nombre)
                   FROM diferencias WHERE tipo = 'trigger'), '')
  UNION ALL
  SELECT 6, 'Politicas de public: exactamente las 24 de 0001_init',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'politica'),
         coalesce((SELECT string_agg(estado || ' ' || nombre, ', ' ORDER BY nombre)
                   FROM diferencias WHERE tipo = 'politica'), '')
  UNION ALL
  SELECT 7, 'storage.objects: exactamente las 3 politicas de article-images',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'politica_storage'),
         coalesce((SELECT string_agg(estado || ' ' || nombre, ', ' ORDER BY nombre)
                   FROM diferencias WHERE tipo = 'politica_storage'), '')
  UNION ALL
  SELECT 8, 'Las 8 tablas del blog (todas menos feature_flags) tienen 0 filas',
         (SELECT count(*) FROM conteo WHERE nombre != 'feature_flags') = 8
         AND NOT EXISTS (SELECT 1 FROM conteo WHERE nombre != 'feature_flags' AND filas != 0),
         coalesce((SELECT string_agg(nombre || '=' || filas::text, ', ' ORDER BY nombre) FROM conteo), '')
  UNION ALL
  SELECT 9, 'feature_flags: 3 filas originales, todas desactivadas',
         EXISTS (SELECT 1 FROM conteo AS c JOIN ff ON ff.nombre = c.nombre
                 WHERE c.filas = 3 AND ff.activas = 0 AND ff.claves_ok = 3),
         ''
  UNION ALL
  SELECT 10, 'Storage: solo el bucket article-images y 0 objetos en todo storage.objects',
         NOT EXISTS (SELECT 1 FROM diferencias WHERE tipo = 'bucket')
         AND (SELECT count(*) FROM storage.objects) = 0,
         (SELECT count(*) FROM storage.objects)::text || ' objetos'
  UNION ALL
  SELECT 11, 'Ninguna FK externa apunta a las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_constraint AS k
                     WHERE k.contype = 'f'
                       AND k.confrelid IN (SELECT oid FROM tablas)
                       AND k.conrelid NOT IN (SELECT oid FROM tablas)),
         ''
  UNION ALL
  SELECT 12, 'Ninguna vista ni regla externa depende de las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d
                     JOIN pg_rewrite AS r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                     WHERE d.refobjid IN (SELECT oid FROM tablas)
                       AND r.ev_class NOT IN (SELECT oid FROM tablas)),
         ''
  UNION ALL
  SELECT 13, 'Ninguna publicacion incluye las tablas objetivo',
         NOT EXISTS (SELECT 1 FROM pg_publication_rel AS pr WHERE pr.prrelid IN (SELECT oid FROM tablas)),
         ''
  UNION ALL
  SELECT 14, 'Ninguna tabla ni funcion objetivo pertenece a una extension',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d
                     WHERE d.deptype = 'e'
                       AND ((d.classid = 'pg_class'::regclass AND d.objid IN (SELECT oid FROM tablas))
                            OR (d.classid = 'pg_proc'::regclass AND d.objid IN (SELECT oid FROM funcs)))),
         ''
  UNION ALL
  SELECT 15, 'Ningun event trigger usa las funciones objetivo',
         NOT EXISTS (SELECT 1 FROM pg_event_trigger AS e WHERE e.evtfoid IN (SELECT oid FROM funcs)),
         ''
  UNION ALL
  SELECT 16, 'Ninguna politica ni trigger ajeno depende de las funciones objetivo',
         NOT EXISTS (SELECT 1 FROM pg_depend AS d
                     JOIN pg_policy AS pl ON pl.oid = d.objid AND d.classid = 'pg_policy'::regclass
                     WHERE d.refclassid = 'pg_proc'::regclass
                       AND d.refobjid IN (SELECT oid FROM funcs)
                       AND pl.polrelid NOT IN (SELECT oid FROM tablas)
                       AND NOT (pl.polrelid = 'storage.objects'::regclass
                                AND pl.polname IN ('article_images_admin_insert',
                                                   'article_images_admin_update',
                                                   'article_images_admin_delete')))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger AS t
                         WHERE t.tgfoid IN (SELECT oid FROM funcs)
                           AND NOT t.tgisinternal
                           AND t.tgrelid NOT IN (SELECT oid FROM tablas)),
         ''
  UNION ALL
  SELECT 17, 'rls_auto_enable: SECURITY DEFINER, propiedad de postgres, tipo event_trigger y fuera de extensiones',
         EXISTS (SELECT 1 FROM pg_proc AS p
                 JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'
                   AND p.prosecdef
                   AND pg_get_userbyid(p.proowner) = 'postgres'
                   AND p.prorettype = 'event_trigger'::regtype
                   AND NOT EXISTS (SELECT 1 FROM pg_depend AS d
                                   WHERE d.classid = 'pg_proc'::regclass
                                     AND d.objid = p.oid AND d.deptype = 'e')),
         ''
  UNION ALL
  SELECT 18, 'Event trigger ensure_rls: habilitado y ejecuta public.rls_auto_enable',
         EXISTS (SELECT 1 FROM pg_event_trigger AS e
                 WHERE e.evtname = 'ensure_rls' AND e.evtenabled = 'O'
                   AND e.evtfoid IN (SELECT p.oid FROM pg_proc AS p
                                     JOIN pg_namespace AS s ON s.oid = p.pronamespace
                                     WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable')),
         ''
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion, detalle
FROM checks
UNION ALL
SELECT 80 + (row_number() OVER (ORDER BY pin.rol))::int, 'INFO', 'UID de ' || pin.rol,
       coalesce(pin.uid::text, '(no encontrado)') || ' | ' || pin.correo
FROM pin
UNION ALL
SELECT 90 + (row_number() OVER (ORDER BY e.evtname))::int, 'INFO',
       'event trigger (se conserva): ' || e.evtname,
       e.evtevent || ' | ' || e.evtfoid::regproc::text || ' | habilitado=' || e.evtenabled::text
FROM pg_event_trigger AS e
UNION ALL
SELECT 97, 'INFO', 'huella de rls_auto_enable (debe ser igual al comparar despues)',
       coalesce((SELECT md5(pg_get_functiondef(p.oid))
                 FROM pg_proc AS p
                 JOIN pg_namespace AS s ON s.oid = p.pronamespace
                 WHERE s.nspname = 'public' AND p.proname = 'rls_auto_enable'), '(no existe)')
UNION ALL
SELECT 98, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL', ''
FROM checks
UNION ALL
SELECT 99, 'AVISO',
       'PASA no prueba que este sea charlitron-aliados-test: falta confirmar el Reference ID en el Dashboard.', ''
ORDER BY orden;
