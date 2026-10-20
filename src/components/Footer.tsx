import React from 'react';
import { CharlitronLogo } from './CharlitronLogo';
import { PHONE_DISPLAY, CONTACT_EMAIL, FACEBOOK_URL, INSTAGRAM_URL, createWhatsAppUrl } from '../data/content';
import { MessageCircle, Phone, Mail, ArrowUp, ShieldCheck, Facebook, Instagram } from 'lucide-react';
import { LegalTab } from './LegalPage';

interface FooterProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const directWhatsAppUrl = createWhatsAppUrl(
    'Hola Charlitron Digital, vi su sitio web y quiero ponerme en contacto.'
  );

  const handleLegalClick = (tab: LegalTab, e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenLegal) {
      onOpenLegal(tab);
    } else {
      window.location.hash = `legal-${tab}`;
    }
  };

  return (
    <footer className="border-t border-zinc-900 bg-[#070709] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Brand identity */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <CharlitronLogo size="sm" />
          <p className="text-xs text-zinc-400 mt-2 max-w-sm">
            Soluciones digitales para negocios. Webs, apps, automatizaciones e IA para simplificar procesos y vender más.
          </p>
        </div>

        {/* Quick direct contacts */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <a
            href={directWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 hover:border-amber-400/50 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>WhatsApp: {PHONE_DISPLAY}</span>
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>{CONTACT_EMAIL}</span>
          </a>

          <a
            href="tel:4444237092"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-zinc-400" />
            <span>Tel: {PHONE_DISPLAY}</span>
          </a>

          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook de Charlitron Digital"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors"
          >
            <Facebook className="w-3.5 h-3.5 text-amber-400" />
            <span>Facebook</span>
          </a>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de Charlitron Digital"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5 text-amber-400" />
            <span>Instagram</span>
          </a>
        </div>

        {/* Scroll to top button */}
        <button
          onClick={scrollToTop}
          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-800 transition-colors cursor-pointer"
          aria-label="Volver al inicio"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>

      {/* Legal navigation bar */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-zinc-900/90 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400 gap-4">
        <p className="text-zinc-500 text-center md:text-left">
          © 2026 Charlitron Digital. Todos los derechos reservados.
        </p>

        {/* Legal links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs">
          <button
            onClick={(e) => handleLegalClick('privacidad', e)}
            className="text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
          >
            Aviso de Privacidad
          </button>
          <span className="text-zinc-600">·</span>
          <button
            onClick={(e) => handleLegalClick('terminos', e)}
            className="text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
          >
            Términos y Condiciones
          </button>
          <span className="text-zinc-600">·</span>
          <button
            onClick={(e) => handleLegalClick('cookies', e)}
            className="text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
          >
            Política de Cookies
          </button>
        </nav>

        <div className="flex items-center gap-1.5 text-zinc-400 text-center md:text-right">
          <span>Contacto:</span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-zinc-300 hover:text-amber-400 font-mono transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
};

