// Política de redeploy del blog (función pura, sin dependencias de red ni de
// Vite, para poder probarla de forma aislada).
import type { ArticleStatus } from '../../lib/database.types';

/**
 * Solo los cambios que alteran el contenido público del blog justifican un
 * redeploy de producción (regenera prerender, sitemap y páginas del blog):
 *   - publicar un artículo nuevo;
 *   - editar un artículo que sigue publicado;
 *   - archivar un artículo.
 * Borradores (`draft`) y revisión (`review`) NO disparan redeploy.
 */
export function shouldTriggerBlogRedeploy(status: ArticleStatus): boolean {
  return status === 'published' || status === 'archived';
}
