import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { createWhatsAppUrl } from '../data/content';
import { CONCEPT_SOLUTIONS, PROJECTS } from '../data/projects';
import type { ProjectImage } from '../data/projects';
import { loadPortfolioManifest, resolvePortfolioManifestImages } from '../features/projects/portfolioManifest';

export const EvidenceSection: React.FC = () => {
  const [imagesByProject, setImagesByProject] = useState<Record<string, ProjectImage[]>>({});
  const softwareProjects = PROJECTS.filter((project) => project.group === 'software');
  const experienceProjects = PROJECTS.filter((project) => project.group === 'experience');

  useEffect(() => {
    if (!__PORTFOLIO_PUBLIC_MEDIA_ENABLED__) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;
    let active = true;
    void Promise.all(
      PROJECTS.map(async (project) => {
        const manifest = await loadPortfolioManifest(supabaseUrl, project.slug);
        return [project.slug, manifest ? resolvePortfolioManifestImages(manifest, supabaseUrl) : []] as const;
      }),
    ).then((entries) => {
      if (active) setImagesByProject(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, []);

  return (
    <section id="evidencia" className="border-t border-zinc-900 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Proyectos</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-5xl">
            Tecnología hecha para experiencias reales.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            Plataformas y experiencias digitales desarrolladas por Charlitron. Las funciones se describen según su estado confirmado.
          </p>
        </div>

        <ProjectGroup title="Software y plataformas" projects={softwareProjects} imagesByProject={imagesByProject} />
        <ProjectGroup title="Experiencias digitales e IA" projects={experienceProjects} imagesByProject={imagesByProject} />

        <section className="mt-16 border-t border-zinc-800 pt-8" aria-labelledby="concept-solutions-title">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Ideas para nuevos proyectos</p>
          <h3 id="concept-solutions-title" className="mt-2 font-display text-2xl font-bold text-white">
            Soluciones conceptuales
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Estas opciones son conceptos para proyectos futuros, no casos publicados en este portafolio.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {CONCEPT_SOLUTIONS.map((solution) => (
              <article key={solution.title} className="border border-zinc-800 bg-[#101013] p-5">
                <h4 className="font-semibold text-zinc-100">{solution.title}</h4>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{solution.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
};

function ProjectGroup({
  title,
  projects,
  imagesByProject,
}: {
  title: string;
  projects: typeof PROJECTS;
  imagesByProject: Record<string, ProjectImage[]>;
}) {
  return (
    <section className="mb-14" aria-label={title}>
      <h3 className="mb-5 border-b border-zinc-800 pb-3 font-display text-xl font-bold text-white sm:text-2xl">
        {title}
      </h3>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const image = imagesByProject[project.slug]?.[0] ?? project.images?.[0];
          return (
          <article key={project.slug} className="flex min-w-0 flex-col border border-zinc-800 bg-[#101013]">
            {image ? (
              <img
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading="lazy"
                decoding="async"
                className="aspect-[16/10] w-full border-b border-zinc-800 bg-black object-contain"
              />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center border-b border-zinc-800 bg-[#0b0b0e] p-6 text-center">
                <p className="max-w-xs text-sm text-zinc-500">Captura auténtica autorizada pendiente</p>
              </div>
            )}
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h4 className="font-display text-xl font-bold text-white">{project.title}</h4>
              <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">{project.summary}</p>
              <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  to={`/proyectos/${project.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-amber-400"
                >
                  Ver proyecto <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href={createWhatsAppUrl(project.whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Quiero algo similar
                </a>
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
