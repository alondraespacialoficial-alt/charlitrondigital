-- SOLO PARA PRUEBAS LOCALES. Se ejecuta tras instalar 0006 y 0007 sobre 0001-0005 y despues de tests.sql.
-- Cada DO es una transaccion; cualquier afirmacion fallida aborta psql (exit != 0). psql -v ON_ERROR_STOP=1

-- A. Preparacion: aliados de prueba en cada estado y un usuario sin rol. Los datos de ally1 ya existen (tests.sql).
DO $$
DECLARE
  v_u uuid;
BEGIN
  PERFORM harness.must((SELECT status = 'active' FROM public.ally_profiles WHERE user_id = harness.id('ally1')), 'ally1 sigue activo');
  PERFORM harness.must((SELECT count(*) FROM public.referrals WHERE ally_id = harness.id('ally1')) > 0
                       AND (SELECT count(*) FROM public.commissions WHERE ally_id = harness.id('ally1')) > 0,
    'ally1 ya tiene recomendaciones y comisiones antes de exigir aceptacion (datos reales a proteger)');
  PERFORM harness.must((SELECT count(*) FROM public.ally_acceptances) = 0, '0006/0007 no crearon ninguna aceptacion por si solas');
  PERFORM harness.must((SELECT count(*) FROM public.ally_legal_documents) = 2, '0007 publico exactamente dos versiones documentales');

  INSERT INTO auth.users (email, email_confirmed_at) VALUES ('acc-ally@test.local', now()) RETURNING id INTO v_u;
  PERFORM harness.put('acc_ally', v_u);
  INSERT INTO public.account_roles (user_id, role) VALUES (v_u, 'ally');
  INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_u, 'Aliado Aceptacion');

  INSERT INTO auth.users (email, email_confirmed_at) VALUES ('acc-paused@test.local', now()) RETURNING id INTO v_u;
  PERFORM harness.put('acc_paused', v_u);
  INSERT INTO public.account_roles (user_id, role) VALUES (v_u, 'ally');
  INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_u, 'Aliado Pausado');

  INSERT INTO auth.users (email, email_confirmed_at) VALUES ('acc-pending@test.local', now()) RETURNING id INTO v_u;
  PERFORM harness.put('acc_pending', v_u);
  INSERT INTO public.account_roles (user_id, role) VALUES (v_u, 'ally');
  INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_u, 'Aliado Pendiente');

  INSERT INTO auth.users (email, email_confirmed_at) VALUES ('acc-noally@test.local', now()) RETURNING id INTO v_u;
  PERFORM harness.put('acc_noally', v_u);

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(harness.id('acc_ally'), 'active');
  PERFORM public.admin_set_ally_status(harness.id('acc_paused'), 'active');
  PERFORM public.admin_set_ally_status(harness.id('acc_paused'), 'paused');
  RESET ROLE;
END $$;

-- B. Caso 1: aliado invitado/activo SIN aceptacion: bloqueado en la base, incluso con datos previos.
DO $$
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Sin Aceptar','sinaceptar@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 0, 'sin aceptacion: ally_my_referrals vacia aunque tenga recomendaciones');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_commissions) = 0, 'sin aceptacion: ally_my_commissions vacia');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_commission_payments) = 0, 'sin aceptacion: ally_my_commission_payments vacia');
  PERFORM harness.must((SELECT NOT accepted AND current_terms_version = '1.0' AND current_privacy_version = '1.2' AND accepted_at IS NULL
                        FROM public.ally_acceptance_state()),
    'ally_acceptance_state: no aceptado y versiones vigentes 1.0 / 1.2');
  PERFORM harness.must(NOT EXISTS (SELECT 1 FROM public.ally_current_acceptance), 'ally_current_acceptance vacia sin aceptacion');
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.referrals WHERE referred_email = 'sinaceptar@ejemplo.com') = 0, 'la recomendacion bloqueada no se guardo');
  PERFORM harness.must((SELECT count(*) FROM public.ally_acceptances) = 0, 'invitar, aprobar y activar no registraron aceptacion alguna');
