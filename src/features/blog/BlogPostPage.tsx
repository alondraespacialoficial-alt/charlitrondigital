import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ExternalLink, HelpCircle } from 'lucide-react';
import { BlogShell } from './BlogShell';
import { getPublishedArticleBySlug, listArticleSources } from './api';
import type { ArticleRow, ArticleSourceRow, CategoryRow, FaqItem } from '../../lib/database.types';
import { applyPageMeta, articleJsonLd } from '../../lib/seo';
import { renderMarkdownLite } from '../../lib/markdown';
import { trackPageView } from '../../lib/analytics';
import { SITE_NAME } from '../../lib/site';

type ArticleWithCategory = ArticleRow & { categories?: Pick<CategoryRow, 'name' | 'slug'> | null };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(iso),
  );
}

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<ArticleWithCategory | null>(null);
  const [sources, setSources] = useState<ArticleSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getPublishedArticleBySlug(slug)
      .then(async (data) => {
        if (!data) {
          setNotFound(true);
          return;
        }
        setArticle(data);
        const articleSources = await listArticleSources(data.id).catch(() => []);
        setSources(articleSources);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!article) return;
    const title = article.meta_title ?? `${article.title} | Blog ${SITE_NAME}`;
    const description =
      article.meta_description ?? article.excerpt ?? `Artículo de ${SITE_NAME}.`;
    applyPageMeta(
      {
        title,
        description,
        canonicalPath: `/blog/${article.slug}`,
        ogImage: article.cover_image_url,
        ogType: 'article',
      },
      articleJsonLd(article, article.categories?.name),
    );
    trackPageView(`/blog/${article.slug}`, article.slug);
  }, [article]);

  const contentHtml = useMemo(
    () => (article ? renderMarkdownLite(article.content) : ''),
    [article],
  );

  const faqItems: FaqItem[] = useMemo(
    () => (article && Array.isArray(article.faq) ? (article.faq as FaqItem[]) : []),
    [article],
  );

  if (loading) {
    return (
      <BlogShell>
        <div className="max-w-3xl mx-auto px-4 py-24 text-zinc-500">Cargando artículo…</div>
      </BlogShell>
    );
  }

  if (notFound || !article) {
    return (
      <BlogShell>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Artículo no encontrado</h1>
          <p className="text-zinc-400 mb-8">El contenido que buscas no existe o fue archivado.</p>
          <Link to="/blog" className="text-amber-400 hover:text-amber-300 font-medium">
            ← Volver al blog
          </Link>
        </div>
      </BlogShell>
    );
  }

  return (
    <BlogShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Blog
        </Link>

        {article.categories && (
          <span className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
            {article.categories.name}
          </span>
        )}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 mb-8">
          <span>{article.author_name}</span>
          {article.published_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              Publicado: {formatDate(article.published_at)}
            </span>
          )}
          {article.updated_at && article.updated_at !== article.published_at && (
            <span>Actualizado: {formatDate(article.updated_at)}</span>
          )}
        </div>

        {article.cover_image_url && (
          <img
            src={article.cover_image_url}
            alt={article.cover_alt ?? article.title}
            width={1600}
            height={900}
            className="w-full aspect-video object-cover rounded-2xl border border-zinc-800 mb-10"
          />
        )}

        <div
          className="text-base sm:text-lg"
          // Contenido propio del admin, renderizado con escape total (sin XSS).
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {faqItems.length > 0 && (
          <section className="mt-12 border-t border-zinc-800 pt-8">
            <h2 className="text-2xl font-bold text-white mb-6 inline-flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" /> Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {faqItems.map((item, idx) => (
                <details
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 open:border-amber-400/40"
                >
                  <summary className="cursor-pointer font-semibold text-white">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-zinc-300 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {sources.length > 0 && (
          <section className="mt-12 border-t border-zinc-800 pt-8">
            <h2 className="text-xl font-bold text-white mb-4">Fuentes y evidencia</h2>
            <ul className="space-y-2">
              {sources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline underline-offset-4"
                  >
                    {source.title}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {source.publisher && (
                    <span className="text-zinc-500 text-sm"> — {source.publisher}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {article.cta_text && article.cta_url && (
          <div className="mt-12 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-8 text-center">
            <a
              href={article.cta_url}
              target={article.cta_url.startsWith('http') ? '_blank' : undefined}
              rel={article.cta_url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition-all"
            >
              {article.cta_text}
            </a>
          </div>
        )}
      </article>
    </BlogShell>
  );
};
