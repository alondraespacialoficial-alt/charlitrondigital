/**
 * Ally Registration Form — Conectado a Supabase
 * Registro público simplificado (sin librerías UI externas)
 */

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Mail, Phone, MapPin, User, AlertCircle, CheckCircle } from 'lucide-react';
import { aliadosSupabase } from './aliadosSupabase';

interface RegistrationForm {
  email: string;
  full_name: string;
  phone?: string;
  city?: string;
  share_data_agreed: boolean;
}

interface RegistrationState {
  form: RegistrationForm;
  loading: boolean;
  error?: string;
  success?: string;
  formErrors: { [key in keyof RegistrationForm]?: string };
}

export function AllyRegistrationForm() {
  const [state, setState] = useState<RegistrationState>({
    form: {
      email: '',
      full_name: '',
      phone: '',
      city: '',
      share_data_agreed: false,
    },
    loading: false,
    formErrors: {},
  });

  const validateForm = (): boolean => {
    const errors: { [key in keyof RegistrationForm]?: string } = {};

    if (!state.form.email) {
      errors.email = 'Email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.form.email)) {
      errors.email = 'Email inválido';
    }

    if (!state.form.full_name || state.form.full_name.trim().length < 2) {
      errors.full_name = 'Nombre debe tener al menos 2 caracteres';
    }

    if (!state.form.share_data_agreed) {
      errors.share_data_agreed = 'Debes autorizar el compartir datos';
    }

    setState(s => ({ ...s, formErrors: errors }));
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof RegistrationForm, value: string | boolean) => {
    setState(s => ({
      ...s,
      form: { ...s.form, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!aliadosSupabase) {
      setState(s => ({
        ...s,
        error: 'Supabase no configurado. Contacta al administrador.',
      }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: undefined, success: undefined }));

    try {
      // Usar función SECURITY DEFINER: submit_registration
      // Esta función valida entrada y guarda en ally_registrations de forma segura
      const { data, error } = await aliadosSupabase.rpc('submit_registration', {
        p_email: state.form.email,
        p_full_name: state.form.full_name,
        p_phone: state.form.phone || null,
        p_city: state.form.city || null,
        p_share_data_agreed: state.form.share_data_agreed,
      });

      if (error) {
        throw error;
      }

      const registrationId = data as string;

      setState(s => ({
        ...s,
        loading: false,
        success: `Solicitud registrada exitosamente. Ref: ${registrationId.slice(0, 8)}. El administrador la revisará pronto.`,
        form: {
          email: '',
          full_name: '',
          phone: '',
          city: '',
          share_data_agreed: false,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar solicitud';
      setState(s => ({ ...s, loading: false, error: message }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-amber-200 mb-2">
            Únete al Programa Aliados
          </h1>
          <p className="text-slate-300">
            Completa tu solicitud. El administrador la revisará y te contactará.
          </p>
        </div>

        <div className="bg-slate-800 border border-amber-200/20 rounded-lg overflow-hidden">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-amber-200 mb-2">Solicitud de Registro</h2>
            <p className="text-slate-300 text-sm mb-6">
              Todos los campos marcados con * son requeridos
            </p>

            {state.error && (
              <div className="mb-6 p-4 bg-red-900/50 border border-red-600/50 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{state.error}</p>
              </div>
            )}

            {state.success && (
              <div className="mb-6 p-4 bg-green-900/50 border border-green-600/50 rounded-lg flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-green-200 text-sm">{state.success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre Completo */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <User className="inline w-4 h-4 mr-2" />
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={state.form.full_name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('full_name', e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-slate-700 border border-amber-200/20 text-white placeholder:text-slate-500 rounded px-4 py-2"
                  disabled={state.loading}
                />
                {state.formErrors.full_name && (
                  <p className="text-red-400 text-xs mt-1">{state.formErrors.full_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <Mail className="inline w-4 h-4 mr-2" />
                  Email *
                </label>
                <input
                  type="email"
                  value={state.form.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                  placeholder="juan@example.com"
                  className="w-full bg-slate-700 border border-amber-200/20 text-white placeholder:text-slate-500 rounded px-4 py-2"
                  disabled={state.loading}
                />
                {state.formErrors.email && (
                  <p className="text-red-400 text-xs mt-1">{state.formErrors.email}</p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <Phone className="inline w-4 h-4 mr-2" />
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={state.form.phone || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('phone', e.target.value)}
                  placeholder="+52 5555551234"
                  className="w-full bg-slate-700 border border-amber-200/20 text-white placeholder:text-slate-500 rounded px-4 py-2"
                  disabled={state.loading}
                />
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <MapPin className="inline w-4 h-4 mr-2" />
                  Ciudad (opcional)
                </label>
                <input
                  type="text"
                  value={state.form.city || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('city', e.target.value)}
                  placeholder="Ciudad de México"
                  className="w-full bg-slate-700 border border-amber-200/20 text-white placeholder:text-slate-500 rounded px-4 py-2"
                  disabled={state.loading}
                />
              </div>

              {/* Autorización de Datos */}
              <div className="border-t border-amber-200/20 pt-6">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="share_data"
                    checked={state.form.share_data_agreed}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('share_data_agreed', e.target.checked)
                    }
                    disabled={state.loading}
                    className="w-4 h-4 mt-1 bg-slate-700 border border-amber-200/20 rounded"
                  />
                  <label htmlFor="share_data" className="text-sm text-slate-300 cursor-pointer flex-1">
                    Autorizo a Charlitron Digital a procesar y compartir mis datos de contacto
                    únicamente para el programa Aliados y comunicaciones relacionadas. *
                  </label>
                </div>
                {state.formErrors.share_data_agreed && (
                  <p className="text-red-400 text-xs mt-2">{state.formErrors.share_data_agreed}</p>
                )}
              </div>

              {/* Aviso Legal */}
              <div className="bg-amber-950/30 border border-amber-200/30 rounded p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-200 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-100 text-xs">
                    <strong>Nota importante:</strong> Tu solicitud será revisada por el administrador.
                    No recibirás acceso automático. Lee nuestro{' '}
                    <a href="#" className="underline hover:text-amber-200">
                      aviso de privacidad
                    </a>{' '}
                    y{' '}
                    <a href="#" className="underline hover:text-amber-200">
                      términos de servicio
                    </a>
                    .
                  </p>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={state.loading}
                className="w-full bg-amber-200 text-slate-950 hover:bg-amber-300 disabled:opacity-50 font-semibold py-2 rounded"
              >
                {state.loading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>
            ¿Preguntas? Contacta a{' '}
            <a href="mailto:aliados@charlitron.com" className="text-amber-200 hover:underline">
              aliados@charlitron.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
