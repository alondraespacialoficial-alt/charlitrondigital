// JSON-LD puro (sin DOM ni import.meta) — compartido entre la SPA (seo.ts)
// y el script de prerender (scripts/prerender.ts) para que ambos emitan
// exactamente el mismo structured data.
import type { ArticleRow, FaqItem } from './database.types';

export function buildArticleJsonLd(
  article: ArticleRow,
  categoryName: string | null | undefined,
  siteUrl: string,
  siteName: string,
): object[] {
  const url = `${siteUrl}/blog/${article.slug}`;
  const graph: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt ?? undefined,
      image: article.cover_image_url ?? undefined,
      author: { '@type': 'Organization', name: article.author_name },
      publisher: {
        '@type': 'Organization',
        name: siteName,
        logo: { '@type': 'ImageObject', url: `${siteUrl}/charlitron-icon.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      datePublished: article.published_at ?? undefined,
      dateModified: article.updated_at,
      articleSection: categoryName ?? undefined,
      inLanguage: 'es-MX',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    },
  ];

  const faq = Array.isArray(article.faq) ? (article.faq as FaqItem[]) : [];
  if (faq.length > 0) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }
  return graph;
}

export function buildBlogJsonLd(siteUrl: string, siteName: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `Blog de ${siteName}`,
    url: `${siteUrl}/blog`,
    inLanguage: 'es-MX',
  };
}
