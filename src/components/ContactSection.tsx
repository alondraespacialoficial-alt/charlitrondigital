import React, { useState } from 'react';
import { MessageCircle, Send, CheckCircle2, Phone, ShieldCheck, Mail } from 'lucide-react';
import { PHONE_DISPLAY, CONTACT_EMAIL, createWhatsAppUrl } from '../data/content';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    contacto: '',
    mejora: '',
    websiteHoneypot: '', // Honeypot field for anti-spam
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const mainWhatsAppUrl = createWhatsAppUrl(
    'Hola Charlitron Digital, me gustaría platicar sobre cómo pueden simplificar los procesos de mi negocio.'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: If bot filled the hidden website field, silently abort
    if (formData.websiteHoneypot) {
      return;
    }

    if (!formData.nombre.trim() || !formData.contacto.trim() || !formData.mejora.trim()) {
      return;
    }

    setLoading(true);

    // Format message to send directly via WhatsApp or confirm receipt
    const customMessage = `Hola Charlitron Digital,\n\nMi nombre es: ${formData.nombre.trim()}${
      formData.empresa.trim() ? ` (Empresa: ${formData.empresa.trim()})` : ''
    }\nContacto: ${formData.contacto.trim()}\n\nLo que quiero mejorar en mi negocio:\n${formData.mejora.trim()}`;

    const waRedirect = createWhatsAppUrl(customMessage);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      // Open WhatsApp with prefilled message
      window.open(waRedirect, '_blank', 'noopener,noreferrer');
    }, 600);
  };

  return (
    <section id="contacto" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-zinc-900">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-amber-400 font-semibold tracking-wider text-xs uppercase px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
          Contacto sin complicaciones
        </span>
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white mt-3 mb-4 tracking-tight">
          Cuéntanos qué quieres mejorar.
        </h2>
        <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
          No necesitas saber qué tecnología necesitas. Cuéntanos cómo trabajas y nosotros analizamos qué podemos simplificar.
        </p>
      </div>

      {/* Main WhatsApp Primary Card */}
      <div className="premium-shell relative rounded-3xl border border-amber-400/30 p-8 sm:p-10 text-center mb-12 glow-ring">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400 text-zinc-950 mb-5 shadow-[0_0_30px_rgba(250,204,21,0.35)]">
          <MessageCircle className="w-8 h-8 fill-current" />
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold text-white font-display mb-2">
          Respuesta directa por WhatsApp
        </h3>
        <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto mb-7">
          Atención personalizada e inmediata sin intermediarios ni filtros complejos.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={mainWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="amber-button w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-zinc-950 font-bold text-base hover:brightness-105 active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>Hablar por WhatsApp</span>
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Consulta - Charlitron Digital')}`}
            className="dark-button w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-zinc-200 border border-zinc-700 hover:border-amber-400/60 hover:text-white text-sm font-semibold transition-all"
          >
            <Mail className="w-4 h-4 text-amber-400" />
            <span>Escribir por Correo</span>
          </a>

          <a
            href="tel:4444237092"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 hover:border-zinc-500 text-sm font-medium transition-all"
          >
            <Phone className="w-4 h-4 text-zinc-400" />
            <span>{PHONE_DISPLAY}</span>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Atención directa y confidencial</span>
          </span>
          <span className="hidden sm:inline text-zinc-600">•</span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-zinc-300 hover:text-amber-400 transition-colors underline decoration-zinc-700 underline-offset-4 font-mono"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      {/* Secondary Lightweight Contact Form (Opción secundaria estructurada) */}
      <div className="rounded-2xl bg-[#0f0f14] border border-zinc-800 p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h4 className="text-lg font-bold text-white font-display">
            ¿Prefieres dejarnos tus datos primero?
          </h4>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Llena este breve formato y te responderemos con una propuesta inicial.
          </p>
        </div>

        {submitted ? (
          <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h5 className="font-bold text-white text-base">¡Información recibida!</h5>
            <p className="text-xs text-zinc-300 mt-1 mb-4">
              Hemos preparado tu solicitud para enviarla de inmediato a nuestro equipo técnico.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={mainWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs hover:bg-amber-300 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Abrir WhatsApp ahora</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Contacto de ${formData.nombre}`)}&body=${encodeURIComponent(`Nombre: ${formData.nombre}\nEmpresa: ${formData.empresa}\nContacto: ${formData.contacto}\n\nMejora:\n${formData.mejora}`)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 font-semibold text-xs transition-all"
              >
                <Mail className="w-4 h-4 text-amber-400" />
                <span>Enviar también por Correo</span>
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field (hidden from users, traps automated bots) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="websiteHoneypot">Website</label>
              <input
                type="text"
                id="websiteHoneypot"
                name="websiteHoneypot"
                tabIndex={-1}
                autoComplete="off"
                value={formData.websiteHoneypot}
                onChange={(e) => setFormData({ ...formData, websiteHoneypot: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="nombre">
                  Nombre *
                </label>
                <input
                  id="nombre"
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="empresa">
                  Empresa o negocio
                </label>
                <input
                  id="empresa"
                  type="text"
                  placeholder="Nombre de tu negocio"
                  value={formData.empresa}
                  onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="contacto">
                Teléfono o correo *
              </label>
              <input
                id="contacto"
                type="text"
                required
                placeholder="Ej. 444 123 4567 o tu@correo.com"
                value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="mejora">
                ¿Qué quieres mejorar? *
              </label>
              <textarea
                id="mejora"
                rows={3}
                required
                placeholder="Ejemplo: Pierdo mucho tiempo enviando cotizaciones a mano o quiero un sistema para que mis clientes agenden citas..."
                value={formData.mejora}
                onChange={(e) => setFormData({ ...formData, mejora: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              {loading ? (
                <span>Preparando contacto...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar y conectar por WhatsApp</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
