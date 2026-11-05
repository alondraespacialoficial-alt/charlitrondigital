-- SOLO PARA PRUEBAS LOCALES. Cada DO es una transaccion; cualquier afirmacion fallida aborta psql (exit != 0).
-- Se ejecuta con: psql -v ON_ERROR_STOP=1

-- 0. La migracion no altero lo instalado por 0001 ni la plataforma.
DO $$
BEGIN
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(),
    'auth.uid, is_admin, las 4 tablas de 0001, auth.users, triggers/politicas de 0001 y roles: sin cambios');
END $$;

-- 1. Preparacion: ids y aliado de prueba aprobado con el flujo de 0001.
DO $$
DECLARE
  v_admin uuid; v_ally uuid;
BEGIN
  SELECT admin_uid, ally_uid INTO v_admin, v_ally FROM public.lab_environment;
  PERFORM harness.put('admin', v_admin);
  PERFORM harness.put('ally1', v_ally);
  PERFORM harness.as_user(v_admin);
  PERFORM public.admin_set_ally_status(v_ally, 'active');
  RESET ROLE;
  PERFORM harness.must((SELECT status = 'active' AND approved_by = v_admin FROM public.ally_profiles WHERE user_id = v_ally),
    'aliado 1 activado por el administrador (admin_set_ally_status sobre el trigger de 0001)');
END $$;

-- 2. Registro cerrado por defecto: nada se guarda ni se expone.
DO $$
BEGIN
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('x@test.local','Persona X','5551234567','CDMX',true)$q$, 'P0001');
  PERFORM harness.expect_error('SELECT * FROM public.ally_registrations', '42501');
  PERFORM harness.expect_error($q$INSERT INTO public.ally_registrations (email, full_name) VALUES ('a@b.co','Nombre')$q$, '42501');
  PERFORM harness.expect_error('SELECT * FROM public.admin_registrations', '42501');
  PERFORM harness.expect_error('SELECT * FROM public.aliados_settings', '42501');
  PERFORM harness.expect_error('UPDATE public.aliados_settings SET registration_open = true', '42501');
  PERFORM harness.expect_error($q$SELECT public.admin_finalize_registration(gen_random_uuid(), gen_random_uuid())$q$, '42501');
  PERFORM harness.expect_error('SELECT public.aliados_assert_admin()', '42501');
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations) = 0 AND NOT (SELECT registration_open FROM public.aliados_settings),
    'registro cerrado: anon no guarda nada y no puede abrirlo');
END $$;

-- 3. Registro abierto (lo abre el propietario con SQL): validaciones y anti-enumeracion.
UPDATE public.aliados_settings SET registration_open = true;
DO $$
BEGIN
  PERFORM harness.as_anon();
  PERFORM public.submit_ally_registration('nuevo@test.local', 'Aliada Nueva', '5551112222', 'CDMX', true);
  PERFORM public.submit_ally_registration('  Nuevo@Test.Local ', 'Aliada Nueva', NULL, NULL, true);
  PERFORM public.submit_ally_registration('rechazar@test.local', 'Persona Rechazada', NULL, NULL, true);
  PERFORM public.submit_ally_registration('nadrian18@gmail.com', 'Intento Admin', NULL, NULL, true);
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('c@test.local','Sin Consentimiento',NULL,NULL,false)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('no-es-correo','Nombre Valido',NULL,NULL,true)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('n@test.local','A',NULL,NULL,true)$q$, '23514');
  PERFORM harness.expect_error('SELECT * FROM public.ally_registrations', '42501');
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations) = 2,
    'duplicado (mayusculas/espacios) y correo de usuario existente no crean solicitud; datos invalidos rechazados');
  PERFORM harness.must((SELECT consent_at IS NOT NULL AND status = 'pending' AND user_id IS NULL AND email = 'nuevo@test.local'
                        FROM public.ally_registrations WHERE email = 'nuevo@test.local'),
    'solicitud pendiente con consentimiento registrado, sin cuenta Auth');
  PERFORM harness.put('reg_ok', (SELECT id FROM public.ally_registrations WHERE email = 'nuevo@test.local'));
  PERFORM harness.put('reg_rej', (SELECT id FROM public.ally_registrations WHERE email = 'rechazar@test.local'));

  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error('SELECT * FROM public.ally_registrations', '42501');
  PERFORM harness.must((SELECT count(*) FROM public.admin_registrations) = 0, 'aliado: admin_registrations devuelve 0 filas');
  PERFORM harness.expect_error(format('SELECT * FROM public.admin_registration_for_approval(%L)', harness.id('reg_ok')), '42501');
  PERFORM harness.expect_error(format('SELECT public.admin_reject_registration(%L, %L)', harness.id('reg_rej'), 'no'), '42501');
  RESET ROLE;
END $$;

-- 4. Aprobacion: el "backend" (aqui el arnes) crea el usuario Auth; la BD solo asigna rol y perfil.
DO $$
DECLARE
  v_user uuid; v_n int;
