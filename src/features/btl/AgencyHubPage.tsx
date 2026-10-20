import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  Download,
  Hand,
  Megaphone,
  MessageCircle,
  Radio,
  Sparkles,
  UserCheck,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { BtlLayout } from './BtlLayout';
import { applyPageMeta } from '../../lib/seo';
import { buildAgencyHubJsonLd } from '../../lib/jsonld';
import { SITE_URL } from '../../lib/site';
import { AGENCY_HUB, BTL_SERVICES } from '../../data/btl';
import { createWhatsAppUrl } from '../../data/content';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  'demostradoras-san-luis-potosi': Users,
  'promotores-san-luis-potosi': UserCheck,
  'edecanes-san-luis-potosi': Sparkles,
  'ejecucion-local-agencias': Building2,
  'activaciones-btl-san-luis-potosi': Megaphone,
  'perifoneo-san-luis-potosi': Radio,
  'volanteo-san-luis-potosi': Hand,
  'produccion-audiovisual-san-luis-potosi': Video,
};

const agencyGallery = [
  'Gemini_Generated_Image_207yek207yek207y.jpg',
  'Gemini_Generated_Image_5tjp835tjp835tjp.jpg',
  'Gemini_Generated_Image_a3pvsia3pvsia3pv.jpg',
  'Gemini_Generated_Image_aascquaascquaasc.jpg',
  'Gemini_Generated_Image_chdsljchdsljchds.jpg',
  'Gemini_Generated_Image_errt2berrt2berrt.jpg',
  'Gemini_Generated_Image_k8384uk8384uk838.jpg',
  'Gemini_Generated_Image_n82gxkn82gxkn82g.jpg',
  'Gemini_Generated_Image_pxyvvnpxyvvnpxyv.jpg',
  'Gemini_Generated_Image_spv3l3spv3l3spv3.jpg',
  'Gemini_Generated_Image_tjlf2qtjlf2qtjlf.jpg',
  'Gemini_Generated_Image_tns692tns692tns6.jpg',
  'Gemini_Generated_Image_wc3rhywc3rhywc3r.jpg',
  'Gemini_Generated_Image_wxb7f4wxb7f4wxb7.jpg',
  'Gemini_Generated_Image_xzup1sxzup1sxzup.jpg',
];

// Servicios BTL sin página propia todavía: se mencionan en el hub para
// completar la oferta sin crear URLs vacías de contenido.
const MORE_BTL_SERVICES = ['Contenido y campañas'];

const hubWhatsApp = createWhatsAppUrl(AGENCY_HUB.whatsappMessage);

