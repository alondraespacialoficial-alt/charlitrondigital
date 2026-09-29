import React from 'react';
import { AGENCY_SERVICES } from '../data/content';
import { ArrowUpRight } from 'lucide-react';

export const ComplementaryServices: React.FC = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-zinc-900/80">
      <div className="relative rounded-2xl bg-[#0e0e12] border border-zinc-800/80 p-6 sm:p-8 overflow-hidden group shadow-xl">
        {/* Background Image of Agency Services & Activations */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src="/agency-banner.jpg"
            alt="Charlitron Agencia - Producción de video, activaciones de marca y BTL"
            className="w-full h-full object-cover object-center sm:object-right md:object-center opacity-45 sm:opacity-50 group-hover:scale-105 group-hover:opacity-60 transition-all duration-700 brightness-[0.95] contrast-[1.05]"
          />
          {/* Gradients ensuring clear visibility of the scene while preserving text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/80 to-[#09090b]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/90 via-transparent to-[#09090b]/60" />
          <div className="absolute inset-0 bg-radial-[circle_at_15%_50%] from-amber-500/10 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs text-amber-400/90 font-semibold tracking-wide uppercase">
              También podemos ayudarte fuera de la pantalla
            </span>
            <div className="flex items-center gap-2.5 mt-1 mb-2">
              <h3 className="font-display text-2xl font-bold text-white tracking-tight drop-shadow-md">
                Charlitron Agencia
              </h3>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 backdrop-blur-sm">
                Offline & BTL
              </span>
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed mb-4 drop-shadow-sm">
              Activaciones de marca, producción de video profesional, perifoneo y campañas publicitarias para posicionar tu negocio en la calle.
            </p>

            <div className="flex flex-wrap gap-2">
              {AGENCY_SERVICES.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-zinc-700/80 text-zinc-200 font-medium shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <a
              href="#agencia"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white font-semibold text-sm border border-zinc-600/80 hover:border-amber-400/60 transition-all backdrop-blur-md shadow-lg cursor-pointer group/btn"
            >
              <span>Explorar Charlitron Agencia</span>
              <ArrowUpRight className="w-4 h-4 text-amber-400 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>

    </section>
  );
};
