// Auditoría de permisos efectivos de Storage (anon / usuario no admin / admin). Núcleo puro y probable con un doble.
import type { StorageBucketLike, StorageErrorLike } from '../src/features/admin/portfolioStorageRepository';

export interface AuditBucket extends StorageBucketLike {
  list(prefix: string): PromiseLike<{ data: { name: string }[] | null; error: StorageErrorLike | null }>;
}

export interface AuditClient {
  from(bucket: string): AuditBucket;
}

export interface AuditContext {
  anon: AuditClient;
  user: AuditClient;
  admin: AuditClient;
  publicGet(bucket: string, path: string): Promise<number>;
  runId: string;
}

export interface AuditResult {
  name: string;
  passed: boolean;
  detail: string;
}

const DRAFTS = 'portfolio-drafts';
const PUBLISHED = 'portfolio-published';
const MAX_BYTES = 5 * 1024 * 1024;
const AUDIT_BUCKETS = new Set([DRAFTS, PUBLISHED]);
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{5,39}$/;

// Una violación de alcance aborta la auditoría; nunca cuenta como «rechazo esperado».
export class AuditScopeError extends Error {}

export function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) throw new AuditScopeError('runId no válido.');
}

export function assertAuditPath(bucket: string, path: string, runId: string): void {
  assertSafeRunId(runId);
  const prefix = `_audit/${runId}/`;
  if (!AUDIT_BUCKETS.has(bucket)) throw new AuditScopeError(`Bucket fuera de la auditoría: ${bucket}`);
  if (!path.startsWith(prefix) || path.length === prefix.length || /(^|\/)\.\.?(\/|$)|\/\/|\\/.test(path)) {
    throw new AuditScopeError(`Ruta fuera de ${prefix}: ${path}`);
  }
}

export function assertAuditPrefix(bucket: string, prefix: string, runId: string): void {
  assertSafeRunId(runId);
  if (!AUDIT_BUCKETS.has(bucket)) throw new AuditScopeError(`Bucket fuera de la auditoría: ${bucket}`);
  if (prefix !== `_audit/${runId}`) throw new AuditScopeError(`Prefijo fuera de _audit/${runId}: ${prefix}`);
}

// Todo acceso a Storage pasa por aquí: solo upload/download/remove/list y solo bajo _audit/<runId>/.
export function scopeAuditClient(client: AuditClient, runId: string): AuditClient {
  return {
    from(bucket) {
      const api = client.from(bucket);
      return {
        upload(path, body, options) {
          assertAuditPath(bucket, path, runId);
          return api.upload(path, body, options);
        },
        download(path) {
          assertAuditPath(bucket, path, runId);
          return api.download(path);
        },
        remove(paths) {
          paths.forEach((path) => assertAuditPath(bucket, path, runId));
          return api.remove(paths);
        },
        list(prefix) {
          assertAuditPrefix(bucket, prefix, runId);
          return api.list(prefix);
        },
      };
    },
  };
}

const json = (text: string) => new Blob([text], { type: 'application/json' });

