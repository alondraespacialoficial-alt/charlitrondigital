import React, { useState } from 'react';
import { SERVICES_LIST, createWhatsAppUrl } from '../data/content';
import { Globe, Smartphone, Zap, Bot, ArrowRight, Check, X, MessageCircle } from 'lucide-react';
import { ServiceItem } from '../types';

export const WhatWeDo: React.FC = () => {
  const [activeService, setActiveService] = useState<ServiceItem | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe':
        return <Globe className="w-7 h-7 text-amber-400" />;
      case 'Smartphone':
        return <Smartphone className="w-7 h-7 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-7 h-7 text-amber-400" />;
      case 'Bot':
        return <Bot className="w-7 h-7 text-amber-400" />;
      default:
        return <Zap className="w-7 h-7 text-amber-400" />;
    }
  };

  return (
    <section id="soluciones" className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-900/90 overflow-hidden">
      {/* Background Image & Atmospheric Overlays */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/services-bg.jpg"
          alt="Soluciones digitales de Charlitron Digital"
          className="w-full h-full object-cover object-center opacity-40 sm:opacity-45 brightness-[0.9] contrast-[1.08] saturate-[1.15]"
        />
        {/* Layered gradients for cinematic depth and readability */}
        <div className="absolute inset-0 bg-[#09090b]/75 backdrop-blur-[0.5px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-transparent to-[#09090b]" />
        <div className="absolute inset-0 bg-radial-[circle_at_50%_40%] from-amber-500/10 via-transparent to-[#09090b]/80" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-amber-400 font-semibold tracking-wider text-xs uppercase px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 backdrop-blur-sm shadow-sm">
            Qué hacemos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-3 mb-4 tracking-tight drop-shadow-md">
            Soluciones digitales concretas
          </h2>
          <p className="text-zinc-300 text-base sm:text-lg leading-relaxed drop-shadow-sm">
            Sin conceptos abstractos ni rodeos. Herramientas diseñadas para resolver fricciones reales de tu día a día.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES_LIST.map((service) => (
            <div
              key={service.id}
              className="tech-panel group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-[#0f0f14]/85 backdrop-blur-md border border-zinc-800/90 hover:border-amber-400/60 hover:bg-[#14141b]/95 transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.38)] hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(250,204,21,0.12)]"
            >
              <div>
                {/* Header Icon with geometric frame */}
                <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm border border-zinc-700/80 flex items-center justify-center mb-5 group-hover:border-amber-400/40 group-hover:scale-105 transition-all">
                  {getIcon(service.iconName)}
                </div>

                {/* Title */}
                <h3 className="font-display text-2xl font-bold text-white mb-2 tracking-tight group-hover:text-amber-400 transition-colors drop-shadow-sm">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  {service.description}
                </p>
              </div>

              {/* Quick action buttons */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <button
                  onClick={() => setActiveService(service)}
                  className="text-xs font-semibold text-zinc-200 hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ver detalles</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <a
                  href={createWhatsAppUrl(`Hola Charlitron Digital, me interesa saber más sobre soluciones de ${service.title} para mi negocio.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-zinc-900/90 hover:bg-amber-400 hover:text-zinc-950 text-amber-400 border border-zinc-700/80 hover:border-amber-400 transition-all shadow-sm"
                  title={`Consultar ${service.title} por WhatsApp`}
                  aria-label={`Consultar ${service.title} por WhatsApp`}
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      {activeService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121216] border border-zinc-700 p-6 sm:p-8 text-left shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setActiveService(null)}
              className="absolute top-5 right-5 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                {getIcon(activeService.iconName)}
              </div>
              <div>
                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  Solución
                </span>
                <h3 className="text-2xl font-bold text-white font-display">
                  {activeService.title}
                </h3>
              </div>
            </div>

            <p className="text-zinc-300 text-sm mb-5 leading-relaxed">
              {activeService.description}
            </p>

            <div className="space-y-2.5 mb-6">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Beneficios clave:
              </h4>
              {activeService.detailPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-zinc-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-6 flex items-center gap-2">
              <span className="font-semibold text-amber-400">Resultado:</span>
              <span>{activeService.sampleOutcome}</span>
            </div>

            <div className="flex gap-3">
              <a
                href={createWhatsAppUrl(`Hola Charlitron Digital, me gustaría platicar sobre ${activeService.title} para mi negocio.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 text-zinc-950 font-bold text-sm hover:bg-amber-300 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Consultar por WhatsApp</span>
              </a>
              <button
                onClick={() => setActiveService(null)}
                className="py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
