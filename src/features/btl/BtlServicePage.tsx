import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageCircle,
  Newspaper,
  Route,
} from 'lucide-react';
import { BtlLayout } from './BtlLayout';
import { applyPageMeta } from '../../lib/seo';
import { buildBtlServiceJsonLd } from '../../lib/jsonld';
import { SITE_URL } from '../../lib/site';
import { getBtlCase, getBtlService } from '../../data/btl';
import { createWhatsAppUrl } from '../../data/content';
import {
  listArticlesByServiceSlug,
  type RelatedArticleItem,
} from '../../features/blog/api';

// Template único de las páginas de servicio BTL. El contenido sale del
// catálogo src/data/btl.ts; un slug desconocido redirige al hub /agencia.
export const BtlServicePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const service = slug ? getBtlService(slug) : undefined;

  useEffect(() => {
    if (!service) return;
    applyPageMeta(
      {
        title: service.metaTitle,
        description: service.metaDescription,
        canonicalPath: `/agencia/${service.slug}`,
      },
      buildBtlServiceJsonLd(service, SITE_URL),
    );
    window.scrollTo({ top: 0 });
  }, [service]);

  if (!service) {
    return <Navigate to="/agencia" replace />;
  }

  const whatsappUrl = createWhatsAppUrl(service.whatsappMessage);
  const related = service.relatedSlugs
    .map((relatedSlug) => getBtlService(relatedSlug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const caseStudies = (service.casos ?? [])
    .map((id) => getBtlCase(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Artículos del blog relacionados con este servicio (migración 0002).
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticleItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    setRelatedArticles([]);
    listArticlesByServiceSlug(service.slug).then((items) => {
      if (!cancelled) setRelatedArticles(items);
    });
    return () => {
      cancelled = true;
    };
  }, [service]);

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
              <span className="text-zinc-300">{service.shortName}</span>
            </nav>

            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
              <span className="h-px w-7 bg-amber-400" /> Charlitron Agencia · Servicio BTL
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">{service.h1}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">{service.intro}</p>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300"
            >
              <MessageCircle className="h-4 w-4" />
              Cotizar por WhatsApp
            </a>
          </div>
        </section>

        {/* Ficha comercial */}
        <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <CheckCircle2 className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Qué incluye
              </h2>
              <ul className="mt-5 space-y-3">
                {service.queIncluye.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <ClipboardList className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Usos frecuentes
              </h2>
              <ul className="mt-5 space-y-3">
                {service.usos.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Cobertura + proceso */}
        <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
            <div className="border border-zinc-800 bg-[#101013] p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <MapPin className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Cobertura
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">{service.cobertura}</p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <Route className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Cómo contratamos
              </h2>
              <ol className="mt-5 space-y-4">
                {service.proceso.map((step, index) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="pt-0.5 font-mono text-xs text-zinc-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm leading-6 text-zinc-300">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* FAQ visible (habilita FAQPage en JSON-LD) */}
        <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-bold text-white">Preguntas frecuentes</h2>
            <div className="mt-6 divide-y divide-zinc-800 border-y border-zinc-800">
              {service.faqs.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white transition-colors hover:text-amber-300 [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-amber-400 transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Casos documentados (catálogo BTL_CASES; nota visible si hubo intermediaria) */}
        {caseStudies.length > 0 && (
          <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <h2 className="font-display text-2xl font-bold text-white">Casos documentados</h2>
              <div className="mt-6 space-y-3">
                {caseStudies.map((caso) => (
                  <div key={caso.id} className="border border-zinc-800 bg-[#101013] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                      {caso.projectType}
                    </p>
                    {caso.articleSlug ? (
                      <Link
                        to={`/blog/${caso.articleSlug}`}
                        className="mt-1 inline-block text-sm font-semibold text-white underline-offset-4 transition-colors hover:text-amber-400 hover:underline"
                      >
                        {caso.name} → leer el caso
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-white">{caso.name}</p>
                    )}
                    {caso.intermediaryNote && (
                      <p className="mt-1 text-xs italic text-zinc-500">{caso.intermediaryNote}</p>
                    )}
                  </div>
                ))}
              </div>
              <Link
                to="/agencia/casos"
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 transition-colors hover:text-amber-300"
              >
                Ver todos los casos documentados →
              </Link>
            </div>
          </section>
        )}

        {/* Artículos del blog relacionados (solo publicados; si hay) */}
        {relatedArticles.length > 0 && (
          <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                <Newspaper className="h-5 w-5 text-amber-400" aria-hidden="true" />
                Artículos relacionados
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {relatedArticles.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/blog/${item.slug}`}
                    className="group border border-zinc-800 bg-[#101013] p-5 transition-colors hover:border-amber-400/60"
                  >
                    <h3 className="font-display text-base font-semibold text-white group-hover:text-amber-300">
                      {item.title}
                    </h3>
                    {item.excerpt && (
                      <p className="mt-2 text-xs leading-5 text-zinc-400 line-clamp-3">
                        {item.excerpt}
                      </p>
                    )}
                    <span className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                      Leer artículo →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Servicios relacionados + CTA */}
        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-bold text-white">También te puede servir</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  to={`/agencia/${item.slug}`}
                  className="group border border-zinc-800 bg-[#101013] p-5 transition-colors hover:border-amber-400/60"
                >
                  <h3 className="font-display text-base font-semibold text-white group-hover:text-amber-300">
                    {item.shortName}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">{item.serviceType} en San Luis Potosí.</p>
                  <span className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    Ver servicio →
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-10 border border-amber-400/30 bg-[#101013] p-6 text-center sm:p-8">
              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                ¿Armamos tu {service.shortName.toLowerCase()} en San Luis Potosí?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
                Respuesta directa por WhatsApp, sin intermediarios ni formularios eternos.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 bg-amber-400 px-6 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300 sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hablar por WhatsApp
                </a>
                <Link
                  to="/agencia"
                  className="inline-flex w-full items-center justify-center gap-2 border border-zinc-700 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300 sm:w-auto"
                >
                  Ver todos los servicios BTL
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </BtlLayout>
  );
};
