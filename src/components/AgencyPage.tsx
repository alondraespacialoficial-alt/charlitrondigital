import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  MapPin,
  Megaphone,
  MessageCircle,
  Radio,
  Video
} from 'lucide-react';
import { CharlitronLogo } from './CharlitronLogo';
import { createWhatsAppUrl } from '../data/content';

interface AgencyPageProps {
  onBack: () => void;
}

const services = [
  {
    number: '01',
    title: 'Activaciones en campo',
    description: 'Presencia directa de marca en zonas, rutas y puntos de alto impacto.',
    icon: MapPin
  },
  {
    number: '02',
    title: 'Publicidad BTL',
    description: 'Experiencias que conectan a las marcas con las personas fuera de los medios digitales.',
    icon: Megaphone
  },
  {
    number: '03',
    title: 'Producción de video',
    description: 'Producción audiovisual para comunicar, promocionar y compartir lo que hace especial a tu marca.',
    icon: Video
  },
  {
    number: '04',
    title: 'Perifoneo profesional',
    description: 'Difusión de campañas y mensajes en zonas estratégicas.',
    icon: Radio
  },
  {
    number: '05',
    title: 'Contenido y campañas',
    description: 'Contenido y acciones publicitarias para comunicar tu marca y mantenerla presente.',
    icon: Megaphone
  }
];

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
  'Gemini_Generated_Image_xzup1sxzup1sxzup.jpg'
];

const agencyWhatsApp = createWhatsAppUrl(
  'Hola Charlitron, vi su página de Agencia BTL y quiero información sobre activaciones y servicios para mi marca.'
);

export const AgencyPage: React.FC<AgencyPageProps> = ({ onBack }) => (
  <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-amber-400 selection:text-zinc-950">
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
          aria-label="Volver al sitio principal"
        >
          <ArrowLeft className="h-4 w-4 text-amber-400" />
          <span className="hidden sm:inline">Volver al sitio</span>
        </button>
        <a href="#agencia-inicio" aria-label="Charlitron Agencia, inicio">
          <CharlitronLogo size="sm" />
        </a>
        <a
          href={agencyWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-300 sm:px-4 sm:text-sm"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Hablemos</span>
        </a>
      </div>
    </header>

    <main>
      <section id="agencia-inicio" className="border-b border-zinc-800/80 bg-grid-pattern">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
                <span className="h-px w-7 bg-amber-400" /> Charlitron Agencia · Servicios BTL
              </p>
              <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
                10 años creando experiencias que se viven en campo.
              </h1>
              <p className="mt-3 text-sm text-zinc-400 sm:text-base">
                Experiencias que conectan, estrategias que venden.
              </p>
            </div>
            <a
              href="#servicios"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-amber-400"
            >
              Conoce lo que hacemos <ArrowUpRight className="h-4 w-4" />
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
              aria-label="Video de trayectoria de Charlitron Agencia: 10 años"
            >
              Tu navegador no puede reproducir este video.
            </video>
          </div>
          <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-zinc-500">
            Una década de ideas que salen a la calle
          </p>
        </div>
      </section>

      <section id="servicios" className="border-b border-zinc-800/80 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Lo hacemos realidad</p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Tu marca, presente donde está tu gente.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-400 sm:text-base">
              Diseñamos acciones BTL y activaciones en campo para acercar tu marca a las personas. Llevamos el mensaje a zonas, rutas y puntos de alto impacto, con experiencias que se recuerdan.
            </p>
            <a
              href={agencyWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300"
            >
              <MessageCircle className="h-4 w-4 text-amber-400" />
              Platiquemos de tu campaña
            </a>
          </div>

          <div className="divide-y divide-zinc-800 border-y border-zinc-800">
            {services.map(({ number, title, description, icon: Icon }) => (
              <article key={number} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 py-5 sm:gap-5">
                <span className="pt-1 font-mono text-xs text-zinc-500">{number}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
                </div>
                <Icon className="mt-1 h-5 w-5 text-amber-400" aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800/80 px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Catálogo visual</p>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Ideas para llevar tu marca más lejos.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-zinc-400">
              Elige la imagen que te interesa y cuéntanos qué tienes en mente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {agencyGallery.map((image, imageIndex) => {
              const imageNumber = String(imageIndex + 1).padStart(2, '0');
              const imageWhatsApp = createWhatsAppUrl(
                `Hola Charlitron, me interesa este servicio. Vi la imagen ${imageNumber} del catálogo de Agencia.`
              );

              return (
                <article key={image} className="overflow-hidden border border-zinc-800 bg-[#101013]">
                  <img
                    src={`/${image}`}
                    alt={`Imagen ${imageNumber} del catálogo de servicios Charlitron Agencia`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
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
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Conoce nuestra propuesta</p>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Charlitron Agencia · Presentación 2026</h2>
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

    <footer className="px-4 py-6 text-center text-xs text-zinc-500 sm:px-6">
      © 2026 Charlitron Agencia · San Luis Potosí, México
    </footer>
  </div>
);