// Shell para páginas del blog: cabecera mínima + footer existente.
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { Footer } from '../../components/Footer';
import { FloatingWhatsApp } from '../../components/FloatingWhatsApp';
import { createWhatsAppUrl } from '../../data/content';

export const BlogShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  const handleOpenLegal = (tab: string) => {
    // La lógica de legales vive en la landing; navegar con hash.
    navigate(`/#legal-${tab}`);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col selection:bg-amber-400 selection:text-zinc-950">
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          <Link to="/" aria-label="Charlitron Digital Inicio" className="py-1">
            <CharlitronLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al inicio</span>
            </Link>
            <a
              href={createWhatsAppUrl('Hola Charlitron Digital, leí su blog y quiero información para mi negocio.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-zinc-950 font-semibold text-sm hover:bg-amber-300 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer onOpenLegal={handleOpenLegal} />
      <FloatingWhatsApp />
    </div>
  );
};
