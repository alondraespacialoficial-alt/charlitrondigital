// ============================================================================
// Prerender estático (SSG ligero) del blog — corre DESPUÉS de `vite build`.
//
// Qué hace:
//   1. Lee artículos `published` vía Supabase REST (anon key, columnas mínimas).
//   2. Genera dist/blog/index.html y dist/blog/<slug>/index.html con el
//      contenido y metas completas (canonical, OG, Twitter, JSON-LD) ya en el
//      HTML → crawlers y previews sociales no necesitan ejecutar JS.
//   3. Genera dist/sitemap.xml (robots.txt es estático en public/).
//
// Si faltan variables de entorno, avisa y NO rompe el build (el blog sigue
// funcionando client-side; solo se pospone la indexación óptima).
// ============================================================================
import { config as loadEnv } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderMarkdownLite } from '../src/lib/markdown';
import {
  buildAgencyHubJsonLd,
  buildArticleJsonLd,
  buildBlogJsonLd,
  buildBtlCasesJsonLd,
  buildBtlServiceJsonLd,
  buildPortfolioProjectJsonLd,
} from '../src/lib/jsonld';
import type { ArticleRow, CategoryRow } from '../src/lib/database.types';
import {
  AGENCY_HUB,
  BTL_CASES,
  BTL_CASES_PAGE,
  BTL_SERVICES,
  getBtlCase,
  getBtlService,
  type BtlCaseStudy,
  type BtlService,
} from '../src/data/btl';
import {
  AGENCY_SERVICES,
  BUSINESS_NEEDS,
  CONTACT_EMAIL,
  PHONE_DISPLAY,
  SERVICES_LIST,
  WORK_STEPS,
  createWhatsAppUrl,
} from '../src/data/content';
import {
  CONCEPT_SOLUTIONS,
  PROJECTS,
  PROJECT_FEATURE_STATUS_LABELS,
} from '../src/data/projects';
import { isPortfolioPreviewEnvironment } from './portfolioPreviewPolicy';

// En local carga .env.local / .env; en Vercel las vars ya vienen en process.env.
const isolatePortfolioPreview = isPortfolioPreviewEnvironment(process.env);
if (!isolatePortfolioPreview) loadEnv({ path: ['.env.local', '.env'] });

const SUPABASE_URL = isolatePortfolioPreview ? undefined : process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = isolatePortfolioPreview
  ? undefined
  : process.env.VITE_SUPABASE_ANON_KEY;
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://www.charlitrondigital.com').replace(
  /\/$/,
  '',
);
const SITE_NAME = 'Charlitron Digital';
// Imagen OG de marca (1200x630). site.ts no se puede importar aquí porque usa
// import.meta.env (solo Vite); este valor debe coincidir con DEFAULT_SOCIAL_IMAGE.
const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/og-default.png`;
const DEFAULT_SOCIAL_IMAGE_ALT =
  'Logo de Charlitron Digital, agencia digital en San Luis Potosí';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

type ArticleWithCategory = ArticleRow & {
  categories?: Pick<CategoryRow, 'name' | 'slug'> | null;
  // Relaciones N:M con servicios BTL (migración 0002). Si la tabla aún no
  // existe en el proyecto, el fetch reintenta sin el embed y queda vacío.
  article_btl_services?: { service_slug: string }[] | null;
};

// Slugs de servicios BTL de un artículo, filtrados contra el catálogo vigente.
function articleServiceSlugs(article: ArticleWithCategory): string[] {
  return (article.article_btl_services ?? [])
    .map((r) => r.service_slug)
    .filter((slug) => Boolean(getBtlService(slug)));
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface HeadMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: 'website' | 'article';
  ogImage?: string | null;
  ogImageAlt?: string | null;
  ogImageWidth?: number;
  ogImageHeight?: number;
  publishedTime?: string | null;
  jsonLd?: object | object[];
}

function applyHead(template: string, meta: HeadMeta): string {
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(meta.title)}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtmlAttr(meta.description)}" />`,
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${escapeHtmlAttr(meta.canonical)}" />`,
  );
  html = html.replace(
    /<meta property="og:type" content="[^"]*" \/>/,
    `<meta property="og:type" content="${meta.ogType}" />`,
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${escapeHtmlAttr(meta.canonical)}" />`,
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />`,
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />`,
  );
  if (meta.ogImage) {
    const img = escapeHtmlAttr(meta.ogImage);
    html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${img}" />`);
    html = html.replace(
      /<meta property="og:image:secure_url" content="[^"]*" \/>/,
      `<meta property="og:image:secure_url" content="${img}" />`,
    );
    html = html.replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${img}" />`);
    if (meta.ogImageAlt) {
      const alt = escapeHtmlAttr(meta.ogImageAlt);
      html = html.replace(
        /<meta property="og:image:alt" content="[^"]*" \/>/,
        `<meta property="og:image:alt" content="${alt}" />`,
      );
      html = html.replace(
        /<meta name="twitter:image:alt" content="[^"]*" \/>/,
        `<meta name="twitter:image:alt" content="${alt}" />`,
      );
    }
    if (meta.ogImageWidth && meta.ogImageHeight) {
      html = html.replace(
        /<meta property="og:image:width" content="[^"]*" \/>/,
        `<meta property="og:image:width" content="${meta.ogImageWidth}" />`,
      );
      html = html.replace(
        /<meta property="og:image:height" content="[^"]*" \/>/,
        `<meta property="og:image:height" content="${meta.ogImageHeight}" />`,
      );
    }
  }
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${escapeHtmlAttr(meta.canonical)}" />`,
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />`,
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />`,
  );

  const headExtras: string[] = [];
  if (meta.ogType === 'article' && meta.publishedTime) {
    headExtras.push(
      `    <meta property="article:published_time" content="${escapeHtmlAttr(meta.publishedTime)}" />`,
    );
  }
  if (meta.jsonLd) {
    const jsonLdScript = `    <script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`;
    headExtras.push(jsonLdScript);
  }
  if (headExtras.length > 0) {
    html = html.replace('</head>', `${headExtras.join('\n')}\n  </head>`);
  }

  return html;
}

