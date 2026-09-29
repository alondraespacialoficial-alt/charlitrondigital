import React, { useState, useEffect } from 'react';
import { CharlitronLogo } from './CharlitronLogo';
import { MessageCircle, Menu, X, ArrowUpRight, Mail, Phone, ShieldCheck, ChevronRight, Sparkles, Home, Layers, Target, Laptop, HelpCircle, Send, Megaphone } from 'lucide-react';
import { PHONE_DISPLAY, CONTACT_EMAIL, createWhatsAppUrl } from '../data/content';
import { LegalTab } from './LegalPage';

interface HeaderProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLegal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock scroll when mobile hamburger modal is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { label: 'Inicio', href: '#inicio', icon: Home },
    { label: 'Soluciones', href: '#soluciones', icon: Layers, badge: 'Webs · Apps · IA' },
    { label: '¿Qué mejorar?', href: '#necesidades', icon: Target },
    { label: 'Proyectos', href: '#evidencia', icon: Laptop, badge: 'Casos Reales' },
    { label: 'Cómo trabajamos', href: '#metodo', icon: HelpCircle },
    { label: 'Agencia BTL', href: '#agencia', icon: Megaphone, badge: 'Activaciones' },
    { label: 'Contacto', href: '#contacto', icon: Send },
  ];

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (href === '#agencia') {
      window.location.hash = 'agencia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const directWhatsAppUrl = createWhatsAppUrl(
    'Hola Charlitron Digital, vi su página en mi celular y me gustaría información para mi negocio.'
  );

  const handleOpenLegalTab = (tab: LegalTab) => {
    setMobileMenuOpen(false);
    if (onOpenLegal) {
      onOpenLegal(tab);
    } else {
      window.location.hash = `legal-${tab}`;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Logo anchor */}
          <a
            href="#inicio"
            onClick={(e) => handleScrollTo(e, '#inicio')}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg py-1"
            aria-label="Charlitron Digital Inicio"
          >
            <CharlitronLogo size="md" />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleScrollTo(e, link.href)}
                className="text-sm font-medium text-zinc-300 hover:text-amber-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action buttons on Desktop/Tablet */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/60 text-xs font-medium transition-colors"
              title={`Enviar correo a ${CONTACT_EMAIL}`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>{CONTACT_EMAIL}</span>
            </a>

            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-zinc-950 font-semibold text-sm hover:bg-amber-300 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)]"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp</span>
              <span className="hidden md:inline text-xs opacity-80 font-normal">
                ({PHONE_DISPLAY})
              </span>
            </a>
          </div>

          {/* Mobile Hamburger Button with comfortable touch target */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:border-amber-400/50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-sm"
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="w-6 h-6 text-amber-400" />
          </button>
        </div>
      </header>

      {/* Full-Screen Mobile Hamburger Modal */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#09090b]/95 backdrop-blur-xl lg:hidden overflow-y-auto animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación móvil"
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 h-18 border-b border-zinc-800/90 bg-[#09090b]/90 backdrop-blur-md">
            <a
              href="#inicio"
              onClick={(e) => handleScrollTo(e, '#inicio')}
              aria-label="Charlitron Digital Inicio"
            >
              <CharlitronLogo size="sm" />
            </a>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-zinc-300 hover:text-white hover:border-amber-400/60 active:scale-95 transition-all cursor-pointer"
              aria-label="Cerrar menú"
            >
              <span className="text-xs font-semibold">Cerrar</span>
              <X className="w-5 h-5 text-amber-400" />
            </button>
          </div>

          {/* Modal Body: Navigation Links & Quick Actions */}
          <div className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-lg mx-auto w-full">
            {/* Quick Status / Value Pill */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-400">Atención rápida por WhatsApp</span>
              </div>
              <span className="text-amber-400 font-medium">SLP, México</span>
            </div>

            {/* Nav links with icons and comfortable tap targets */}
            <nav className="space-y-1.5">
              <p className="px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Navegación
              </p>
              {navLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleScrollTo(e, link.href)}
                    className="flex items-center justify-between px-3.5 py-3.5 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-850/90 active:bg-zinc-800 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 group-hover:border-amber-400/40">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-base font-semibold">{link.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {link.badge && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          {link.badge}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </a>
                );
              })}
            </nav>

            {/* Direct Contact Actions */}
            <div className="pt-4 border-t border-zinc-800/90 space-y-3">
              <p className="px-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Contacto Directo
              </p>

              {/* Main WhatsApp Button */}
              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>Chatear por WhatsApp</span>
                </div>
                <span className="text-xs bg-emerald-600/60 px-2 py-0.5 rounded-md font-mono">
                  {PHONE_DISPLAY}
                </span>
              </a>

              {/* Quick phone & email buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href="tel:4444237092"
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-800 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Llamar ahora</span>
                </a>

                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-800 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Enviar correo</span>
                </a>
              </div>
            </div>

            {/* Legal Links in Mobile Modal */}
            <div className="pt-4 border-t border-zinc-800/80">
              <p className="px-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                Marco Legal
              </p>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  onClick={() => handleOpenLegalTab('privacidad')}
                  className="py-2 px-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-[11px] text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer border border-zinc-850"
                >
                  Privacidad
                </button>
                <button
                  onClick={() => handleOpenLegalTab('terminos')}
                  className="py-2 px-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-[11px] text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer border border-zinc-850"
                >
                  Términos
                </button>
                <button
                  onClick={() => handleOpenLegalTab('cookies')}
                  className="py-2 px-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-[11px] text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer border border-zinc-850"
                >
                  Cookies
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-zinc-850 text-center text-[11px] text-zinc-500 bg-[#070709]">
            <span>© 2026 Charlitron Digital • San Luis Potosí, México</span>
          </div>
        </div>
      )}
    </>
  );
};