END $$;

-- C. Caso 5: usuario no autorizado rechazado; llamadas directas a tablas y funciones, sin permiso.
DO $$
BEGIN
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',true,true)$q$, '42501');
  PERFORM harness.expect_error($q$SELECT * FROM public.ally_acceptance_state()$q$, '42501');
  PERFORM harness.expect_error($q$SELECT * FROM public.ally_current_acceptance$q$, '42501');
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_ally_acceptances$q$, '42501');
  PERFORM harness.expect_error($q$SELECT * FROM public.ally_acceptances$q$, '42501');
  RESET ROLE;

  FOR i IN 1..4 LOOP
    PERFORM harness.as_user(harness.id((ARRAY['acc_noally', 'acc_pending', 'acc_paused', 'acc_ally'])[i]));
    IF i < 4 THEN
      PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',true,true)$q$, '42501');
    END IF;
    PERFORM harness.expect_error($q$SELECT public.submit_referral('X Persona','x@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
    -- Falsificar evidencia o saltarse la funcion: sin permisos de tabla.
    PERFORM harness.expect_error(format($q$INSERT INTO public.ally_acceptances (user_id, terms_version, terms_sha256, privacy_version, privacy_sha256,
      terms_accepted, privacy_notice_available_confirmed, action, source) VALUES (%L,'1.0','x','1.2','y',true,true,'checkbox_accept_and_enter','aliados_web_acceptance_screen')$q$, harness.id('acc_ally')), '42501');
    PERFORM harness.expect_error($q$UPDATE public.ally_acceptances SET terms_version = '9.9'$q$, '42501');
    PERFORM harness.expect_error($q$DELETE FROM public.ally_acceptances$q$, '42501');
    PERFORM harness.expect_error($q$INSERT INTO public.ally_legal_documents (doc_type, version, effective_date, title, content, content_sha256)
      VALUES ('terms','9.9','2026-01-01','x','x','x')$q$, '42501');
    PERFORM harness.expect_error($q$UPDATE public.ally_profiles SET status = 'active'$q$, '42501');
    RESET ROLE;
  END LOOP;
  PERFORM harness.must((SELECT count(*) FROM public.ally_acceptances) = 0, 'ningun intento no autorizado dejo evidencia');
END $$;

-- D. Validaciones de la funcion: ambas casillas, versiones vigentes, sin identidad enviada por el navegador.
DO $$
BEGIN
  PERFORM harness.must((SELECT pg_get_function_identity_arguments('public.ally_accept_terms(text, text, boolean, boolean)'::regprocedure))
                       = 'p_terms_version text, p_privacy_version text, p_terms_accepted boolean, p_privacy_confirmed boolean',
    'la funcion no recibe usuario, fecha, accion ni origen: salen del servidor');
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',true,false)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',false,true)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',NULL,NULL)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('0.9','1.2',true,true)$q$, '22023');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.1',true,true)$q$, '22023');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms(NULL,NULL,true,true)$q$, '22023');
  PERFORM harness.must((SELECT NOT accepted FROM public.ally_acceptance_state()), 'tras intentos invalidos sigue sin aceptacion');
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_acceptances) = 0, 'los intentos invalidos no dejaron evidencia');
END $$;

-- E. Caso 3: error al guardar => acceso bloqueado (fallo simulado en el insert, dentro de una transaccion revertida).
BEGIN;
CREATE FUNCTION public.test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'fallo simulado' USING ERRCODE = 'XX000'; END $f$;
CREATE TRIGGER test_fail BEFORE INSERT ON public.ally_acceptances FOR EACH ROW EXECUTE FUNCTION public.test_fail_insert();
DO $$
BEGIN
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',true,true)$q$, 'XX000');
  PERFORM harness.must((SELECT NOT accepted FROM public.ally_acceptance_state()), 'error al guardar: la base sigue sin aceptacion vigente');
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Tras Error','traserror@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  RESET ROLE;
END $$;
ROLLBACK;

