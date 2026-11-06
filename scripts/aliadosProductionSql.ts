// Genera los scripts SQL de Production de Aliados a partir de las migraciones validadas en el laboratorio.
// Las migraciones del laboratorio NO se modifican ni se les quita ninguna proteccion: la unica diferencia es
// que la guarda del laboratorio (assert_aliados_lab) se sustituye por la guarda de Production
// (assert_aliados_production, creada por supabase/production/aliados-prod-01-guard.sql).
// Uso: npm run generate:aliados-production-sql
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL_DOCUMENTS } from '../src/features/aliados/aliadosLegal';
import { legalDigest } from './aliadosLegalSeed';

const proposals = (name: string) => fileURLToPath(new URL(`../supabase/proposals/${name}`, import.meta.url));
export const PRODUCTION_DIR = fileURLToPath(new URL('../supabase/production/', import.meta.url));

export const LAB_GUARD = 'PERFORM public.assert_aliados_lab();';
export const PRODUCTION_GUARD = 'PERFORM public.assert_aliados_production();';

const BANNER = (labFile: string) =>
  `-- ALIADOS CHARLITRON — VERSION PRODUCTION de ${labFile}.\n` +
  `-- GENERADA por scripts/aliadosProductionSql.ts (npm run generate:aliados-production-sql). NO editar a mano.\n` +
  `-- Identica al archivo del laboratorio salvo la guarda: ${LAB_GUARD} -> ${PRODUCTION_GUARD}\n` +
  `-- Requiere haber ejecutado antes aliados-prod-00-preflight.sql (PASA) y aliados-prod-01-guard.sql.\n` +
  `-- Orden y procedimiento: docs/aliados-production-runbook.md. Todo el archivo es atomico (BEGIN ... COMMIT).\n\n`;

export function toProduction(labFile: string, lab: string): string {
  const occurrences = lab.split(LAB_GUARD).length - 1;
  if (occurrences !== 1) throw new Error(`${labFile}: se esperaba exactamente una guarda de laboratorio y hay ${occurrences}.`);
  return BANNER(labFile) + lab.replace(LAB_GUARD, PRODUCTION_GUARD);
}

export const PRODUCTION_MIGRATIONS = [
  { lab: 'aliados-lab-0006-acceptance.sql', production: 'aliados-prod-0006-acceptance.sql' },
  { lab: 'aliados-lab-0007-legal-documents.sql', production: 'aliados-prod-0007-legal-documents.sql' },
  { lab: 'aliados-lab-0006-acceptance-rollback.sql', production: 'aliados-prod-0006-acceptance-rollback.sql' },
] as const;

export const VERIFY_FILE = 'aliados-prod-99-verify.sql';

