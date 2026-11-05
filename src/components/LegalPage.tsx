import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, FileText, Cookie, Mail, CheckCircle2, ChevronRight, Home } from 'lucide-react';
import { CharlitronLogo } from './CharlitronLogo';
import { CONTACT_EMAIL, PHONE_DISPLAY } from '../data/content';
import { LEGAL_ADDRESS_LINE, LEGAL_RESPONSIBLE_NAME } from '../data/legalEntity';

export type LegalTab = 'privacidad' | 'terminos' | 'cookies';

interface LegalPageProps {
  initialTab?: LegalTab;
  onBack: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialTab = 'privacidad', onBack }) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialTab]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 flex flex-col selection:bg-amber-400 selection:text-zinc-950">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-750 transition-all text-xs font-semibold cursor-pointer group shadow-sm active:scale-95"
              title="Volver a la página principal"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Volver a la página principal</span>
              <span className="sm:hidden">Volver al inicio</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <CharlitronLogo size="sm" />
          </div>
        </div>
      </header>

      {/* Hero / Header banner */}
      <section className="border-b border-zinc-800/80 bg-gradient-to-b from-[#111117] to-[#09090b] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold tracking-wider uppercase mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Marco Legal y Transparencia</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Datos Legales de Charlitron Digital
          </h1>
          <p className="mt-3 text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto">
            Información legal transparente, términos de uso y políticas de protección de datos conforme a la legislación aplicable en México.
          </p>

          {/* Navigation Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setActiveTab('privacidad');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'privacidad'
                  ? 'bg-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(250,204,21,0.25)]'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>1. Aviso de Privacidad</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('terminos');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'terminos'
                  ? 'bg-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(250,204,21,0.25)]'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>2. Términos y Condiciones</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('cookies');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'cookies'
                  ? 'bg-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(250,204,21,0.25)]'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Cookie className="w-4 h-4" />
              <span>3. Política de Cookies</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* TAB 1: AVISO DE PRIVACIDAD */}
        {activeTab === 'privacidad' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border border-amber-400/30 bg-amber-400/5 rounded-2xl p-6 sm:p-7">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Documento Obligatorio</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Aviso de Privacidad Integral
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Última actualización: Noviembre de 2026 • Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
              </p>
            </div>

            {/* Responsable & Domicilio */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  Responsable del Tratamiento
                </h3>
                <p className="text-base text-white font-medium">
                  {LEGAL_RESPONSIBLE_NAME}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Persona física, titular fiscal y responsable legal de la operación Charlitron Digital.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  Domicilio Fiscal y Ubicación
                </h3>
                <p className="text-base text-white font-medium">
                  {LEGAL_ADDRESS_LINE}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Para fines de notificación y trámites legales oficiales.
                </p>
              </div>
            </div>

            {/* Correo de contacto */}
            <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-1">
                  Correo Electrónico de Contacto Oficial
                </h3>
                <p className="text-xs text-zinc-400">
                  Canal directo para aclaraciones, ejercicio de derechos y avisos de privacidad.
                </p>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 font-mono text-sm transition-colors border border-zinc-700"
              >
                <Mail className="w-4 h-4" />
                <span>{CONTACT_EMAIL}</span>
              </a>
            </div>

            {/* Datos Personales que se recaban */}
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-white">
                Datos personales que se recaban
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Para cumplir con las finalidades descritas en el presente aviso, Charlitron Digital recabará los siguientes datos personales cuando decides interactuar a través de formularios, WhatsApp o correo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  'Nombre completo',
                  'Correo electrónico',
                  'Número de WhatsApp / teléfono',
                  'Nombre del negocio / giro comercial',
                  'Mensaje libre sobre el proceso o reto a optimizar'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/50 border border-zinc-850 text-sm text-zinc-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Finalidades del tratamiento */}
            <section className="space-y-3 pt-4 border-t border-zinc-800/80">
              <h3 className="text-lg font-bold text-white">
                Finalidades del tratamiento
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Los datos personales que recabamos serán utilizados estrictamente para las siguientes finalidades necesarias para el servicio:
              </p>
              <ul className="space-y-2.5 pt-1">
                {[
                  'Contactar al usuario para dar seguimiento directo a su solicitud o consulta sobre soluciones digitales.',
                  'Enviar información técnica, cotizaciones o propuestas de valor sobre los servicios de Charlitron Digital (webs, apps, automatizaciones, integraciones de IA).',
                  'Evaluar y mejorar la experiencia de usuario y desempeño técnico de nuestro sitio web.'
                ].map((finalidad, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
                    <span className="w-5 h-5 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{finalidad}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Derechos ARCO */}
            <section className="space-y-3 pt-4 border-t border-zinc-800/80 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>Ejercicio de Derechos ARCO</span>
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones de su uso (<strong>Acceso</strong>). Asimismo, es su derecho solicitar la corrección de su información personal si está desactualizada, inexacta o incompleta (<strong>Rectificación</strong>); que la eliminemos de nuestros registros cuando considere que no está siendo utilizada adecuadamente (<strong>Cancelación</strong>); así como oponerse al uso de sus datos para fines específicos (<strong>Oposición</strong>).
              </p>
              <div className="pt-2">
                <p className="text-xs text-zinc-400">
                  Para ejercer cualquiera de sus derechos ARCO, envíe una solicitud directa con su nombre y detalle de la petición a:
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 text-amber-400 font-mono text-xs border border-zinc-700">
                  <Mail className="w-4 h-4" />
                  <span>{CONTACT_EMAIL}</span>
                </div>
              </div>
            </section>

            {/* Cambios al aviso */}
            <section className="space-y-2 pt-4 border-t border-zinc-800/80">
              <h3 className="text-base font-bold text-white">
                Modificaciones y cambios al Aviso de Privacidad
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                El presente aviso de privacidad puede sufrir modificaciones, cambios o actualizaciones derivadas de nuevos requerimientos legales o de nuestras propias necesidades operativas. Cualquier modificación se comunicará oportunamente a través de este mismo sitio web.
              </p>
            </section>
          </article>
        )}

        {/* TAB 2: TÉRMINOS Y CONDICIONES */}
        {activeTab === 'terminos' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border border-zinc-700 bg-zinc-900/60 rounded-2xl p-6 sm:p-7">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Normas de Uso del Sitio</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Términos y Condiciones de Uso
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Vigentes a partir de 2026 • Charlitron Digital
              </p>
            </div>

            {/* 1. Introducción */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <h3 className="text-base font-bold text-amber-400">
                1. Introducción y Aceptación
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Bienvenido a <strong>Charlitron Digital</strong>. Al acceder, navegar o utilizar este sitio web, usted acepta expresamente los presentes Términos y Condiciones. Si no está de acuerdo con alguno de ellos, le solicitamos abstenerse de utilizar el sitio.
              </p>
            </div>

            {/* 2. Descripción del servicio */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <h3 className="text-base font-bold text-amber-400">
                2. Descripción del Servicio
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Charlitron Digital ofrece soluciones tecnológicas e ingeniería digital a la medida para negocios y profesionales: desarrollo de sitios web de alta velocidad, aplicaciones web y móviles, automatizaciones de flujos de trabajo e implementaciones prácticas de Inteligencia Artificial para reducir fricciones operativas y acelerar ventas.
              </p>
            </div>

            {/* 3. Propiedad intelectual */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <h3 className="text-base font-bold text-amber-400">
                3. Propiedad Intelectual
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Todo el contenido contenido en este sitio (incluyendo marcas, logotipos, textos, códigos fuente, demostraciones interactivas, imágenes, diseños gráficos e interfaces) es propiedad exclusiva de Charlitron Digital o de sus respectivos titulares y está protegido por las leyes de propiedad intelectual e industrial mexicanas e internacionales. Queda prohibida su reproducción no autorizada.
              </p>
            </div>

            {/* 4. Limitación de responsabilidad */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <h3 className="text-base font-bold text-amber-400">
                4. Limitación de Responsabilidad
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                El contenido y las herramientas de este sitio se proporcionan "tal cual" y "según disponibilidad". Charlitron Digital realiza sus mejores esfuerzos para mantener la información actualizada y el servicio operativo, sin embargo no garantiza la disponibilidad ininterrumpida del 100% del tiempo ni se hace responsable por caídas temporales de servidores externos o proveedores de telecomunicaciones.
              </p>
            </div>

            {/* 5. Modificaciones */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <h3 className="text-base font-bold text-amber-400">
                5. Modificaciones a los Términos
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Nos reservamos el derecho de actualizar o modificar estos términos en cualquier momento sin previo aviso. La fecha de última actualización indicará la vigencia de los mismos.
              </p>
            </div>

            {/* 6. Contacto */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-amber-400">
                  6. Contacto Legal
                </h3>
                <p className="text-sm text-zinc-400">
                  Cualquier duda respecto a estos términos puede enviarse a nuestro canal oficial:
                </p>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-mono text-xs border border-zinc-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>{CONTACT_EMAIL}</span>
              </a>
            </div>
          </article>
        )}

        {/* TAB 3: POLÍTICA DE COOKIES */}
        {activeTab === 'cookies' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border border-zinc-700 bg-zinc-900/60 rounded-2xl p-6 sm:p-7">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Cookie className="w-4 h-4 text-amber-400" />
                <span>Privacidad en la Navegación</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Política de Cookies
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Información sobre almacenamiento local y cookies técnicas.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3">
              <h3 className="text-base font-bold text-white">
                ¿Qué son las cookies y cómo las usamos?
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Este sitio web utiliza cookies técnicas propias y de terceros con el único fin de mejorar la experiencia del usuario, recordar preferencias de navegación (como temas y estado de interacción) y analizar métricas de desempeño de forma anónima.
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                <strong>Al continuar navegando por nuestro sitio web, usted acepta el uso de estas cookies.</strong>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3">
              <h3 className="text-base font-bold text-white">
                ¿Cómo desactivar o gestionar las cookies?
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Usted puede en cualquier momento restringir, bloquear o borrar las cookies de Charlitron Digital o de cualquier otra página web utilizando la configuración de su navegador de internet:
              </p>
              <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 pt-1 pl-2">
                <li>Google Chrome: Configuración &gt; Privacidad y seguridad &gt; Cookies y otros datos de sitios.</li>
                <li>Mozilla Firefox: Ajustes &gt; Privacidad &amp; Seguridad &gt; Cookies y datos del sitio.</li>
                <li>Apple Safari: Preferencias &gt; Privacidad &gt; Bloquear todas las cookies.</li>
                <li>Microsoft Edge: Configuración &gt; Cookies y permisos del sitio.</li>
              </ul>
              <p className="text-xs text-zinc-500 pt-1">
                Nota: La desactivación de cookies técnicas esenciales puede reducir la fluidez o funcionalidad de algunas partes del sitio web.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Dudas sobre nuestra política
                </h3>
                <p className="text-sm text-zinc-400">
                  Contáctanos si necesitas asistencia adicional sobre tu privacidad digital.
                </p>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-mono text-xs border border-zinc-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>{CONTACT_EMAIL}</span>
              </a>
            </div>
          </article>
        )}

        {/* Bottom return bar */}
        <div className="mt-14 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-sm hover:bg-amber-300 transition-all cursor-pointer shadow-[0_0_20px_rgba(250,204,21,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Regresar a la página principal</span>
          </button>

          <div className="text-xs text-zinc-500 text-center sm:text-right">
            <span>© {new Date().getFullYear()} Charlitron Digital • Todos los derechos reservados.</span>
          </div>
        </div>
      </main>
    </div>
  );
};