-- F. Caso 2: ambas casillas => evidencia registrada con identidad, versiones, huellas, hora del servidor y origen.
DO $$
DECLARE
  v_before timestamptz := clock_timestamp();
  v_id uuid; v_again uuid;
BEGIN
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"Prueba UA/1.0"}', true);
  v_id := public.ally_accept_terms('1.0', '1.2', true, true);
  v_again := public.ally_accept_terms('1.0', '1.2', true, true);
  PERFORM harness.must(v_id IS NOT NULL AND v_again = v_id, 'repetir la aceptacion con las mismas versiones no duplica evidencia');
  PERFORM harness.must((SELECT accepted AND accepted_at IS NOT NULL FROM public.ally_acceptance_state()), 'ally_acceptance_state: aceptado');
  PERFORM harness.must(EXISTS (SELECT 1 FROM public.ally_current_acceptance WHERE id = v_id), 'ally_current_acceptance devuelve la aceptacion propia');
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) = 1 FROM public.ally_acceptances WHERE user_id = harness.id('acc_ally')), 'una sola fila de evidencia');
  PERFORM harness.must((SELECT a.user_id = harness.id('acc_ally') AND a.terms_version = '1.0' AND a.privacy_version = '1.2'
                          AND a.terms_sha256 = (SELECT content_sha256 FROM public.ally_legal_documents WHERE doc_type = 'terms' AND version = '1.0')
                          AND a.privacy_sha256 = (SELECT content_sha256 FROM public.ally_legal_documents WHERE doc_type = 'privacy' AND version = '1.2')
                          AND a.terms_accepted AND a.privacy_notice_available_confirmed
                          AND a.action = 'checkbox_accept_and_enter' AND a.source = 'aliados_web_acceptance_screen'
                          AND a.accepted_at BETWEEN v_before AND clock_timestamp()
                          AND a.forwarded_for = '203.0.113.7, 10.0.0.1' AND a.user_agent = 'Prueba UA/1.0'
                        FROM public.ally_acceptances a WHERE a.id = v_id),
    'evidencia: usuario autenticado, versiones 1.0/1.2, huellas, hora del servidor, accion, origen, cadena x-forwarded-for y agente');
  PERFORM harness.must(EXISTS (SELECT 1 FROM public.aliados_audit_log WHERE table_name = 'ally_acceptances' AND op = 'INSERT'
                               AND row_id = v_id::text AND actor = harness.id('acc_ally')),
    'la aceptacion queda en la auditoria con el usuario como actor');
  -- Cabeceras ausentes o invalidas no impiden registrar.
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM set_config('request.headers', 'no-es-json', true);
  v_id := public.ally_accept_terms('1.0', '1.2', true, true);
  RESET ROLE;
  PERFORM harness.must((SELECT forwarded_for IS NULL AND user_agent IS NULL FROM public.ally_acceptances WHERE id = v_id), 'cabeceras invalidas: se registra sin cabeceras');
END $$;

-- G. Caso 4: aliado activo con aceptacion vigente: acceso permitido (ally1 conserva sus datos; acc_ally opera).
DO $$
DECLARE
  v_ref uuid;
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) > 0, 'con aceptacion: ally1 vuelve a ver sus recomendaciones');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_commissions) > 0, 'con aceptacion: ally1 vuelve a ver sus comisiones');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('acc_ally'));
  v_ref := public.submit_referral('Cliente Con Aceptacion', 'conaceptacion@ejemplo.com', NULL, NULL, NULL, true);
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals WHERE id = v_ref) = 1, 'con aceptacion: acc_ally registra y ve su recomendacion');
  -- Aislamiento: sigue sin ver nada ajeno ni la evidencia de otros.
  PERFORM harness.must((SELECT count(*) FROM public.ally_current_acceptance) = 1, 'cada aliado ve solo su aceptacion');
  PERFORM harness.must((SELECT count(*) FROM public.admin_ally_acceptances) = 0, 'un aliado no ve la vista de auditoria');
  RESET ROLE;
  -- Un aliado pausado con aceptacion previa sigue bloqueado por el estado (el bloqueo por aceptacion no lo reabre).
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(harness.id('acc_ally'), 'paused');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Pausado','pausado2@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 0, 'pausado: sin acceso aunque haya aceptado');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(harness.id('acc_ally'), 'active');
  RESET ROLE;
