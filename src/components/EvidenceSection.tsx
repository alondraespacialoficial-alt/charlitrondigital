import React, { useState } from 'react';
import { SHOWCASE_PROJECTS, createWhatsAppUrl } from '../data/content';
import { ShowcaseProject } from '../types';
import { ProjectMockup } from './ProjectMockup';
import { ProjectModal } from './ProjectModal';
import { Eye, ArrowUpRight, MessageCircle, CheckCircle2, Globe } from 'lucide-react';

export const EvidenceSection: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

  return (
    <section id="evidencia" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-900">
      {/* Section Heading */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-amber-400 font-semibold tracking-wider text-xs uppercase px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
          Resultados reales
        </span>
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4 tracking-tight">
          No solo entregamos trabajo. <br className="hidden sm:inline" />
          <span className="text-amber-400">Generamos impacto real.</span>
        </h2>
        <p className="text-zinc-400 text-base sm:text-lg">
          Soluciones vivas, operativas y pensadas para negocios que quieren más orden, más ventas y menos fricción en cada proceso.
        </p>
      </div>

      {/* Featured Projects Grid: Charlitron VET and Charlitron Eventos 360 (Large cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {SHOWCASE_PROJECTS.slice(0, 2).map((project) => (
          <div
            key={project.id}
            className="tech-panel group relative flex flex-col justify-between rounded-2xl bg-[#111116] border border-zinc-800 hover:border-amber-400/70 transition-all duration-300 p-6 sm:p-7 shadow-[0_18px_44px_rgba(0,0,0,0.32)] hover:-translate-y-1"
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-zinc-950">
                    {project.badge}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {project.tag}
                  </span>
                </div>
                {project.liveUrl ? (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 hover:border-emerald-400 transition-all shadow-sm"
                    title={`Visitar sitio real: ${project.liveUrl}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Sitio en Vivo</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-zinc-500 font-mono">V1 Producción</span>
                )}
              </div>

              {/* Title & Subtitle */}
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
                {project.title}
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mb-5">
                {project.subtitle}
              </p>

              {/* Visual Mockup Container (Responsive, Fast, WebP/SVG optimized vector UI) */}
              <div className="mb-5 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/60 p-1.5 transition-all group-hover:border-zinc-700">
                <ProjectMockup type={project.visualType} />
              </div>

              <p className="text-zinc-300 text-sm leading-relaxed mb-5">
                {project.description}
              </p>

              {/* Mini feature pills */}
              <div className="space-y-1.5 mb-6">
                {project.keyFeatures.slice(0, 2).map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(250,204,21,0.25)] active:scale-95"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Visitar sitio web</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={() => setSelectedProject(project)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white font-semibold text-xs transition-colors cursor-pointer active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Detalles</span>
                </button>
              </div>

              <a
                href={createWhatsAppUrl(project.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 hover:underline font-medium transition-colors py-1"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>Consultar caso</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 3 Secondary Solution Cards (Citas, Cotizadores, Paneles) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SHOWCASE_PROJECTS.slice(2, 5).map((project) => (
          <div
            key={project.id}
            className="group flex flex-col justify-between rounded-2xl bg-[#101014] border border-zinc-800 hover:border-amber-400/60 transition-all p-5 sm:p-6"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  {project.tag}
                </span>
                <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {project.badge}
                </span>
              </div>

              <h4 className="font-display text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                {project.title}
              </h4>

              <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-1">
                <ProjectMockup type={project.visualType} />
              </div>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4">
                {project.description}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
              <button
                onClick={() => setSelectedProject(project)}
                className="text-xs font-semibold text-zinc-300 hover:text-amber-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Detalles</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <a
                href={createWhatsAppUrl(project.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-zinc-900 hover:bg-amber-400 hover:text-zinc-950 text-amber-400 transition-all"
                title={`Consultar ${project.title} por WhatsApp`}
                aria-label={`Consultar ${project.title} por WhatsApp`}
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal viewer */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
};
