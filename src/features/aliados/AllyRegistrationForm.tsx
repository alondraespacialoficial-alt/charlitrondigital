/**
 * Ally Registration Page — Conectado a Supabase
 * Formulario público para solicitar registro.
 * Guardar solicitud en ally_registrations (sin crear usuario aún).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Mail, Phone, MapPin, User } from 'lucide-react';
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

export function AllyRegistrationPage() {
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

  const handleInputChange = (field: keyof RegistrationForm, value: any) => {
    setState(s => ({
      ...s,
      form: { ...s.form, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Insertar solicitud en ally_registrations
      // Nota: sin crear usuario aún (requiere aprobación admin)
      const { data, error } = await aliadosSupabase
        .from('ally_registrations')
        .insert([
          {
            email: state.form.email,
            full_name: state.form.full_name,
            phone: state.form.phone || null,
            city: state.form.city || null,
            share_data_agreed: state.form.share_data_agreed,
            status: 'pending',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setState(s => ({
        ...s,
        loading: false,
        success: `Solicitud registrada exitosamente. Ref: ${data.id.slice(0, 8)}. El administrador la revisará pronto.`,
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

        <Card className="bg-slate-800 border-amber-200/20">
          <CardHeader>
            <CardTitle className="text-amber-200">Solicitud de Registro</CardTitle>
            <CardDescription className="text-slate-300">
              Todos los campos marcados con * son requeridos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {state.success && (
              <Alert className="mb-6 bg-green-900/50 border-green-600/50">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">{state.success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre Completo */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <User className="inline w-4 h-4 mr-2" />
                  Nombre Completo *
                </label>
                <Input
                  type="text"
                  value={state.form.full_name}
                  onChange={e => handleInputChange('full_name', e.target.value)}
                  placeholder="Juan Pérez"
                  className="bg-slate-700 border-amber-200/20 text-white placeholder:text-slate-500"
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
                <Input
                  type="email"
                  value={state.form.email}
                  onChange={e => handleInputChange('email', e.target.value)}
                  placeholder="juan@example.com"
                  className="bg-slate-700 border-amber-200/20 text-white placeholder:text-slate-500"
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
                <Input
                  type="tel"
                  value={state.form.phone || ''}
                  onChange={e => handleInputChange('phone', e.target.value)}
                  placeholder="+52 5555551234"
                  className="bg-slate-700 border-amber-200/20 text-white placeholder:text-slate-500"
                  disabled={state.loading}
                />
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-amber-200 mb-2">
                  <MapPin className="inline w-4 h-4 mr-2" />
                  Ciudad (opcional)
                </label>
                <Input
                  type="text"
                  value={state.form.city || ''}
                  onChange={e => handleInputChange('city', e.target.value)}
                  placeholder="Ciudad de México"
                  className="bg-slate-700 border-amber-200/20 text-white placeholder:text-slate-500"
                  disabled={state.loading}
                />
              </div>

              {/* Autorización de Datos */}
              <div className="border-t border-amber-200/20 pt-6">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="share_data"
                    checked={state.form.share_data_agreed}
                    onCheckedChange={checked =>
                      handleInputChange('share_data_agreed', checked === true)
                    }
                    disabled={state.loading}
                    className="mt-1"
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

              {/* Aviso Legal Corto */}
              <Alert className="bg-amber-950/30 border-amber-200/30">
                <AlertCircle className="h-4 w-4 text-amber-200" />
                <AlertDescription className="text-amber-100 text-xs">
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
                </AlertDescription>
              </Alert>

              {/* Submit */}
              <Button
                type="submit"
                disabled={state.loading}
                className="w-full bg-amber-200 text-slate-950 hover:bg-amber-300 font-semibold py-2"
              >
                {state.loading ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            </form>
          </CardContent>
        </Card>

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
