import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Handshake,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';

const publicSteps = [
  { number: '01', title: 'Recomienda una oportunidad.', icon: ArrowDownRight },
  { number: '02', title: 'Charlitron contacta, cotiza y ejecuta.', icon: BriefcaseBusiness },
  {
    number: '03',
    title: 'Recibe tu comisión según el acuerdo cuando Charlitron haya cobrado.',
    icon: CircleDollarSign,
  },
];

export function AlliesLanding() {
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
            <Link
              to="/aliados/registrarse"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-md bg-amber-300 px-6 text-base font-bold text-zinc-950 shadow-[0_12px_42px_rgba(251,191,36,0.16)] transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            >
              Quiero ser aliado
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
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

    </main>
  );
}
