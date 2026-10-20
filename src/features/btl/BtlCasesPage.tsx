import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, ChevronRight, MessageCircle } from 'lucide-react';
import { BtlLayout } from './BtlLayout';
import { applyPageMeta } from '../../lib/seo';
import { buildBtlCasesJsonLd } from '../../lib/jsonld';
import { SITE_URL } from '../../lib/site';
import { BTL_CASES, BTL_CASES_PAGE, getBtlService } from '../../data/btl';
import { createWhatsAppUrl } from '../../data/content';

// /agencia/casos — colección de casos documentados de Charlitron Agencia.
// Contenido desde el catálogo BTL_CASES (misma fuente para el prerender).
export const BtlCasesPage: React.FC = () => {
  useEffect(() => {
    applyPageMeta(
      {
        title: BTL_CASES_PAGE.metaTitle,
        description: BTL_CASES_PAGE.metaDescription,
        canonicalPath: '/agencia/casos',
      },
      buildBtlCasesJsonLd(SITE_URL, BTL_CASES, {
        name: BTL_CASES_PAGE.h1,
        description: BTL_CASES_PAGE.metaDescription,
      }),
    );
    window.scrollTo({ top: 0 });
  }, []);

  const whatsappUrl = createWhatsAppUrl(BTL_CASES_PAGE.whatsappMessage);

  return (
    <BtlLayout>
      <main>
        {/* Breadcrumb + encabezado */}
        <section className="border-b border-zinc-800/80 bg-grid-pattern">
          <div className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:px-8">
            <nav aria-label="Miga de pan" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
              <Link to="/" className="transition-colors hover:text-amber-400">
                Inicio
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <Link to="/agencia" className="transition-colors hover:text-amber-400">
                Agencia BTL
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <span className="text-zinc-300">Casos documentados</span>
            </nav>

            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
              <span className="h-px w-7 bg-amber-400" /> Charlitron Agencia · Casos documentados
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
              {BTL_CASES_PAGE.h1}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              {BTL_CASES_PAGE.intro}
            </p>
          </div>
        </section>

        {/* Casos */}
        <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {BTL_CASES.map((caso) => (
              <article key={caso.id} className="border border-zinc-800 bg-[#101013] p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
                      {caso.projectType}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-bold text-white">{caso.name}</h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">{caso.description}</p>
                    {caso.intermediaryNote && (
                      <p className="mt-3 border-l-2 border-amber-400/60 pl-3 text-xs italic leading-6 text-zinc-400">
                        {caso.intermediaryNote}
                      </p>
                    )}
                  </div>
                  {caso.articleSlug && (
                    <Link
                      to={`/blog/${caso.articleSlug}`}
                      className="inline-flex shrink-0 items-center gap-2 border border-zinc-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300"
                    >
                      <BookOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      Leer el caso completo
                    </Link>
                  )}
                </div>

                <div className="mt-5 border-t border-zinc-800/80 pt-4">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Servicios relacionados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {caso.serviceSlugs.map((slug) => {
                      const service = getBtlService(slug);
                      if (!service) return null;
                      return (
                        <Link
                          key={slug}
                          to={`/agencia/${slug}`}
                          className="group inline-flex items-center gap-1.5 border border-zinc-700/80 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-amber-400/60 hover:text-amber-300"
                        >
                          {service.shortName}
                          <ArrowUpRight className="h-3 w-3 text-amber-400" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl border border-amber-400/30 bg-[#101013] p-6 text-center sm:p-8">
            <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
              ¿Quieres una campaña como estas en San Luis Potosí?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
              Cuéntanos tu objetivo y te proponemos cómo ejecutarlo en campo.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 bg-amber-400 px-6 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                Cotizar por WhatsApp
              </a>
              <Link
                to="/agencia"
                className="inline-flex w-full items-center justify-center gap-2 border border-zinc-700 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300 sm:w-auto"
              >
                Ver servicios BTL
              </Link>
            </div>
          </div>
        </section>
      </main>
    </BtlLayout>
  );
};
