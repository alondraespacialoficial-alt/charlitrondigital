import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Handshake,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { applyPageMeta } from '../../lib/seo';

type PanelTab = 'resumen' | 'recomendaciones' | 'comisiones';

const ROUTE_META_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:type"]',
  'meta[property="og:site_name"]',
  'meta[property="og:image"]',
  'meta[property="og:image:alt"]',
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'link[rel="canonical"]',
];

function useAliadosMeta(path: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const previousElements = ROUTE_META_SELECTORS.flatMap((selector) =>
      Array.from(document.head.querySelectorAll<HTMLElement>(selector), (element) => ({
        element,
        content: element.getAttribute('content'),
        href: element.getAttribute('href'),
      })),
    );
    const originalElements = new Set(previousElements.map(({ element }) => element));
    const previousJsonLd = document.getElementById('charlitron-jsonld-page')?.cloneNode(true);
    const isPublicPage = path === '/aliados';
    const isTermsPage = path === '/aliados/terminos';

    applyPageMeta({
      title: isPublicPage
        ? 'Aliados Charlitron | Recomienda oportunidades de negocio'
        : isTermsPage
          ? 'Términos del Programa Aliados (borrador) | Charlitron Digital'
          : 'Acceso de aliados | Charlitron Digital',
      description: isPublicPage
        ? 'Recomienda negocios a Charlitron y recibe una comisión según el acuerdo cuando el proyecto se concrete y se cobre.'
        : isTermsPage
          ? 'Borrador de los términos del programa Aliados Charlitron, pendiente de validación legal.'
          : 'Acceso al espacio de aliados Charlitron.',
      canonicalPath: path,
    });
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = isPublicPage ? 'index, follow' : 'noindex, nofollow';

    return () => {
      for (const selector of ROUTE_META_SELECTORS) {
        document.head.querySelectorAll<HTMLElement>(selector).forEach((element) => {
          if (!originalElements.has(element)) element.remove();
        });
      }
      for (const { element, content, href } of previousElements) {
        if (content === null) element.removeAttribute('content');
        else element.setAttribute('content', content);
        if (href === null) element.removeAttribute('href');
        else element.setAttribute('href', href);
      }
      document.title = previousTitle;
      document.getElementById('charlitron-jsonld-page')?.remove();
      if (previousJsonLd) document.head.append(previousJsonLd);
    };
  }, [path]);
}

const referrals = [
  {
    business: 'Clínica Boreal',
    project: 'Publicidad digital',
    date: '24 oct 2026',
    status: 'Proyecto cobrado',
    commission: '$3,200 MXN',
    payout: 'Liberación pendiente',
  },
  {
    business: 'Panadería Olivo',
    project: 'Sitio web',
    date: '18 oct 2026',
    status: 'En cotización',
    commission: 'Según acuerdo',
    payout: 'Pendiente de cobro',
  },
  {
    business: 'Barra Lumbre',
    project: 'Automatización',
    date: '09 oct 2026',
    status: 'Primer contacto',
    commission: 'Según acuerdo',
    payout: 'En seguimiento',
  },
];

const publicSteps = [
  { number: '01', title: 'Recomienda una oportunidad.', icon: ArrowDownRight },
  { number: '02', title: 'Charlitron contacta, cotiza y ejecuta.', icon: BriefcaseBusiness },
  {
    number: '03',
    title: 'Recibe tu comisión según el acuerdo cuando Charlitron haya cobrado.',
    icon: CircleDollarSign,
  },
];

export function AliadosApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const path = location.pathname.replace(/\/$/, '') || '/aliados';
  useAliadosMeta(path);

  if (path === '/aliados') return <AlliesLanding />;
  if (path === '/aliados/terminos') return <AllyTermsPage />;
  if (path === '/aliados/ingresar') return <PartnerLogin onLogin={() => {
    setDemoSignedIn(true);
    navigate('/aliados/panel');
  }} />;
  if (path === '/aliados/panel') {
    return demoSignedIn ? (
      <PartnerDashboard onLogout={() => {
        setDemoSignedIn(false);
        navigate('/aliados');
      }} />
    ) : (
      <PartnerLogin onLogin={() => {
        setDemoSignedIn(true);
        navigate('/aliados/panel');
      }} />
    );
  }
  return <Navigate to="/aliados" replace />;
}