export function buildVerifySql(): string {
  const expected = LEGAL_DOCUMENTS.map((doc) => `('${doc.type}', '${doc.version}', '${legalDigest(doc)}')`).join(',\n  ');
  return `-- ALIADOS CHARLITRON — PRODUCTION, verificacion posterior (SOLO LECTURA). No modifica nada.
-- GENERADA por scripts/aliadosProductionSql.ts: las huellas SHA-256 esperadas salen de aliadosLegal.ts. NO editar a mano.
-- Ejecutar justo despues de instalar 0006 y 0007 (y antes del despliegue de la aplicacion). Debe dar RESULTADO GLOBAL = PASA.
-- Compara los datos con la fotografia guardada por aliados-prod-01-guard.sql (excepto el conteo de la bitacora, informativo).

WITH
expected_docs (doc_type, version, sha256) AS (VALUES
  ${expected}),
checks (orden, verificacion, ok) AS (
  SELECT 1, 'el marcador de Production existe y la guarda lo acepta',
         to_regclass('public.aliados_production_marker') IS NOT NULL
         AND (SELECT count(*) = 1 FROM public.aliados_production_marker WHERE environment = 'charlitron-aliados-production')
  UNION ALL
  SELECT 2, '0006 instalada: tablas, vistas y funciones de aceptacion presentes',
         to_regclass('public.ally_legal_documents') IS NOT NULL AND to_regclass('public.ally_acceptances') IS NOT NULL
         AND to_regclass('public.ally_current_acceptance') IS NOT NULL AND to_regclass('public.admin_ally_acceptances') IS NOT NULL
         AND to_regprocedure('public.ally_accept_terms(text, text, boolean, boolean)') IS NOT NULL
         AND to_regprocedure('public.ally_acceptance_state()') IS NOT NULL
  UNION ALL
  SELECT 3, '0007: exactamente las versiones esperadas, con la huella SHA-256 verificada y recalculada',
         (SELECT count(*) FROM public.ally_legal_documents) = (SELECT count(*) FROM expected_docs)
         AND NOT EXISTS (SELECT 1 FROM expected_docs e
                          WHERE NOT EXISTS (SELECT 1 FROM public.ally_legal_documents d
                                             WHERE d.doc_type = e.doc_type AND d.version = e.version
                                               AND d.content_sha256 = e.sha256
                                               AND d.content_sha256 = encode(sha256(convert_to(d.content, 'UTF8')), 'hex')))
  UNION ALL
  SELECT 4, 'ni 0006 ni 0007 registraron aceptaciones por su cuenta (informativo tras el lanzamiento: ver conteo abajo)',
         (SELECT count(*) FROM public.ally_acceptances) = 0
  UNION ALL
  SELECT 5, 'el registro publico sigue cerrado',
         (SELECT count(*) = 1 AND bool_and(registration_open = false) FROM public.aliados_settings)
  UNION ALL
  SELECT 6, 'anon solo ejecuta las dos funciones publicas de registro',
         (SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C")
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname ~ '^(admin_|aliados_|submit_|ally_)'
             AND has_function_privilege('anon', p.oid, 'EXECUTE'))
         = ARRAY['aliados_registration_open', 'submit_ally_registration']
  UNION ALL
  SELECT 7, 'anon no tiene privilegios sobre ninguna tabla ni vista de public; las tablas nuevas tienen RLS y cerradas a authenticated',
         NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                        AND has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
         AND (SELECT bool_and(c.relrowsecurity) FROM pg_class c
               WHERE c.oid IN ('public.ally_legal_documents'::regclass, 'public.ally_acceptances'::regclass))
         AND NOT has_table_privilege('authenticated', 'public.ally_acceptances', 'SELECT,INSERT,UPDATE,DELETE')
         AND NOT has_table_privilege('authenticated', 'public.ally_legal_documents', 'SELECT,INSERT,UPDATE,DELETE')
  UNION ALL
  SELECT 8, 'la aceptacion solo se ejecuta autenticado (ally_accept_terms y ally_acceptance_state)',
         has_function_privilege('authenticated', 'public.ally_accept_terms(text, text, boolean, boolean)', 'EXECUTE')
         AND has_function_privilege('authenticated', 'public.ally_acceptance_state()', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.ally_accept_terms(text, text, boolean, boolean)', 'EXECUTE')
         AND NOT has_function_privilege('anon', 'public.ally_acceptance_state()', 'EXECUTE')
  UNION ALL
  SELECT 9, 'aliados, referidos, ventas, cobros, comisiones y pagos identicos a la fotografia previa (conteos y huellas)',
         ((SELECT pre_snapshot FROM public.aliados_production_marker) - 'aliados_audit_log_count')
         = (public.aliados_production_snapshot() - 'aliados_audit_log_count')
)
SELECT orden, CASE WHEN ok IS TRUE THEN 'PASA' ELSE 'FALLA' END AS resultado, verificacion FROM checks
UNION ALL
SELECT 99, CASE WHEN bool_and(ok IS TRUE) THEN 'PASA' ELSE 'FALLA' END, 'RESULTADO GLOBAL' FROM checks
ORDER BY orden;

-- Evidencia "despues" (guardar junto con la de "antes"): conteos actuales, aceptaciones y bitacora.
SELECT jsonb_pretty(public.aliados_production_snapshot()) AS snapshot_despues,
       (SELECT count(*) FROM public.ally_acceptances) AS aceptaciones_registradas,
       (SELECT jsonb_agg(jsonb_build_object('doc_type', doc_type, 'version', version, 'sha256', content_sha256) ORDER BY doc_type) FROM public.ally_legal_documents) AS documentos_publicados,
       (SELECT (pre_snapshot ->> 'aliados_audit_log_count')::bigint FROM public.aliados_production_marker) AS bitacora_antes;
`;
}

export function buildProductionFiles(): Array<{ file: string; content: string }> {
  const migrations = PRODUCTION_MIGRATIONS.map(({ lab, production }) => ({
    file: production,
    content: toProduction(lab, readFileSync(proposals(lab), 'utf8')),
  }));
  return [...migrations, { file: VERIFY_FILE, content: buildVerifySql() }];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const { file, content } of buildProductionFiles()) {
    writeFileSync(`${PRODUCTION_DIR}${file}`, content);
    console.log(`generado ${file}`);
  }
}
