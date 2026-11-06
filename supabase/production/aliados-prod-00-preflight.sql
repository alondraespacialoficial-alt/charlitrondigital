-- ALIADOS CHARLITRON — PRODUCTION, paso 0: verificacion previa (SOLO LECTURA). No modifica nada.
-- Ejecutar en el SQL Editor del proyecto Supabase de Aliados de PRODUCTION, tras confirmar su Reference ID
-- (ver docs/aliados-production-runbook.md, paso 1). Continuar SOLO si el RESULTADO GLOBAL es PASA.
-- Si algo FALLA: detener. No improvisar cambios; reportar la fila que falla.

WITH
core_tables (name) AS (VALUES
  ('account_roles'), ('admin_users'), ('ally_profiles'), ('aliados_settings'), ('ally_registrations'),
  ('referrals'), ('sales'), ('payments'), ('commissions'), ('commission_payments'), ('aliados_audit_log')),
core_routines (sig) AS (VALUES
  ('public.is_admin()'),
  ('public.admin_set_ally_status(uuid, text)'),
  ('public.aliados_registration_open()'),
  ('public.submit_ally_registration(text, text, text, text, boolean)'),
  ('public.admin_invite_ally(text, text, text, text)'),
  ('public.submit_referral(text, text, text, text, text, boolean)'),
  ('public.admin_registration_for_approval(uuid)'),
  ('public.admin_finalize_registration(uuid, uuid)'),
  ('public.admin_reject_registration(uuid, text)'),
  ('public.admin_set_referral_status(uuid, text, text, uuid)'),
  ('public.admin_record_sale(uuid, numeric, text, text, date)'),
  ('public.admin_correct_sale(uuid, numeric, text)'),
  ('public.admin_record_payment(uuid, numeric, text, text, text, text, date)'),
  ('public.admin_reverse_payment(uuid, text)'),
  ('public.admin_assign_commission(uuid, numeric)'),
  ('public.admin_authorize_commission(uuid)'),
  ('public.admin_pay_commission(uuid, numeric, text, text, text, text, date)'),
  ('public.admin_reverse_commission_payment(uuid, text)')),
core_views (name) AS (VALUES
  ('admin_registrations'), ('admin_allies'), ('admin_referrals'), ('admin_sales'), ('admin_payments'),
  ('admin_commissions'), ('admin_commission_payments'), ('admin_audit_log'),
  ('ally_my_referrals'), ('ally_my_commissions'), ('ally_my_commission_payments')),
checks (orden, verificacion, ok) AS (
  SELECT 1, 'NO es el proyecto editorial (public sin articles, categories, content_ideas ni page_views)',
         to_regclass('public.articles') IS NULL AND to_regclass('public.categories') IS NULL
         AND to_regclass('public.content_ideas') IS NULL AND to_regclass('public.page_views') IS NULL
  UNION ALL
  SELECT 2, 'NO es charlitron-aliados-test (sin marcador lab_environment ni assert_aliados_lab)',
         to_regclass('public.lab_environment') IS NULL
         AND to_regprocedure('public.assert_aliados_lab()') IS NULL
  UNION ALL
  SELECT 3, '0001 a 0005: tablas del esquema presentes con RLS activa',
         (SELECT bool_and(to_regclass('public.' || name) IS NOT NULL) FROM core_tables)
         AND NOT EXISTS (SELECT 1 FROM core_tables t JOIN pg_class c ON c.oid = to_regclass('public.' || t.name) WHERE NOT c.relrowsecurity)
  UNION ALL
  SELECT 4, '0001 a 0005: funciones con la firma esperada (incluye 0003, 0004 y 0005)',
         (SELECT bool_and(to_regprocedure(sig) IS NOT NULL) FROM core_routines)
  UNION ALL
  SELECT 5, '0001 a 0005: vistas admin_* y ally_my_* presentes',
         (SELECT bool_and(to_regclass('public.' || name) IS NOT NULL) FROM core_views)
  UNION ALL
  SELECT 6, 'las vistas ally_my_* tienen exactamente las columnas que 0006 redefine',
         (SELECT string_agg(a.attname::text, ',' ORDER BY a.attnum) FROM pg_attribute a
           WHERE a.attrelid = to_regclass('public.ally_my_referrals') AND a.attnum > 0 AND NOT a.attisdropped)
           = 'id,referred_name,referred_email,referred_phone,referred_city,referred_organization,data_share_authorized,status,created_at,updated_at'
         AND (SELECT string_agg(a.attname::text, ',' ORDER BY a.attnum) FROM pg_attribute a
               WHERE a.attrelid = to_regclass('public.ally_my_commissions') AND a.attnum > 0 AND NOT a.attisdropped)
           = 'id,referral_id,referred_name,commission_amount,status,paid_total,balance,assigned_at'
         AND (SELECT string_agg(a.attname::text, ',' ORDER BY a.attnum) FROM pg_attribute a
               WHERE a.attrelid = to_regclass('public.ally_my_commission_payments') AND a.attnum > 0 AND NOT a.attisdropped)
           = 'id,commission_id,amount_paid,payment_date'
  UNION ALL
  SELECT 7, '0006 y 0007 aun NO instaladas',
         to_regclass('public.ally_acceptances') IS NULL
         AND to_regclass('public.ally_legal_documents') IS NULL
         AND to_regclass('public.ally_current_acceptance') IS NULL
         AND to_regprocedure('public.ally_accept_terms(text, text, boolean, boolean)') IS NULL
         AND to_regprocedure('public.ally_acceptance_state()') IS NULL
  UNION ALL
  SELECT 8, 'el registro publico esta cerrado (aliados_settings.registration_open = false)',
         (SELECT count(*) = 1 AND bool_and(registration_open = false) FROM public.aliados_settings)
  UNION ALL
  SELECT 9, 'anon solo ejecuta las dos funciones publicas de registro',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_|ally_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
  UNION ALL
  SELECT 10, 'anon no tiene ningun privilegio sobre tablas ni vistas de public',
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                        AND has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
  UNION ALL
  SELECT 11, 'public solo contiene tablas de Aliados 0001-0005 (mas, a lo sumo, el marcador de Production)',
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
                        AND c.relname NOT IN (SELECT name FROM core_tables)
                        AND c.relname != 'aliados_production_marker')
)
SELECT orden, CASE WHEN ok IS TRUE THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok IS TRUE) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;

-- Informativo (guardar como evidencia "antes"): estado y cantidades.
SELECT
  (SELECT count(*) FROM auth.users)                                       AS usuarios_auth,
  (SELECT count(*) FROM public.ally_profiles)                             AS aliados,
  (SELECT count(*) FROM public.ally_profiles WHERE status = 'active')     AS aliados_activos,
  (SELECT count(*) FROM public.ally_registrations)                        AS solicitudes,
  (SELECT count(*) FROM public.referrals)                                 AS referidos,
  (SELECT count(*) FROM public.sales)                                     AS ventas,
  (SELECT count(*) FROM public.payments)                                  AS cobros,
  (SELECT count(*) FROM public.commissions)                               AS comisiones,
  (SELECT count(*) FROM public.commission_payments)                       AS pagos_comision,
  (SELECT registration_open FROM public.aliados_settings LIMIT 1)         AS registro_abierto,
  to_regclass('public.aliados_production_marker') IS NOT NULL             AS marcador_production_instalado;
