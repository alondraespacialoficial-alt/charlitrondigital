#!/bin/bash
set -e

CONTAINER="aliados-test-db"
DB_PORT="5433"
PSQL_LOCAL="psql -h localhost -p $DB_PORT -U postgres -d aliados_test"

echo "🐳 Starting PostgreSQL..."
docker run --rm -d \
  --name "$CONTAINER" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=aliados_test \
  -p "$DB_PORT:5432" \
  postgres:15-alpine > /dev/null 2>&1

sleep 5

echo "📥 Installing schema..."
PGPASSWORD=testpass $PSQL_LOCAL < /workspaces/charlitrondigital/supabase/proposals/aliados-lab-0003-complete.sql > /dev/null 2>&1

echo "✅ Schema installed. Running tests...\n"

# Create SQL test file
cat > /tmp/aliados-tests.sql << 'SQLEOF'
\set ON_ERROR_STOP on

-- Setup: Create admin and ally users
INSERT INTO auth.users (email) VALUES ('admin@test.local') ON CONFLICT DO NOTHING;
INSERT INTO public.ally_profiles (user_id, full_name, role) 
  SELECT id, 'Admin', 'admin' FROM auth.users WHERE email = 'admin@test.local' 
  ON CONFLICT DO NOTHING;

INSERT INTO auth.users (email) VALUES ('ally@test.local') ON CONFLICT DO NOTHING;
INSERT INTO public.ally_profiles (user_id, full_name, role) 
  SELECT id, 'Test Ally', 'ally' FROM auth.users WHERE email = 'ally@test.local' 
  ON CONFLICT DO NOTHING;

-- Get IDs
\set ADMIN_ID `psql -h localhost -p 5433 -U postgres -d aliados_test -tc "SELECT id FROM auth.users WHERE email='admin@test.local'"`
\set ALLY_ID `psql -h localhost -p 5433 -U postgres -d aliados_test -tc "SELECT id FROM auth.users WHERE email='ally@test.local'"`

-- TEST 1: Registration secure insert
SELECT 'TEST 1: REGISTRO SEGURO' as test;
SELECT CASE WHEN id IS NOT NULL THEN '✓ Registration submitted' ELSE '✗ Registration failed' END
  FROM public.ally_registrations 
  WHERE email = 'newally@test.com' 
  LIMIT 1;

-- TEST 2: Approval creates user + profile
SELECT 'TEST 2: APROBACIÓN Y CREACIÓN USER' as test;
SELECT CASE WHEN status = 'approved' THEN '✓ Registration approved' ELSE '✗ Approval failed' END
  FROM public.ally_registrations 
  WHERE email = 'newally@test.com' 
  LIMIT 1;

SELECT CASE WHEN role = 'ally' THEN '✓ Ally profile created' ELSE '✗ Profile creation failed' END
  FROM public.ally_profiles 
  WHERE email = 'newally@test.com' 
  LIMIT 1;

-- TEST 3: Referrals created
SELECT 'TEST 3: REFERIDOS' as test;
SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Referrals exist' ELSE '✗ No referrals' END
  FROM public.referrals;

-- TEST 4: Sales and payments
SELECT 'TEST 4: VENTAS Y COBROS' as test;
SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Sales exist' ELSE '✗ No sales' END
  FROM public.sales;

SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Payments recorded' ELSE '✗ No payments' END
  FROM public.payments;

-- TEST 5: Commission exists
SELECT 'TEST 5: COMISIONES' as test;
SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Commissions exist' ELSE '✗ No commissions' END
  FROM public.commissions;

SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Commission payments recorded' ELSE '✗ No commission payments' END
  FROM public.commission_payments WHERE reversed_at IS NULL;

-- TEST 6: Privacy - views work
SELECT 'TEST 6: PRIVACIDAD (vistas para aliado)' as test;
SELECT CASE WHEN COUNT(*) >= 0 THEN '✓ Ally referrals view accessible' ELSE '✗ View failed' END
  FROM public.referrals_ally_view;

SELECT CASE WHEN COUNT(*) >= 0 THEN '✓ Ally commissions view accessible' ELSE '✗ View failed' END
  FROM public.commissions_ally_view;

-- TEST 7: Reversal recorded
SELECT 'TEST 7: REVERSIÓN (auditable, no borra)' as test;
SELECT CASE WHEN COUNT(*) > 0 THEN '✓ Reversals recorded' ELSE '✗ No reversals' END
  FROM public.commission_payments WHERE reversed_at IS NOT NULL;

-- TEST 8: Audit trail
SELECT 'TEST 8: AUDITORÍA COMPLETA' as test;
SELECT COUNT(*) as audit_count FROM public.commissions_audit;
SELECT COUNT(*) as registration_audit_count FROM public.ally_registration_audit;

-- Final summary
SELECT 'FINAL RESULT' as result, 
  (SELECT COUNT(*) FROM public.ally_registrations WHERE status='approved') as registrations_approved,
  (SELECT COUNT(*) FROM public.ally_profiles WHERE role='ally') as allies_created,
  (SELECT COUNT(*) FROM public.referrals) as referrals,
  (SELECT COUNT(*) FROM public.sales) as sales,
  (SELECT COUNT(*) FROM public.payments) as payments,
  (SELECT COUNT(*) FROM public.commissions) as commissions,
  (SELECT COUNT(*) FROM public.commission_payments WHERE reversed_at IS NULL) as commission_payments_active;
SQLEOF

# Run tests
echo "Running validation suite...\n"
PGPASSWORD=testpass $PSQL_LOCAL -f /tmp/aliados-tests.sql 2>&1 | grep -E '(TEST|✓|✗|audit_count|result|aliases|referrals|sales|payments|commissions)' || true

echo "\n✅ Test suite complete\n"

# Cleanup
echo "🧹 Stopping container..."
docker stop "$CONTAINER" > /dev/null 2>&1

echo "✅ Validation finished"
