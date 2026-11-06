# Aliados Charlitron — Procedimiento de instalación en Production (0006 y 0007)

Estado: **preparado, NO ejecutado**. Nada de esto se ha aplicado en Production.
Alcance: instalar la aceptación electrónica (migraciones 0006 y 0007) en el proyecto Supabase de Aliados de Production y desplegar el PR #5 con **una sola integración a `main`**.

Qué NO cambia: aliados, referidos, ventas, cobros, comisiones y pagos; comisiones y acuerdos económicos; Auth y roles; `aliados_settings.registration_open` (el registro público sigue **cerrado**).

## Por qué hay scripts propios de Production

Las migraciones del laboratorio terminan en `PERFORM public.assert_aliados_lab();`, una guarda que solo pasa en `charlitron-aliados-test` (marcador `lab_environment` con los dos usuarios de prueba). **Esa guarda se conserva intacta en `supabase/proposals/`.** Para Production se genera una copia idéntica en `supabase/production/` donde únicamente esa línea cambia a `PERFORM public.assert_aliados_production();`, una guarda equivalente que exige un marcador de Production con el Reference ID confirmado, rechaza el proyecto editorial y rechaza cualquier base que conserve el marcador del laboratorio. Una prueba (`scripts/aliadosProductionSql.test.ts`) verifica que la única diferencia es esa línea y que las huellas SHA-256 son las mismas.

| Archivo (`supabase/production/`) | Tipo | Cuándo |
|---|---|---|
| `aliados-prod-00-preflight.sql` | solo lectura | paso 3 |
| `aliados-prod-01-guard.sql` | crea marcador, guarda y fotografía de datos | paso 4 |
| `aliados-prod-0006-acceptance.sql` | migración 0006 (generada) | paso 5 |
| `aliados-prod-0007-legal-documents.sql` | migración 0007: Términos v1.0 y Privacidad v1.2 (generada) | paso 6 |
| `aliados-prod-99-verify.sql` | solo lectura, compara contra la fotografía previa | paso 7 |
| `aliados-prod-0006-acceptance-rollback.sql` | reversión (generada) | solo si hay que revertir |

Regenerar: `npm run generate:aliados-production-sql`. No editar a mano los archivos generados.

## Reglas de detención

Detener el procedimiento, **no improvisar cambios** y reportar la fila o el mensaje exacto si:

- el Reference ID no coincide en los tres lugares del paso 1;
- el preflight da **FALLA** en cualquier fila (esquema distinto al laboratorio, tablas ajenas, anon con permisos extra, 0006/0007 ya presentes, registro abierto…);
- el preflight FALLA en las filas 2 u 11 porque la base conserva `lab_environment`: es `charlitron-aliados-test` (o una copia), no Production. Si Production y el laboratorio fueran el mismo proyecto, 0006/0007 ya están instaladas: no ejecutar los pasos 3 a 7 y pasar directamente al paso 8 (verificando antes en esa base que 0006/0007 estén íntegras);
- cualquier script lanza una excepción (todos son atómicos: si fallan, no queda nada a medias);
- `aliados-prod-99-verify.sql` no da PASA.

## Orden exacto

### 1. Identificar el proyecto (sin tocar nada)
Los tres valores deben coincidir y confirmarlos **dos personas**:
1. Supabase Dashboard › Project Settings › General › **Reference ID** del proyecto de Aliados de Production.
2. El host de `ALIADOS_SUPABASE_URL` en Vercel › Production (`https://<Reference ID>.supabase.co`).
3. No es `rvvqhpbtqgjpzflopflv` (editorial) ni el Reference ID de `charlitron-aliados-test`.

### 2. Respaldo y ventana
- Crear un respaldo/punto de restauración del proyecto de Aliados en Supabase y anotar su hora.
- Elegir una ventana tranquila: entre la instalación de 0006 (paso 5) y el despliegue (paso 9) los aliados activos **no podrán usar el panel** hasta aceptar (con la app anterior verían un error). Mantener esa ventana en minutos.
- Verificar en Vercel › Production que existen `ALIADOS_SUPABASE_URL` y `ALIADOS_SUPABASE_ANON_KEY` (clave pública `sb_publishable_…`/anon, nunca `service_role`) y en Supabase Auth: registros públicos deshabilitados y `https://<dominio de Production>/aliados/activar` en las Redirect URLs.