END $$;

-- H. La evidencia es inmutable, incluso para el propietario; y los administradores conservan sus accesos.
DO $$
DECLARE
  v_referrals bigint := (SELECT count(*) FROM public.referrals);
  v_commissions bigint := (SELECT count(*) FROM public.commissions);
  v_sales bigint := (SELECT count(*) FROM public.sales);
  v_allies bigint := (SELECT count(*) FROM public.ally_profiles);
BEGIN
  PERFORM harness.expect_error($q$UPDATE public.ally_acceptances SET terms_version = '1.0'$q$, '42501');
  PERFORM harness.expect_error($q$DELETE FROM public.ally_acceptances$q$, '42501');
  PERFORM harness.expect_error($q$TRUNCATE public.ally_acceptances$q$, '42501');
  PERFORM harness.expect_error($q$UPDATE public.ally_legal_documents SET title = 'otro'$q$, '42501');
  PERFORM harness.expect_error($q$DELETE FROM public.ally_legal_documents$q$, '42501');
  PERFORM harness.expect_error($q$TRUNCATE public.ally_legal_documents$q$, '0A000');  -- referenciada por FK: PostgreSQL ya lo impide

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.must((SELECT count(*) FROM public.admin_ally_acceptances) = 2, 'el administrador audita las aceptaciones (con correo)');
  PERFORM harness.must((SELECT count(*) FROM public.admin_referrals) = v_referrals, 'admin_referrals intacta');
  PERFORM harness.must((SELECT count(*) FROM public.admin_commissions) = v_commissions, 'admin_commissions intacta');
  PERFORM harness.must((SELECT count(*) FROM public.admin_sales) = v_sales, 'admin_sales intacta');
  PERFORM harness.must((SELECT count(*) FROM public.admin_allies) = v_allies, 'admin_allies intacta');
  -- El administrador no es aliado: sigue sin poder registrar recomendaciones, como antes.
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Admin','admin@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  RESET ROLE;
END $$;

-- I. Actualizacion de terminos: un cambio no sustancial no pide nueva aceptacion; uno sustancial si (se revierte).
BEGIN;
DO $$
DECLARE
  v_ref uuid;
BEGIN
  INSERT INTO public.ally_legal_documents (doc_type, version, effective_date, title, content, content_sha256, requires_reacceptance)
  VALUES ('terms', '1.1', '2027-01-10', 'Terminos 1.1', 'texto 1.1', encode(sha256(convert_to('texto 1.1', 'UTF8')), 'hex'), false);
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.must((SELECT accepted AND current_terms_version = '1.1' FROM public.ally_acceptance_state()),
    'cambio no sustancial (1.1): la aceptacion sigue vigente');
  v_ref := public.submit_referral('Tras 1.1', 'tras11@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;

  INSERT INTO public.ally_legal_documents (doc_type, version, effective_date, title, content, content_sha256, requires_reacceptance)
  VALUES ('terms', '2.0', '2027-02-01', 'Terminos 2.0', 'texto 2.0', encode(sha256(convert_to('texto 2.0', 'UTF8')), 'hex'), true);
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.must((SELECT NOT accepted AND current_terms_version = '2.0' FROM public.ally_acceptance_state()),
    'cambio sustancial (2.0): se solicita nueva aceptacion');
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Tras 2.0','tras20@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 0, 'cambio sustancial: vistas bloqueadas hasta aceptar');
  PERFORM harness.expect_error($q$SELECT public.ally_accept_terms('1.0','1.2',true,true)$q$, '22023');
  PERFORM public.ally_accept_terms('2.0', '1.2', true, true);
  PERFORM harness.must((SELECT accepted FROM public.ally_acceptance_state()), 'nueva aceptacion registrada con 2.0');
  v_ref := public.submit_referral('Tras 2.0 aceptado', 'tras20b@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_acceptances WHERE user_id = harness.id('acc_ally')) = 2,
    'la aceptacion anterior (1.0) se conserva junto a la nueva (2.0)');

  INSERT INTO public.ally_legal_documents (doc_type, version, effective_date, title, content, content_sha256, requires_reacceptance)
  VALUES ('privacy', '1.3', '2027-03-01', 'Aviso 1.3', 'aviso 1.3', encode(sha256(convert_to('aviso 1.3', 'UTF8')), 'hex'), true);
  PERFORM harness.as_user(harness.id('acc_ally'));
  PERFORM harness.must((SELECT NOT accepted AND current_privacy_version = '1.3' FROM public.ally_acceptance_state()),
    'cambio sustancial del aviso (1.3): tambien se solicita confirmacion nueva');
  RESET ROLE;
