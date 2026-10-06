import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { WhatWeDo } from './components/WhatWeDo';
import { NeedsSelector } from './components/NeedsSelector';
import { EvidenceSection } from './components/EvidenceSection';
import { HowWeWork } from './components/HowWeWork';
import { ComplementaryServices } from './components/ComplementaryServices';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { LegalPage, LegalTab } from './components/LegalPage';
import { CookieConsent } from './components/CookieConsent';
import { AgencyPage } from './components/AgencyPage';
import { CotizadorInterno } from './features/cotizador/CotizadorInterno';

export default function App() {
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [agencyPage, setAgencyPage] = useState(false);
  const [cotizadorOpen, setCotizadorOpen] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<number | null>(null);

  useEffect(() => {
    const handleLogoClickSequence = (event: MouseEvent) => {
      const target = event.target;
      const clickedLogo = target instanceof Element && target.closest('[data-cotizador-logo-trigger]');
      if (clickedLogo) {
        if (logoClickTimeout.current !== null) window.clearTimeout(logoClickTimeout.current);
        logoClickCount.current += 1;
        if (logoClickCount.current === 5) {
          logoClickCount.current = 0;
          setCotizadorOpen(true);
          return;
        }
        logoClickTimeout.current = window.setTimeout(() => {
          logoClickCount.current = 0;
          logoClickTimeout.current = null;
        }, 2000);
        return;
      }

      logoClickCount.current = 0;
      if (logoClickTimeout.current !== null) {
        window.clearTimeout(logoClickTimeout.current);
        logoClickTimeout.current = null;
      }
    };

    document.addEventListener('click', handleLogoClickSequence, true);
    return () => {
      document.removeEventListener('click', handleLogoClickSequence, true);
      if (logoClickTimeout.current !== null) window.clearTimeout(logoClickTimeout.current);
    };
  }, []);

  // Sync with window hash for direct linking / back navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#agencia') {
        setAgencyPage(true);
        setLegalTab(null);
        return;
      }
      setAgencyPage(false);
      if (hash.includes('privacidad') || hash === '#legal-privacidad' || hash === '#aviso-privacidad') {
        setLegalTab('privacidad');
      } else if (hash.includes('terminos') || hash === '#legal-terminos' || hash === '#terminos-condiciones') {
        setLegalTab('terminos');
      } else if (hash.includes('cookie') || hash === '#legal-cookies' || hash === '#politica-cookies') {
        setLegalTab('cookies');
      } else if (hash.includes('legal')) {
        setLegalTab('privacidad');
      } else if (!hash || hash === '#') {
        setLegalTab(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    window.location.hash = `legal-${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToMain = () => {
    setLegalTab(null);
    setAgencyPage(false);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (cotizadorOpen) {
    return <CotizadorInterno onClose={() => setCotizadorOpen(false)} />;
  }

  if (agencyPage) {
    return (
      <>
        <AgencyPage onBack={handleBackToMain} />
        <FloatingWhatsApp />
        <CookieConsent onOpenLegal={handleOpenLegal} />
      </>
    );
  }

  if (legalTab) {
    return (
      <>
        <LegalPage
          initialTab={legalTab}
          onBack={handleBackToMain}
        />
        <CookieConsent onOpenLegal={handleOpenLegal} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col selection:bg-amber-400 selection:text-zinc-950">
      {/* Sleek Navigation Bar */}
      <Header onOpenLegal={handleOpenLegal} />

      {/* Main landing sections */}
      <main className="flex-1">
        {/* 1. Hero: First full viewport */}
        <Hero />

        {/* 2. Qué Hacemos: 4 visual cards */}
        <WhatWeDo />

        {/* 3. Hablar de necesidades: 6 big action buttons to WhatsApp */}
        <NeedsSelector />

        {/* 4. Evidencia: Real projects showcase with interactive mockups */}
        <EvidenceSection />

        {/* 5. Cómo trabajamos: 4 clear steps */}
        <HowWeWork />

        {/* 6. Servicios complementarios: Charlitron Agencia (discreet) */}
        <ComplementaryServices />

        {/* 7. Contacto final: Cuéntanos qué quieres mejorar */}
        <ContactSection />
      </main>

      {/* Footer with Legal links */}
      <Footer onOpenLegal={handleOpenLegal} />

      {/* Persistent floating WhatsApp button */}
      <FloatingWhatsApp />

      {/* Cookie consent banner */}
      <CookieConsent onOpenLegal={handleOpenLegal} />
    </div>
  );
}

