import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { CharlitronLogo } from '../../components/CharlitronLogo';

export const AdminLogin: React.FC = () => {
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
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <CharlitronLogo size="md" />
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 space-y-5"
        >
          <div className="text-center">
            <Lock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <h1 className="text-xl font-bold">Panel interno</h1>
            <p className="text-sm text-zinc-500 mt-1">Solo equipo Charlitron Digital</p>
          </div>

          <label className="block">
            <span className="text-sm text-zinc-400">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50 transition-all"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
