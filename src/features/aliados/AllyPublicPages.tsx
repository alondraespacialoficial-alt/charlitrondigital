import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { aliadosSupabase } from './aliadosSupabase';
import { activateAccount, linkErrorMessage, MIN_PASSWORD_LENGTH, parseAuthLink } from './aliadosActivation';
import { ALIADOS_LEGAL_APPROVED, PRIVACY_SECTIONS, TERMS_SECTIONS, type LegalSection } from './aliadosLegal';
import {
  fetchRegistrationAvailability,
  submitAllyRegistration,
  validateRegistration,
  type RegistrationAvailability,
  type RegistrationErrors,
  type RegistrationInput,
} from './aliadosRegistration';

const inputClass =
  'mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60 disabled:opacity-50';
const buttonClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200';

function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-40" />
      <section className="relative w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <Link to="/aliados" aria-label="Volver a Aliados Charlitron" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <CharlitronLogo size="sm" showTagline={false} />
        <h1 className="mt-7 font-display text-3xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

function FieldError({ text }: { text?: string }) {
  return text ? <p role="alert" className="mt-1 text-xs leading-5 text-red-300">{text}</p> : null;
}

// ---------------------------------------------------------------- Registro

const EMPTY_INPUT: RegistrationInput = { name: '', email: '', whatsapp: '', city: '', accepted: false };

export function AllyRegistrationForm({ onSubmit }: { onSubmit: (input: RegistrationInput) => Promise<string> }) {
  const [values, setValues] = useState<RegistrationInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateRegistration(values);
    setErrors(found);
    setMessage('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const error = await onSubmit(values);
    setBusy(false);
    if (error) {
      setMessage(error);
      return;
    }
    setValues(EMPTY_INPUT);
    setDone(true);
  };

  if (done) {
    return (
      <div role="status" className="flex gap-3 text-sm leading-6 text-zinc-300">
        <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
        <p>Recibimos tu solicitud. Charlitron la revisará y, si es aprobada, te enviará por correo una invitación para crear tu contraseña.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <label className="block text-sm text-zinc-300">
        Nombre completo
        <input name="name" autoComplete="name" maxLength={120} disabled={busy} value={values.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(errors.name)} className={inputClass} placeholder="Tu nombre" />
        <FieldError text={errors.name} />
      </label>
      <label className="block text-sm text-zinc-300">
        Correo
        <input name="email" type="email" autoComplete="email" maxLength={254} disabled={busy} value={values.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email)} className={inputClass} placeholder="tu@correo.com" />
        <FieldError text={errors.email} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300">
          WhatsApp
          <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} disabled={busy} value={values.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} aria-invalid={Boolean(errors.whatsapp)} className={inputClass} placeholder="444 000 0000" />
          <FieldError text={errors.whatsapp} />
        </label>
        <label className="block text-sm text-zinc-300">
          Ciudad
          <input name="city" autoComplete="address-level2" maxLength={80} disabled={busy} value={values.city} onChange={(e) => set('city', e.target.value)} aria-invalid={Boolean(errors.city)} className={inputClass} placeholder="San Luis Potosí" />
          <FieldError text={errors.city} />
        </label>
      </div>
      <div>
        <label className="flex items-start gap-3 text-xs leading-5 text-zinc-400">
          <input name="accepted" type="checkbox" disabled={busy} checked={values.accepted} onChange={(e) => set('accepted', e.target.checked)} aria-invalid={Boolean(errors.accepted)} className="mt-1 accent-amber-300" />
          <span>
            He leído el{' '}
            <Link to="/aliados/privacidad" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">Aviso de Privacidad</Link>{' '}
            y los{' '}
            <Link to="/aliados/terminos" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">Términos del Programa Aliados</Link>
            , y acepto que Charlitron trate mis datos para revisar mi solicitud y contactarme.
          </span>
        </label>
        <FieldError text={errors.accepted} />
      </div>
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? 'Enviando…' : 'Solicitar registro'} <ArrowRight className="h-4 w-4" />
      </button>
      {message && <p role="alert" className="text-xs leading-5 text-red-300">{message}</p>}
      <p className="text-xs leading-5 text-zinc-500">Revisamos cada solicitud de forma manual. Enviar el formulario no crea una cuenta.</p>
    </form>
  );
}

