import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowUpRight } from 'lucide-react';
import { BlogShell } from './BlogShell';
import { listPublishedArticles, type ArticleListItem } from './api';
import { applyPageMeta } from '../../lib/seo';
import { trackPageView } from '../../lib/analytics';
import { absoluteUrl, SITE_NAME } from '../../lib/site';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(iso),
  );
}

export const BlogListPage: React.FC = () => {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyPageMeta(
      {
        title: `Blog | ${SITE_NAME} — Ideas sobre webs, apps, automatización e IA`,
        description:
          'Artículos de Charlitron Digital sobre desarrollo web, apps, automatización, IA y marketing local para negocios en México.',
        canonicalPath: '/blog',
        ogType: 'website',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `Blog de ${SITE_NAME}`,
        url: absoluteUrl('/blog'),
        inLanguage: 'es-MX',
      },
    );
    trackPageView('/blog');

    listPublishedArticles()
      .then(setArticles)
      .catch((err) => setError(err.message ?? 'Error al cargar artículos'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BlogShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">Blog</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
          Ideas para que tu negocio opere y venda mejor
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mb-12">
          Webs, apps, automatización, IA y marketing local — explicado sin humo, con evidencia.
        </p>

        {loading && <p className="text-zinc-500">Cargando artículos…</p>}
        {error && <p className="text-red-400">No se pudieron cargar los artículos.</p>}
        {!loading && !error && articles.length === 0 && (
          <p className="text-zinc-500">Aún no hay artículos publicados. Vuelve pronto.</p>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/blog/${article.slug}`}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden hover:border-amber-400/40 transition-colors"
            >
              {article.cover_thumb_url && (
                <img
                  src={article.cover_thumb_url}
                  alt={article.cover_alt ?? article.title}
                  loading="lazy"
                  width={480}
                  height={270}
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-6">
                {article.categories && (
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    {article.categories.name}
                  </span>
                )}
                <h2 className="mt-2 text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="mt-2 text-sm text-zinc-400 line-clamp-3">{article.excerpt}</p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDate(article.published_at)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                    Leer <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </BlogShell>
  );
};