BEGIN
  PERFORM harness.as_user(harness.id('admin'));
  SELECT count(*) INTO v_n FROM public.admin_registration_for_approval(harness.id('reg_ok'));
  PERFORM harness.must(v_n = 1, 'admin obtiene los datos de la solicitud pendiente');
  RESET ROLE;

  INSERT INTO auth.users (email) VALUES ('nuevo@test.local') RETURNING id INTO v_user;
  PERFORM harness.put('ally2', v_user);

  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error(format('SELECT public.admin_finalize_registration(%L, %L)', harness.id('reg_ok'), v_user), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format('SELECT public.admin_finalize_registration(%L, %L)', harness.id('reg_ok'), harness.id('ally1')), '23514');
  PERFORM public.admin_finalize_registration(harness.id('reg_ok'), v_user);
  PERFORM harness.expect_error(format('SELECT public.admin_finalize_registration(%L, %L)', harness.id('reg_ok'), v_user), 'P0002');
  PERFORM public.admin_reject_registration(harness.id('reg_rej'), 'No cumple el perfil');
  PERFORM harness.expect_error(format('SELECT public.admin_reject_registration(%L, %L)', harness.id('reg_rej'), 'otra vez'), 'P0002');
  RESET ROLE;

  PERFORM harness.must((SELECT role = 'ally' FROM public.account_roles WHERE user_id = v_user), 'rol ally asignado');
  PERFORM harness.must((SELECT status = 'active' AND approved_by = harness.id('admin') AND approved_at IS NOT NULL
                               AND display_name = 'Aliada Nueva' AND role = 'ally'
                        FROM public.ally_profiles WHERE user_id = v_user),
    'ally_profiles creado respetando 0001: nace pending y el trigger lo activa con aprobador');
  PERFORM harness.must((SELECT status = 'approved' AND user_id = v_user AND reviewed_by = harness.id('admin')
                        FROM public.ally_registrations WHERE id = harness.id('reg_ok')), 'solicitud marcada aprobada');
  PERFORM harness.must((SELECT status = 'rejected' AND rejection_reason = 'No cumple el perfil'
                        FROM public.ally_registrations WHERE id = harness.id('reg_rej')), 'solicitud rechazada con motivo');
  PERFORM harness.must(NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_user), 'el aliado nuevo no es administrador');
END $$;

-- 5. Referidos: aislamiento, duplicados, estados.
DO $$
DECLARE
  v_r1 uuid; v_r2 uuid;
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  v_r1 := public.submit_referral('Cliente Uno', 'cliente1@ejemplo.com', '5512345678', 'CDMX', 'Acme', true);
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Sin Permiso','z@ejemplo.com',NULL,NULL,NULL,false)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Sin Contacto',NULL,'123',NULL,NULL,true)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Cliente Uno Otra Vez','CLIENTE1@ejemplo.com',NULL,NULL,NULL,true)$q$, '23505');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('ally2'));
  v_r2 := public.submit_referral('Cliente Uno (de Ally2)', 'cliente1@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;
  PERFORM harness.put('r1', v_r1);
  PERFORM harness.put('r2', v_r2);
  PERFORM harness.must((SELECT duplicate_review AND duplicate_of = v_r1 FROM public.referrals WHERE id = v_r2),
    'el mismo contacto de otro aliado queda marcado para revision manual, sin avisar al aliado');

  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 1
                       AND (SELECT id FROM public.ally_my_referrals) = v_r1, 'aliado 1 ve solo su referido');
  PERFORM harness.expect_error('SELECT internal_notes FROM public.ally_my_referrals', '42703');
  PERFORM harness.expect_error('SELECT duplicate_key FROM public.ally_my_referrals', '42703');
  PERFORM harness.expect_error('SELECT duplicate_review FROM public.ally_my_referrals', '42703');
  PERFORM harness.expect_error('SELECT * FROM public.referrals', '42501');
  PERFORM harness.expect_error($q$UPDATE public.ally_my_referrals SET referred_name = 'Alterado'$q$, '42501');
  PERFORM harness.expect_error($q$DELETE FROM public.ally_my_referrals$q$, '42501');
  PERFORM harness.expect_error($q$INSERT INTO public.referrals (ally_id, referred_name, referred_email, data_share_authorized, duplicate_key)
                                   VALUES (auth.uid(), 'Directo', 'd@x.co', true, 'd@x.co')$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.admin_referrals) = 0, 'aliado: admin_referrals devuelve 0 filas');
  PERFORM harness.expect_error(format('SELECT public.admin_set_referral_status(%L, %L)', v_r1, 'closed'), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('ally2'));
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 1 AND (SELECT id FROM public.ally_my_referrals) = v_r2,
    'aliado 2 ve solo su referido');
  RESET ROLE;

  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Anon','a@x.co',NULL,NULL,NULL,true)$q$, '42501');
  RESET ROLE;

  -- Resolucion manual de duplicado.
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format('SELECT public.admin_set_referral_status(%L, %L)', v_r2, 'duplicate'), '23514');
  PERFORM public.admin_set_referral_status(v_r2, 'duplicate', 'mismo contacto que r1', v_r1);
  PERFORM harness.must((SELECT NOT duplicate_review AND internal_notes = 'mismo contacto que r1' AND status = 'duplicate'
                        FROM public.admin_referrals WHERE id = v_r2), 'admin resuelve duplicado y ve notas internas');
  PERFORM public.admin_set_referral_status(v_r1, 'contacted', 'llamado el lunes');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('ally2'));
  PERFORM harness.must((SELECT status = 'closed' FROM public.ally_my_referrals), 'el estado duplicate se muestra como closed al aliado');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT status = 'contacted' FROM public.ally_my_referrals), 'aliado ve el estado administrado por Charlitron');
  RESET ROLE;

  -- Acceso segun estado: pausado no opera ni lee.
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(harness.id('ally2'), 'paused');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('ally2'));
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Pausado','p@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 0, 'aliado pausado no lee datos');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(harness.id('ally2'), 'active');
  RESET ROLE;
END $$;

