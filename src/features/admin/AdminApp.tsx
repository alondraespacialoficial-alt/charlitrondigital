import React, { useState } from 'react';
import { FileText, Lightbulb, FolderOpen, LogOut, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminSession } from './useAdminSession';
import { AdminLogin } from './AdminLogin';
import { ArticlesAdmin } from './ArticlesAdmin';
import { CategoriesAdmin } from './CategoriesAdmin';
import { IdeasAdmin } from './IdeasAdmin';
import { MetricsAdmin } from './MetricsAdmin';
import { logAdminAction } from './audit';
import { CharlitronLogo } from '../../components/CharlitronLogo';

type AdminTab = 'articles' | 'ideas' | 'categories' | 'metrics';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'articles', label: 'Artículos', icon: FileText },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'categories', label: 'Categorías', icon: FolderOpen },
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
];

export const AdminApp: React.FC = () => {
  const { session, loading } = useAdminSession();
  const [tab, setTab] = useState<AdminTab>('articles');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-500 flex items-center justify-center">
        Verificando sesión…
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (!session.isAdmin) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
          <p className="text-zinc-400 mb-6">
            Tu cuenta no tiene permisos de administrador. Contacta al equipo de Charlitron.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await logAdminAction(session.user, 'auth.signout', 'auth', session.user.id);
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5]">
      <header className="border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CharlitronLogo size="sm" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 border border-amber-400/30 rounded-full px-2.5 py-0.5">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-500 hidden sm:inline">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'articles' && <ArticlesAdmin user={session.user} />}
        {tab === 'ideas' && <IdeasAdmin user={session.user} />}
        {tab === 'categories' && <CategoriesAdmin user={session.user} />}
        {tab === 'metrics' && <MetricsAdmin />}
      </main>
    </div>
  );
};
