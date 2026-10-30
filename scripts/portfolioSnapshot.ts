// Snapshot de imágenes del portafolio para el prerender. Un error de lectura detiene la generación;
// solo un manifiesto confirmado como inexistente permite el placeholder.
import type { ProjectImage } from '../src/data/projects';
import {
  readPortfolioManifestWithRetry,
  resolvePortfolioManifestImages,
  type ManifestRetryOptions,
} from '../src/features/projects/portfolioManifest';

export interface PortfolioSnapshotFailure {
  slug: string;
  reason: string;
  detail: string;
}

export class PortfolioSnapshotError extends Error {
  constructor(readonly failures: PortfolioSnapshotFailure[]) {
    super(
      `No se pudo leer el manifiesto del portafolio (${failures
        .map((failure) => `${failure.slug}: ${failure.reason} ${failure.detail}`)
        .join('; ')}). Se detiene el build para no reemplazar fichas publicadas por el placeholder.`,
    );
    this.name = 'PortfolioSnapshotError';
  }
}

export interface PortfolioSnapshotOptions extends ManifestRetryOptions {
  supabaseUrl: string | undefined;
  slugs: string[];
  log?: (message: string) => void;
}

export async function loadPortfolioSnapshot(
  options: PortfolioSnapshotOptions,
): Promise<Record<string, ProjectImage[]>> {
  const { supabaseUrl, slugs, log = () => {}, ...retry } = options;
  if (!supabaseUrl) {
    throw new PortfolioSnapshotError([
      { slug: '*', reason: 'config', detail: 'La lectura de medios est\u00e1 activada pero falta VITE_SUPABASE_URL.' },
    ]);
  }

  const images: Record<string, ProjectImage[]> = {};
  const failures: PortfolioSnapshotFailure[] = [];
  for (const slug of slugs) {
    const result = await readPortfolioManifestWithRetry(supabaseUrl, slug, retry);
    if (result.status === 'ok') {
      images[slug] = resolvePortfolioManifestImages(result.manifest, supabaseUrl);
      log(`[prerender] portafolio ${slug}: versi\u00f3n ${result.manifest.version} (${images[slug].length} imagen(es))`);
    } else if (result.status === 'absent') {
      log(`[prerender] portafolio ${slug}: sin versi\u00f3n publicada (placeholder)`);
    } else {
      failures.push({ slug, reason: result.reason, detail: result.detail });
      log(`[prerender] portafolio ${slug}: ERROR ${result.reason} ${result.detail}`);
    }
  }

  if (failures.length > 0) throw new PortfolioSnapshotError(failures);
  return images;
}
