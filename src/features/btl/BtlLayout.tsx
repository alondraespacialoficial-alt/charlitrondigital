import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { FACEBOOK_URL, INSTAGRAM_URL, createWhatsAppUrl } from '../../data/content';
import { AGENCY_HUB } from '../../data/btl';

interface BtlLayoutProps {
  children: React.ReactNode;
}

// Shell compartido de las páginas BTL (/agencia y /agencia/:slug).
export const BtlLayout: React.FC<BtlLayoutProps> = ({ children }) => {
  const whatsappUrl = createWhatsAppUrl(AGENCY_HUB.whatsappMessage);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-amber-400 selection:text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
            aria-label="Ir al sitio principal de Charlitron Digital"
          >
            <CharlitronLogo size="sm" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-300 sm:flex">
            <Link to="/" className="transition-colors hover:text-amber-400">
              Charlitron Digital
            </Link>
            <Link to="/agencia" className="transition-colors hover:text-amber-400">
              Agencia BTL
            </Link>
          </nav>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-300 sm:px-4 sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Hablemos</span>
          </a>
        </div>
      </header>

      {children}

      <footer className="border-t border-zinc-800/80 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-zinc-500 sm:flex-row">
          <p>© 2026 Charlitron Agencia · San Luis Potosí, México</p>
          <p>
            Unidad BTL de la marca Charlitron ·{' '}
            <Link to="/" className="text-zinc-300 underline-offset-4 transition-colors hover:text-amber-400 hover:underline">
              Charlitron Digital
            </Link>
          </p>
          <div className="flex items-center gap-3">
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook de Charlitron Agencia"
              className="text-zinc-400 transition-colors hover:text-amber-400"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Charlitron Agencia"
              className="text-zinc-400 transition-colors hover:text-amber-400"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