export async function runPortfolioStorageAudit(rawContext: AuditContext): Promise<AuditResult[]> {
  assertSafeRunId(rawContext.runId);
  const context: AuditContext = {
    ...rawContext,
    anon: scopeAuditClient(rawContext.anon, rawContext.runId),
    user: scopeAuditClient(rawContext.user, rawContext.runId),
    admin: scopeAuditClient(rawContext.admin, rawContext.runId),
    publicGet: (bucket, path) => {
      assertAuditPath(bucket, path, rawContext.runId);
      return rawContext.publicGet(bucket, path);
    },
  };
  const results: AuditResult[] = [];
  const record = (name: string, passed: boolean, detail = '') => {
    results.push({ name, passed, detail: passed ? 'OK' : detail || 'Resultado distinto del esperado' });
  };
  const dir = `_audit/${context.runId}`;
  const jsonPath = `${dir}/probe.json`;
  const original = '{"audit":"original"}';
  const changed = '{"audit":"changed"}';
  // Cada ruta que algún rol intenta escribir, para limpiarla aunque una restricción falle.
  const touched = new Map<string, [string, string]>();
  const upload = (client: AuditClient, bucket: string, path: string, body: Blob, upsert: boolean) => {
    touched.set(`${bucket}/${path}`, [bucket, path]);
    return client.from(bucket).upload(path, body, { contentType: body.type, cacheControl: '0', upsert });
  };

  const attempt = async <T>(run: () => PromiseLike<T>): Promise<{ value?: T; thrown?: unknown }> => {
    try {
      return { value: await run() };
    } catch (thrown) {
      if (thrown instanceof AuditScopeError) throw thrown;
      return { thrown };
    }
  };

  const expectOk = async (name: string, run: () => PromiseLike<{ error: StorageErrorLike | null }>) => {
    const outcome = await attempt(run);
    const error = outcome.value?.error ?? (outcome.thrown ? { message: String(outcome.thrown) } : null);
    record(name, !error, `Se esperaba éxito: ${error?.message}`);
    return !error;
  };

  const expectDenied = async (name: string, run: () => PromiseLike<{ error: StorageErrorLike | null }>) => {
    const outcome = await attempt(run);
    const denied = Boolean(outcome.thrown) || Boolean(outcome.value?.error);
    record(name, denied, 'La operación se permitió y debía rechazarse');
  };

  const adminText = async (bucket: string, path: string): Promise<string | null> => {
    const outcome = await attempt(() => context.admin.from(bucket).download(path));
    const data = outcome.value?.data;
    return data ? data.text() : null;
  };

  try {
    // Admin: operaciones permitidas.
    await expectOk('admin sube a borradores', () => upload(context.admin, DRAFTS, jsonPath, json(original), false));
    await expectOk('admin sube a publicados', () => upload(context.admin, PUBLISHED, jsonPath, json(original), false));
    record('admin lee borradores', (await adminText(DRAFTS, jsonPath)) === original, 'No se pudo leer el borrador');
    record('admin lee publicados por API', (await adminText(PUBLISHED, jsonPath)) === original, 'No se pudo leer lo publicado');
    await expectOk('admin reemplaza (upsert) en publicados', () => upload(context.admin, PUBLISHED, jsonPath, json(changed), true));
    record('el reemplazo del admin tuvo efecto', (await adminText(PUBLISHED, jsonPath)) === changed, 'El contenido no cambió');
    const adminList = await attempt(() => context.admin.from(PUBLISHED).list(dir));
    record(
      'admin lista publicados',
      Boolean(adminList.value?.data?.some((entry) => entry.name === 'probe.json')),
      'El admin no vio el objeto de prueba',
    );

    // Límites del bucket (rechazados antes de guardar nada).
    await expectDenied('rechaza tipo MIME no permitido', () =>
      upload(context.admin, PUBLISHED, `${dir}/probe.txt`, new Blob(['x'], { type: 'text/plain' }), false),
    );
    await expectDenied('rechaza WebP mayor a 5 MiB', () =>
      upload(context.admin, PUBLISHED, `${dir}/big.webp`, new Blob([new Uint8Array(MAX_BYTES + 1)], { type: 'image/webp' }), false),
    );

    // Anon y usuario autenticado sin rol admin: todo denegado y sin efecto.
    for (const [label, client] of [['anónimo', context.anon], ['autenticado no admin', context.user]] as const) {
      await expectDenied(`${label} no sube a borradores`, () => upload(client, DRAFTS, `${dir}/${label}.json`, json('x'), false));
      await expectDenied(`${label} no sube a publicados`, () => upload(client, PUBLISHED, `${dir}/${label}.json`, json('x'), false));
      await expectDenied(`${label} no reemplaza lo publicado`, () => upload(client, PUBLISHED, jsonPath, json('hacked'), true));
      await expectDenied(`${label} no lee borradores`, () => client.from(DRAFTS).download(jsonPath) as PromiseLike<{ error: StorageErrorLike | null }>);
      await expectDenied(`${label} no lee publicados por API`, () => client.from(PUBLISHED).download(jsonPath) as PromiseLike<{ error: StorageErrorLike | null }>);

      for (const bucket of [DRAFTS, PUBLISHED]) {
        const listed = await attempt(() => client.from(bucket).list(dir));
        const visible = listed.value?.data?.length ?? 0;
        record(`${label} no lista ${bucket}`, Boolean(listed.thrown) || Boolean(listed.value?.error) || visible === 0, `Listó ${visible} objeto(s)`);
      }

      await attempt(() => client.from(PUBLISHED).remove([jsonPath]));
      await attempt(() => client.from(DRAFTS).remove([jsonPath]));
      record(
        `${label} no borra nada`,
        (await adminText(PUBLISHED, jsonPath)) === changed && (await adminText(DRAFTS, jsonPath)) === original,
        'Un objeto desapareció o cambió',
      );
    }

    // Lectura pública: el sitio usa la URL pública del bucket, no la API.
    record('URL pública de publicados responde 200', (await context.publicGet(PUBLISHED, jsonPath)) === 200, 'El manifiesto público no se puede leer');
    record('URL pública de borradores no responde 200', (await context.publicGet(DRAFTS, jsonPath)) !== 200, 'Los borradores son públicos');
  } finally {
    for (const [bucket, path] of touched.values()) {
      await attempt(() => context.admin.from(bucket).remove([path]));
    }
    const leftovers: string[] = [];
    for (const [bucket, path] of touched.values()) {
      if ((await adminText(bucket, path)) !== null) leftovers.push(`${bucket}/${path}`);
    }
    record(
      'limpieza de objetos de prueba',
      leftovers.length === 0,
      `Borrar manualmente: ${leftovers.join(', ')}`,
    );
  }
  return results;
}

