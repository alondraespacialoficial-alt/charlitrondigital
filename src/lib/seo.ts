// Helpers SEO: actualización de metas en cliente (para la SPA) y
// generadores de JSON-LD (también usados por el prerender estático).
import { absoluteUrl, SITE_NAME, SITE_URL } from './site';
import { buildArticleJsonLd } from './jsonld';
import type { ArticleRow } from './database.types';

export interface PageMeta {
  title: string;
  description: string;
  canonicalPath: string;
  ogImage?: string | null;
  ogType?: 'website' | 'article';
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const JSONLD_ID = 'charlitron-jsonld-page';

export function applyPageMeta(meta: PageMeta, jsonLd?: object | object[]) {
  document.title = meta.title;
  upsertMeta('name', 'description', meta.description);
  upsertLink('canonical', absoluteUrl(meta.canonicalPath));
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:url', absoluteUrl(meta.canonicalPath));
  upsertMeta('property', 'og:type', meta.ogType ?? 'website');
  upsertMeta('property', 'og:site_name', SITE_NAME);
  if (meta.ogImage) {
    upsertMeta('property', 'og:image', meta.ogImage);
    upsertMeta('name', 'twitter:image', meta.ogImage);
  }
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);

  document.getElementById(JSONLD_ID)?.remove();
  if (jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSONLD_ID;
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

export function articleJsonLd(article: ArticleRow, categoryName?: string | null): object[] {
  return buildArticleJsonLd(article, categoryName, SITE_URL, SITE_NAME);
}
