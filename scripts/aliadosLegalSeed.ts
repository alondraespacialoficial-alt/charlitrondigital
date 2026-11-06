// Genera supabase/proposals/aliados-lab-0007-legal-documents.sql a partir de src/features/aliados/aliadosLegal.ts,
// que es la fuente unica de los textos. Uso: npm run generate:aliados-legal-seed
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL_DOCUMENTS, canonicalLegalContent, type LegalDocument } from '../src/features/aliados/aliadosLegal';

export const LEGAL_SEED_PATH = fileURLToPath(new URL('../supabase/proposals/aliados-lab-0007-legal-documents.sql', import.meta.url));

export function legalDigest(doc: LegalDocument): string {
  return createHash('sha256').update(canonicalLegalContent(doc), 'utf8').digest('hex');
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function insertFor(doc: LegalDocument): string {
  const content = canonicalLegalContent(doc);
  if (content.includes('$legal$')) throw new Error('El contenido no puede incluir el delimitador $legal$.');
  return [
    `INSERT INTO public.ally_legal_documents (doc_type, version, effective_date, title, content, content_sha256, requires_reacceptance)`,
    `VALUES (${literal(doc.type)}, ${literal(doc.version)}, ${literal(doc.effectiveDate)}, ${literal(doc.title)},`,
    `  $legal$${content}$legal$,`,
    `  ${literal(legalDigest(doc))}, true);`,
  ].join('\n');
}

export function buildLegalSeedSql(): string {
  const versions = LEGAL_DOCUMENTS.map((doc) => `${doc.type} v${doc.version}`).join(' y ');
  const guardList = LEGAL_DOCUMENTS.map((doc) => `(${literal(doc.type)}, ${literal(doc.version)})`).join(', ');
  return `-- ALIADOS CHARLITRON — Migracion incremental 0007: publica las versiones documentales (${versions}).
-- GENERADA por scripts/aliadosLegalSeed.ts desde src/features/aliados/aliadosLegal.ts. NO editar a mano: cambia el
-- texto en aliadosLegal.ts, sube la version y regenera (npm run generate:aliados-legal-seed). Una prueba verifica
-- que este archivo coincide con el codigo.
-- Proyecto Supabase EXCLUSIVO de Aliados. NO ejecutar en ningun otro. Requiere 0006.
-- Cada fila guarda el texto canonico completo y su huella SHA-256 (la base verifica que coincidan). Las filas son
-- inmutables. Publicar estas versiones NO crea ninguna aceptacion: cada aliado debe aceptar dentro de la aplicacion.

BEGIN;

DO $guard$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aliados-lab-0007'));

  IF to_regclass('public.ally_legal_documents') IS NULL THEN
    RAISE EXCEPTION '0006 debe estar instalada. No se modifico nada.';
  END IF;

  PERFORM public.assert_aliados_lab();

  IF EXISTS (SELECT 1 FROM public.ally_legal_documents WHERE (doc_type, version) IN (${guardList})) THEN
    RAISE EXCEPTION '0007 ya esta instalada. No se modifico nada.';
  END IF;
END
$guard$;

${LEGAL_DOCUMENTS.map(insertFor).join('\n\n')}

COMMIT;

-- Verificacion posterior (solo lectura)
SELECT doc_type, version, effective_date, content_sha256, requires_reacceptance
FROM public.ally_legal_documents ORDER BY ordinal;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(LEGAL_SEED_PATH, buildLegalSeedSql(), 'utf8');
  console.log(`Escrito ${LEGAL_SEED_PATH}`);
}
