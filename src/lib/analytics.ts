// Medición mínima: page views sin cookies, sin IP, sin fingerprint.
// Solo path + referrer. Insert anónimo permitido por RLS; lectura solo admin.
import { supabase, isSupabaseConfigured } from './supabaseClient';

const sent = new Set<string>();

export function trackPageView(path: string, articleSlug?: string) {
  if (!isSupabaseConfigured) return;
  const key = `${path}`;
  if (sent.has(key)) return; // una vista por carga de página
  sent.add(key);

  const referrer = document.referrer || null;
  void supabase
    .from('page_views')
    .insert({ path, article_slug: articleSlug ?? null, referrer })
    .then(({ error }) => {
      if (error) console.warn('[analytics] page_view falló:', error.message);
    });
}
