import { fetchAcceptanceState, type AcceptanceClient } from './aliadosAcceptance';

export type AllyStatus = 'pending' | 'active' | 'paused';

export type AliadosRole =
  | { kind: 'admin' }
  | { kind: 'ally'; status: AllyStatus; displayName: string; accepted: boolean }
  | { kind: 'none' };

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Subconjunto minimo de supabase-js, para poder probar la logica sin red.
export interface RoleQueryClient extends AcceptanceClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<QueryResult>;
      };
    };
  };
}

const STATUSES: readonly AllyStatus[] = ['pending', 'active', 'paused'];

// El rol sale solo de tablas protegidas por RLS (admin_users, ally_profiles), nunca de user_metadata.
// Cada usuario solo puede ver su propia fila; cualquier error se propaga y se trata como "sin acceso".
export async function resolveAliadosRole(client: RoleQueryClient, userId: string): Promise<AliadosRole> {
  const admin = await client.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (admin.error) throw new Error('No se pudo verificar el acceso.');
  if (admin.data) return { kind: 'admin' };

  const ally = await client.from('ally_profiles').select('display_name,status').eq('user_id', userId).maybeSingle();
  if (ally.error) throw new Error('No se pudo verificar el acceso.');
  if (!ally.data) return { kind: 'none' };

  const row = ally.data as { display_name?: unknown; status?: unknown };
  const status = STATUSES.find((value) => value === row.status);
  const resolved = status ?? 'paused';
  // La aceptacion vigente solo se consulta para aliados activos y siempre la decide la base; un error se propaga.
  const accepted = resolved === 'active' ? (await fetchAcceptanceState(client)).accepted : false;
  return {
    kind: 'ally',
    // Un estado desconocido se trata como pausado: ante la duda, sin acceso al panel.
    status: resolved,
    displayName: typeof row.display_name === 'string' ? row.display_name : '',
    accepted,
  };
}

export type AccessDestination = 'admin' | 'panel' | 'acceptance' | 'pending' | 'paused' | 'denied';

export function destinationFor(role: AliadosRole): AccessDestination {
  if (role.kind === 'admin') return 'admin';
  if (role.kind === 'ally') {
    // Activo pero sin aceptacion vigente: solo puede ver la pantalla de aceptacion.
    if (role.status === 'active') return role.accepted ? 'panel' : 'acceptance';
    return role.status === 'pending' ? 'pending' : 'paused';
  }
  return 'denied';
}

export function loginErrorMessage(error: { status?: number; code?: string } | null | undefined): string {
  if (!error) return '';
  if (error.status === 400 || error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.';
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}