export const AgencyHubPage: React.FC = () => {
  useEffect(() => {
    applyPageMeta(
      {
        title: AGENCY_HUB.metaTitle,
        description: AGENCY_HUB.metaDescription,
        canonicalPath: '/agencia',
      },
      buildAgencyHubJsonLd(SITE_URL, BTL_SERVICES),
    );
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <BtlLayout>
      <main>
        {/* Breadcrumb + hero */}
        <section className="border-b border-zinc-800/80 bg-grid-pattern">
          <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:px-8">
            <nav aria-label="Miga de pan" className="mb-6 flex items-center gap-1.5 text-xs text-zinc-500">
              <Link to="/" className="transition-colors hover:text-amber-400">
                Inicio
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <span className="text-zinc-300">Agencia BTL</span>
            </nav>

            <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-3xl">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
                  <span className="h-px w-7 bg-amber-400" /> Charlitron Agencia · Ejecución presencial y BTL
                </p>
                <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
                  {AGENCY_HUB.h1}
                </h1>
                <p className="mt-3 text-sm font-semibold text-zinc-300 sm:text-base">{AGENCY_HUB.tagline}</p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">{AGENCY_HUB.intro}</p>
              </div>
              <a
                href={hubWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300"
              >
                <MessageCircle className="h-4 w-4" />
                Platiquemos de tu campaña
              </a>
            </div>

            <div className="overflow-hidden border border-zinc-800 bg-black">
              <video
                className="block aspect-video w-full object-cover"
                src="/10%20a%C3%B1os.mp4"
                poster="/agency-banner.jpg"
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Video de trayectoria de Charlitron Agencia: más de 10 años"
              >
                Tu navegador no puede reproducir este video.
              </video>
            </div>
            <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-zinc-500">
              Más de una década de ideas que salen a la calle
            </p>
          </div>
        </section>

        {/* Servicios con página propia */}
        <section className="border-b border-zinc-800/80 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Lo hacemos realidad</p>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Tu marca, presente donde está tu gente.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Diseñamos y operamos acciones en campo en San Luis Potosí: personal en punto de venta, activaciones,
                perifoneo, volanteo y producción audiovisual.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BTL_SERVICES.map((service) => {
                const Icon = SERVICE_ICONS[service.slug] ?? Users;
                return (
                  <Link
                    key={service.slug}
                    to={`/agencia/${service.slug}`}
                    className="group flex flex-col justify-between border border-zinc-800 bg-[#101013] p-6 transition-colors hover:border-amber-400/60"
                  >
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className="h-6 w-6 text-amber-400" aria-hidden="true" />
                        <ArrowUpRight
                          className="h-4 w-4 text-zinc-500 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-400"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="font-display text-lg font-semibold text-white">{service.serviceType}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{service.intro}</p>
                    </div>
                    <span className="mt-5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                      Ver servicio →
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 border border-zinc-800/80 bg-[#0e0e12] p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                También operamos
              </p>
              <div className="flex flex-wrap gap-2">
                {MORE_BTL_SERVICES.map((item) => (
                  <span
                    key={item}
                    className="border border-zinc-700/80 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-medium text-zinc-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                ¿Buscas alguno de estos servicios?{' '}
                <a
                  href={hubWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-amber-400 underline-offset-4 hover:underline"
                >
                  Escríbenos por WhatsApp
                </a>{' '}
                y armamos tu propuesta.
              </p>
            </div>
          </div>
        </section>

        {/* Catálogo visual (ideas, no casos) */}
        <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Catálogo visual</p>
                <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Ideas para llevar tu marca más lejos.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-zinc-400">
                Elige la imagen que te interesa y cuéntanos qué tienes en mente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {agencyGallery.map((image, imageIndex) => {
                const imageNumber = String(imageIndex + 1).padStart(2, '0');
                const imageWhatsApp = createWhatsAppUrl(
                  `Hola Charlitron, me interesa este servicio. Vi la imagen ${imageNumber} del catálogo de Agencia.`,
                );

                return (
                  <article key={image} className="overflow-hidden border border-zinc-800 bg-[#101013]">
                    <img
                      src={`/${image}`}
                      alt={`Idea ${imageNumber} del catálogo visual de servicios BTL de Charlitron Agencia`}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-[#f4cf10] object-contain"
                    />
                    <a
                      href={imageWhatsApp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-12 items-center justify-center gap-2 px-2 py-3 text-center text-xs font-semibold text-zinc-100 transition-colors hover:bg-amber-400 hover:text-zinc-950 sm:text-sm"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0 text-amber-400 group-hover:text-zinc-950" />
                      <span>Me interesa este servicio</span>
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dossier */}
        <section className="relative overflow-hidden border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <img
            src="/agency-banner.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/90 to-[#09090b]/75" />
          <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
                Conoce nuestra propuesta
              </p>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                Charlitron Agencia · Presentación 2026
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Descarga el dossier de servicios BTL y activaciones en campo.
              </p>
            </div>
            <a
              href="/Charlitron%20presentaci%C3%B3n%202026%20(2).pdf"
              download="Charlitron-Presentacion-BTL-2026.pdf"
              className="inline-flex shrink-0 items-center justify-center gap-2 bg-amber-400 px-5 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300"
            >
              <Download className="h-4 w-4" />
              Descargar presentación
            </a>
          </div>
        </section>
      </main>
    </BtlLayout>
  );
};
