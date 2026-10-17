import React, { useState } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { inputClass, primaryButton } from './ui';

export const AdminLogin: React.FC<{ notice?: string }> = ({ notice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] px-4 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <CharlitronLogo size="md" showTagline={false} />
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
            Panel interno
          </span>
        </div>

        {notice && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <label className="block">
            <span className="text-xs font-medium text-zinc-400">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-400">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={`${primaryButton} w-full`}>
            <LogIn className="h-4 w-4" />
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-700">Acceso restringido al equipo.</p>
      </div>
    </div>
  );
};
