import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogOut } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { ACCEPT_BUTTON_LABEL, PRIVACY_CHECKBOX_LABEL, TERMS_CHECKBOX_LABEL, canSubmitAcceptance } from './aliadosAcceptance';
import { PRIVACY_VERSION, TERMS_VERSION } from './aliadosLegal';

const linkClass = 'text-amber-200 underline underline-offset-2 hover:text-amber-100';

interface AllyAcceptanceFormProps {
  // Devuelve '' si la aceptacion se registro y verifico; si no, el mensaje de error. No abre el acceso por si misma.
  onAccept: (input: { terms: boolean; privacy: boolean }) => Promise<string>;
  onSignOut?: () => void;
}

export function AllyAcceptanceForm({ onAccept, onSignOut }: AllyAcceptanceFormProps) {
  // Ambas casillas nacen desmarcadas y se controlan de forma independiente.
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = canSubmitAcceptance({ terms, privacy });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    const problem = await onAccept({ terms, privacy });
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
          <input
            name="accept_terms"
            type="checkbox"
            checked={terms}
            disabled={busy}
            onChange={(event) => setTerms(event.target.checked)}
            className="mt-1.5 h-4 w-4 shrink-0 accent-amber-300"
          />
          <span>{TERMS_CHECKBOX_LABEL}</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
          <input
            name="accept_privacy"
            type="checkbox"
            checked={privacy}
            disabled={busy}
            onChange={(event) => setPrivacy(event.target.checked)}
            className="mt-1.5 h-4 w-4 shrink-0 accent-amber-300"
          />
          <span>{PRIVACY_CHECKBOX_LABEL}</span>
        </label>
      </div>

      <p className="text-xs leading-5 text-zinc-500">
        Consulta los documentos completos antes de aceptar:{' '}
        <Link to="/aliados/terminos" target="_blank" rel="noopener noreferrer" className={linkClass}>
          Términos y Condiciones v{TERMS_VERSION}
        </Link>{' '}
        y{' '}
        <Link to="/aliados/privacidad" target="_blank" rel="noopener noreferrer" className={linkClass}>
          Aviso Integral de Privacidad v{PRIVACY_VERSION}
        </Link>
        . La segunda casilla solo confirma que el aviso estuvo a tu disposición; no es un consentimiento para tratar datos fiscales o bancarios ni para recibir comunicaciones promocionales.
      </p>

      <button
        type="submit"
        disabled={!ready || busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
      >
        {busy ? 'Guardando…' : ACCEPT_BUTTON_LABEL} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {error && (
        <p role="alert" className="text-xs leading-5 text-red-300">
          {error}
        </p>
      )}
      {onSignOut && (
        <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Cerrar sesión sin aceptar
        </button>
      )}
    </form>
  );
}

export function AllyAcceptanceScreen(props: AllyAcceptanceFormProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40" />
      <section className="relative w-full max-w-lg rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <CharlitronLogo size="sm" showTagline={false} />
        <h1 className="mt-7 font-display text-3xl font-semibold text-white">Aceptación de condiciones</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Tu cuenta ya está activa. Para entrar al panel y registrar recomendaciones necesitamos tu aceptación expresa. La invitación no equivale a aceptar los términos.
        </p>
        <AllyAcceptanceForm {...props} />
      </section>
    </main>
  );
}
