#!/usr/bin/env bash
# Valida las migraciones 0002 y 0003 en un PostgreSQL real y desechable (Docker). Solo pruebas locales.
# Resultado = codigos de salida de psql. Cualquier fallo detiene el script con exit != 0.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPOSALS="$HERE/../../supabase/proposals"
MIGRATION="${MIGRATION_FILE:-$PROPOSALS/aliados-lab-0002-operations.sql}"
IMAGE="${PG_IMAGE:-postgres:15-alpine}"
NAME="aliados-sql-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_c() { docker exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d aliados "$@"; }
step() { printf '\n== %s\n' "$1"; }

step "Contenedor $IMAGE"
docker run -d --rm --name "$NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=aliados "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres -d aliados && break
  sleep 1
done
docker exec "$NAME" pg_isready -q -h 127.0.0.1 -U postgres -d aliados
psql_c -tA -c "SELECT version()"

step "Emulacion de plataforma Supabase (shim)"
psql_c -f - < "$HERE/shim.sql"

step "Instalacion de 0001 (solo PASO 1; PASO 2 son pruebas que terminan en excepcion intencional)"
awk '/^-- PASO 2\./ { exit } { print }' "$PROPOSALS/aliados-lab-0001-security.sql" | psql_c -f -
psql_c -f - < "$HERE/fingerprint.sql"

step "Instalacion de 0002 (la migracion entregada, tal cual)"
psql_c -f - < "$MIGRATION"

step "Reinstalar 0002 debe FALLAR (guarda de idempotencia)"
if psql_c -f - < "$MIGRATION" >/dev/null 2>&1; then
  echo "ERROR: la segunda instalacion no fallo" >&2
  exit 1
fi
echo "ok  la segunda instalacion fue rechazada (exit != 0)"

step "Instalacion de 0003 (estado de aliados) sobre 0001+0002"
psql_c -f - < "$PROPOSALS/aliados-lab-0003-ally-status.sql"

step "Reinstalar 0003 debe FALLAR (guarda de idempotencia)"
if psql_c -f - < "$PROPOSALS/aliados-lab-0003-ally-status.sql" >/dev/null 2>&1; then
  echo "ERROR: la segunda instalacion de 0003 no fallo" >&2
  exit 1
fi
echo "ok  la segunda instalacion de 0003 fue rechazada (exit != 0)"

step "Pruebas funcionales y de acceso indebido"
psql_c -f - < "$HERE/tests.sql"

step "Concurrencia real: dos sesiones psql"
ADMIN="$(psql_c -tA -c "SELECT harness.id('admin')")"
C3="$(psql_c -tA -c "SELECT harness.id('c3')")"
C4="$(psql_c -tA -c "SELECT harness.id('c4')")"
PB4="$(psql_c -tA -c "SELECT harness.id('pb4')")"

# Ejecuta SQL como administrador autenticado, dentro de una transaccion.
admin_session() {
  psql_c -f - <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$ADMIN', true);
$1
COMMIT;
SQL
}
now_ms() { echo $(( $(date +%s%N) / 1000000 )); }

# Carrera 1: dos pagos de 60 sobre una comision de 100 con cobros completos. Solo uno puede entrar.
admin_session "SELECT public.admin_pay_commission('$C3', 60, 'race1-key-a01', 'transferencia'); SELECT pg_sleep(2);" >/dev/null &
PID_A=$!
sleep 0.8
T0=$(now_ms)
set +e
ERR_B="$(admin_session "SELECT public.admin_pay_commission('$C3', 60, 'race1-key-b01', 'transferencia');" 2>&1 >/dev/null)"
RC_B=$?
set -e
ELAPSED=$(( $(now_ms) - T0 ))
set +e; wait "$PID_A"; RC_A=$?; set -e
echo "carrera 1: A exit=$RC_A, B exit=$RC_B, B espero ${ELAPSED} ms"
[ "$RC_A" -eq 0 ] || { echo "ERROR: A debia tener exito" >&2; exit 1; }
[ "$RC_B" -ne 0 ] || { echo "ERROR: B debia fallar (sobrepago concurrente)" >&2; exit 1; }
[ "$ELAPSED" -ge 900 ] || { echo "ERROR: B no espero el bloqueo de A (${ELAPSED} ms): no hubo concurrencia real" >&2; exit 1; }
echo "mensaje de B: $(echo "$ERR_B" | head -n 1)"
psql_c -c "SELECT harness.must(public.aliados_commission_paid('$C3'::uuid) = 60
  , 'carrera 1: pagado = 60, el segundo pago concurrente no se inserto')"

# Carrera 2: misma llave de idempotencia en dos sesiones: un solo pago.
admin_session "SELECT public.admin_pay_commission('$C3', 40, 'race2-key-same', 'transferencia'); SELECT pg_sleep(2);" >/dev/null &
PID_A=$!
sleep 0.8
set +e
admin_session "SELECT public.admin_pay_commission('$C3', 40, 'race2-key-same', 'transferencia');" >/dev/null 2>&1
RC_B=$?
wait "$PID_A"; RC_A=$?
set -e
echo "carrera 2: A exit=$RC_A, B exit=$RC_B"
[ "$RC_A" -eq 0 ] && [ "$RC_B" -eq 0 ] || { echo "ERROR: ambas sesiones con la misma llave debian terminar sin error" >&2; exit 1; }
psql_c -c "SELECT harness.must((SELECT count(*) = 1 FROM public.commission_payments
                                 WHERE commission_id = '$C3'::uuid AND idempotency_key = 'race2-key-same')
                           AND public.aliados_commission_paid('$C3'::uuid) = 100,
  'carrera 2: una sola fila para la llave; pagado = 100 = comision acordada')"

# Carrera 3: revertir un cobro mientras otra sesion paga comision basada en ese cobro.
admin_session "SELECT public.admin_reverse_payment('$PB4', 'devolucion bancaria concurrente'); SELECT pg_sleep(2);" >/dev/null &
PID_A=$!
sleep 0.8
set +e
admin_session "SELECT public.admin_pay_commission('$C4', 80, 'race3-key-b01', 'transferencia');" >/dev/null 2>&1
RC_B=$?
wait "$PID_A"; RC_A=$?
set -e
echo "carrera 3: A(reversion) exit=$RC_A, B(pago 80) exit=$RC_B"
[ "$RC_A" -eq 0 ] || { echo "ERROR: la reversion debia tener exito" >&2; exit 1; }
[ "$RC_B" -ne 0 ] || { echo "ERROR: el pago debia fallar con cobros netos reducidos (limite 50)" >&2; exit 1; }
psql_c -c "SELECT harness.must((SELECT public.aliados_net_collected(c.sale_id) = 500 AND public.aliados_release_limit(c.id) = 50
                                        AND public.aliados_commission_paid(c.id) = 0
                                 FROM public.commissions c WHERE c.id = '$C4'::uuid),
  'carrera 3: cobros netos 500, liberable 50, pagado 0')"

step "Invariante global tras todas las pruebas"
psql_c -c "SELECT harness.must(NOT EXISTS (SELECT 1 FROM public.commissions c
                WHERE public.aliados_commission_paid(c.id) > public.aliados_release_limit(c.id)
                   OR public.aliados_commission_paid(c.id) > c.commission_amount)
  AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE public.aliados_net_collected(s.id) > s.amount_agreed),
  'ninguna comision pagada supera su limite ni su monto; ningun cobro neto supera la venta')"

printf '\nTODAS LAS PRUEBAS TERMINARON CON EXIT 0 (PostgreSQL: %s)\n' "$IMAGE"
