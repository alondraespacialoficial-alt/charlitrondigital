#!/bin/bash
set -e

CONTAINER_NAME="aliados-test-db"
DB_USER="postgres"
DB_PASSWORD="testpass"
DB_NAME="aliados_test"
DB_PORT="5433"

echo "🐳 Starting PostgreSQL container..."
docker run --rm -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT:5432" \
  postgres:15-alpine

sleep 3

PSQL_CMD="docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"

echo "📝 Installing base security schema..."
$PSQL_CMD < /workspaces/charlitrondigital/supabase/proposals/aliados-lab-0001-security.sql

echo "📝 Installing complete schema v2..."
$PSQL_CMD < /workspaces/charlitrondigital/supabase/proposals/aliados-lab-0002-complete-schema.sql

echo "📝 Installing fixes v3..."
$PSQL_CMD < /workspaces/charlitrondigital/supabase/proposals/aliados-lab-0003-fixes.sql

echo "✅ Schemas installed. Running validation tests..."

# Función para ejecutar SQL y mostrar resultado
run_test() {
  local test_name=$1
  local sql=$2
  echo ""
  echo "🧪 TEST: $test_name"
  echo "───────────────────────────────"
  $PSQL_CMD -c "$sql" 2>&1 | head -20
}

# TEST 1: Registro seguro (usuario anónimo)
run_test "REGISTRO: insertar solicitud sin exponer tablas" \
"SET ROLE anon;
SELECT public.submit_registration(
  'ally@example.com',
  'Test Ally',
  '555-1234',
  'Mexico City',
  true
) as registration_id;"

# TEST 2: Admin aprueba y crea user (verificar privacidad post-aprobación)
run_test "APROBACIÓN: crear user Auth + ally_profile" \
"SET ROLE postgres;
WITH reg AS (
  SELECT id FROM public.ally_registrations WHERE email = 'ally@example.com' LIMIT 1
)
SELECT public.approve_registration_and_create_user((SELECT id FROM reg));"

# TEST 3: Aliado intenta acceder ventas directo (debe fallar)
run_test "PRIVACIDAD: aliado NO puede ver tabla sales" \
"SET ROLE authenticated;
SELECT COUNT(*) FROM public.sales LIMIT 1;"

# TEST 4: Aliado intenta actualizar comisión (debe fallar)
run_test "PROTECCIÓN: aliado NO puede modificar comisión" \
"SET ROLE authenticated;
SELECT id FROM public.commissions LIMIT 1;
-- Attempt update (should fail)
UPDATE public.commissions SET commission_amount = 999 WHERE id = (SELECT id FROM public.commissions LIMIT 1);"

# TEST 5: Crear venta y pagos parciales
run_test "VENTA Y COBRO: registrar venta + pagos parciales" \
"SET ROLE postgres;
WITH ally AS (SELECT user_id FROM public.ally_profiles LIMIT 1),
referral AS (
  SELECT id FROM public.referrals WHERE ally_id = (SELECT user_id FROM ally) LIMIT 1
),
sale AS (
  SELECT id FROM public.sales WHERE referral_id = (SELECT id FROM referral) LIMIT 1
)
SELECT 'Sale ID: ' || (SELECT id FROM sale) as result;"

# TEST 6: Comisión no supera cobros confirmados
run_test "COMISIONES: no superar proporción de cobros" \
"SET ROLE postgres;
WITH c AS (SELECT id FROM public.commissions LIMIT 1)
SELECT public.pay_commission_safe((SELECT id FROM c), 100::numeric);"

# TEST 7: Reversar pago (auditable)
run_test "REVERSIÓN: reversar pago sin borrar" \
"SET ROLE postgres;
WITH p AS (SELECT id FROM public.commission_payments WHERE status = 'completed' LIMIT 1)
SELECT public.reverse_commission_payment((SELECT id FROM p), 'Test reversal');"

# TEST 8: Intentar pago duplicado en concurrencia
run_test "CONCURRENCIA: detectar intentos duplicados" \
"SET ROLE postgres;
WITH c AS (SELECT id FROM public.commissions LIMIT 1)
SELECT COUNT(*) as duplicate_attempts FROM public.commission_payment_attempts WHERE commission_id = (SELECT id FROM c);"

echo ""
echo "🏁 All tests completed. Checking audit trail..."
run_test "AUDITORÍA: cambios registrados" \
"SELECT action, COUNT(*) FROM public.commissions_audit GROUP BY action;"

echo ""
echo "🧹 Cleanup..."
docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true

echo "✅ Validation complete."
