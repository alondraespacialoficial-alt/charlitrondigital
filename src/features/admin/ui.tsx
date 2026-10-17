// Piezas visuales compartidas del panel interno.
import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400/70 focus:outline-none focus:ring-1 focus:ring-amber-400/30';

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50 transition-colors';

export const SectionHeader: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/80 pb-5">
    <div>
      <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-white">{title}</h1>
      {description && <p className="mt-1 max-w-xl text-sm text-zinc-500">{description}</p>}
    </div>
    {action}
  </div>
);

export const StateBlock: React.FC<{
  kind: 'loading' | 'error' | 'empty';
  message: string;
  onRetry?: () => void;
}> = ({ kind, message, onRetry }) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-12 text-center"
  >
    {kind === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
    {kind === 'error' && <AlertTriangle className="h-5 w-5 text-red-400" />}
    <p className={kind === 'error' ? 'text-sm text-red-300' : 'text-sm text-zinc-500'}>{message}</p>
    {kind === 'error' && onRetry && (
      <button onClick={onRetry} className="text-sm font-medium text-amber-400 hover:text-amber-300">
        Reintentar
      </button>
    )}
  </div>
);

export const ActionError: React.FC<{ message: string | null; onDismiss: () => void }> = ({
  message,
  onDismiss,
}) =>
  message ? (
    <div
      role="alert"
      className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      <span>{message}</span>
      <button onClick={onDismiss} className="shrink-0 text-red-300/70 hover:text-red-200">
        Cerrar
      </button>
    </div>
  ) : null;

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
