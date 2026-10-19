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
import { buildArticleJsonLd, buildBlogJsonLd } from '../src/lib/jsonld';
import type { ArticleRow, CategoryRow } from '../src/lib/database.types';
import {
  AGENCY_SERVICES,
  BUSINESS_NEEDS,
  CONTACT_EMAIL,
  PHONE_DISPLAY,
  SERVICES_LIST,
  SHOWCASE_PROJECTS,
  WORK_STEPS,
  createWhatsAppUrl,
} from '../src/data/content';

// En local carga .env.local / .env; en Vercel las vars ya vienen en process.env.
loadEnv({ path: ['.env.local', '.env'] });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://charlitrondigital.vercel.app').replace(
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
};

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
  parts.push('<h2>No solo entregamos trabajo. Generamos impacto real.</h2>');
  parts.push(
    '<p>Soluciones vivas, operativas y pensadas para negocios que quieren más orden, más ventas y menos fricción en cada proceso.</p>',
  );
  parts.push(
    `<ul>${SHOWCASE_PROJECTS.map(
      (p) => `<li><strong>${p.title}</strong> — ${p.subtitle}. ${p.description}</li>`,
    ).join('')}</ul>`,
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

function buildSitemap(articles: ArticleWithCategory[]): string {
  const urls: string[] = [];
  const staticPages: Array<{ loc: string; priority: string }> = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/blog`, priority: '0.8' },
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
  const select =
    'title,slug,excerpt,content,cover_image_url,cover_thumb_url,cover_alt,author_name,status,meta_title,meta_description,faq,cta_text,cta_url,published_at,updated_at,category_id,categories(name,slug)';
  const url = `${SUPABASE_URL}/rest/v1/articles?select=${encodeURIComponent(select)}&status=eq.published&order=published_at.desc`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
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
      jsonLd: buildArticleJsonLd(article, article.categories?.name, SITE_URL, SITE_NAME),
    };
    await writeFile(
      path.join(dir, 'index.html'),
      injectBody(applyHead(template, meta), renderArticleStatic(article)),
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
