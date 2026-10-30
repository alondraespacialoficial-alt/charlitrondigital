import type { ProjectImage } from '../../data/projects';
import {
  MAX_PORTFOLIO_GALLERY_IMAGES,
  type PortfolioManifest,
  type PortfolioManifestImage,
} from '../admin/portfolioModel';

export const PORTFOLIO_PUBLISHED_BUCKET = 'portfolio-published';

export function currentPortfolioManifestUrl(supabaseUrl: string, projectSlug: string): string {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  return `${baseUrl}/storage/v1/object/public/${PORTFOLIO_PUBLISHED_BUCKET}/projects/${encodeURIComponent(projectSlug)}/current.json`;
}

function isValidImage(value: unknown): value is PortfolioManifestImage {
  if (!value || typeof value !== 'object') return false;
  const image = value as Partial<PortfolioManifestImage>;
  return (
    typeof image.path === 'string' && isSafeStoragePath(image.path) &&
    typeof image.thumbPath === 'string' && isSafeStoragePath(image.thumbPath) &&
    typeof image.alt === 'string' && image.alt.trim().length > 0 && image.alt.trim().length <= 250 &&
    Number.isInteger(image.order) && Number(image.order) >= 0 &&
    Number.isInteger(image.width) && Number(image.width) > 0 &&
    Number.isInteger(image.height) && Number(image.height) > 0
  );
}

function isSafeStoragePath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('..') && !path.includes('\\');
}

export function parsePortfolioManifest(value: unknown, expectedSlug: string): PortfolioManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<PortfolioManifest>;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.projectSlug !== expectedSlug ||
    !Number.isInteger(manifest.version) || Number(manifest.version) < 1 ||
    typeof manifest.publishedAt !== 'string' ||
    !isValidImage(manifest.cover) ||
    !Array.isArray(manifest.gallery) ||
    manifest.gallery.length > MAX_PORTFOLIO_GALLERY_IMAGES ||
    !manifest.gallery.every(isValidImage)
  ) {
    return null;
  }
  const orders = manifest.gallery.map((image) => image.order);
  if (new Set(orders).size !== orders.length) return null;
  return manifest as PortfolioManifest;
}

export type ManifestReadFailure = 'network' | 'http' | 'invalid-json' | 'invalid-manifest';

export type ManifestReadResult =
  | { status: 'ok'; manifest: PortfolioManifest }
  | { status: 'absent' }
  | { status: 'error'; reason: ManifestReadFailure; detail: string; httpStatus?: number };

// «Ausente» solo si Storage dice explícitamente que el objeto no existe; todo lo demás es un error.
function isObjectNotFound(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }
  if (!payload || typeof payload !== 'object') return false;
  const { statusCode, error, message } = payload as Record<string, unknown>;
  const text = `${String(error ?? '')} ${String(message ?? '')}`;
  if (/bucket/i.test(text)) return false;
  return String(statusCode) === '404' || /not.?found/i.test(text);
}

export async function readPortfolioManifest(
  supabaseUrl: string,
  projectSlug: string,
  fetcher: typeof fetch = fetch,
): Promise<ManifestReadResult> {
  let response: Response;
  try {
    response = await fetcher(currentPortfolioManifestUrl(supabaseUrl, projectSlug), {
      cache: 'no-store',
    });
  } catch (error) {
    return { status: 'error', reason: 'network', detail: error instanceof Error ? error.message : 'sin conexión' };
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    return { status: 'error', reason: 'network', detail: error instanceof Error ? error.message : 'lectura interrumpida' };
  }

  if (!response.ok) {
    if (isObjectNotFound(response.status, body)) return { status: 'absent' };
    return { status: 'error', reason: 'http', detail: `HTTP ${response.status}`, httpStatus: response.status };
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { status: 'error', reason: 'invalid-json', detail: 'La respuesta no es JSON.' };
  }
  const manifest = parsePortfolioManifest(json, projectSlug);
  if (!manifest) {
    return { status: 'error', reason: 'invalid-manifest', detail: 'El manifiesto no cumple el esquema esperado.' };
  }
  return { status: 'ok', manifest };
}

export interface ManifestRetryOptions {
  fetcher?: typeof fetch;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

// Solo los errores se reintentan; ok y ausente son resultados definitivos.
export async function readPortfolioManifestWithRetry(
  supabaseUrl: string,
  projectSlug: string,
  options: ManifestRetryOptions = {},
): Promise<ManifestReadResult> {
  const { fetcher = fetch, attempts = 3, delayMs = 1000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = options;
  let result = await readPortfolioManifest(supabaseUrl, projectSlug, fetcher);
  for (let attempt = 2; attempt <= attempts && result.status === 'error'; attempt += 1) {
    await sleep(delayMs * (attempt - 1));
    result = await readPortfolioManifest(supabaseUrl, projectSlug, fetcher);
  }
  return result;
}

// Uso en cliente: ante cualquier fallo se conserva lo que ya hay en pantalla.
export async function loadPortfolioManifest(
  supabaseUrl: string,
  projectSlug: string,
  fetcher: typeof fetch = fetch,
): Promise<PortfolioManifest | null> {
  const result = await readPortfolioManifest(supabaseUrl, projectSlug, fetcher);
  return result.status === 'ok' ? result.manifest : null;
}

export function resolvePortfolioManifestImages(
  manifest: PortfolioManifest,
  supabaseUrl: string,
): ProjectImage[] {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const toImage = (image: PortfolioManifestImage): ProjectImage => ({
    src: `${baseUrl}/storage/v1/object/public/${PORTFOLIO_PUBLISHED_BUCKET}/${image.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    alt: image.alt,
    width: image.width,
    height: image.height,
  });
  return [manifest.cover, ...[...manifest.gallery].sort((a, b) => a.order - b.order)].map(toImage);
}