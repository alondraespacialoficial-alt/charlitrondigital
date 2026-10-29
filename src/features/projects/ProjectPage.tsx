import React, { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MessageCircle } from 'lucide-react';
import { createWhatsAppUrl } from '../../data/content';
import {
  PROJECTS,
  PROJECT_FEATURE_STATUS_LABELS,
  type PortfolioProject,
  type ProjectFeature,
} from '../../data/projects';
import { applyPageMeta } from '../../lib/seo';
import { buildPortfolioProjectJsonLd } from '../../lib/jsonld';
import { SITE_URL } from '../../lib/site';

export const ProjectRoute: React.FC = () => {
  const { slug } = useParams();
  const project = PROJECTS.find((item) => item.slug === slug);
  return project ? <ProjectPage project={project} /> : <Navigate to="/" replace />;
};

function ProjectPage({ project }: { project: PortfolioProject }) {
  useEffect(() => {
    applyPageMeta(
      {
        title: project.metaTitle,
        description: project.metaDescription,
        canonicalPath: `/proyectos/${project.slug}`,
      },
      buildPortfolioProjectJsonLd(project, SITE_URL),
    );
    window.scrollTo({ top: 0 });
  }, [project]);

  const whatsappUrl = createWhatsAppUrl(project.whatsappMessage);

  return (
    <main className="min-h-screen bg-[#09090b] text-[#f4f4f5]">
      <header className="border-b border-zinc-800/80 bg-[#09090b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="font-display text-sm font-bold text-white hover:text-amber-400">
            Charlitron Digital
          </Link>
          <a
            href="/#evidencia"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a proyectos
          </a>
        </div>
      </header>

      <nav aria-label="Miga de pan" className="mx-auto max-w-7xl px-4 pt-8 text-sm text-zinc-500 sm:px-6 lg:px-8">
        <Link to="/" className="hover:text-amber-400">Inicio</Link>
        <span className="px-2" aria-hidden="true">/</span>
        <a href="/#evidencia" className="hover:text-amber-400">Proyectos</a>
        <span className="px-2" aria-hidden="true">/</span>
        <span className="text-zinc-300">{project.title}</span>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <section className="grid gap-8 border-b border-zinc-800 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
              {project.group === 'software' ? 'Software y plataformas' : 'Experiencias digitales e IA'}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              {project.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              {project.summary}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={project.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-amber-400 hover:text-amber-300"
              >
                Ver sitio oficial <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Quiero algo similar
              </a>
            </div>
          </div>
          <ProjectGallery project={project} />
        </section>

        <section className="grid gap-8 border-b border-zinc-800 py-10 md:grid-cols-2 md:gap-12">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Problema que atiende</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">{project.problem}</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">Solución desarrollada</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">{project.solution}</p>
          </div>
        </section>

        <section className="border-b border-zinc-800 py-10">
          <h2 className="font-display text-2xl font-bold text-white">Capacidades y estado</h2>
          {project.features.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {project.features.map((feature) => (
                <FeatureItem key={feature.name} feature={feature} />
              ))}
            </div>
          ) : (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              La descripción de funciones específicas se añadirá cuando se valide el producto y haya evidencia autorizada para publicarla.
            </p>
          )}
        </section>

        {project.sections?.map((section) => (
          <section key={section.title} className="border-b border-zinc-800 py-10">
            <h2 className="font-display text-2xl font-bold text-white">{section.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{section.description}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {section.features.map((feature) => (
                <FeatureItem key={feature.name} feature={feature} />
              ))}
            </div>
          </section>
        ))}

        <section className="pt-10">
          <h2 className="font-display text-2xl font-bold text-white">Evidencias del proyecto</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Solo se mostrarán capturas auténticas autorizadas.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {project.images?.length ? (
              project.images.map((image) => (
                <figure key={image.src} className="overflow-hidden border border-zinc-800 bg-zinc-950">
                  <img
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    decoding="async"
                    className="h-auto max-h-[34rem] w-full bg-black object-contain"
                  />
                  <figcaption className="sr-only">{image.alt}</figcaption>
                </figure>
              ))
            ) : (
              <div className="flex aspect-video items-center justify-center border border-zinc-800 bg-[#0b0b0e] p-6 text-center sm:col-span-2">
                <p className="text-sm text-zinc-500">Captura auténtica autorizada pendiente</p>
              </div>
            )}
          </div>
        </section>

        <div className="mt-12 border-t border-zinc-800 pt-6">
          <a href="/#evidencia" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-amber-400">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al portafolio
          </a>
        </div>
      </div>
    </main>
  );
}

function ProjectGallery({ project }: { project: PortfolioProject }) {
  const image = project.images?.[0];
  if (image) {
    return (
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        fetchPriority="high"
        decoding="async"
        className="max-h-[34rem] w-full border border-zinc-800 bg-black object-contain"
      />
    );
  }
  return (
    <div className="flex aspect-video items-center justify-center border border-zinc-800 bg-[#0b0b0e] p-6 text-center">
      <p className="text-sm text-zinc-500">Captura auténtica autorizada pendiente</p>
    </div>
  );
}

function FeatureItem({ feature }: { feature: ProjectFeature }) {
  return (
    <article className="border border-zinc-800 bg-[#101013] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-6 text-zinc-100">{feature.name}</h3>
        <span className="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] leading-4 text-amber-300">
          {PROJECT_FEATURE_STATUS_LABELS[feature.status]}
        </span>
      </div>
      {feature.description && <p className="mt-2 text-sm leading-6 text-zinc-400">{feature.description}</p>}
    </article>
  );
}