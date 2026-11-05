/**
 * Ally Registration Page
 * Public registration form with data sharing authorization
 * Status: FORM ONLY - actual registration account creation disabled until legal review
 */

import { useCallback, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Mail, Phone, MapPin, User, ArrowRight } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';

interface RegistrationFormData {
  full_name: string;
  email: string;
  phone?: string;
  city?: string;
  share_data_agreed: boolean;
}

export function AllyRegistrationPage() {
  const [form, setForm] = useState<RegistrationFormData>({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    share_data_agreed: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, type, value, checked } = e.currentTarget as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate
      if (!form.full_name.trim()) throw new Error('El nombre es requerido');
      if (!form.email.trim()) throw new Error('El correo es requerido');
      if (!form.share_data_agreed) throw new Error('Debes autorizar el uso de tus datos');

      // NOTE: Registration account creation is DISABLED until legal review
      // Only form validation and display confirmation for now
      console.log('Registration form submitted (account creation pending legal approval):', form);

      setSubmitted(true);
      setForm({ full_name: '', email: '', phone: '', city: '', share_data_agreed: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar tu solicitud');
    } finally {
      setLoading(false);
    }
  }, [form]);

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
        <section role="status" className="w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200/[0.12] border border-emerald-200/30">
            <Check className="h-6 w-6 text-emerald-100" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Solicitud Recibida</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Tu solicitud de registro ha sido recibida correctamente. Pronto nos comunicaremos contigo para confirmar tu participación en el programa Aliados Charlitron.
          </p>
          <p className="mt-4 rounded-md bg-amber-200/[0.08] border border-amber-200/20 p-3 text-xs text-amber-100">
            <strong>Estado:</strong> Tu solicitud está en revisión. Recibirás un correo cuando sea aprobada.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <a href="/aliados" className="text-sm text-zinc-400 transition hover:text-white">
              ← Volver a Aliados
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-8">
        <CharlitronLogo size="sm" showTagline={false} />
        
        <h1 className="mt-7 font-display text-2xl font-semibold text-white">Únete a Aliados Charlitron</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Completa este formulario para solicitar tu participación en nuestro programa de alianzas.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-zinc-300">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" /> Nombre Completo
              </span>
            </label>
            <input
              required
              type="text"
              id="full_name"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              disabled={loading}
              placeholder="Tu nombre completo"
              className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" /> Correo Electrónico
              </span>
            </label>
            <input
              required
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              disabled={loading}
              placeholder="tu@correo.com"
              className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zinc-300">
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" /> Teléfono (Opcional)
              </span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              disabled={loading}
              placeholder="+52 1234567890"
              className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50"
            />
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-zinc-300">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Ciudad (Opcional)
              </span>
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={form.city}
              onChange={handleChange}
              disabled={loading}
              placeholder="Tu ciudad"
              className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none transition focus:border-amber-200/60 disabled:opacity-50"
            />
          </div>

          {/* Data Sharing Consent */}
          <div className="mt-6 rounded-md bg-amber-200/[0.08] border border-amber-200/20 p-4">
            <label className="flex items-start gap-3">
              <input
                required
                type="checkbox"
                name="share_data_agreed"
                checked={form.share_data_agreed}
                onChange={handleChange}
                disabled={loading}
                className="mt-1 h-5 w-5 rounded border-white/10 bg-black/20 text-amber-200 accent-amber-200 outline-none cursor-pointer disabled:opacity-50"
              />
              <span className="text-xs text-amber-100 leading-5">
                <strong>Autorizo</strong> el uso de mis datos personales para ser contactado dentro del programa Aliados Charlitron, de acuerdo con la{' '}
                <a href="/aliados/privacidad" className="underline hover:no-underline">
                  Política de Privacidad
                </a>
                .
              </span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-200/[0.12] border border-red-200/20 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-100 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-100">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !form.share_data_agreed}
            className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-200/20 border border-amber-200/50 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/30 hover:border-amber-200/70 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando…' : 'Solicitar Entrada'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5">
          <a href="/aliados" className="text-sm text-zinc-400 transition hover:text-white">
            ← Volver a Aliados
          </a>
        </div>
      </section>
    </main>
  );
}
