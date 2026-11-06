import { useEffect, useState, lazy, Suspense, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  LogOut,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { applyPageMeta } from '../../lib/seo';
import { destinationFor } from './aliadosRole';
import { useAliadosSession, type AliadosSession } from './useAliadosSession';
import { useAliadosRepository, useAllyData } from './useAliadosData';
import type { AliadosRepository, Commission, Referral } from './aliadosRepository';
import { COMMISSION_STATUS_LABELS, REFERRAL_STATUS_LABELS, errorText, formatDate, formatMoney, statusLabel } from './aliadosLabels';
import { AllyActivationPage, AllyLegalPage, AllyRegistrationPage } from './AllyPublicPages';
import { AllyAcceptanceScreen } from './AllyAcceptance';
import { ACCEPTANCE_ROUTE, recordAcceptance, type AcceptanceClient } from './aliadosAcceptance';
import { aliadosSupabase } from './aliadosSupabase';
import { PRIVACY_VERSION, TERMS_VERSION } from './aliadosLegal';
import { AlliesLanding } from './AllyLanding';

type PanelTab = 'resumen' | 'recomendaciones' | 'comisiones';

// Carga diferida: los paneles no viajan en el código del área de landing.
const AliadosAdminPanel = lazy(() => import('./AliadosAdminPanel').then(m => ({ default: m.AliadosAdminPanel })));

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
    const isPrivacyPage = path === '/aliados/privacidad';
    const isRegisterPage = path === '/aliados/registrarse';
    const isAdminPage = path === '/aliados/admin';
    const isAcceptancePage = path === ACCEPTANCE_ROUTE;

    applyPageMeta({
      title: isPublicPage
        ? 'Aliados Charlitron | Recomienda oportunidades de negocio'
        : isTermsPage
          ? `Términos y condiciones del programa Aliados v${TERMS_VERSION} | Charlitron Digital`
          : isPrivacyPage
            ? `Aviso integral de privacidad de Aliados v${PRIVACY_VERSION} | Charlitron Digital`
            : isRegisterPage
              ? 'Quiero ser aliado | Charlitron Digital'
              : isAdminPage
                ? 'Panel administrador | Charlitron Digital'
                : isAcceptancePage
                  ? 'Aceptación de condiciones | Charlitron Digital'
                  : 'Acceso de aliados | Charlitron Digital',
      description: isPublicPage
        ? 'Recomienda negocios a Charlitron y recibe una comisión según el acuerdo cuando el proyecto se concrete y se cobre.'
        : isTermsPage
          ? 'Borrador de los términos del programa Aliados Charlitron, pendiente de validación legal.'
          : isPrivacyPage
            ? 'Borrador del aviso de privacidad del programa Aliados Charlitron, pendiente de validación legal.'
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

export function AliadosApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAliadosSession();
  const path = location.pathname.replace(/\/$/, '') || '/aliados';
  useAliadosMeta(path);

  const handleSignOut = async () => {
    await session.signOut();
    navigate('/aliados');
  };

  if (path === '/aliados') return <AlliesLanding />;
  if (path === '/aliados/terminos') return <AllyLegalPage kind="terms" />;
  if (path === '/aliados/privacidad') return <AllyLegalPage kind="privacy" />;
  if (path === '/aliados/registrarse') return <AllyRegistrationPage />;
  if (path === '/aliados/activar') return <AllyActivationPage />;
  if (path === '/aliados/ingresar') return <PartnerLogin session={session} />;
  if (path === ACCEPTANCE_ROUTE) return <AcceptanceGate session={session} onSignOut={handleSignOut} />;
  if (path === '/aliados/admin') return <AdminGate session={session} onSignOut={handleSignOut} />;
  if (path === '/aliados/panel') return <PanelGate session={session} onSignOut={handleSignOut} />;
  return <Navigate to="/aliados" replace />;
}

function StatusScreen({ title, text, onSignOut, children }: { title: string; text?: string; onSignOut?: () => void; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <section role="status" className="w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <CharlitronLogo size="sm" showTagline={false} />
        <h1 className="mt-7 font-display text-2xl font-semibold text-white">{title}</h1>
        {text && <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>}
        {children}
        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
          <Link to="/aliados" className="text-sm text-zinc-400 transition hover:text-white">Volver a Aliados</Link>
          {onSignOut && (
            <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 text-sm text-amber-200 transition hover:text-amber-100">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminGate({ session, onSignOut }: { session: AliadosSession; onSignOut: () => void }) {
  const { state } = session;
  if (state.status === 'loading') return <StatusScreen title="Verificando acceso…" />;
  if (state.status === 'unconfigured' || state.status === 'anonymous') return <Navigate to="/aliados/ingresar" replace />;
  if (state.status === 'error') return <StatusScreen title="No pudimos verificar tu acceso" text={state.message} onSignOut={onSignOut} />;
  if (destinationFor(state.role) !== 'admin') {
    return <StatusScreen title="Acceso restringido" text="Esta sección es solo para administradores de Charlitron." onSignOut={onSignOut} />;
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b]" />}>
      <AliadosAdminPanel onSignOut={onSignOut} />
    </Suspense>
  );
}

function PanelGate({ session, onSignOut }: { session: AliadosSession; onSignOut: () => void }) {
  const { state } = session;
  if (state.status === 'loading') return <StatusScreen title="Verificando acceso…" />;
  if (state.status === 'unconfigured' || state.status === 'anonymous') return <Navigate to="/aliados/ingresar" replace />;
  if (state.status === 'error') return <StatusScreen title="No pudimos verificar tu acceso" text={state.message} onSignOut={onSignOut} />;

  const destination = destinationFor(state.role);
  if (destination === 'panel' && state.role.kind === 'ally') {
    return <PartnerDashboard displayName={state.role.displayName} onLogout={onSignOut} />;
  }
  // Cuenta activa sin aceptacion vigente: nunca ve el panel; se la lleva a la pantalla de aceptacion.
  if (destination === 'acceptance') return <Navigate to={ACCEPTANCE_ROUTE} replace />;
  if (destination === 'pending') {
    return <StatusScreen title="Tu cuenta está pendiente de aprobación" text="Charlitron revisará tu solicitud. Cuando esté aprobada podrás entrar a tu panel." onSignOut={onSignOut} />;
  }
  if (destination === 'paused') {
    return <StatusScreen title="Tu cuenta está en pausa" text="Por ahora no puedes acceder al panel. Escríbenos si tienes dudas." onSignOut={onSignOut} />;
  }
  if (destination === 'admin') {
    return (
      <StatusScreen title="Cuenta de administrador" text="Esta cuenta no es de aliado." onSignOut={onSignOut}>
        <Link to="/aliados/admin" className="mt-4 inline-block text-sm text-amber-200 underline underline-offset-2">Ir al panel administrador</Link>
      </StatusScreen>
    );
  }
  return <StatusScreen title="Tu cuenta no tiene acceso al programa" text="Si crees que es un error, contacta a Charlitron." onSignOut={onSignOut} />;
}

function AcceptanceGate({ session, onSignOut }: { session: AliadosSession; onSignOut: () => void }) {
  const { state } = session;
  if (state.status === 'ready' && destinationFor(state.role) === 'acceptance') {
    const handleAccept = async (input: { terms: boolean; privacy: boolean }) => {
      if (!aliadosSupabase) return 'El acceso no está configurado en esta vista previa.';
      const result = await recordAcceptance(aliadosSupabase as unknown as AcceptanceClient, input);
      if (!result.ok) return result.message;
      // El panel se abre solo si la base confirma la aceptacion al volver a verificar el acceso.
      await session.refresh();
      return '';
    };
    return <AllyAcceptanceScreen onAccept={handleAccept} onSignOut={onSignOut} />;
  }
  if (state.status === 'ready' && destinationFor(state.role) === 'panel') return <Navigate to="/aliados/panel" replace />;
  // Resto de casos (cargando, sin sesion, error, pendiente, pausado, admin o sin rol): mismas pantallas que el panel.
  return <PanelGate session={session} onSignOut={onSignOut} />;
}

function PartnerLogin({ session }: { session: AliadosSession }) {
  const { state, signIn, signOut } = session;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'error') {
      setBusy(false);
      setMessage(state.message);
    }
  }, [state]);

  if (state.status === 'ready') {
    const destination = destinationFor(state.role);
    if (destination === 'admin') return <Navigate to="/aliados/admin" replace />;
    if (destination !== 'denied') return <Navigate to="/aliados/panel" replace />;
    return <StatusScreen title="Tu cuenta no tiene acceso al programa" text="Si crees que es un error, contacta a Charlitron." onSignOut={() => void signOut()} />;
  }

  const unconfigured = state.status === 'unconfigured';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || unconfigured) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    const error = await signIn(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
    if (error) {
      setBusy(false);
      setMessage(error);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40" />
      <section className="relative w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <Link to="/aliados" aria-label="Volver a Aliados Charlitron" className="mb-8 flex w-fit items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="mb-7">
          <CharlitronLogo size="sm" showTagline={false} />
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Portal de aliados</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Qué gusto verte.</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Ingresa para consultar tus recomendaciones y acuerdos.</p>
        </div>
        {unconfigured && (
          <p role="alert" className="mb-4 rounded-md border border-amber-200/20 bg-amber-200/[0.06] p-3 text-xs leading-5 text-amber-100">
            El acceso no está configurado en esta vista previa.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Correo
            <input required name="email" type="email" autoComplete="email" disabled={unconfigured || busy} className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50" placeholder="tu@correo.com" />
          </label>
          <label className="block text-sm text-zinc-300">
            Contraseña
            <input required name="password" type="password" autoComplete="current-password" disabled={unconfigured || busy} className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50" placeholder="••••••••" />
          </label>
          <button type="submit" disabled={unconfigured || busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Verificando…' : 'Entrar'} <ArrowRight className="h-4 w-4" />
          </button>
          {message && <p role="alert" className="text-xs leading-5 text-red-300">{message}</p>}
        </form>
        <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-600">
          El acceso es solo para cuentas autorizadas por Charlitron. ¿Aún no eres aliado?{' '}
          <Link to="/aliados/registrarse" className="text-amber-200 underline underline-offset-2">Solicita tu registro</Link>.
        </p>
      </section>
    </main>
  );
}

function PartnerDashboard({ displayName, onLogout }: { displayName: string; onLogout: () => void }) {
  const firstName = displayName.trim().split(' ')[0] ?? '';
  const repo = useAliadosRepository();
  const data = useAllyData(repo);
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
            <span className="hidden text-sm text-zinc-400 sm:inline">{displayName}</span>
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Salir" className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white">
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
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">Tu espacio</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-white">{activeTab === 'resumen' ? `Hola${firstName ? `, ${firstName}` : ''}.` : activeTab === 'recomendaciones' ? 'Tus recomendaciones.' : 'Tus comisiones.'}</h1>
            <p className="mt-2 text-sm text-zinc-500">{activeTab === 'resumen' ? 'Aquí puedes dar seguimiento a tus oportunidades.' : activeTab === 'recomendaciones' ? 'El avance de los negocios que acercaste a Charlitron.' : 'Acuerdos registrados y su estado de liberación.'}</p>
          </div>

          {data.error && (
            <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span>{data.error}</span>
              <button type="button" onClick={() => void data.reload()} className="shrink-0 font-semibold text-red-100 underline underline-offset-2">Reintentar</button>
            </div>
          )}

          {data.loading ? (
            <p role="status" className="text-sm text-zinc-500">Cargando tus datos…</p>
          ) : (
            <>
              {activeTab === 'resumen' && <DashboardOverview referrals={data.referrals} commissions={data.commissions} onViewReferrals={() => setActiveTab('recomendaciones')} />}
              {activeTab === 'recomendaciones' && (
                <>
                  <div className="mb-5 flex justify-end">
                    <button type="button" onClick={() => setReferralOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
                      + Registrar nuevo referido
                    </button>
                  </div>
                  <ReferralsTable referrals={data.referrals} commissions={data.commissions} showCommission={false} />
                </>
              )}
              {activeTab === 'comisiones' && <CommissionList commissions={data.commissions} />}
            </>
          )}
        </main>
      </div>
      {referralOpen && <NewReferralDialog repo={repo} onClose={() => setReferralOpen(false)} onCreated={() => void data.reload()} />}
    </div>
  );
}

function DashboardOverview({ referrals, commissions, onViewReferrals }: { referrals: Referral[]; commissions: Commission[]; onViewReferrals: () => void }) {
  const following = referrals.filter((referral) => ['new', 'contacted', 'interested'].includes(referral.status)).length;
  const paid = commissions.reduce((sum, commission) => sum + commission.paid_total, 0);
  return (
    <>
      <section aria-label="Resumen de actividad" className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Recomendaciones" value={String(referrals.length)} hint="Oportunidades registradas" icon={UsersRound} />
        <SummaryMetric label="En seguimiento" value={String(following)} hint="Charlitron está en contacto" icon={Clock3} />
        <SummaryMetric label="Comisiones pagadas" value={formatMoney(paid)} hint="Liberado por Charlitron" icon={WalletCards} />
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
        <ReferralsTable referrals={referrals.slice(0, 5)} commissions={commissions} showCommission />
      </section>

      <div className="mt-5 flex gap-3 border-l-2 border-emerald-300/50 bg-emerald-300/[0.04] px-4 py-3 text-xs leading-5 text-zinc-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        La comisión solo puede liberarse después de que Charlitron confirme el cobro del proyecto al cliente.
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

const fieldClass = 'mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60';

function NewReferralDialog({ repo, onClose, onCreated }: { repo: AliadosRepository | null; onClose: () => void; onCreated: () => void }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!repo || busy) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    setBusy(true);
    setError('');
    try {
      await repo.submitReferral({
        name: text('contact'),
        organization: text('business') || undefined,
        phone: text('phone') || undefined,
        email: text('email') || undefined,
        city: text('city') || undefined,
        authorized: form.get('authorized') === 'on',
      });
      setDone(true);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
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
              {done ? 'Referido registrado.' : 'Registrar nuevo referido'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="flex gap-3 text-sm leading-6 text-zinc-300">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
              <p>Charlitron recibió tu referido y le dará seguimiento. Podrás ver su estado en Recomendaciones.</p>
            </div>
            <button type="button" onClick={onClose} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200">
              Listo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-white/10 pt-6">
            <label className="block text-sm text-zinc-300">
              Nombre del contacto
              <input name="contact" required minLength={2} maxLength={120} autoComplete="off" className={fieldClass} />
            </label>
            <label className="block text-sm text-zinc-300">
              Nombre del negocio <span className="text-zinc-600">(opcional)</span>
              <input name="business" maxLength={120} className={fieldClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                WhatsApp o teléfono
                <input name="phone" required type="tel" inputMode="tel" maxLength={30} pattern="[0-9+()\s\-]{10,}" title="Escribe al menos 10 dígitos" autoComplete="off" className={fieldClass} placeholder="444 000 0000" />
              </label>
              <label className="block text-sm text-zinc-300">
                Correo <span className="text-zinc-600">(opcional)</span>
                <input name="email" type="email" maxLength={254} autoComplete="off" className={fieldClass} placeholder="contacto@ejemplo.com" />
              </label>
            </div>
            <label className="block text-sm text-zinc-300">
              Ciudad
              <input name="city" required maxLength={80} className={fieldClass} placeholder="Ej. San Luis Potosí" />
            </label>
            <label className="flex items-start gap-3 pt-1 text-xs leading-5 text-zinc-400">
              <input name="authorized" required type="checkbox" className="mt-1 accent-amber-300" />
              Confirmo que cuento con autorización de esta persona para compartir sus datos de contacto con Charlitron.
            </label>
            {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <button type="submit" disabled={busy || !repo} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
              {busy ? 'Enviando…' : 'Registrar referido'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function ReferralsTable({ referrals, commissions, showCommission }: { referrals: Referral[]; commissions: Commission[]; showCommission: boolean }) {
  if (referrals.length === 0) {
    return <p className="border-y border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Todavía no has registrado referidos.</p>;
  }
  return (
    <div className="overflow-hidden border-y border-white/10">
      <div className="hidden grid-cols-[1.3fr_1.2fr_0.9fr_1fr] gap-4 bg-white/[0.025] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 md:grid">
        <span>Contacto / negocio</span><span>Estado</span><span>Recomendado</span><span>{showCommission ? 'Comisión' : 'Contacto'}</span>
      </div>
      {referrals.map((referral) => {
        const commission = commissions.find((item) => item.referral_id === referral.id);
        return (
          <div key={referral.id} className="grid gap-3 border-t border-white/[0.07] px-4 py-4 first:border-t-0 md:grid-cols-[1.3fr_1.2fr_0.9fr_1fr] md:items-center md:gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">{referral.referred_name}</p>
              {referral.referred_organization && <p className="mt-1 text-xs text-zinc-600">{referral.referred_organization}</p>}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${referral.status === 'closed' ? 'bg-zinc-500' : 'bg-amber-200'}`} />{statusLabel(REFERRAL_STATUS_LABELS, referral.status)}</div>
            <p className="text-xs text-zinc-600">{formatDate(referral.created_at)}</p>
            <div>
              {showCommission ? (
                <>
                  <p className="text-xs font-medium text-zinc-300">{commission ? formatMoney(commission.commission_amount) : 'Sin comisión asignada'}</p>
                  {commission && <p className="mt-1 text-[11px] text-zinc-600">{statusLabel(COMMISSION_STATUS_LABELS, commission.status)}</p>}
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-300">{referral.referred_phone ?? referral.referred_email}</p>
                  {referral.referred_phone && referral.referred_email && <p className="mt-1 text-[11px] text-zinc-600">{referral.referred_email}</p>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommissionList({ commissions }: { commissions: Commission[] }) {
  return (
    <section>
      {commissions.length === 0 ? (
        <p className="border-y border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Aún no tienes comisiones asignadas.</p>
      ) : (
        <div className="overflow-hidden border-y border-white/10">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] gap-4 bg-white/[0.025] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 md:grid">
            <span>Referido</span><span>Acordada</span><span>Pagada</span><span>Pendiente</span><span>Estado</span>
          </div>
          {commissions.map((commission) => (
            <div key={commission.id} className="grid gap-2 border-t border-white/[0.07] px-4 py-4 first:border-t-0 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] md:items-center md:gap-4">
              <p className="text-sm font-medium text-zinc-200">{commission.referred_name}</p>
              <p className="text-xs text-zinc-300">{formatMoney(commission.commission_amount)}</p>
              <p className="text-xs text-emerald-300">{formatMoney(commission.paid_total)}</p>
              <p className="text-xs text-zinc-300">{formatMoney(commission.balance)}</p>
              <p className="text-xs text-zinc-400">{statusLabel(COMMISSION_STATUS_LABELS, commission.status)}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-zinc-600">Charlitron asigna y paga cada comisión de forma manual según lo acordado, y solo puede liberarla después de recibir el pago del cliente.</p>
    </section>
  );
}