END $$;
ROLLBACK;

-- J. Catalogo: permisos exactos tras 0006 y el registro publico sigue cerrado.
DO $$
DECLARE
  v_expected text[] := ARRAY['admin_assign_commission', 'admin_authorize_commission', 'admin_correct_sale',
    'admin_finalize_registration', 'admin_invite_ally', 'admin_pay_commission', 'admin_record_payment', 'admin_record_sale',
    'admin_registration_for_approval', 'admin_reject_registration', 'admin_reverse_commission_payment',
    'admin_reverse_payment', 'admin_set_ally_status', 'admin_set_referral_status', 'aliados_registration_open',
    'ally_accept_terms', 'ally_acceptance_state', 'submit_ally_registration', 'submit_referral'];
BEGIN
  PERFORM harness.must((SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
                        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_|ally_)'
                          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) = v_expected,
    'authenticated ejecuta las 17 funciones previas mas ally_accept_terms y ally_acceptance_state; ningun ayudante interno');
  PERFORM harness.must((SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C") FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_|ally_)'
                          AND has_function_privilege('anon', p.oid, 'EXECUTE')) = ARRAY['aliados_registration_open', 'submit_ally_registration'],
    'anon sigue ejecutando solo aliados_registration_open y submit_ally_registration');
  PERFORM harness.must(NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN ('ally_acceptances', 'ally_legal_documents')
        AND (NOT c.relrowsecurity
          OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
          OR has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))),
    'tablas de evidencia: RLS activo y sin permisos para anon ni authenticated');
  PERFORM harness.must(NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
        AND (has_table_privilege('anon', c.oid, 'SELECT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR NOT has_table_privilege('authenticated', c.oid, 'SELECT')
          OR NOT COALESCE((SELECT 'security_barrier=true' = ANY (c.reloptions)), false))),
    'las 13 vistas: solo SELECT para authenticated, nada para anon, todas security_barrier');
  PERFORM harness.must((SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_commissions'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'referral_id', 'referred_name', 'commission_amount', 'status', 'paid_total', 'balance', 'assigned_at']
                       AND (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_commission_payments'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'commission_id', 'amount_paid', 'payment_date']
                       AND (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_referrals'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'referred_name', 'referred_email', 'referred_phone', 'referred_city',
                               'referred_organization', 'data_share_authorized', 'status', 'created_at', 'updated_at'],
    'las vistas ally_my_* conservan exactamente sus columnas');
  PERFORM harness.must((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) = 14,
    'RLS activo en las 14 tablas de public');
  PERFORM harness.must((SELECT registration_open = false FROM public.aliados_settings), 'registration_open sigue en false');
  PERFORM harness.must((SELECT count(*) FROM public.aliados_settings) = 1, 'aliados_settings sin cambios de estructura');
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(), 'huellas de 0001/plataforma intactas tras 0006 y 0007');
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('pub@test.local','Persona Publica','5551234567','CDMX',true)$q$, 'P0001');
  RESET ROLE;
END $$;