-- 6. Ventas y cobros parciales + privacidad.
DO $$
DECLARE
  v_s1 uuid; v_p1 uuid; v_p1b uuid;
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error(format('SELECT public.admin_record_sale(%L, 1000)', harness.id('r1')), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format('SELECT public.admin_record_sale(%L, 1000)', harness.id('r2')), 'P0002');
  PERFORM harness.expect_error(format('SELECT public.admin_record_sale(%L, 0)', harness.id('r1')), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_record_sale(%L, 100.555)', harness.id('r1')), '23514');
  v_s1 := public.admin_record_sale(harness.id('r1'), 1000.00, 'Sitio web', 'nota interna de venta');

  v_p1 := public.admin_record_payment(v_s1, 400.00, 'pay-key-0001', 'transferencia', 'REF-1', 'nota cobro');
  PERFORM harness.must(public.admin_record_payment(v_s1, 400.00, 'pay-key-0001', 'transferencia', 'REF-1') = v_p1
                       AND (SELECT count(*) FROM public.admin_payments WHERE sale_id = v_s1) = 1,
    'reintento con la misma llave no duplica el cobro');
  PERFORM harness.expect_error(format('SELECT public.admin_record_payment(%L, 700, %L, %L)', v_s1, 'pay-key-0002', 'transferencia'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_record_payment(%L, 10, %L, %L, %L)', v_s1, 'pay-key-0003', 'transferencia', 'REF-1'), '23505');
  RESET ROLE;
  PERFORM harness.put('s1', v_s1);

  -- El aliado no ve nada contable.
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error('SELECT * FROM public.sales', '42501');
  PERFORM harness.expect_error('SELECT * FROM public.payments', '42501');
  PERFORM harness.expect_error('SELECT * FROM public.commissions', '42501');
  PERFORM harness.expect_error('SELECT * FROM public.commission_payments', '42501');
  PERFORM harness.expect_error('SELECT * FROM public.aliados_audit_log', '42501');
  PERFORM harness.must((SELECT count(*) FROM public.admin_sales) = 0, 'aliado: admin_sales devuelve 0 filas');
  PERFORM harness.must((SELECT count(*) FROM public.admin_payments) = 0, 'aliado: admin_payments devuelve 0 filas');
  PERFORM harness.must((SELECT count(*) FROM public.admin_commissions) = 0, 'aliado: admin_commissions devuelve 0 filas');
  PERFORM harness.must((SELECT count(*) FROM public.admin_audit_log) = 0, 'aliado: admin_audit_log devuelve 0 filas');
  PERFORM harness.must((SELECT count(*) FROM public.admin_allies) = 0, 'aliado: admin_allies devuelve 0 filas');
  -- Un predicado que fallaria si se evaluara sobre filas reales no produce error ni filas.
  PERFORM harness.must((SELECT count(*) FROM public.admin_sales WHERE 1 / (amount_agreed - amount_agreed) > 0) = 0,
    'aliado: un predicado de sondeo sobre admin_sales no produce error ni filas');
  PERFORM harness.expect_error(format('SELECT public.admin_record_payment(%L, 1, %L, %L)', v_s1, 'pay-key-9999', 'efectivo'), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.must((SELECT count(*) FROM public.admin_sales) >= 1 AND (SELECT count(*) FROM public.admin_audit_log) > 0
                       AND (SELECT count(*) FROM public.admin_allies WHERE email IS NOT NULL) >= 2,
    'el administrador si ve ventas, cobros, auditoria y aliados con correo');
  RESET ROLE;
END $$;

-- 7. Comisiones: autorizacion separada, limite proporcional a cobros netos, reversiones, correcciones.
DO $$
DECLARE
  v_s1 uuid := harness.id('s1');
  v_c1 uuid; v_cp1 uuid; v_cp2 uuid; v_p2 uuid;
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_commissions) = 0, 'antes de asignar, el aliado no ve comisiones');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format('SELECT public.admin_assign_commission(%L, 1000.01)', v_s1), '23514');
  v_c1 := public.admin_assign_commission(v_s1, 100.00);
  PERFORM harness.expect_error(format('SELECT public.admin_assign_commission(%L, 50)', v_s1), '23505');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 1, %L, %L)', v_c1, 'cpay-key-0000', 'transferencia'), '23514');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error(format('SELECT public.admin_authorize_commission(%L)', v_c1), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_authorize_commission(v_c1);
  PERFORM harness.expect_error(format('SELECT public.admin_authorize_commission(%L)', v_c1), 'P0002');
  PERFORM harness.must((SELECT net_collected = 400 AND release_limit = 40 AND paid_total = 0 FROM public.admin_commissions WHERE id = v_c1),
    'cobros netos 400 de 1000 -> liberable 40 de 100');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 40.01, %L, %L)', v_c1, 'cpay-key-0001', 'transferencia'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 10.005, %L, %L)', v_c1, 'cpay-key-0001', 'transferencia'), '23514');
  v_cp1 := public.admin_pay_commission(v_c1, 40.00, 'cpay-key-0001', 'transferencia', 'CREF-1');
  PERFORM harness.must(public.admin_pay_commission(v_c1, 40.00, 'cpay-key-0001', 'transferencia', 'CREF-1') = v_cp1
                       AND (SELECT count(*) FROM public.admin_commission_payments WHERE commission_id = v_c1) = 1,
    'pago de comision repetido con la misma llave no duplica');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 0.01, %L, %L)', v_c1, 'cpay-key-0002', 'transferencia'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 0.01, %L, %L, %L)', v_c1, 'cpay-key-0009', 'transferencia', 'CREF-1'), '23514');

  v_p2 := public.admin_record_payment(v_s1, 600.00, 'pay-key-0002', 'transferencia');
  PERFORM harness.expect_error(format('SELECT public.admin_record_payment(%L, 0.01, %L, %L)', v_s1, 'pay-key-0004', 'transferencia'), '23514');
  PERFORM harness.must((SELECT net_collected = 1000 AND release_limit = 100 FROM public.admin_commissions WHERE id = v_c1),
    'cobro completo -> liberable 100');
  v_cp2 := public.admin_pay_commission(v_c1, 60.00, 'cpay-key-0002', 'transferencia');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 0.01, %L, %L)', v_c1, 'cpay-key-0003', 'transferencia'), '23514');

  -- Reversiones: no se puede revertir el cobro mientras la comision pagada lo excederia.
  PERFORM harness.expect_error(format('SELECT public.admin_reverse_payment(%L, %L)', v_p2, 'cobro erroneo'), '23514');
  PERFORM harness.must((SELECT reversed_at IS NULL FROM public.admin_payments WHERE id = v_p2), 'el cobro sigue vigente tras el intento bloqueado');
  PERFORM harness.expect_error(format('SELECT public.admin_reverse_commission_payment(%L, %L)', v_cp2, 'x'), '23514');
  PERFORM public.admin_reverse_commission_payment(v_cp2, 'pago enviado a cuenta equivocada');
  PERFORM harness.expect_error(format('SELECT public.admin_reverse_commission_payment(%L, %L)', v_cp2, 'otra vez'), '23514');
  PERFORM public.admin_reverse_payment(v_p2, 'transferencia devuelta por el banco');
  PERFORM harness.expect_error(format('SELECT public.admin_reverse_payment(%L, %L)', v_p2, 'otra vez'), '23514');
  PERFORM harness.must((SELECT net_collected = 400 AND release_limit = 40 AND paid_total = 40 FROM public.admin_commissions WHERE id = v_c1),
    'tras reversiones: cobros netos 400, liberable 40, pagado 40');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 60, %L, %L)', v_c1, 'cpay-key-0004', 'transferencia'), '23514');

  -- Correcciones de venta con motivo; no pueden dejar comisiones pagadas por encima del limite.
  PERFORM harness.expect_error(format('SELECT public.admin_correct_sale(%L, 300, %L)', v_s1, 'menor que lo cobrado'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_correct_sale(%L, 2000, %L)', v_s1, 'precio mayor'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_correct_sale(%L, 800, %L)', v_s1, 'x'), '23514');
  PERFORM public.admin_correct_sale(v_s1, 800.00, 'Correccion de prueba');
  PERFORM public.admin_correct_sale(v_s1, 1000.00, 'Se restablece el precio acordado');
  RESET ROLE;

  -- Vista del aliado: solo lo autorizado.
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT commission_amount = 100 AND paid_total = 40 AND balance = 60 AND status = 'authorized'
                        FROM public.ally_my_commissions WHERE id = v_c1), 'aliado ve su comision, lo pagado y el saldo');
  PERFORM harness.must((SELECT count(*) = 1 AND sum(amount_paid) = 40 FROM public.ally_my_commission_payments),
    'aliado ve solo pagos vigentes (el revertido no aparece)');
  PERFORM harness.expect_error('SELECT release_limit FROM public.ally_my_commissions', '42703');
  PERFORM harness.expect_error('SELECT net_collected FROM public.ally_my_commissions', '42703');
  PERFORM harness.expect_error('SELECT method FROM public.ally_my_commission_payments', '42703');
  PERFORM harness.expect_error('SELECT payment_method FROM public.ally_my_commission_payments', '42703');
  PERFORM harness.expect_error('SELECT internal_notes FROM public.ally_my_commission_payments', '42703');
  PERFORM harness.expect_error('UPDATE public.commissions SET commission_amount = 999', '42501');
  PERFORM harness.expect_error('DELETE FROM public.commission_payments', '42501');
  PERFORM harness.expect_error(format('SELECT public.admin_pay_commission(%L, 1, %L, %L)', v_c1, 'cpay-key-8888', 'transferencia'), '42501');
  PERFORM harness.expect_error(format('SELECT public.aliados_release_limit(%L)', v_c1), '42501');
  PERFORM harness.expect_error(format('SELECT public.aliados_net_collected(%L)', v_s1), '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('ally2'));
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_commissions) = 0
                       AND (SELECT count(*) FROM public.ally_my_commission_payments) = 0, 'aliado 2 no ve comisiones ni pagos del aliado 1');
  RESET ROLE;
