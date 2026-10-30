// Doble en memoria de Storage con las reglas aprobadas (solo admin; 5 MiB; WebP/JSON). Solo para pruebas.
import type { StorageErrorLike, StorageUploadOptions } from './portfolioStorageRepository';

export type FakeRole = 'anon' | 'user' | 'admin';
type Operation = 'upload' | 'download' | 'remove' | 'list';

export interface FakeOverrides {
  anonCanWrite?: boolean;
  userCanReadDrafts?: boolean;
  draftsArePublic?: boolean;
  limitsDisabled?: boolean;
}

export interface FakeLogEntry {
  op: Operation;
  role: FakeRole;
  bucket: string;
  path: string;
  upsert?: boolean;
}

const BUCKETS: Record<string, { public: boolean; maxBytes: number; mimeTypes: string[] }> = {
  'portfolio-drafts': { public: false, maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/webp', 'application/json'] },
  'portfolio-published': { public: true, maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/webp', 'application/json'] },
};

const rlsError: StorageErrorLike = {
  message: 'new row violates row-level security policy',
  status: 403,
  statusCode: '403',
};
const notFound: StorageErrorLike = { message: 'Object not found', status: 400, statusCode: '404' };

export class FakeStorageServer {
  private readonly objects = new Map<string, { body: Blob; type: string }>();
  readonly log: FakeLogEntry[] = [];
  failWhen: ((op: Operation, bucket: string, path: string) => boolean) | null = null;

  constructor(private readonly overrides: FakeOverrides = {}) {}

  private allowed(role: FakeRole, bucket: string, kind: 'read' | 'write'): boolean {
    if (role === 'admin') return true;
    if (kind === 'write') return role === 'anon' && Boolean(this.overrides.anonCanWrite);
    return role === 'user' && bucket === 'portfolio-drafts' && Boolean(this.overrides.userCanReadDrafts);
  }

  private injectedFailure(op: Operation, bucket: string, path: string): StorageErrorLike | null {
    return this.failWhen?.(op, bucket, path) ? { message: 'injected failure', status: 500 } : null;
  }

  seed(bucket: string, path: string, body: Blob | string, type = 'application/json'): void {
    this.objects.set(`${bucket}/${path}`, { body: typeof body === 'string' ? new Blob([body], { type }) : body, type });
  }

  has(bucket: string, path: string): boolean {
    return this.objects.has(`${bucket}/${path}`);
  }

  read(bucket: string, path: string): Blob | undefined {
    return this.objects.get(`${bucket}/${path}`)?.body;
  }

  keys(bucket: string): string[] {
    return [...this.objects.keys()].filter((key) => key.startsWith(`${bucket}/`)).map((key) => key.slice(bucket.length + 1));
  }

  uploads(bucket: string): FakeLogEntry[] {
    return this.log.filter((entry) => entry.op === 'upload' && entry.bucket === bucket);
  }

  async publicGet(bucket: string, path: string): Promise<number> {
    const isPublic = BUCKETS[bucket]?.public || (bucket === 'portfolio-drafts' && this.overrides.draftsArePublic);
    return isPublic && this.has(bucket, path) ? 200 : 404;
  }

  async publicRead(bucket: string, path: string): Promise<{ status: number; contentType: string | null; bytes: Uint8Array }> {
    const status = await this.publicGet(bucket, path);
    const stored = this.objects.get(`${bucket}/${path}`);
    if (status !== 200 || !stored) return { status, contentType: null, bytes: new Uint8Array() };
    return { status, contentType: stored.type, bytes: new Uint8Array(await stored.body.arrayBuffer()) };
  }

  client(role: FakeRole) {
    const server = this;
    return {
      from(bucket: string) {
        const config = BUCKETS[bucket];
        return {
          async upload(path: string, body: Blob, options: StorageUploadOptions) {
            server.log.push({ op: 'upload', role, bucket, path, upsert: options.upsert });
            const injected = server.injectedFailure('upload', bucket, path);
            if (injected) return { error: injected };
            if (!config) return { error: { message: 'Bucket not found', status: 404 } };
            const exists = server.has(bucket, path);
            if (!server.allowed(role, bucket, 'write')) return { error: rlsError };
            if (exists && !options.upsert) {
              return { error: { message: 'The resource already exists', status: 409, statusCode: '409' } };
            }
            if (!server.overrides.limitsDisabled && !config.mimeTypes.includes(options.contentType)) {
              return { error: { message: 'mime type not supported', status: 415 } };
            }
            if (!server.overrides.limitsDisabled && body.size > config.maxBytes) {
              return { error: { message: 'The object exceeded the maximum allowed size', status: 413 } };
            }
            server.objects.set(`${bucket}/${path}`, { body, type: options.contentType });
            return { error: null };
          },
          async download(path: string) {
            server.log.push({ op: 'download', role, bucket, path });
            const injected = server.injectedFailure('download', bucket, path);
            if (injected) return { data: null, error: injected };
            const stored = server.objects.get(`${bucket}/${path}`);
            if (!stored || !server.allowed(role, bucket, 'read')) return { data: null, error: notFound };
            return { data: stored.body, error: null };
          },
          async remove(paths: string[]) {
            for (const path of paths) {
              server.log.push({ op: 'remove', role, bucket, path });
              if (server.allowed(role, bucket, 'write')) server.objects.delete(`${bucket}/${path}`);
            }
            return { error: null };
          },
          async list(prefix: string) {
            server.log.push({ op: 'list', role, bucket, path: prefix });
            if (!server.allowed(role, bucket, 'read')) return { data: [] as { name: string }[], error: null };
            const names = server
              .keys(bucket)
              .filter((key) => key.startsWith(`${prefix}/`))
              .map((key) => ({ name: key.slice(prefix.length + 1).split('/')[0] }));
            return { data: names, error: null };
          },
        };
      },
    };
  }
}
