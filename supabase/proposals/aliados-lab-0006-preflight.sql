-- ALIADOS CHARLITRON — Verificacion previa (SOLO LECTURA) antes de instalar 0006 y 0007.
-- Ejecutar en el SQL Editor del proyecto "charlitron-aliados-test" y confirmar el Reference ID en
-- Dashboard > Project Settings > General (distinto de rvvqhpbtqgjpzflopflv). No modifica nada.
-- Instalar 0006 y 0007 SOLO si el resultado global es PASA.

WITH checks (orden, verificacion, ok) AS (
  SELECT 1, 'marcador del laboratorio presente (lab_environment = charlitron-aliados-test)',
         to_regclass('public.lab_environment') IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.lab_environment WHERE environment = 'charlitron-aliados-test')
  UNION ALL
  SELECT 2, '0001 a 0005 instaladas',
         to_regclass('public.ally_profiles') IS NOT NULL
         AND to_regclass('public.referrals') IS NOT NULL
         AND to_regprocedure('public.admin_set_ally_status(uuid, text)') IS NOT NULL
         AND to_regprocedure('public.aliados_registration_open()') IS NOT NULL
         AND to_regprocedure('public.admin_invite_ally(text, text, text, text)') IS NOT NULL
  UNION ALL
  SELECT 3, '0006 y 0007 aun NO instaladas',
         to_regclass('public.ally_acceptances') IS NULL
         AND to_regclass('public.ally_legal_documents') IS NULL
         AND to_regprocedure('public.ally_accept_terms(text, text, boolean, boolean)') IS NULL
  UNION ALL
  SELECT 4, 'el registro publico esta cerrado (registration_open = false)',
         EXISTS (SELECT 1 FROM public.aliados_settings WHERE registration_open = false)
  UNION ALL
  SELECT 5, 'anon solo ejecuta las dos funciones publicas de registro',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
)
SELECT orden, CASE WHEN ok THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;

-- Informativo: usuarios y aliados existentes (los aliados activos sin aceptacion quedaran bloqueados al instalar 0006).
SELECT (SELECT count(*) FROM auth.users) AS usuarios_auth,
       (SELECT count(*) FROM public.ally_profiles WHERE status = 'active') AS aliados_activos,
       (SELECT count(*) FROM public.referrals) AS referidos,
       (SELECT count(*) FROM public.commissions) AS comisiones;