END $$;

-- 8. Contabilidad inmutable y auditoria (incluso para el propietario).
DO $$
BEGIN
  PERFORM harness.expect_error('UPDATE public.payments SET amount_paid = 1', '42501');
  PERFORM harness.expect_error('DELETE FROM public.payments', '42501');
  PERFORM harness.expect_error($q$UPDATE public.payments SET reversal_reason = 'cambiado' WHERE reversed_at IS NOT NULL$q$, '42501');
  PERFORM harness.expect_error('UPDATE public.commission_payments SET amount_paid = 1', '42501');
  PERFORM harness.expect_error('DELETE FROM public.commission_payments', '42501');
  PERFORM harness.expect_error('DELETE FROM public.sales', '42501');
  PERFORM harness.expect_error('DELETE FROM public.commissions', '42501');
  PERFORM harness.expect_error($q$UPDATE public.aliados_audit_log SET reason = 'x'$q$, '42501');
  PERFORM harness.expect_error('DELETE FROM public.aliados_audit_log', '42501');
  PERFORM harness.expect_error('TRUNCATE public.aliados_audit_log', '42501');

  PERFORM harness.must((SELECT count(*) FROM public.aliados_audit_log
                        WHERE table_name = 'payments' AND op = 'UPDATE' AND actor = harness.id('admin')
                          AND new_row ->> 'reversal_reason' = 'transferencia devuelta por el banco') = 1,
    'reversion de cobro auditada con actor y motivo');
  PERFORM harness.must((SELECT count(*) FROM public.aliados_audit_log
                        WHERE table_name = 'sales' AND op = 'UPDATE' AND reason = 'Correccion de prueba'
                          AND (old_row ->> 'amount_agreed')::numeric = 1000 AND (new_row ->> 'amount_agreed')::numeric = 800) = 1,
    'correccion de venta auditada con valor anterior, nuevo y motivo');
  PERFORM harness.must((SELECT count(*) FROM public.aliados_audit_log WHERE table_name = 'commission_payments' AND op = 'INSERT') = 2,
    'pagos de comision auditados');
  PERFORM harness.must((SELECT actor IS NULL FROM public.aliados_audit_log WHERE table_name = 'ally_registrations' AND op = 'INSERT' ORDER BY id LIMIT 1),
    'solicitud publica auditada sin actor');