// ---- Piloto controlado: administradora + sesión anónima. NO sustituye la auditoría completa (falta el usuario autenticado sin rol). ----

export interface PublicRead {
  status: number;
  contentType: string | null;
  bytes: Uint8Array;
}

export interface PilotContext {
  anon: AuditClient;
  admin: AuditClient;
  publicRead(bucket: string, path: string): Promise<PublicRead>;
  runId: string;
}

export const PILOT_PENDING = 'Usuario autenticado SIN rol administrador: PENDIENTE (no se probó).';

// WebP lossless de 1x1 px; no es contenido de ningún proyecto.
export const PILOT_WEBP = new Uint8Array(Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64'));

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, index) => value === b[index]);

export async function runPortfolioStoragePilot(rawContext: PilotContext): Promise<AuditResult[]> {
  assertSafeRunId(rawContext.runId);
  const { runId } = rawContext;
  const anon = scopeAuditClient(rawContext.anon, runId);
  const admin = scopeAuditClient(rawContext.admin, runId);
  const publicRead = (bucket: string, path: string) => {
    assertAuditPath(bucket, path, runId);
    return rawContext.publicRead(bucket, path);
  };
  const results: AuditResult[] = [];
  const record = (name: string, passed: boolean, detail = '') => {
    results.push({ name, passed, detail: passed ? 'OK' : detail || 'Resultado distinto del esperado' });
  };
  const dir = `_audit/${runId}`;
  const draftImage = `${dir}/pilot-draft.webp`;
  const publishedImage = `${dir}/pilot-published.webp`;
  const manifestPath = `${dir}/current.json`;
  const manifest = JSON.stringify({ audit: true, image: 'pilot-published.webp' });
  const webp = () => new Blob([PILOT_WEBP], { type: 'image/webp' });
  const manifestBlob = (text = manifest) => new Blob([text], { type: 'application/json' });
  const touched = new Map<string, [string, string]>();

  const attempt = async <T>(run: () => PromiseLike<T>): Promise<{ value?: T; thrown?: unknown }> => {
    try {
      return { value: await run() };
    } catch (thrown) {
      if (thrown instanceof AuditScopeError) throw thrown;
      return { thrown };
    }
  };
  const upload = (client: AuditClient, bucket: string, path: string, body: Blob, upsert: boolean) => {
    touched.set(`${bucket}/${path}`, [bucket, path]);
    return client.from(bucket).upload(path, body, { contentType: body.type, cacheControl: '0', upsert });
  };
  const expectOk = async (name: string, run: () => PromiseLike<{ error: StorageErrorLike | null }>) => {
    const outcome = await attempt(run);
    const error = outcome.value?.error ?? (outcome.thrown ? { message: String(outcome.thrown) } : null);
    record(name, !error, `Se esperaba éxito: ${error?.message}`);
  };
  const expectDenied = async (name: string, run: () => PromiseLike<{ error: StorageErrorLike | null }>) => {
    const outcome = await attempt(run);
    record(name, Boolean(outcome.thrown) || Boolean(outcome.value?.error), 'La operación se permitió y debía rechazarse');
  };
  const adminBytes = async (bucket: string, path: string): Promise<Uint8Array | null> => {
    const outcome = await attempt(() => admin.from(bucket).download(path));
    const data = outcome.value?.data;
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  };

  try {
    // Subida a borradores, lectura y listado (admin).
    await expectOk('admin sube la imagen WebP a borradores', () => upload(admin, DRAFTS, draftImage, webp(), false));
    const draftRead = await adminBytes(DRAFTS, draftImage);
    record('admin lee el borrador y los bytes coinciden', draftRead !== null && sameBytes(draftRead, PILOT_WEBP), 'El borrador leído difiere del subido');
    const listed = await attempt(() => admin.from(DRAFTS).list(dir));
    record('admin lista el borrador', Boolean(listed.value?.data?.some((entry) => entry.name === 'pilot-draft.webp')), 'No apareció en el listado');
    const draftPublic = await attempt(() => publicRead(DRAFTS, draftImage));
    record('el borrador no es público', draftPublic.value?.status !== 200, 'La URL pública de borradores respondió 200');

    // Publicación: imagen + manifiesto bajo _audit/.
    await expectOk('admin publica la imagen WebP', () => upload(admin, PUBLISHED, publishedImage, webp(), false));
    await expectOk('admin publica el manifiesto de prueba', () => upload(admin, PUBLISHED, manifestPath, manifestBlob(), false));
    const imagePublic = await attempt(() => publicRead(PUBLISHED, publishedImage));
    const image = imagePublic.value;
    record('URL pública de la imagen: 200, image/webp y bytes idénticos', image?.status === 200 && /^image\/webp/.test(image.contentType ?? '') && sameBytes(image.bytes, PILOT_WEBP), `status=${image?.status} tipo=${image?.contentType}`);
    const manifestPublic = await attempt(() => publicRead(PUBLISHED, manifestPath));
    const manifestRead = manifestPublic.value;
    record('URL pública del manifiesto: 200, JSON y contenido idéntico', manifestRead?.status === 200 && /json/.test(manifestRead.contentType ?? '') && new TextDecoder().decode(manifestRead.bytes) === manifest, `status=${manifestRead?.status} tipo=${manifestRead?.contentType}`);

    // Sesión anónima: nada de subir, modificar, borrar, leer borradores ni listar.
    await expectDenied('anónimo no sube a borradores', () => upload(anon, DRAFTS, `${dir}/anon.webp`, webp(), false));
    await expectDenied('anónimo no sube a publicados', () => upload(anon, PUBLISHED, `${dir}/anon.webp`, webp(), false));
    await expectDenied('anónimo no reemplaza la imagen publicada', () => upload(anon, PUBLISHED, publishedImage, manifestBlob('hacked'), true));
    await expectDenied('anónimo no reemplaza el manifiesto publicado', () => upload(anon, PUBLISHED, manifestPath, manifestBlob('hacked'), true));
    await expectDenied('anónimo no reemplaza el borrador', () => upload(anon, DRAFTS, draftImage, manifestBlob('hacked'), true));
    await expectDenied('anónimo no lee borradores por API', () => anon.from(DRAFTS).download(draftImage) as PromiseLike<{ error: StorageErrorLike | null }>);
    for (const bucket of [DRAFTS, PUBLISHED]) {
      const anonList = await attempt(() => anon.from(bucket).list(dir));
      const visible = anonList.value?.data?.length ?? 0;
      record(`anónimo no lista ${bucket}`, Boolean(anonList.thrown) || Boolean(anonList.value?.error) || visible === 0, `Listó ${visible} objeto(s)`);
    }
    await attempt(() => anon.from(DRAFTS).remove([draftImage]));
    await attempt(() => anon.from(PUBLISHED).remove([publishedImage, manifestPath]));

    // Persistencia: tras los intentos anónimos todo sigue igual.
    const draftAfter = await adminBytes(DRAFTS, draftImage);
    const publishedAfter = await adminBytes(PUBLISHED, publishedImage);
    const manifestAfter = await adminBytes(PUBLISHED, manifestPath);
    const publicAfter = await attempt(() => publicRead(PUBLISHED, publishedImage));
    record('persistencia: el borrador sigue intacto tras los intentos anónimos', draftAfter !== null && sameBytes(draftAfter, PILOT_WEBP), 'El borrador cambió o desapareció');
    record('persistencia: la imagen publicada sigue intacta', publishedAfter !== null && sameBytes(publishedAfter, PILOT_WEBP), 'La imagen publicada cambió o desapareció');
    record('persistencia: el manifiesto sigue intacto', manifestAfter !== null && new TextDecoder().decode(manifestAfter) === manifest, 'El manifiesto cambió o desapareció');
    record('persistencia: la URL pública sigue sirviendo los mismos bytes', publicAfter.value?.status === 200 && sameBytes(publicAfter.value.bytes, PILOT_WEBP), 'La URL pública cambió');

    // Eliminación por la administradora.
    await expectOk('admin elimina el borrador', () => admin.from(DRAFTS).remove([draftImage]));
    record('el borrador ya no existe', (await adminBytes(DRAFTS, draftImage)) === null, 'El borrador sigue existiendo');
    await expectOk('admin elimina lo publicado', () => admin.from(PUBLISHED).remove([publishedImage, manifestPath]));
    record('lo publicado ya no existe', (await adminBytes(PUBLISHED, publishedImage)) === null && (await adminBytes(PUBLISHED, manifestPath)) === null, 'Algún objeto publicado sigue existiendo');
  } finally {
    for (const [bucket, path] of touched.values()) {
      await attempt(() => admin.from(bucket).remove([path]));
    }
    const leftovers: string[] = [];
    for (const [bucket, path] of touched.values()) {
      if ((await adminBytes(bucket, path)) !== null) leftovers.push(`${bucket}/${path}`);
    }
    record('limpieza: no queda ningún objeto temporal', leftovers.length === 0, `Borrar manualmente: ${leftovers.join(', ')}`);
    const listedLeft: string[] = [];
    let listFailed = false;
    for (const bucket of [DRAFTS, PUBLISHED]) {
      const listing = await attempt(() => admin.from(bucket).list(dir));
      if (listing.thrown || listing.value?.error) listFailed = true;
      for (const entry of listing.value?.data ?? []) listedLeft.push(`${bucket}/${dir}/${entry.name}`);
    }
    record('limpieza: el listado de _audit/<runId>/ queda vacío en ambos buckets', !listFailed && listedLeft.length === 0, listFailed ? 'No se pudo listar para verificar' : `Borrar manualmente: ${listedLeft.join(', ')}`);
  }
  return results;
}

// Valida la clave pública sin imprimirla: debe ser anónima (no de servicio) y, si es un JWT, del proyecto esperado.
export function checkAnonKey(key: string, projectRef: string): { ok: boolean; detail: string } {
  if (key.startsWith('sb_publishable_')) return { ok: true, detail: 'clave publicable (formato nuevo)' };
  if (key.startsWith('sb_')) return { ok: false, detail: 'no es una clave publicable' };
  const payload = key.split('.')[1];
  if (!payload) return { ok: false, detail: 'formato de clave no reconocido' };
  let claims: { role?: unknown; ref?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, detail: 'la clave no se pudo interpretar' };
  }
  if (claims.role !== 'anon') return { ok: false, detail: `rol de la clave: ${String(claims.role)} (debe ser anon)` };
  if (claims.ref !== projectRef) return { ok: false, detail: `la clave es de otro proyecto (${String(claims.ref)})` };
  return { ok: true, detail: `clave anon del proyecto ${projectRef}` };
}
