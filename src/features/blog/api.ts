// Consultas públicas del blog. REGLA: nunca select('*'); solo las columnas
// necesarias por vista para minimizar egress. La RLS ya limita a `published`.
import { supabase } from '../../lib/supabaseClient';
import type { ArticleRow, ArticleSourceRow, CategoryRow } from '../../lib/database.types';

// Columnas para listados (sin `content`, que es lo pesado).
const LIST_COLUMNS =
  'id, title, slug, excerpt, cover_thumb_url, cover_alt, author_name, status, published_at, updated_at, category_id';

// Detalle completo de un artículo.
const DETAIL_COLUMNS =
  'id, title, slug, excerpt, content, cover_image_url, cover_thumb_url, cover_alt, author_name, status, meta_title, meta_description, faq, cta_text, cta_url, published_at, updated_at, category_id';

export interface ArticleListItem extends Pick<
  ArticleRow,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'cover_thumb_url'
  | 'cover_alt'
  | 'author_name'
  | 'status'
  | 'published_at'
  | 'updated_at'
  | 'category_id'
> {
  categories?: Pick<CategoryRow, 'name' | 'slug'> | null;
}

export async function listPublishedArticles(): Promise<ArticleListItem[]> {
  const { data, error } = await supabase
    .from('articles')
    .select(`${LIST_COLUMNS}, categories(name, slug)`)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ArticleListItem[];
}

export async function getPublishedArticleBySlug(
  slug: string,
): Promise<(ArticleRow & { categories?: Pick<CategoryRow, 'name' | 'slug'> | null }) | null> {
  const { data, error } = await supabase
    .from('articles')
    .select(`${DETAIL_COLUMNS}, categories(name, slug)`)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as (ArticleRow & { categories?: Pick<CategoryRow, 'name' | 'slug'> | null }) | null;
}

export async function listArticleSources(articleId: string): Promise<ArticleSourceRow[]> {
  const { data, error } = await supabase
    .from('article_sources')
    .select('id, article_id, title, url, publisher, published_date')
    .eq('article_id', articleId)
    .order('published_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ArticleSourceRow[];
}

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

// Slugs de servicios BTL relacionados con un artículo (migración 0002).
// Lectura pública: si la tabla aún no existe, devuelve [] (sin bloque).
export async function listArticleServiceSlugs(articleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('article_btl_services')
    .select('service_slug')
    .eq('article_id', articleId);
  if (error) return [];
  return (data ?? []).map((row) => row.service_slug);
}

export interface RelatedArticleItem {
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
}

// Consulta inversa: artículos publicados relacionados con un servicio BTL.
// La RLS ya excluye drafts/review/archived para anon; el filtro articles.status
// lo hace explícito. Si la tabla aún no existe, devuelve [] (sin bloque).
export async function listArticlesByServiceSlug(
  serviceSlug: string,
): Promise<RelatedArticleItem[]> {
  const { data, error } = await supabase
    .from('article_btl_services')
    .select('articles!inner(title, slug, excerpt, published_at, status)')
    .eq('service_slug', serviceSlug)
    .eq('articles.status', 'published');
  if (error) return [];
  return (
    (data ?? []) as unknown as { articles: RelatedArticleItem & { status: string } }[]
  )
    .filter((row) => row.articles.status === 'published')
    .map((row) => ({
      title: row.articles.title,
      slug: row.articles.slug,
      excerpt: row.articles.excerpt,
      published_at: row.articles.published_at,
    }));
}