END $$;

-- 9. Catalogo: permisos exactos.
DO $$
DECLARE
  v_expected text[] := ARRAY['admin_assign_commission', 'admin_authorize_commission', 'admin_correct_sale',
    'admin_finalize_registration', 'admin_invite_ally', 'admin_pay_commission', 'admin_record_payment', 'admin_record_sale',
    'admin_registration_for_approval', 'admin_reject_registration', 'admin_reverse_commission_payment',
    'admin_reverse_payment', 'admin_set_ally_status', 'admin_set_referral_status', 'aliados_registration_open',
    'submit_ally_registration', 'submit_referral'];
BEGIN
  PERFORM harness.must((SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
                        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)'
                          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) = v_expected,
    'authenticated ejecuta exactamente las 17 funciones publicas; ningun ayudante interno');
  PERFORM harness.must((SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C") FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)'
                          AND has_function_privilege('anon', p.oid, 'EXECUTE')) = ARRAY['aliados_registration_open', 'submit_ally_registration'],
    'anon solo ejecuta aliados_registration_open y submit_ally_registration');
  PERFORM harness.must(NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN ('aliados_settings', 'ally_registrations', 'referrals', 'sales', 'payments',
                          'commissions', 'commission_payments', 'aliados_audit_log')
        AND (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
          OR has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))),
    'las 8 tablas nuevas: anon y authenticated sin ningun permiso (tabla ni columna)');
  PERFORM harness.must(NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
        AND (has_table_privilege('anon', c.oid, 'SELECT')
          OR has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR NOT has_table_privilege('authenticated', c.oid, 'SELECT')
          OR NOT COALESCE((SELECT 'security_barrier=true' = ANY (c.reloptions)), false))),
    'las 11 vistas: solo SELECT para authenticated, nada para anon, todas security_barrier');
  PERFORM harness.must((SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_commissions'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'referral_id', 'referred_name', 'commission_amount', 'status', 'paid_total', 'balance', 'assigned_at'],
    'ally_my_commissions expone solo columnas autorizadas');
  PERFORM harness.must((SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_commission_payments'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'commission_id', 'amount_paid', 'payment_date'],
    'ally_my_commission_payments expone solo columnas autorizadas');
  PERFORM harness.must((SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a
                        WHERE a.attrelid = 'public.ally_my_referrals'::regclass AND a.attnum > 0)
                       = ARRAY['id', 'referred_name', 'referred_email', 'referred_phone', 'referred_city',
                               'referred_organization', 'data_share_authorized', 'status', 'created_at', 'updated_at'],
    'ally_my_referrals expone solo columnas autorizadas');
  PERFORM harness.must((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) = 12,
    'RLS activo en las 12 tablas de public (4 de 0001 + 8 nuevas)');
  PERFORM set_config('request.jwt.claim.sub', harness.id('admin')::text, true);
  PERFORM harness.must((SELECT count(*) FROM public.admin_commissions) = (SELECT count(*) FROM public.commissions)
                       AND NOT EXISTS (SELECT 1 FROM public.commissions c
                        WHERE public.aliados_release_limit(c.id) IS DISTINCT FROM
                              (SELECT release_limit FROM public.admin_commissions WHERE id = c.id)),
    'la formula de la vista admin_commissions coincide con aliados_release_limit');
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(), 'huellas de 0001/plataforma siguen intactas al final');
END $$;

-- 10. Preparacion de las carreras de concurrencia (las ejecuta run.sh con sesiones psql reales).
DO $$
DECLARE
  v_ref uuid; v_s uuid; v_c uuid; v_pa uuid; v_pb uuid;
BEGIN
  PERFORM harness.as_user(harness.id('ally1'));
  v_ref := public.submit_referral('Cliente Concurrencia 3', 'cliente3@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  v_s := public.admin_record_sale(v_ref, 1000);
  PERFORM public.admin_record_payment(v_s, 1000, 'race-pay-0003', 'transferencia');
  v_c := public.admin_assign_commission(v_s, 100);
  PERFORM public.admin_authorize_commission(v_c);
  RESET ROLE;
  PERFORM harness.put('c3', v_c);

  PERFORM harness.as_user(harness.id('ally1'));
  v_ref := public.submit_referral('Cliente Concurrencia 4', 'cliente4@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  v_s := public.admin_record_sale(v_ref, 1000);
  v_pa := public.admin_record_payment(v_s, 500, 'race-pay-004a', 'transferencia');
  v_pb := public.admin_record_payment(v_s, 500, 'race-pay-004b', 'transferencia');
  v_c := public.admin_assign_commission(v_s, 100);
  PERFORM public.admin_authorize_commission(v_c);
  RESET ROLE;
  PERFORM harness.put('pb4', v_pb);
  PERFORM harness.put('c4', v_c);
END $$;

-- 11. admin_set_ally_status: aprobar / pausar / reactivar, solo por funcion segura, sin tocar Auth ni roles.
DO $$
DECLARE
  v_user uuid;
  v_roles_before int := (SELECT count(*) FROM public.account_roles);
  v_auth_before int := (SELECT count(*) FROM auth.users);
BEGIN
  -- Aliado pendiente (como Integrando): ya existe en Auth, con rol y perfil pending.
  INSERT INTO auth.users (email) VALUES ('pendiente@test.local') RETURNING id INTO v_user;
  INSERT INTO public.account_roles (user_id, role) VALUES (v_user, 'ally');
  INSERT INTO public.ally_profiles (user_id, display_name) VALUES (v_user, 'Aliado Pendiente');
  PERFORM harness.put('pend', v_user);
  v_roles_before := v_roles_before + 1;
  v_auth_before := v_auth_before + 1;

  -- Accesos indebidos.
  PERFORM harness.as_anon();
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'active'), '42501');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'active'), '42501');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', harness.id('ally1'), 'paused'), '42501');
  PERFORM harness.expect_error(format($q$UPDATE public.ally_profiles SET status = 'active' WHERE user_id = %L$q$, v_user), '42501');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format($q$UPDATE public.ally_profiles SET status = 'active' WHERE user_id = %L$q$, v_user), '42501');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'pending'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'cualquiera'), '23514');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', gen_random_uuid(), 'active'), 'P0002');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, NULL)', v_user), '23514');
  RESET ROLE;
  PERFORM harness.must((SELECT status = 'pending' AND approved_at IS NULL FROM public.ally_profiles WHERE user_id = v_user),
    'los intentos indebidos no cambiaron el estado pendiente');

  -- Aprobar (pending -> active): el trigger de 0001 registra aprobador y fecha.
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.must((SELECT status = 'pending' FROM public.admin_allies WHERE user_id = v_user), 'el admin ve al aliado pendiente');
  PERFORM public.admin_set_ally_status(v_user, 'active');
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'active'), '23514');
  PERFORM harness.must((SELECT status = 'active' FROM public.admin_allies WHERE user_id = v_user), 'la vista admin_allies refleja active');
  RESET ROLE;
  PERFORM harness.must((SELECT status = 'active' AND approved_by = harness.id('admin') AND approved_at IS NOT NULL
                               AND status_changed_by = harness.id('admin') FROM public.ally_profiles WHERE user_id = v_user),
    'aprobacion registrada con aprobador y fecha por el trigger de 0001');

  -- El aliado aprobado ya opera; pausado deja de leer y de registrar; reactivado vuelve.
  PERFORM harness.as_user(v_user);
  PERFORM public.submit_referral('Cliente Del Nuevo', 'delnuevo@ejemplo.com', NULL, NULL, NULL, true);
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_set_ally_status(v_user, 'paused');
  RESET ROLE;
  PERFORM harness.as_user(v_user);
  PERFORM harness.expect_error($q$SELECT public.submit_referral('Pausado','otro@ejemplo.com',NULL,NULL,NULL,true)$q$, '42501');
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 0, 'aliado pausado no lee sus datos');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error(format('SELECT public.admin_set_ally_status(%L, %L)', v_user, 'paused'), '23514');
  PERFORM public.admin_set_ally_status(v_user, 'active');
  RESET ROLE;
  PERFORM harness.as_user(v_user);
  PERFORM harness.must((SELECT count(*) FROM public.ally_my_referrals) = 1, 'aliado reactivado vuelve a leer sus datos');
  RESET ROLE;

  -- Nada de Auth ni de roles cambio; la huella de 0001 sigue intacta.
  PERFORM harness.must((SELECT count(*) FROM public.account_roles) = v_roles_before
                       AND (SELECT count(*) FROM auth.users) = v_auth_before
                       AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_user),
    'admin_set_ally_status no creo cuentas ni roles ni administradores');
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(), 'huellas de 0001/plataforma intactas tras 0003');
  PERFORM harness.must((SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C") FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_)' AND has_function_privilege('anon', p.oid, 'EXECUTE'))
                       = ARRAY['aliados_registration_open', 'submit_ally_registration'], 'anon sigue ejecutando solo las dos funciones publicas de registro');
  PERFORM harness.must(NOT has_any_column_privilege('authenticated', 'public.ally_profiles', 'UPDATE'),
    'authenticated no tiene UPDATE directo sobre ally_profiles');
END $$;

-- 12. 0004: registro publico con limites anti-abuso (el registro lo abre el propietario; 0004 no lo abre).
DO $$
BEGIN
  PERFORM harness.as_anon();
  PERFORM harness.must(public.aliados_registration_open() IS TRUE, 'anon ve que el registro esta abierto');
  PERFORM harness.expect_error('SELECT * FROM public.aliados_settings', '42501');
  RESET ROLE;
  UPDATE public.aliados_settings SET registration_open = false;
  PERFORM harness.as_anon();
  PERFORM harness.must(public.aliados_registration_open() IS FALSE, 'anon ve que el registro esta cerrado');
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('cerrado@test.local','Persona Cerrada','5551234567','CDMX',true)$q$, 'P0001');
  RESET ROLE;
  UPDATE public.aliados_settings SET registration_open = true;
  PERFORM harness.must(NOT EXISTS (SELECT 1 FROM public.ally_registrations WHERE email = 'cerrado@test.local'),
    'con el registro cerrado no se guarda nada');