function injectBody(template: string, staticHtml: string): string {
  return template.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered="true">${staticHtml}</div>`,
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

function renderArticleStatic(article: ArticleWithCategory): string {
  const parts: string[] = [];
  parts.push('<main style="max-width:48rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">');
  parts.push('<p><a href="/blog">← Blog</a></p>');
  if (article.categories?.name) {
    parts.push(`<p><strong>${article.categories.name}</strong></p>`);
  }
  parts.push(`<h1>${article.title}</h1>`);
  const dates: string[] = [article.author_name];
  if (article.published_at) dates.push(`Publicado: ${fmtDate(article.published_at)}`);
  if (article.updated_at && article.updated_at !== article.published_at) {
    dates.push(`Actualizado: ${fmtDate(article.updated_at)}`);
  }
  parts.push(`<p>${dates.join(' · ')}</p>`);
  if (article.cover_image_url) {
    parts.push(
      `<img src="${article.cover_image_url}" alt="${escapeHtmlAttr(article.cover_alt ?? article.title)}" width="1600" height="900" />`,
    );
  }
  parts.push(renderMarkdownLite(article.content));
  // Servicios BTL relacionados (visibles → también alimentan mentions del
  // JSON-LD del artículo).
  const linkedServices = articleServiceSlugs(article)
    .map((s) => getBtlService(s))
    .filter((s): s is BtlService => Boolean(s));
  if (linkedServices.length > 0) {
    parts.push('<h2>Servicios relacionados</h2>');
    parts.push(
      `<ul>${linkedServices
        .map(
          (s) =>
            `<li><a href="/agencia/${s.slug}">${s.shortName} — ${s.serviceType} en San Luis Potosí</a></li>`,
        )
        .join('')}</ul>`,
    );
  }
  if (article.cta_text && article.cta_url) {
    parts.push(`<p><a href="${escapeHtmlAttr(article.cta_url)}">${article.cta_text}</a></p>`);
  }
  parts.push('</main>');
  return parts.join('\n');
}

function renderBlogListStatic(articles: ArticleWithCategory[]): string {
  const items = articles
    .map((article) => {
      const thumb = article.cover_thumb_url
        ? `<img src="${article.cover_thumb_url}" alt="${escapeHtmlAttr(article.cover_alt ?? article.title)}" width="480" height="270" />`
        : '';
      return `<article>${thumb}<h2><a href="/blog/${article.slug}">${article.title}</a></h2>${
        article.excerpt ? `<p>${article.excerpt}</p>` : ''
      }<p>${fmtDate(article.published_at)}</p></article>`;
    })
    .join('\n');
  return `<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">
<h1>Blog — ${SITE_NAME}</h1>
<p>Ideas sobre webs, apps, automatización, IA y marketing local para negocios en México.</p>
${items}
</main>`;
}

// Home estática: contenido REAL de la landing (Hero, WhatWeDo, NeedsSelector,
// EvidenceSection, HowWeWork, ComplementaryServices, ContactSection) para que
// crawlers e IA que no ejecutan JS no vean la página vacía. React reemplaza
// este HTML al montar la SPA; el usuario final no nota diferencia.
function renderHomeStatic(): string {
  const waHeroUrl = createWhatsAppUrl(
    'Hola Charlitron Digital, vi su página web y quiero platicar sobre una solución digital para mi negocio.',
  );
  const parts: string[] = [];
  parts.push(
    '<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">',
  );

  // Hero
  parts.push('<p><strong>CHARLITRON DIGITAL</strong> · Agencia digital + tecnología para crecer</p>');
  parts.push('<h1>Tecnología que mueve negocio.</h1>');
  parts.push(
    '<p>Webs, apps, automatizaciones e IA para eliminar fricción, vender más y hacer que tu operación funcione mejor cada día.</p>',
  );
  // Descripción con ubicación: texto real del meta description de index.html.
  parts.push(
    `<p>${SITE_NAME} es una agencia digital en San Luis Potosí que crea páginas web, apps, automatizaciones e IA para negocios. También ofrece activaciones BTL, producción de video y perifoneo para marcas en México.</p>`,
  );
  parts.push(
    `<p><a href="#contacto">Hablemos de tu proyecto</a> · <a href="#soluciones">Ver soluciones</a> · <a href="${waHeroUrl}">WhatsApp: ${PHONE_DISPLAY}</a></p>`,
  );
  parts.push('<p>10+ años de experiencia · Web • Apps · Atención directa</p>');

  // Soluciones (WhatWeDo + SERVICES_LIST)
  parts.push('<section id="soluciones">');
  parts.push('<h2>Más que tecnología: una ventaja competitiva.</h2>');
  parts.push(
    '<p>Eliminamos fricción, automatizamos procesos y convertimos la operación diaria en una máquina más clara, rápida y rentable.</p>',
  );
  for (const service of SERVICES_LIST) {
    parts.push(`<h3>${service.title}</h3>`);
    parts.push(`<p>${service.description}</p>`);
    parts.push(`<ul>${service.detailPoints.map((d) => `<li>${d}</li>`).join('')}</ul>`);
  }
  parts.push('</section>');

  // Necesidades (NeedsSelector + BUSINESS_NEEDS)
  parts.push('<section id="necesidades">');
  parts.push('<h2>¿Qué quieres mejorar en tu negocio?</h2>');
  parts.push(
    '<p>No necesitas dominar términos técnicos. Elige la meta principal que tienes hoy y te asesoramos directamente por WhatsApp.</p>',
  );
  parts.push(
    `<ul>${BUSINESS_NEEDS.map((n) => `<li><strong>${n.label}:</strong> ${n.description}</li>`).join('')}</ul>`,
  );
  parts.push('</section>');

  // Evidencia (EvidenceSection + SHOWCASE_PROJECTS)
  parts.push('<section id="evidencia">');
  parts.push('<h2>Proyectos de Charlitron Digital</h2>');
  parts.push(
    '<h3>Software y plataformas</h3>',
  );
  parts.push(
    `<ul>${PROJECTS.filter((project) => project.group === 'software').map(
      (project) => `<li><a href="/proyectos/${project.slug}"><strong>${project.title}</strong></a> — ${project.summary}</li>`,
    ).join('')}</ul>`,
  );
  parts.push('<h3>Experiencias digitales e IA</h3>');
  parts.push(
    `<ul>${PROJECTS.filter((project) => project.group === 'experience').map(
      (project) => `<li><a href="/proyectos/${project.slug}"><strong>${project.title}</strong></a> — ${project.summary}</li>`,
    ).join('')}</ul>`,
  );
  parts.push('<h3>Soluciones conceptuales</h3>');
  parts.push(
    `<ul>${CONCEPT_SOLUTIONS.map((solution) => `<li><strong>${solution.title}</strong> — ${solution.description}</li>`).join('')}</ul>`,
  );
  parts.push('</section>');

  // Método (HowWeWork + WORK_STEPS)
  parts.push('<section id="metodo">');
  parts.push('<h2>Cómo trabajamos</h2>');
  parts.push('<p>Sin procesos burocráticos ni meses de juntas interminables. Vamos directo al grano.</p>');
  parts.push(
    `<ol>${WORK_STEPS.map((s) => `<li><strong>${s.title}:</strong> ${s.description}</li>`).join('')}</ol>`,
  );
  parts.push('</section>');

  // Agencia BTL (ComplementaryServices + AGENCY_SERVICES)
  parts.push('<section id="agencia-btl">');
  parts.push('<h2>Charlitron Agencia — Offline &amp; BTL</h2>');
  parts.push(
    '<p>Activaciones de marca, producción de video profesional, perifoneo y campañas publicitarias para posicionar tu negocio en la calle.</p>',
  );
  parts.push(`<ul>${AGENCY_SERVICES.map((a) => `<li>${a}</li>`).join('')}</ul>`);
  parts.push('</section>');

  // Contacto (ContactSection + datos de Footer/content.ts)
  parts.push('<section id="contacto">');
  parts.push('<h2>Cuéntanos qué quieres mejorar.</h2>');
  parts.push(
    '<p>No necesitas saber qué tecnología necesitas. Cuéntanos cómo trabajas y nosotros analizamos qué podemos simplificar.</p>',
  );
  parts.push(
    '<p>Respuesta directa por WhatsApp. Atención personalizada e inmediata sin intermediarios ni filtros complejos.</p>',
  );
  parts.push(
    `<p><a href="${waHeroUrl}">WhatsApp: ${PHONE_DISPLAY}</a> · <a href="tel:4444237092">${PHONE_DISPLAY}</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`,
  );
  parts.push(`<p>${SITE_NAME} — San Luis Potosí, México.</p>`);
  parts.push('</section>');

  parts.push('</main>');
  return parts.join('\n');
}

// /agencia: hub BTL estático (mismo contenido comercial que la SPA, desde
// src/data/btl.ts) para crawlers e IA sin JS.
function renderAgencyHubStatic(): string {
  const waUrl = createWhatsAppUrl(AGENCY_HUB.whatsappMessage);
  const parts: string[] = [];
  parts.push(
    '<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">',
  );
  parts.push('<nav><a href="/">Inicio</a> › <strong>Agencia BTL</strong></nav>');
  parts.push('<p><strong>CHARLITRON AGENCIA</strong> · Ejecución presencial y BTL</p>');
  parts.push(`<h1>${AGENCY_HUB.h1}</h1>`);
  parts.push(`<p><strong>${AGENCY_HUB.tagline}</strong></p>`);
  parts.push(`<p>${AGENCY_HUB.intro}</p>`);
  parts.push(
    `<p><a href="${waUrl}">WhatsApp: ${PHONE_DISPLAY}</a> · <a href="tel:4444237092">${PHONE_DISPLAY}</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`,
  );
  parts.push('<h2>Servicios BTL en San Luis Potosí</h2>');
  parts.push(
    `<ul>${BTL_SERVICES.map(
      (s) => `<li><a href="/agencia/${s.slug}"><strong>${s.serviceType}</strong></a> — ${s.intro}</li>`,
    ).join('')}</ul>`,
  );
  parts.push(
    '<p>También producimos contenido y campañas publicitarias. Escríbenos por WhatsApp y armamos tu propuesta.</p>',
  );
  parts.push(
    '<p><a href="/agencia/casos">Casos documentados: OXXO, RAC, Hellmann’s (ejecución mediante agencia intermediaria) y Restaurante Galicia</a></p>',
  );
  parts.push(
    '<p><a href="/">Charlitron Digital</a> (webs, apps, automatizaciones e IA) y Charlitron Agencia (ejecución presencial y BTL) son dos unidades de la misma marca.</p>',
  );
  parts.push('<p>Charlitron Agencia — San Luis Potosí, México.</p>');
  parts.push('</main>');
  return parts.join('\n');
}

// /agencia/<slug>: ficha estática de cada servicio BTL (con FAQs visibles,
// requisito para el FAQPage del JSON-LD). Incluye los artículos publicados
// relacionados (migración 0002), si los hay.
function renderBtlServiceStatic(
  service: BtlService,
  relatedArticles: ArticleWithCategory[] = [],
): string {
  const waUrl = createWhatsAppUrl(service.whatsappMessage);
  const related = service.relatedSlugs
    .map((slug) => BTL_SERVICES.find((s) => s.slug === slug))
    .filter((s): s is BtlService => Boolean(s));
  const parts: string[] = [];
  parts.push(
    '<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">',
  );
  parts.push(
    `<nav><a href="/">Inicio</a> › <a href="/agencia">Agencia BTL</a> › <strong>${service.shortName}</strong></nav>`,
  );
  parts.push('<p><strong>CHARLITRON AGENCIA</strong> · Servicio BTL</p>');
  parts.push(`<h1>${service.h1}</h1>`);
  parts.push(`<p>${service.intro}</p>`);
  parts.push(`<p><a href="${waUrl}">Cotizar por WhatsApp: ${PHONE_DISPLAY}</a></p>`);
  parts.push('<h2>Qué incluye</h2>');
  parts.push(`<ul>${service.queIncluye.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  parts.push('<h2>Usos frecuentes</h2>');
  parts.push(`<ul>${service.usos.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  parts.push('<h2>Cobertura</h2>');
  parts.push(`<p>${service.cobertura}</p>`);
  parts.push('<h2>Cómo contratamos</h2>');
  parts.push(`<ol>${service.proceso.map((step) => `<li>${step}</li>`).join('')}</ol>`);
  parts.push('<h2>Preguntas frecuentes</h2>');
  for (const faq of service.faqs) {
    parts.push(`<h3>${faq.question}</h3>`);
    parts.push(`<p>${faq.answer}</p>`);
  }
  if (service.casos && service.casos.length > 0) {
    const cases = service.casos
      .map((id) => getBtlCase(id))
      .filter((c): c is BtlCaseStudy => Boolean(c));
    if (cases.length > 0) {
      parts.push('<h2>Casos documentados</h2>');
      parts.push(
        `<ul>${cases
          .map((caso) => {
            const label = `${caso.name} — ${caso.projectType}`;
            return `<li>${
              caso.articleSlug ? `<a href="/blog/${caso.articleSlug}">${label}</a>` : label
            }${caso.intermediaryNote ? ` <em>${caso.intermediaryNote}</em>` : ''}</li>`;
          })
          .join('')}</ul>`,
      );
      parts.push(
        '<p><a href="/agencia/casos">Ver todos los casos documentados de Charlitron Agencia</a></p>',
      );
    }
  }
  if (relatedArticles.length > 0) {
    parts.push('<h2>Artículos relacionados</h2>');
    parts.push(
      `<ul>${relatedArticles
        .map(
          (a) =>
            `<li><a href="/blog/${a.slug}">${a.title}</a>${a.excerpt ? ` — ${a.excerpt}` : ''}</li>`,
        )
        .join('')}</ul>`,
    );
  }
  parts.push('<h2>Servicios relacionados</h2>');
  parts.push(
    `<ul>${related
      .map((r) => `<li><a href="/agencia/${r.slug}">${r.serviceType}</a></li>`)
      .join('')}</ul>`,
  );
  parts.push('<p><a href="/agencia">Ver todos los servicios BTL de Charlitron Agencia</a></p>');
  parts.push('<p>Charlitron Agencia — San Luis Potosí, México.</p>');
  parts.push('</main>');
  return parts.join('\n');
}

// /agencia/casos: colección estática de casos documentados (Fase 3A).
// Enlaza artículos del blog SOLO cuando existen (nunca URLs inventadas).
function renderBtlCasesStatic(): string {
  const waUrl = createWhatsAppUrl(BTL_CASES_PAGE.whatsappMessage);
  const parts: string[] = [];
  parts.push(
    '<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">',
  );
  parts.push(
    '<nav><a href="/">Inicio</a> › <a href="/agencia">Agencia BTL</a> › <strong>Casos documentados</strong></nav>',
  );
  parts.push('<p><strong>CHARLITRON AGENCIA</strong> · Casos documentados</p>');
  parts.push(`<h1>${BTL_CASES_PAGE.h1}</h1>`);
  parts.push(`<p>${BTL_CASES_PAGE.intro}</p>`);
  for (const caso of BTL_CASES) {
    const services = caso.serviceSlugs
      .map((slug) => getBtlService(slug))
      .filter((s): s is BtlService => Boolean(s));
    parts.push('<article>');
    parts.push(`<h2>${caso.name}</h2>`);
    parts.push(`<p><strong>${caso.projectType}</strong></p>`);
    parts.push(`<p>${caso.description}</p>`);
    if (caso.intermediaryNote) {
      parts.push(`<p><em>${caso.intermediaryNote}</em></p>`);
    }
    if (services.length > 0) {
      parts.push(
        `<p>Servicios relacionados: ${services
          .map((s) => `<a href="/agencia/${s.slug}">${s.shortName}</a>`)
          .join(' · ')}</p>`,
      );
    }
    if (caso.articleSlug) {
      parts.push(`<p><a href="/blog/${caso.articleSlug}">Leer el caso completo</a></p>`);
    }
    parts.push('</article>');
  }
  parts.push(
    `<p><a href="${waUrl}">Cotizar una campaña por WhatsApp: ${PHONE_DISPLAY}</a> · <a href="/agencia">Ver servicios BTL</a></p>`,
  );
  parts.push('<p>Charlitron Agencia — San Luis Potosí, México.</p>');
  parts.push('</main>');
  return parts.join('\n');
}

function renderProjectStatic(project: (typeof PROJECTS)[number]): string {
  const whatsappUrl = createWhatsAppUrl(project.whatsappMessage);
  const parts: string[] = [];
  parts.push('<main style="max-width:64rem;margin:0 auto;padding:3rem 1rem;font-family:sans-serif;">');
  parts.push(
    `<nav><a href="/">Inicio</a> › <a href="/#evidencia">Proyectos</a> › <strong>${project.title}</strong></nav>`,
  );
  parts.push(`<p>${project.group === 'software' ? 'Software y plataformas' : 'Experiencias digitales e IA'}</p>`);
  parts.push(`<h1>${project.title}</h1>`);
  parts.push(`<p>${project.summary}</p>`);
  parts.push(
    `<p><a href="${escapeHtmlAttr(project.officialUrl)}">Ver sitio oficial</a> · <a href="${whatsappUrl}">Quiero algo similar por WhatsApp</a></p>`,
  );
  parts.push('<h2>Problema que atiende</h2>');
  parts.push(`<p>${project.problem}</p>`);
  parts.push('<h2>Solución desarrollada</h2>');
  parts.push(`<p>${project.solution}</p>`);
  parts.push('<h2>Capacidades y estado</h2>');
  if (project.features.length > 0) {
    parts.push(
      `<ul>${project.features
        .map(
          (feature) =>
            `<li><strong>${feature.name}</strong> — ${PROJECT_FEATURE_STATUS_LABELS[feature.status]}${
              feature.description ? `. ${feature.description}` : ''
            }</li>`,
        )
        .join('')}</ul>`,
    );
  } else {
    parts.push('<p>Las funciones específicas se añadirán cuando se validen y haya evidencia autorizada para publicarlas.</p>');
  }
  for (const section of project.sections ?? []) {
    parts.push(`<h2>${section.title}</h2>`);
    parts.push(`<p>${section.description}</p>`);
    parts.push(
      `<ul>${section.features
        .map(
          (feature) =>
            `<li><strong>${feature.name}</strong> — ${PROJECT_FEATURE_STATUS_LABELS[feature.status]}${
              feature.description ? `. ${feature.description}` : ''
            }</li>`,
        )
        .join('')}</ul>`,
    );
  }
  parts.push('<h2>Evidencias del proyecto</h2>');
  if (project.images?.length) {
    parts.push(
      project.images
        .map(
          (image) =>
            `<figure><img src="${escapeHtmlAttr(image.src)}" alt="${escapeHtmlAttr(image.alt)}" loading="lazy" decoding="async" width="${image.width}" height="${image.height}" /><figcaption>${image.alt}</figcaption></figure>`,
        )
        .join('\n'),
    );
  } else {
    parts.push('<p>Captura auténtica autorizada pendiente.</p>');
  }
  parts.push(`<p><a href="${whatsappUrl}">Quiero algo similar</a></p>`);
  parts.push('<p><a href="/#evidencia">Volver al portafolio</a></p>');
  parts.push('</main>');
  return parts.join('\n');
}

function buildSitemap(articles: ArticleWithCategory[]): string {
  const urls: string[] = [];
  const staticPages: Array<{ loc: string; priority: string }> = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/agencia`, priority: '0.9' },
    { loc: `${SITE_URL}/agencia/casos`, priority: '0.8' },
    ...BTL_SERVICES.map((s) => ({ loc: `${SITE_URL}/agencia/${s.slug}`, priority: '0.9' })),
    { loc: `${SITE_URL}/blog`, priority: '0.8' },
    ...PROJECTS.map((project) => ({
      loc: `${SITE_URL}/proyectos/${project.slug}`,
      priority: '0.7',
    })),
  ];
  for (const page of staticPages) {
    urls.push(`  <url><loc>${escapeXml(page.loc)}</loc><priority>${page.priority}</priority></url>`);
  }
  for (const article of articles) {
    const lastmod = (article.updated_at ?? article.published_at ?? '').slice(0, 10);
    urls.push(
      `  <url><loc>${escapeXml(`${SITE_URL}/blog/${article.slug}`)}</loc>${
        lastmod ? `<lastmod>${lastmod}</lastmod>` : ''
      }<priority>0.7</priority></url>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

async function fetchPublishedArticles(): Promise<ArticleWithCategory[]> {
  const headers = {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const buildUrl = (select: string) =>
    `${SUPABASE_URL}/rest/v1/articles?select=${encodeURIComponent(select)}&status=eq.published&order=published_at.desc`;
  const baseSelect =
    'title,slug,excerpt,content,cover_image_url,cover_thumb_url,cover_alt,author_name,status,meta_title,meta_description,faq,cta_text,cta_url,published_at,updated_at,category_id,categories(name,slug)';

  // Intento 1: con embed de servicios BTL (requiere la migración 0002
  // aplicada). Si la tabla aún no existe, reintento sin el embed: el blog y
  // las páginas BTL se generan igual, solo sin las secciones de relaciones.
  let response = await fetch(buildUrl(`${baseSelect},article_btl_services(service_slug)`), {
    headers,
  });
  if (!response.ok) {
    console.warn(
      '[prerender] embed article_btl_services no disponible; continúo sin relaciones.',
    );
    response = await fetch(buildUrl(baseSelect), { headers });
  }
  if (!response.ok) {
    throw new Error(`Supabase REST respondió ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as ArticleWithCategory[];
}

async function main() {
  const template = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');

  // Sin credenciales o si el fetch falla, seguimos con lista vacía: el sitemap
  // y robots.txt siempre se generan; el blog funciona client-side igual.
  let articles: ArticleWithCategory[] = [];
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      articles = await fetchPublishedArticles();
      console.log(`[prerender] ${articles.length} artículo(s) publicado(s) encontrado(s).`);
    } catch (error) {
      console.warn('[prerender] no se pudieron leer artículos (continúa con estáticas):', error);
    }
  } else {
    console.warn('[prerender] Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: solo páginas base.');
  }

  // /blog
  await mkdir(path.join(DIST_DIR, 'blog'), { recursive: true });
  const blogMeta: HeadMeta = {
    title: `Blog | ${SITE_NAME} — Ideas sobre webs, apps, automatización e IA`,
    description:
      'Artículos de Charlitron Digital sobre desarrollo web, apps, automatización, IA y marketing local para negocios en México.',
    canonical: `${SITE_URL}/blog`,
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
    jsonLd: buildBlogJsonLd(SITE_URL, SITE_NAME),
  };
  await writeFile(
    path.join(DIST_DIR, 'blog', 'index.html'),
    injectBody(applyHead(template, blogMeta), renderBlogListStatic(articles)),
    'utf8',
  );

  // /blog/<slug>
  for (const article of articles) {
    const dir = path.join(DIST_DIR, 'blog', article.slug);
    await mkdir(dir, { recursive: true });
    // OG por artículo: siempre cover_image_url (nunca el thumb 480px);
    // sin portada, fallback a la imagen social de marca.
    const hasCover = Boolean(article.cover_image_url);
    const meta: HeadMeta = {
      title: article.meta_title ?? `${article.title} | Blog ${SITE_NAME}`,
      description:
        article.meta_description ?? article.excerpt ?? `Artículo de ${SITE_NAME}.`,
      canonical: `${SITE_URL}/blog/${article.slug}`,
      ogType: 'article',
      ogImage: article.cover_image_url ?? DEFAULT_SOCIAL_IMAGE,
      ogImageAlt: hasCover ? (article.cover_alt ?? article.title) : DEFAULT_SOCIAL_IMAGE_ALT,
      ogImageWidth: hasCover ? 1600 : 1200,
      ogImageHeight: hasCover ? 900 : 630,
      publishedTime: article.published_at,
      jsonLd: buildArticleJsonLd(
        article,
        article.categories?.name,
        SITE_URL,
        SITE_NAME,
        articleServiceSlugs(article),
      ),
    };
    await writeFile(
      path.join(dir, 'index.html'),
      injectBody(applyHead(template, meta), renderArticleStatic(article)),
      'utf8',
    );
  }

  // /agencia (hub BTL) — Fase 1 SEO. Se escribe ANTES de inyectar la home
  // para partir del template prístino (igual que el blog).
  await mkdir(path.join(DIST_DIR, 'agencia'), { recursive: true });
  const agencyMeta: HeadMeta = {
    title: AGENCY_HUB.metaTitle,
    description: AGENCY_HUB.metaDescription,
    canonical: `${SITE_URL}/agencia`,
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
    jsonLd: buildAgencyHubJsonLd(SITE_URL, BTL_SERVICES),
  };
  await writeFile(
    path.join(DIST_DIR, 'agencia', 'index.html'),
    injectBody(applyHead(template, agencyMeta), renderAgencyHubStatic()),
    'utf8',
  );

  // /agencia/casos — colección de casos documentados (Fase 3A).
  const casesDir = path.join(DIST_DIR, 'agencia', 'casos');
  await mkdir(casesDir, { recursive: true });
  const casesMeta: HeadMeta = {
    title: BTL_CASES_PAGE.metaTitle,
    description: BTL_CASES_PAGE.metaDescription,
    canonical: `${SITE_URL}/agencia/casos`,
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogImageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
    jsonLd: buildBtlCasesJsonLd(SITE_URL, BTL_CASES, {
      name: BTL_CASES_PAGE.h1,
      description: BTL_CASES_PAGE.metaDescription,
    }),
  };
  await writeFile(
    path.join(casesDir, 'index.html'),
    injectBody(applyHead(template, casesMeta), renderBtlCasesStatic()),
    'utf8',
  );

  // /agencia/<slug> — páginas de servicio BTL (Fase 1).
  for (const service of BTL_SERVICES) {
    const dir = path.join(DIST_DIR, 'agencia', service.slug);
    await mkdir(dir, { recursive: true });
    // Artículos publicados relacionados con este servicio (mapa inverso del
    // embed; cero queries extra).
    const serviceArticles = articles.filter((a) =>
      articleServiceSlugs(a).includes(service.slug),
    );
    const meta: HeadMeta = {
      title: service.metaTitle,
      description: service.metaDescription,
      canonical: `${SITE_URL}/agencia/${service.slug}`,
      ogType: 'website',
      ogImage: DEFAULT_SOCIAL_IMAGE,
      ogImageAlt: DEFAULT_SOCIAL_IMAGE_ALT,
      jsonLd: buildBtlServiceJsonLd(service, SITE_URL),
    };
    await writeFile(
      path.join(dir, 'index.html'),
      injectBody(applyHead(template, meta), renderBtlServiceStatic(service, serviceArticles)),
      'utf8',
    );
  }

  // Páginas individuales del portafolio (independientes del blog y BTL).
  for (const project of PROJECTS) {
    const dir = path.join(DIST_DIR, 'proyectos', project.slug);
    await mkdir(dir, { recursive: true });
    const projectImage = project.images?.[0];
    const meta: HeadMeta = {
      title: project.metaTitle,
      description: project.metaDescription,
      canonical: `${SITE_URL}/proyectos/${project.slug}`,
      ogType: 'website',
      ogImage: projectImage
        ? projectImage.src.startsWith('http')
          ? projectImage.src
          : `${SITE_URL}${projectImage.src.startsWith('/') ? '' : '/'}${projectImage.src}`
        : DEFAULT_SOCIAL_IMAGE,
      ogImageAlt: projectImage?.alt ?? DEFAULT_SOCIAL_IMAGE_ALT,
      jsonLd: buildPortfolioProjectJsonLd(project, SITE_URL),
    };
    await writeFile(
      path.join(dir, 'index.html'),
      injectBody(applyHead(template, meta), renderProjectStatic(project)),
      'utf8',
    );
  }

  // Home: inyecta el contenido real en dist/index.html usando el template
  // prístino en memoria (las páginas del blog ya se escribieron desde él).
  await writeFile(
    path.join(DIST_DIR, 'index.html'),
    injectBody(template, renderHomeStatic()),
    'utf8',
  );

  // sitemap.xml + robots.txt (con el dominio real de VITE_SITE_URL)
  await writeFile(path.join(DIST_DIR, 'sitemap.xml'), buildSitemap(articles), 'utf8');
  await writeFile(
    path.join(DIST_DIR, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'utf8',
  );
  console.log('[prerender] home, blog/*, sitemap.xml, robots.txt generados ✔');
}

main().catch((error) => {
  // No romper el deploy por un fallo de prerender; el blog funciona client-side.
  console.warn('[prerender] falló el prerender (build continúa):', error);
});
