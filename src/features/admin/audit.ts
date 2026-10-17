// Bitácora de acciones sensibles del admin. Insert propio permitido por RLS.
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export async function logAdminAction(
  user: User | null,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  if (!user) return;
  const { error } = await supabase.from('admin_audit_log').insert({
    user_id: user.id,
    user_email: user.email ?? null,
    action,
    entity,
    entity_id: entityId ?? null,
    metadata,
  });
  if (error) console.warn('[audit] no se pudo registrar:', error.message);
}