### 3. Preflight (solo lectura)
Ejecutar `aliados-prod-00-preflight.sql`. Debe dar **RESULTADO GLOBAL = PASA**. Guardar captura de las dos tablas de resultado (evidencia «antes»: cantidades y estado).

### 4. Marcador de Production
Abrir `aliados-prod-01-guard.sql`, reemplazar `REEMPLAZAR_REFERENCE_ID_PRODUCTION` (Reference ID confirmado) y `REEMPLAZAR_NOMBRE_SEGUNDA_PERSONA`, y ejecutar. Guarda la fotografía de datos («antes») en la propia base. No guardar el archivo editado en el repositorio.

### 5. Instalar 0006
Ejecutar `aliados-prod-0006-acceptance.sql` completo. Una segunda ejecución falla por diseño.

### 6. Instalar 0007
Ejecutar `aliados-prod-0007-legal-documents.sql` completo. Publica Términos v1.0 y Aviso de Privacidad v1.2 con las mismas huellas SHA-256 verificadas en el laboratorio. No crea ninguna aceptación.

### 7. Verificación posterior
Ejecutar `aliados-prod-99-verify.sql`: **RESULTADO GLOBAL = PASA** confirma versiones y huellas SHA-256 (recalculadas en la base), registro cerrado, permisos de `anon`/`authenticated`, RLS de las tablas nuevas, cero aceptaciones creadas por la instalación y que aliados, referidos, ventas, cobros, comisiones y pagos son idénticos (conteos y huellas) a la fotografía previa. Guardar la salida («después»).

### 8. Integración y despliegue (inmediatamente después del paso 7)
1. Confirmar que las comprobaciones de PR #5 están en verde y que Vercel Preview sigue funcionando.
2. **Un solo merge** de PR #5 a `main` (autorización expresa de Alondra). Vercel despliega Production.
3. Esperar el despliegue Ready.

### 9. Pruebas en Production (sin abrir el registro)
- `/aliados` y `/aliados/registro`: el registro sigue cerrado.
- Entrar como administrador de Aliados: el panel funciona y la vista de aceptaciones está vacía.
- Un aliado activo existente entra, ve la pantalla de aceptación con las dos casillas independientes, acepta y accede a su panel con sus referidos y comisiones intactos.
- Invitación de prueba a una cuenta controlada: el enlace abre `/aliados/activar` y permite crear la contraseña (el cliente editorial ya no intercepta el token).
- Sitio público, blog y `/admin` editorial sin cambios.
- Repetir `aliados-prod-99-verify.sql`: tras las primeras aceptaciones la fila 4 mostrará FALLA a propósito (ya existen aceptaciones legítimas); el resto debe seguir en PASA y la fila 9 igual mientras no haya actividad de negocio concurrente.

## Evidencia a conservar
Reference ID y nombre de quien confirmó (queda en `aliados_production_marker`), salidas de los pasos 3, 4, 7 y 9, hora del respaldo, hash del commit desplegado y huellas SHA-256 de las dos versiones legales.

## Plan de reversión
- **Aplicación**: Vercel › Deployments › Instant Rollback al despliegue anterior de `main` (o revertir el merge). Con la app anterior y 0006 aún instalada, los aliados activos no pueden usar su panel: si se revierte la app, revertir también la base de inmediato.
- **Base**: ejecutar `aliados-prod-0006-acceptance-rollback.sql` (atómico). Restaura `ally_my_*` y `submit_referral` a su definición anterior, retira `ally_accept_terms`, `ally_acceptance_state` y las vistas de aceptación, y **conserva** `ally_acceptances` y `ally_legal_documents` como evidencia. Al revertir, los aliados recuperan acceso sin aceptación vigente: solo con autorización expresa. La parte B del script (borrar tablas) está comentada y se rehúsa a borrar si hay aceptaciones.
- El marcador, la guarda y la fotografía de Production pueden quedarse; su retirada está comentada al final de `aliados-prod-01-guard.sql` y solo aplica si se aborta antes del paso 5.
- Restaurar el respaldo es el último recurso (pierde cualquier dato creado después del respaldo).
