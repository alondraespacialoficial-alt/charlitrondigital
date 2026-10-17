// Medición mínima — DESACTIVADA desde el navegador por seguridad/costos.
// La migración 0001_init.sql (§9) ya NO permite inserts anónimos en
// page_views; la recolección pública se resolverá con un endpoint
// rate-limited o Vercel Analytics. La tabla y el panel admin se conservan.
//
// Se mantiene la firma para no tocar a los llamadores; es un no-op.
export function trackPageView(_path: string, _articleSlug?: string) {
  // no-op intencional hasta tener canal de métricas con rate-limit.
}