export function AllyRegistrationPage() {
  const [availability, setAvailability] = useState<RegistrationAvailability | 'loading'>(aliadosSupabase ? 'loading' : 'unknown');

  useEffect(() => {
    const client = aliadosSupabase;
    if (!client) return;
    let live = true;
    void fetchRegistrationAvailability(client).then((result) => {
      if (live) setAvailability(result);
    });
    return () => {
      live = false;
    };
  }, []);

  const client = aliadosSupabase;
  // Doble llave: la base debe tenerlo abierto Y los textos legales deben estar aprobados en el codigo.
  const open = ALIADOS_LEGAL_APPROVED && availability === 'open' && client !== null;

  return (
    <Frame title="Quiero ser aliado" subtitle="Cuéntanos quién eres y revisaremos tu solicitud.">
      {availability === 'loading' ? (
        <p role="status" className="text-sm text-zinc-500">Cargando…</p>
      ) : open ? (
        <AllyRegistrationForm onSubmit={(input) => submitAllyRegistration(client, input)} />
      ) : (
        <div role="status" className="space-y-4 text-sm leading-6 text-zinc-300">
          <p>El registro de nuevos aliados todavía no está abierto.</p>
          <p className="text-zinc-500">Cuando abramos el registro podrás enviar tu solicitud desde esta página.</p>
          <Link to="/aliados/ingresar" className="inline-block text-amber-200 underline underline-offset-2">¿Ya eres aliado? Ingresa</Link>
        </div>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------- Activacion por invitacion

export function AllyActivationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const link = useMemo(() => parseAuthLink(location.hash, location.search), [location.hash, location.search]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!aliadosSupabase) {
    return <Frame title="Activar cuenta"><p role="alert" className="text-sm text-zinc-400">El acceso no está configurado en esta vista previa.</p></Frame>;
  }
  if (link.kind === 'error') {
    return (
      <Frame title="No pudimos activar tu cuenta">
        <p role="alert" className="text-sm leading-6 text-zinc-300">{linkErrorMessage(link.code)}</p>
        <Link to="/aliados/ingresar" className="mt-5 inline-block text-sm text-amber-200 underline underline-offset-2">Ir a ingresar</Link>
      </Frame>
    );
  }
  if (link.kind === 'none') {
    return (
      <Frame title="Enlace no válido">
        <p role="alert" className="text-sm leading-6 text-zinc-300">Abre el enlace de tu correo de invitación. Si ya creaste tu contraseña, ingresa con ella.</p>
        <Link to="/aliados/ingresar" className="mt-5 inline-block text-sm text-amber-200 underline underline-offset-2">Ir a ingresar</Link>
      </Frame>
    );
  }

  const client = aliadosSupabase;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const problem = await activateAccount(client, link, password, confirmation);
    if (problem) {
      setBusy(false);
      setError(problem);
      return;
    }
    navigate('/aliados/panel', { replace: true });
  };

  return (
    <Frame title="Crea tu contraseña" subtitle="Tu solicitud fue aprobada. Elige una contraseña para entrar a tu panel.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-zinc-300">
          Contraseña
          <input required type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm text-zinc-300">
          Repite la contraseña
          <input required type="password" name="confirmation" autoComplete="new-password" disabled={busy} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} />
        </label>
        <p className="text-xs leading-5 text-zinc-500">Mínimo {MIN_PASSWORD_LENGTH} caracteres, con letras y al menos un número.</p>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Guardando…' : 'Guardar y entrar'} <ArrowRight className="h-4 w-4" />
        </button>
        {error && <p role="alert" className="text-xs leading-5 text-red-300">{error}</p>}
      </form>
    </Frame>
  );
}

// ---------------------------------------------------------------- Textos legales

function LegalSections({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol className="mt-8 space-y-6">
      {sections.map((section, index) => (
        <li key={section.title} className="border-t border-white/10 pt-5">
          <h2 className="font-display text-lg font-semibold text-white">{index + 1}. {section.title}</h2>
          {section.paragraphs?.map((text) => <p key={text} className="mt-2 text-sm leading-6 text-zinc-300">{text}</p>)}
          {section.items && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AllyLegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/aliados" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver a Aliados
        </Link>
        {!ALIADOS_LEGAL_APPROVED && (
          <div role="note" className="mb-8 rounded-md border border-amber-200/30 bg-amber-200/[0.06] p-4 text-sm leading-6 text-amber-100">
            <strong>Borrador pendiente de validación legal.</strong> Este texto es una propuesta y no constituye un documento definitivo. Faltan por confirmar la identificación completa del responsable, su domicilio, los plazos de conservación y la ley aplicable.
          </div>
        )}
        <h1 className="font-display text-3xl font-semibold text-white">
          {isPrivacy ? 'Aviso de Privacidad del Programa Aliados' : 'Términos del Programa Aliados Charlitron'}
        </h1>
        <LegalSections sections={isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS} />
        <p className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-500">
          {isPrivacy ? (
            <>Para los datos que recabamos en el sitio fuera del programa, consulta <a href="/#legal-privacidad" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline underline-offset-2">el aviso general</a>.</>
          ) : (
            <>Consulta también el <Link to="/aliados/privacidad" className="text-amber-200 underline underline-offset-2">Aviso de Privacidad del programa</Link>.</>
          )}
        </p>
      </div>
    </main>
  );
}