END $$;

DO $$
BEGIN
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('tel1@test.local','Telefono Corto','123','CDMX',true)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('tel2@test.local','Telefono Letras','abcdefghij','CDMX',true)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('tel3@test.local','Telefono Largo','5551234567890123','CDMX',true)$q$, '23514');
  PERFORM public.submit_ally_registration('tel4@test.local', 'Telefono Valido', '+52 (444) 123-4567', 'San Luis Potosi', true);
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations WHERE email LIKE 'tel_@test.local') = 1
                       AND EXISTS (SELECT 1 FROM public.ally_registrations WHERE email = 'tel4@test.local' AND status = 'pending'),
    'WhatsApp invalido rechazado; uno valido se guarda como pendiente');
END $$;

DO $$
BEGIN
  -- Enfriamiento: un correo rechazado hace poco no genera otra solicitud y la respuesta es identica.
  PERFORM harness.as_anon();
  PERFORM public.submit_ally_registration('rechazar@test.local', 'Persona Rechazada', '5551112222', 'CDMX', true);
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations WHERE email = 'rechazar@test.local') = 1,
    'rechazado hace menos de 30 dias: no se crea otra solicitud');
  UPDATE public.ally_registrations SET reviewed_at = now() - interval '31 days' WHERE email = 'rechazar@test.local' AND status = 'rejected';
  PERFORM harness.as_anon();
  PERFORM public.submit_ally_registration('rechazar@test.local', 'Persona Rechazada', '5551112222', 'CDMX', true);
  RESET ROLE;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations WHERE email = 'rechazar@test.local') = 2
                       AND EXISTS (SELECT 1 FROM public.ally_registrations WHERE email = 'rechazar@test.local' AND status = 'pending'),
    'pasado el enfriamiento se acepta una nueva solicitud');
