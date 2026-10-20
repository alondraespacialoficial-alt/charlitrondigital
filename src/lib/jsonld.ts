// JSON-LD puro (sin DOM ni import.meta) — compartido entre la SPA (seo.ts)
// y el script de prerender (scripts/prerender.ts) para que ambos emitan
// exactamente el mismo structured data.
import type { ArticleRow, FaqItem } from './database.types';
import type { BtlService } from '../data/btl';
import { CONTACT_EMAIL, FACEBOOK_URL, INSTAGRAM_URL, PHONE_DISPLAY } from '../data/content';

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

// ============================================================================
// BTL / Charlitron Agencia (Fase 1 SEO)
//
// Modelado de entidades (sin jerarquía corporativa inventada):
//   - Charlitron Digital  → ProfessionalService @id `${siteUrl}/#org`
//                           (definida en el script estático de index.html)
//   - Charlitron Agencia  → ProfessionalService @id `${siteUrl}/agencia#org`
//   - Ambas comparten la marca "Charlitron" (@id `${siteUrl}/#brand`), que es
//     la relación explícita entre ambas unidades: misma marca, dos unidades.
// ============================================================================

const AGENCY_AREA_SERVED = 'San Luis Potosí, México';

function buildBrandNode(siteUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    '@id': `${siteUrl}/#brand`,
    name: 'Charlitron',
  };
}

function buildAgencyOrgNode(siteUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${siteUrl}/agencia#org`,
    name: 'Charlitron Agencia',
    alternateName: 'Charlitron BTL',
    description:
      'Unidad de ejecución presencial y BTL de la marca Charlitron. Demostradoras, promotores, edecanes, activaciones, perifoneo, volanteo y producción audiovisual en San Luis Potosí.',
    url: `${siteUrl}/agencia`,
    image: `${siteUrl}/og-default.png`,
    telephone: `+52 ${PHONE_DISPLAY}`,
    email: CONTACT_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'San Luis Potosí',
      addressRegion: 'San Luis Potosí',
      addressCountry: 'MX',
    },
    areaServed: AGENCY_AREA_SERVED,
    brand: { '@id': `${siteUrl}/#brand` },
    sameAs: [FACEBOOK_URL, INSTAGRAM_URL],
  };
}

export function buildAgencyHubJsonLd(
  siteUrl: string,
  services: BtlService[],
): object[] {
  return [
    buildAgencyOrgNode(siteUrl),
    buildBrandNode(siteUrl),
    {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Servicios BTL en San Luis Potosí',
      itemListElement: services.map((service, index) => ({
        '@type': 'Offer',
        position: index + 1,
        itemOffered: {
          '@type': 'Service',
          name: service.serviceType,
          url: `${siteUrl}/agencia/${service.slug}`,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Agencia BTL', item: `${siteUrl}/agencia` },
      ],
    },
  ];
}

export function buildBtlServiceJsonLd(service: BtlService, siteUrl: string): object[] {
  const url = `${siteUrl}/agencia/${service.slug}`;
  const graph: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${url}#service`,
      serviceType: service.serviceType,
      name: service.serviceType,
      description: service.metaDescription,
      url,
      provider: { '@id': `${siteUrl}/agencia#org` },
      areaServed: AGENCY_AREA_SERVED,
      inLanguage: 'es-MX',
    },
    // Entidad proveedora (referenciada por @id desde Service) + marca compartida.
    buildAgencyOrgNode(siteUrl),
    buildBrandNode(siteUrl),
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Agencia BTL', item: `${siteUrl}/agencia` },
        { '@type': 'ListItem', position: 3, name: service.shortName, item: url },
      ],
    },
  ];

  // FAQPage SOLO cuando las FAQs están visibles en la página (regla aprobada).
  if (service.faqs.length > 0) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: service.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }
  return graph;
}
