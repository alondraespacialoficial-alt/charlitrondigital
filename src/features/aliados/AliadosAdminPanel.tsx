/**
 * Panel de administrador de Aliados Charlitron.
 * Solo envia acciones a las funciones seguras y lee las vistas admin_*; no calcula limites ni saldos.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, LogOut } from 'lucide-react';
import { errorText } from './aliadosLabels';
import { useAliadosRepository } from './useAliadosData';
import {
  AlliesSection,
  CommissionsSection,
  ReferralsSection,
  SalesSection,
  type AdminPanelData,
  type Run,
} from './AliadosAdminSections';

type TabType = 'allies' | 'referrals' | 'sales' | 'commissions';

const TABS: { id: TabType; label: string }[] = [
  { id: 'allies', label: 'Aliados' },
  { id: 'referrals', label: 'Referidos' },
  { id: 'sales', label: 'Ventas y cobros' },
  { id: 'commissions', label: 'Comisiones' },
];

const EMPTY: AdminPanelData = {
  registrations: [],
  allies: [],
  referrals: [],
  sales: [],
  payments: [],
  commissions: [],
  commissionPayments: [],
};

export function AliadosAdminPanel({ onSignOut }: { onSignOut: () => void }) {
  const repo = useAliadosRepository();
  const [currentTab, setCurrentTab] = useState<TabType>('allies');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<AdminPanelData>(EMPTY);

  const load = useCallback(async (): Promise<boolean> => {
    if (!repo) {
      setError('El portal no está configurado.');
      setLoading(false);
      return false;
    }
    try {
      const [registrations, allies, referrals, sales, payments, commissions, commissionPayments] = await Promise.all([
        repo.listRegistrations(),
        repo.listAllies(),
        repo.listReferrals(),
        repo.listSales(),
        repo.listPayments(),
        repo.listCommissions(),
        repo.listCommissionPayments(),
      ]);
      setData({ registrations, allies, referrals, sales, payments, commissions, commissionPayments });
      return true;
    } catch (err) {
      setError(errorText(err, 'No se pudieron cargar los datos.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  // Toda accion pasa por aqui: bloquea dobles envios, recarga desde la base y muestra el resultado.
  const run: Run = async (action, success) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    let result: unknown;
    try {
      result = await action();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
      return false;
    }
    const refreshed = await load();
    if (refreshed) setNotice(typeof success === 'function' ? success(result) : success);
    setBusy(false);
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-amber-200 md:text-4xl">Panel de Administrador</h1>
            <p className="text-slate-300">Gestión del programa Aliados Charlitron</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/aliados" className="text-slate-400 hover:text-white">Ir a Aliados</Link>
            <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 text-amber-200 hover:text-amber-100">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-red-600/50 bg-red-900/50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-red-200">{error}</p>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 flex gap-3 rounded-lg border border-green-600/50 bg-green-900/40 p-4">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-400" />
            <p className="text-green-200">{notice}</p>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center" role="status">
            <Clock className="mx-auto mb-2 h-8 w-8 animate-spin text-amber-200" />
            <p className="text-slate-300">Cargando datos…</p>
          </div>
        )}

        {!loading && repo && (
          <>
            <div className="mb-6 flex gap-2 overflow-x-auto border-b border-amber-200/20">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurrentTab(tab.id)}
                  aria-current={currentTab === tab.id ? 'page' : undefined}
                  className={`shrink-0 px-4 py-2 font-semibold ${
                    currentTab === tab.id ? 'border-b-2 border-amber-200 text-amber-200' : 'text-slate-400 hover:text-amber-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {currentTab === 'allies' && <AlliesSection data={data} repo={repo} run={run} busy={busy} />}
            {currentTab === 'referrals' && <ReferralsSection data={data} repo={repo} run={run} busy={busy} />}
            {currentTab === 'sales' && <SalesSection data={data} repo={repo} run={run} busy={busy} />}
            {currentTab === 'commissions' && <CommissionsSection data={data} repo={repo} run={run} busy={busy} />}
          </>
        )}
      </div>
    </div>
  );
}