END $$;

DO $$
DECLARE
  i int; v_hit boolean := false;
BEGIN
  PERFORM harness.as_anon();
  FOR i IN 1..40 LOOP
    BEGIN
      PERFORM public.submit_ally_registration(format('hora%s@test.local', i), 'Solicitud Masiva', '5551234567', 'CDMX', true);
    EXCEPTION WHEN program_limit_exceeded THEN
      v_hit := true;
      EXIT;
    END;
  END LOOP;
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('despues@test.local','Despues Del Limite','5551234567','CDMX',true)$q$, '54000');
  RESET ROLE;
  PERFORM harness.must(v_hit AND (SELECT count(*) FROM public.ally_registrations WHERE created_at > now() - interval '1 hour') = 10
                       AND NOT EXISTS (SELECT 1 FROM public.ally_registrations WHERE email = 'despues@test.local'),
    'limite por hora: exactamente 10 solicitudes nuevas y la siguiente se rechaza sin guardarse');
END $$;

DO $$
DECLARE
  i int; v_hit boolean := false;
BEGIN
  -- Se envejecen las solicitudes por tandas de 10 para que el tope por hora no oculte el tope por dia.
  UPDATE public.ally_registrations SET created_at = now() - interval '2 hours';
  PERFORM harness.as_anon();
  FOR i IN 1..80 LOOP
    BEGIN
      PERFORM public.submit_ally_registration(format('dia%s@test.local', i), 'Solicitud Diaria', '5551234567', 'CDMX', true);
    EXCEPTION WHEN program_limit_exceeded THEN
      RESET ROLE;
      IF (SELECT count(*) FROM public.ally_registrations WHERE created_at > now() - interval '24 hours') >= 30 THEN
        v_hit := true;
        EXIT;
      END IF;
      UPDATE public.ally_registrations SET created_at = now() - interval '2 hours' WHERE created_at > now() - interval '1 hour';
      PERFORM harness.as_anon();
    END;
  END LOOP;
  RESET ROLE;
  PERFORM harness.must(v_hit AND (SELECT count(*) FROM public.ally_registrations WHERE created_at > now() - interval '24 hours') = 30,
    'limite por dia: exactamente 30 solicitudes en 24 horas, aunque cada hora este por debajo de su tope');
END $$;

DO $$
BEGIN
  UPDATE public.ally_registrations SET created_at = now() - interval '3 days';
  INSERT INTO public.ally_registrations (email, full_name, created_at)
  SELECT format('pend%s@test.local', g), 'Pendiente Masivo', now() - interval '3 days'
  FROM generate_series(1, 100 - (SELECT count(*) FROM public.ally_registrations WHERE status = 'pending')) AS g;
  PERFORM harness.must((SELECT count(*) FROM public.ally_registrations WHERE status = 'pending') = 100, 'preparacion: 100 pendientes');
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT public.submit_ally_registration('tope@test.local','Tope Pendientes','5551234567','CDMX',true)$q$, '54000');
  RESET ROLE;
  PERFORM harness.must(NOT EXISTS (SELECT 1 FROM public.ally_registrations WHERE email = 'tope@test.local'),
    'limite de 100 pendientes: la solicitud 101 no se guarda');
END $$;

