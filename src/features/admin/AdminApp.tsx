import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { useAdminSession } from './useAdminSession';
import { AdminLogin } from './AdminLogin';
import { Overview } from './Overview';
import { ArticlesAdmin } from './ArticlesAdmin';
import { CategoriesAdmin } from './CategoriesAdmin';
import { IdeasAdmin } from './IdeasAdmin';
import { MetricsAdmin } from './MetricsAdmin';
import { SettingsAdmin } from './SettingsAdmin';
import { logAdminAction } from './audit';
import { primaryButton } from './ui';

type Section = 'overview' | 'articles' | 'ideas' | 'categories' | 'metrics' | 'settings';

const NAV_GROUPS: Array<{ label: string | null; items: Array<{ id: Section; label: string; icon: React.ElementType }> }> = [
  { label: null, items: [{ id: 'overview', label: 'Resumen', icon: LayoutDashboard }] },
  {
    label: 'Contenido',
    items: [
      { id: 'articles', label: 'Artículos', icon: FileText },
      { id: 'ideas', label: 'Ideas', icon: Lightbulb },
      { id: 'categories', label: 'Categorías', icon: FolderOpen },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'metrics', label: 'Métricas', icon: BarChart3 },
      { id: 'settings', label: 'Configuración', icon: Settings },
    ],
  },
];

const FullScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] px-4 text-center text-zinc-400">
    {children}
  </div>
);

const SidebarNav: React.FC<{
  section: Section;
  user: User;
  onSelect: (section: Section) => void;
  onSignOut: () => void;
}> = ({ section, user, onSelect, onSignOut }) => (
  <div className="flex h-full flex-col">
    <div className="px-5 py-5">
      <CharlitronLogo size="sm" showTagline={false} />
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">Panel interno</p>
    </div>

    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Secciones del panel">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label && (
            <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => onSelect(id)}
                  aria-current={section === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    section === id
                      ? 'bg-amber-400/10 text-amber-300'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>

    <div className="border-t border-zinc-800/80 p-3">
      <p className="truncate px-2 pb-2 text-xs text-zinc-600">{user.email}</p>
      <button
        onClick={onSignOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  </div>
);

export const AdminApp: React.FC = () => {
  const state = useAdminSession();
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [wasDenied, setWasDenied] = useState(false);

  // El panel no debe indexarse (además del header X-Robots-Tag y robots.txt).
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = meta?.getAttribute('content') ?? null;
    document.title = 'Panel interno | Charlitron Digital';
    meta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      document.title = previousTitle;
      if (meta && previousRobots !== null) meta.setAttribute('content', previousRobots);
    };
  }, []);

  // Sesión válida pero fuera de admin_users: cerrar sesión y avisar en el login.
  useEffect(() => {
    if (state.status === 'denied') {
      setWasDenied(true);
      void supabase.auth.signOut();
    } else if (state.status === 'admin') {
      setWasDenied(false);
    }
  }, [state.status]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const signOut = async (user?: User) => {
    if (user) await logAdminAction(user, 'auth.signout', 'auth', user.id);
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <FullScreen>
        <p className="max-w-xs text-sm">Panel no disponible: faltan las variables de entorno de Supabase.</p>
      </FullScreen>
    );
  }

  if (state.status === 'loading') return <FullScreen>Verificando sesión…</FullScreen>;

  if (state.status === 'anonymous') {
    return (
      <AdminLogin
        notice={wasDenied ? 'Acceso denegado: esta cuenta no tiene permisos de administrador.' : undefined}
      />
    );
  }

  if (state.status === 'denied') {
    return (
      <FullScreen>
        <div className="max-w-xs">
          <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-amber-400" />
          <p className="font-medium text-white">Acceso denegado</p>
          <p className="mt-1 text-sm">Cerrando sesión…</p>
        </div>
      </FullScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <FullScreen>
        <div className="max-w-xs space-y-4">
          <p className="text-sm text-red-300">{state.message}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className={primaryButton}>
              Reintentar
            </button>
            <button onClick={() => signOut()} className="text-sm text-zinc-400 hover:text-white">
              Cerrar sesión
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  const { user } = state;
  const select = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-zinc-800/80 bg-zinc-950 lg:block">
        <SidebarNav section={section} user={user} onSelect={select} onSignOut={() => signOut(user)} />
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <CharlitronLogo size="sm" showTagline={false} />
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-900"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-950">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-zinc-400 hover:bg-zinc-900"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarNav section={section} user={user} onSelect={select} onSignOut={() => signOut(user)} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          {section === 'overview' && <Overview onNavigate={select} />}
          {section === 'articles' && <ArticlesAdmin user={user} />}
          {section === 'ideas' && <IdeasAdmin user={user} />}
          {section === 'categories' && <CategoriesAdmin user={user} />}
          {section === 'metrics' && <MetricsAdmin />}
          {section === 'settings' && <SettingsAdmin user={user} onSignOut={() => signOut(user)} />}
        </div>
      </main>
    </div>
  );
};