function AlliesLanding() {
  const [registrationOpen, setRegistrationOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090b] text-zinc-100 selection:bg-amber-300 selection:text-zinc-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-50" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-20 h-[30rem] w-[30rem] rounded-full bg-amber-300/[0.07] blur-[110px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" aria-label="Charlitron Digital, ir al inicio" className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
          <CharlitronLogo size="sm" showTagline={false} />
        </Link>
        <Link
          to="/aliados/ingresar"
          className="text-sm font-medium text-zinc-400 transition hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Ya soy aliado <span aria-hidden="true">·</span> Ingresar
        </Link>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:pb-24 lg:pt-24">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Aliados Charlitron
          </p>
          <h1 className="font-display max-w-xl text-4xl font-semibold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Tus contactos pueden convertirse en nuevas oportunidades.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
            ¿Conoces un negocio que necesita publicidad, personal, tecnología o mejorar sus ventas? Recomiéndalo a Charlitron y recibe una comisión cuando se concrete y cobre el proyecto.
          </p>
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setRegistrationOpen(true)}
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-md bg-amber-300 px-6 text-base font-bold text-zinc-950 shadow-[0_12px_42px_rgba(251,191,36,0.16)] transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            >
              Quiero ser aliado
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              Registro gratuito
            </div>
          </div>
          <p className="mt-4 max-w-lg text-xs leading-5 text-zinc-500">
            Las comisiones dependen de las condiciones acordadas para cada proyecto. No hay porcentajes fijos ni ingresos garantizados.
          </p>
        </div>

        <div aria-hidden="true" className="relative mx-auto w-full max-w-[31rem] lg:ml-auto">
          <div className="absolute -inset-5 rounded-full border border-amber-200/10" />
          <div className="absolute -inset-10 rounded-full border border-dashed border-emerald-200/10" />
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#111114]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-medium text-zinc-500">Una buena conexión</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">puede moverlo todo.</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full border border-amber-200/20 bg-amber-200/10 text-amber-200">
                <Handshake className="h-5 w-5" />
              </div>
            </div>
            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-8">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-emerald-300/10 text-emerald-200">
                  <UserRound className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">Tu contacto</p>
                <p className="mt-1 text-xs text-zinc-500">Un negocio con una necesidad</p>
              </div>
              <ArrowRight className="h-5 w-5 text-amber-200" />
              <div className="rounded-md border border-amber-200/20 bg-amber-200/[0.06] p-4">
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-amber-200/10 text-amber-200">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-white">Charlitron</p>
                <p className="mt-1 text-xs text-zinc-500">Una solución acordada</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 pt-5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-200">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <p className="text-xs leading-5 text-zinc-400">
                Una oportunidad concreta. Un acuerdo claro. Una comisión después del cobro.
              </p>
            </div>
          </div>
          <div className="absolute -bottom-5 right-4 hidden items-center gap-2 rounded-full border border-emerald-200/20 bg-[#101713] px-4 py-2 text-xs font-medium text-emerald-100 shadow-xl sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Colaboración de confianza
          </div>
        </div>
      </section>

      <section aria-label="Cómo funciona" className="relative border-t border-white/10 bg-[#0d0d0f]/80">
        <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-8 md:grid-cols-3">
          {publicSteps.map(({ number, title, icon: Icon }, index) => (
            <div key={number} className="relative flex gap-4 border-b border-white/10 py-6 last:border-b-0 md:border-b-0 md:py-9 md:pr-8">
              {index < publicSteps.length - 1 && <div className="absolute bottom-0 left-0 right-8 hidden h-px bg-gradient-to-r from-amber-200/30 to-transparent md:block" />}
              <span className="pt-1 font-mono text-xs text-amber-200/60">{number}</span>
              <div>
                <Icon className="mb-3 h-5 w-5 text-amber-200" aria-hidden="true" />
                <p className="max-w-xs text-sm font-medium leading-6 text-zinc-200">{title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Charlitron Digital · Aliados</span>
        <span>Las comisiones se acuerdan por proyecto y se liberan después del cobro al cliente.</span>
      </footer>

      {registrationOpen && <RegistrationDialog onClose={() => setRegistrationOpen(false)} />}
    </main>
  );
}

function RegistrationDialog({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="registration-title" className="my-auto w-full max-w-lg rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">Aliados Charlitron</p>
            <h2 id="registration-title" className="mt-2 font-display text-2xl font-semibold text-white">
              {submitted ? 'Gracias por tu interés.' : 'Conectemos.'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="flex gap-3 text-sm leading-6 text-zinc-300">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
              <p>En el producto final, Charlitron revisará tu solicitud y se pondrá en contacto contigo.</p>
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-500">Prototipo visual: la información ingresada no se envía ni se guarda.</p>
            <button type="button" onClick={onClose} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200">
              Entendido <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-white/10 pt-6">
            <label className="block text-sm text-zinc-300">
              Nombre
              <input required autoComplete="name" className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60" placeholder="Tu nombre" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Correo
                <input required type="email" autoComplete="email" className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60" placeholder="tu@correo.com" />
              </label>
              <label className="block text-sm text-zinc-300">
                WhatsApp
                <input required type="tel" autoComplete="tel" className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60" placeholder="444 000 0000" />
              </label>
            </div>
            <label className="flex items-start gap-3 pt-1 text-xs leading-5 text-zinc-400">
              <input required type="checkbox" className="mt-1 accent-amber-300" />
              <span>
                He leído el{' '}
                <a href="/#legal-privacidad" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">Aviso de Privacidad</a>{' '}
                y los{' '}
                <a href="/aliados/terminos" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">Términos del Programa Aliados (borrador)</a>
                , y acepto que Charlitron me contacte para revisar mi solicitud.
              </span>
            </label>
            <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
              Solicitar registro <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-[11px] leading-5 text-zinc-600">Demostración: ningún dato se transmite ni se almacena.</p>
          </form>
        )}
      </section>
    </div>
  );
}

const programTerms = [
  { title: 'Qué es el programa', text: 'Aliados Charlitron es un programa de recomendación. No genera relación laboral, de representación ni sociedad, y no implica exclusividad.' },
  { title: 'Recomendación válida', text: 'Debe tratarse de un negocio con interés real y que haya aceptado ser contactado. Charlitron decide si atiende cada recomendación.' },
  { title: 'Comisión', text: 'Se acuerda por escrito para cada proyecto. No hay porcentajes fijos ni ingresos garantizados, y solo se libera después de que Charlitron cobra al cliente.' },
  { title: 'Conducta del aliado', text: 'No enviar spam, no hacer declaraciones engañosas sobre servicios o precios y no usar el nombre de Charlitron fuera de lo acordado.' },
  { title: 'Datos de los referidos', text: 'El aliado protege la información de los negocios y personas que recomienda, y la comparte únicamente para fines del programa.' },
  { title: 'Cambios y baja', text: 'Charlitron puede modificar el programa o dar de baja cuentas. Las comisiones ya devengadas se respetan conforme al acuerdo del proyecto.' },
];

function AllyTermsPage() {
  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/aliados" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver a Aliados
        </Link>
        <div role="note" className="mb-8 rounded-md border border-amber-200/30 bg-amber-200/[0.06] p-4 text-sm leading-6 text-amber-100">
          <strong>Borrador pendiente de validación legal.</strong> Este texto es una propuesta y no constituye un documento definitivo. Aún faltan por definir la identificación del responsable, su domicilio, las finalidades y el tratamiento de datos de prospectos referidos.
        </div>
        <h1 className="font-display text-3xl font-semibold text-white">Términos del Programa Aliados Charlitron</h1>
        <ol className="mt-8 space-y-6">
          {programTerms.map(({ title, text }, index) => (
            <li key={title} className="border-t border-white/10 pt-5">
              <h2 className="font-display text-lg font-semibold text-white">{index + 1}. {title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-500">
          Prototipo visual: no existe registro real. Para el Aviso de Privacidad vigente consulta <a href="/#legal-privacidad" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2">el aviso general</a>.
        </p>
      </div>
    </main>
  );
}

function PartnerLogin({ onLogin }: { onLogin: () => void }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Acceso de demostración activado. No se validan ni almacenan credenciales.');
    onLogin();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40" />
      <section className="relative w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <Link to="/aliados" aria-label="Volver a Aliados Charlitron" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="mb-7">
          <CharlitronLogo size="sm" showTagline={false} />
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Portal de aliados</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Qué gusto verte.</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Ingresa para consultar tus recomendaciones y acuerdos.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Correo
            <input required type="email" autoComplete="email" className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60" placeholder="tu@correo.com" />
          </label>
          <label className="block text-sm text-zinc-300">
            Contraseña
            <input required type="password" autoComplete="current-password" className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60" placeholder="••••••••" />
          </label>
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200">
            Entrar al prototipo <ArrowRight className="h-4 w-4" />
          </button>
          {message && <p role="status" className="text-xs leading-5 text-emerald-200">{message}</p>}
        </form>
        <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-600">Prototipo visual con datos ficticios. El acceso real se integrará en una fase posterior.</p>
      </section>
    </main>
  );
}

function PartnerDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<PanelTab>('resumen');
  const [referralOpen, setReferralOpen] = useState(false);
  const tabs: { id: PanelTab; label: string; icon: typeof UsersRound }[] = [
    { id: 'resumen', label: 'Resumen', icon: Sparkles },
    { id: 'recomendaciones', label: 'Recomendaciones', icon: UsersRound },
    { id: 'comisiones', label: 'Comisiones', icon: WalletCards },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-white/10 bg-[#0d0d0f]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/aliados" aria-label="Aliados Charlitron" className="rounded-sm"><CharlitronLogo size="sm" showTagline={false} /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-400 sm:inline">Mariana Torres</span>
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión de demostración" title="Salir" className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl lg:grid-cols-[15rem_1fr]">
        <aside className="border-b border-white/10 px-4 py-4 lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-8">
          <p className="hidden px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 lg:block">Espacio de aliado</p>
          <nav aria-label="Navegación del panel" className="flex gap-2 overflow-x-auto lg:mt-4 lg:flex-col">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm transition ${activeTab === id ? 'bg-amber-200/10 text-amber-100' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="mt-10 hidden border-t border-white/10 pt-5 lg:block">
            <div className="flex gap-2 text-xs leading-5 text-zinc-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Tus recomendaciones solo son visibles para ti y Charlitron.</div>
          </div>
        </aside>

        <main className="px-5 py-8 sm:px-8 lg:py-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">Tu espacio</p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-white">{activeTab === 'resumen' ? 'Hola, Mariana.' : activeTab === 'recomendaciones' ? 'Tus recomendaciones.' : 'Tus comisiones.'}</h1>
              <p className="mt-2 text-sm text-zinc-500">{activeTab === 'resumen' ? 'Aquí puedes dar seguimiento a tus oportunidades.' : activeTab === 'recomendaciones' ? 'El avance de los negocios que acercaste a Charlitron.' : 'Acuerdos registrados y su estado de liberación.'}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.05] px-3 py-1.5 text-[11px] font-medium text-amber-100/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-200" /> Vista de demostración · datos ficticios
            </span>
          </div>

          {activeTab === 'resumen' && <DashboardOverview onViewReferrals={() => setActiveTab('recomendaciones')} />}
          {activeTab === 'recomendaciones' && (
            <>
              <div className="mb-5 flex justify-end">
                <button type="button" onClick={() => setReferralOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
                  + Registrar nuevo referido
                </button>
              </div>
              <ReferralsTable showCommission={false} />
            </>
          )}
          {activeTab === 'comisiones' && <CommissionList />}
        </main>
      </div>
      {referralOpen && <NewReferralDialog onClose={() => setReferralOpen(false)} />}
    </div>
  );
}

function DashboardOverview({ onViewReferrals }: { onViewReferrals: () => void }) {
  return (
    <>
      <section aria-label="Resumen de actividad" className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Recomendaciones" value="03" hint="Oportunidades registradas" icon={UsersRound} />
        <SummaryMetric label="En seguimiento" value="02" hint="Charlitron está en contacto" icon={Clock3} />
        <SummaryMetric label="Acuerdo registrado" value="$3,200 MXN" hint="Ejemplo · sujeto al acuerdo" icon={WalletCards} />
      </section>

      <section className="mt-9">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Actividad reciente</h2>
            <p className="mt-1 text-xs text-zinc-500">Actualizaciones sobre tus recomendaciones.</p>
          </div>
          <button type="button" onClick={onViewReferrals} className="inline-flex items-center gap-1 text-xs font-medium text-amber-200 transition hover:text-amber-100">
            Ver todas <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <ReferralsTable showCommission />
      </section>

      <div className="mt-5 flex gap-3 border-l-2 border-emerald-300/50 bg-emerald-300/[0.04] px-4 py-3 text-xs leading-5 text-zinc-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        La comisión solo puede liberarse después de que Charlitron confirme el cobro del proyecto al cliente. Los datos de este panel son ficticios.
      </div>
    </>
  );
}

function SummaryMetric({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof UsersRound }) {
  return (
    <div className="border-l border-white/10 pl-4 py-2 first:border-l-0 first:pl-0 sm:pl-5">
      <div className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="h-4 w-4 text-amber-200" />{label}</div>
      <p className="mt-3 font-display text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{hint}</p>
    </div>
  );
}

const referralServices = [
  'Páginas web',
  'Apps y sistemas',
  'Automatización e IA',
  'Perifoneo',
  'Volanteo',
  'Activaciones BTL',
  'Promotores y demostradoras',
  'Eventos',
  'Producción audiovisual',
  'No estoy seguro',
];

const referralRelations = ['Cliente conocido', 'Amigo o familiar', 'Contacto profesional', 'Negocio que visité', 'Otro'];

const fieldClass = 'mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60';

// Fondo y texto explícitos (también en <option>) para legibilidad en Chrome, Edge y móviles.
const selectClass = 'mt-2 min-h-11 w-full rounded-md border border-white/10 bg-[#0b0b0d] px-3 text-zinc-100 outline-none transition [color-scheme:dark] focus:border-amber-200/60';
const optionClass = 'bg-[#0b0b0d] text-zinc-100';

function NewReferralDialog({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-referral-title" className="my-auto w-full max-w-lg rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">Nuevo referido</p>
            <h2 id="new-referral-title" className="mt-2 font-display text-2xl font-semibold text-white">
              {submitted ? 'Simulación completada.' : 'Registrar nuevo referido'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="inline-flex rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-100">Simulación · demostración</p>
            <div className="mt-4 flex gap-3 text-sm leading-6 text-zinc-300">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
              <p>En el producto final, Charlitron recibiría este referido y le daría seguimiento.</p>
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-500">Prototipo visual: la información ingresada no se envía, no se guarda y no aparece en la lista.</p>
            <button type="button" onClick={onClose} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200">
              Entendido <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-white/10 pt-6">
            <label className="block text-sm text-zinc-300">
              Nombre del negocio
              <input required className={fieldClass} placeholder="Ej. Negocio de ejemplo" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Nombre del contacto
                <input required autoComplete="off" className={fieldClass} placeholder="Nombre ficticio" />
              </label>
              <label className="block text-sm text-zinc-300">
                WhatsApp o teléfono
                <input required type="tel" inputMode="tel" pattern="[0-9+()\s\-]{10,}" title="Escribe al menos 10 dígitos" autoComplete="off" className={fieldClass} placeholder="444 000 0000" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Correo <span className="text-zinc-600">(opcional)</span>
                <input type="email" autoComplete="off" className={fieldClass} placeholder="contacto@ejemplo.com" />
              </label>
              <label className="block text-sm text-zinc-300">
                Ciudad
                <input required className={fieldClass} placeholder="Ej. San Luis Potosí" />
              </label>
            </div>
            <label className="block text-sm text-zinc-300">
              Servicio que necesita
              <select required defaultValue="" className={selectClass}>
                <option value="" disabled className={optionClass}>Selecciona un servicio</option>
                {referralServices.map((service) => <option key={service} value={service} className={optionClass}>{service}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              ¿Cómo conoces al prospecto? <span className="text-zinc-600">(opcional)</span>
              <select defaultValue="" className={selectClass}>
                <option value="" className={optionClass}>Selecciona una opción</option>
                {referralRelations.map((relation) => <option key={relation} value={relation} className={optionClass}>{relation}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Comentario <span className="text-zinc-600">(opcional)</span>
              <textarea rows={3} className={`${fieldClass} py-2`} placeholder="Contexto que ayude a Charlitron" />
            </label>
            <label className="flex items-start gap-3 pt-1 text-xs leading-5 text-zinc-400">
              <input required type="checkbox" className="mt-1 accent-amber-300" />
              Confirmo que cuento con autorización de esta persona para compartir sus datos de contacto con Charlitron.
            </label>
            <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
              Registrar referido <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-[11px] leading-5 text-zinc-600">Demostración: usa datos ficticios. Ningún dato se transmite ni se almacena.</p>
          </form>
        )}
      </section>
    </div>
  );
}

function ReferralsTable({ showCommission }: { showCommission: boolean }) {
  return (
    <div className="overflow-hidden border-y border-white/10">
      <div className="hidden grid-cols-[1.3fr_1.2fr_0.9fr_1fr] gap-4 bg-white/[0.025] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 md:grid">
        <span>Negocio / proyecto</span><span>Estado</span><span>Recomendado</span><span>{showCommission ? 'Comisión' : 'Acuerdo'}</span>
      </div>
      {referrals.map((referral) => (
        <div key={referral.business} className="grid gap-3 border-t border-white/[0.07] px-4 py-4 first:border-t-0 md:grid-cols-[1.3fr_1.2fr_0.9fr_1fr] md:items-center md:gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">{referral.business}</p>
            <p className="mt-1 text-xs text-zinc-600">{referral.project}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${referral.status === 'Proyecto cobrado' ? 'bg-emerald-300' : 'bg-amber-200'}`} />{referral.status}</div>
          <p className="text-xs text-zinc-600">{referral.date}</p>
          <div>
            <p className="text-xs font-medium text-zinc-300">{showCommission ? referral.commission : referral.payout}</p>
            <p className="mt-1 text-[11px] text-zinc-600">{showCommission ? referral.payout : 'Comisión acordada manualmente'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommissionList() {
  return (
    <section>
      <div className="mb-6 grid gap-5 border-b border-white/10 pb-6 sm:grid-cols-[1fr_1.4fr] sm:items-end">
        <div>
          <p className="text-xs text-zinc-500">Acuerdo de ejemplo · Clínica Boreal</p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">$3,200 <span className="text-base font-medium text-zinc-500">MXN</span></p>
        </div>
        <div className="flex items-start gap-3 text-sm leading-6 text-zinc-400">
          <Clock3 className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
          <p>El cliente ya pagó el proyecto. La liberación de la comisión está pendiente de gestión manual por Charlitron.</p>
        </div>
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold text-white">Historial de acuerdos</h2>
      <ReferralsTable showCommission />
      <p className="mt-4 text-xs leading-5 text-zinc-600">Los montos y negocios son ficticios. Charlitron asigna cada comisión de forma manual según las condiciones acordadas y solo puede liberarla después de recibir el pago del cliente.</p>
    </section>
  );
}