DO $$
BEGIN
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.must((SELECT confirmed_at IS NULL FROM public.admin_allies WHERE user_id = harness.id('ally2')),
    'admin: aliado invitado sin confirmar muestra confirmed_at nulo');
  RESET ROLE;
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = harness.id('ally2');
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.must((SELECT confirmed_at IS NOT NULL FROM public.admin_allies WHERE user_id = harness.id('ally2')),
    'admin: tras aceptar la invitacion confirmed_at tiene fecha');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.must((SELECT count(*) FROM public.admin_allies) = 0, 'aliado: admin_allies sigue devolviendo 0 filas');
  RESET ROLE;
  PERFORM harness.as_anon();
  PERFORM harness.expect_error('SELECT * FROM public.admin_allies', '42501');
  RESET ROLE;
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(), 'huellas de 0001/plataforma intactas tras 0004');
END $$;

-- 13. 0005: invitacion directa por administrador (solicitud auditada; rol y perfil solo tras finalize).
DO $$
DECLARE
  v_open boolean := (SELECT registration_open FROM public.aliados_settings);
  v_roles int := (SELECT count(*) FROM public.account_roles);
  v_ally_email text := (SELECT email FROM auth.users WHERE id = harness.id('ally1'));
  v_reg uuid; v_again uuid; v_user uuid; v_found uuid;
BEGIN
  PERFORM harness.as_anon();
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_invite_ally('x@test.local','Persona X',NULL,NULL)$q$, '42501');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_invite_ally('x@test.local','Persona X',NULL,NULL)$q$, '42501');
  RESET ROLE;

  PERFORM harness.as_user(harness.id('admin'));
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_invite_ally('tel@test.local','Telefono Malo','123',NULL)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_invite_ally('no-es-correo','Correo Malo',NULL,NULL)$q$, '23514');
  PERFORM harness.expect_error($q$SELECT * FROM public.admin_invite_ally('corto@test.local','A',NULL,NULL)$q$, '23514');
  PERFORM harness.expect_error(format($q$SELECT * FROM public.admin_invite_ally(%L,'Ya Aliado',NULL,NULL)$q$, v_ally_email), '23505');

  -- Correo nuevo: queda una solicitud pendiente y sin cuenta Auth; nada de rol ni perfil.
  SELECT i.registration_id, i.auth_user_id INTO v_reg, v_user FROM public.admin_invite_ally(' Directo@Test.Local ', 'Aliado Directo', '+52 444 123 4567', 'SLP') i;
  SELECT i.registration_id INTO v_again FROM public.admin_invite_ally('directo@test.local', 'Otro Nombre', NULL, NULL) i;
  RESET ROLE;
  PERFORM harness.must(v_reg IS NOT NULL AND v_user IS NULL AND v_again = v_reg
                       AND (SELECT count(*) FROM public.ally_registrations WHERE email = 'directo@test.local') = 1
                       AND EXISTS (SELECT 1 FROM public.ally_registrations WHERE id = v_reg AND status = 'pending' AND full_name = 'Aliado Directo'),
    'invitar un correo nuevo crea una sola solicitud pendiente (repetir no duplica)');
  PERFORM harness.must((SELECT count(*) FROM public.account_roles) = v_roles AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'directo@test.local'),
    'invitar no crea cuenta, rol ni perfil');
  PERFORM harness.must(EXISTS (SELECT 1 FROM public.aliados_audit_log WHERE table_name = 'ally_registrations' AND op = 'INSERT' AND row_id = v_reg::text
                               AND actor = harness.id('admin') AND reason = 'invitacion directa de administrador'),
    'la invitacion directa queda auditada con el administrador y el motivo');

  -- Cuenta Auth confirmada sin rol (caso merkatingadmon): se vincula solo con la autorizacion del administrador.
  INSERT INTO auth.users (email, email_confirmed_at) VALUES ('existente@test.local', now()) RETURNING id INTO v_user;
  PERFORM harness.as_user(harness.id('admin'));
  SELECT i.registration_id, i.auth_user_id INTO v_reg, v_found FROM public.admin_invite_ally('Existente@test.local', 'Aliado Existente', NULL, NULL) i;
  RESET ROLE;
  PERFORM harness.must(v_found = v_user AND NOT EXISTS (SELECT 1 FROM public.account_roles WHERE user_id = v_user),
    'cuenta existente: se detecta y aun no recibe rol ni perfil');
  PERFORM harness.as_user(harness.id('ally1'));
  PERFORM harness.expect_error(format('SELECT public.admin_finalize_registration(%L, %L)', v_reg, v_user), '42501');
  RESET ROLE;
  PERFORM harness.as_user(harness.id('admin'));
  PERFORM public.admin_finalize_registration(v_reg, v_user);
  PERFORM harness.expect_error(format($q$SELECT * FROM public.admin_invite_ally('existente@test.local','Aliado Existente',NULL,NULL)$q$), '23505');
  RESET ROLE;
  PERFORM harness.must(EXISTS (SELECT 1 FROM public.ally_profiles WHERE user_id = v_user AND status = 'active' AND approved_by = harness.id('admin'))
                       AND (SELECT count(*) FROM auth.users WHERE lower(email) = 'existente@test.local') = 1,
    'tras finalize el aliado queda activo, aprobado por el administrador y sin usuarios duplicados');
  PERFORM harness.must((SELECT registration_open FROM public.aliados_settings) = v_open, '0005 no cambia registration_open');
  PERFORM harness.must((SELECT fp FROM harness.fingerprint) = harness.compute_fp(), 'huellas de 0001/plataforma intactas tras 0005');
END $$;
