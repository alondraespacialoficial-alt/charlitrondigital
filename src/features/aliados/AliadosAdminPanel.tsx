/**
 * Aliados Admin Panel — Conectado a Supabase Real
 * 4 tabs: Aliados, Referidos, Ventas, Comisiones
 * Datos REALES, sin ficticios (interfaz simplificada, sin librerías UI)
 */

import { useEffect, useState } from 'react';
import { AliadosRepository } from './aliadosRepository';
import { aliadosSupabase } from './aliadosSupabase';
import type {
  AllyRegistration,
  AllyProfile,
  Referral,
  Sale,
  Payment,
  Commission,
  CommissionPayment,
} from './aliadosRepository';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

type TabType = 'allies' | 'referrals' | 'sales' | 'commissions';

interface AdminPanelData {
  registrations: AllyRegistration[];
  allies: AllyProfile[];
  referrals: Referral[];
  sales: Sale[];
  payments: Payment[];
  commissions: Commission[];
  commissionPayments: CommissionPayment[];
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: { [key: string]: string } = {
    pending: 'bg-yellow-900/50 text-yellow-200',
    approved: 'bg-green-900/50 text-green-200',
    rejected: 'bg-red-900/50 text-red-200',
    expired: 'bg-gray-900/50 text-gray-200',
    active: 'bg-green-900/50 text-green-200',
    new: 'bg-blue-900/50 text-blue-200',
    contacted: 'bg-cyan-900/50 text-cyan-200',
    interested: 'bg-purple-900/50 text-purple-200',
    closed: 'bg-red-900/50 text-red-200',
    duplicate: 'bg-red-900/50 text-red-200',
    assigned: 'bg-blue-900/50 text-blue-200',
    partially_paid: 'bg-orange-900/50 text-orange-200',
    paid: 'bg-green-900/50 text-green-200',
    cancelled: 'bg-red-900/50 text-red-200',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[status] || 'bg-gray-900/50 text-gray-200'}`}>
      {status}
    </span>
  );
};

export function AliadosAdminPanel() {
  const [currentTab, setCurrentTab] = useState<TabType>('allies');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<AdminPanelData>({
    registrations: [],
    allies: [],
    referrals: [],
    sales: [],
    payments: [],
    commissions: [],
    commissionPayments: [],
  });

  const repo = aliadosSupabase ? new AliadosRepository(aliadosSupabase) : null;

  useEffect(() => {
    if (!repo) {
      setError('Supabase no configurado');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [registrations, allies, referrals, sales, payments, commissions, commissionPayments] =
          await Promise.all([
            repo.listRegistrations().catch(() => []),
            repo.listAllies().catch(() => []),
            repo.listReferrals().catch(() => []),
            repo.listSales().catch(() => []),
            repo.listPayments().catch(() => []),
            repo.listCommissions().catch(() => []),
            repo.listCommissionPayments().catch(() => []),
          ]);

        setData({
          registrations,
          allies,
          referrals,
          sales,
          payments,
          commissions,
          commissionPayments,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando datos');
        setLoading(false);
      }
    };

    loadData();
  }, [repo]);

  const handleApproveRegistration = async (regId: string) => {
    if (!repo) return;
    try {
      await repo.approveRegistration(regId);
      const updated = data.registrations.map(r =>
        r.id === regId ? { ...r, status: 'approved' as const } : r
      );
      setData(d => ({ ...d, registrations: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error aprobando');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-amber-200 mb-2">Panel de Administrador</h1>
          <p className="text-slate-300">Gestión del programa Aliados Charlitron</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-600/50 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-amber-200" />
            <p className="text-slate-300">Cargando datos...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-amber-200/20">
              {(['allies', 'referrals', 'sales', 'commissions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`px-4 py-2 font-semibold ${
                    currentTab === tab
                      ? 'text-amber-200 border-b-2 border-amber-200'
                      : 'text-slate-400 hover:text-amber-200'
                  }`}
                >
                  {tab === 'allies'
                    ? 'Aliados'
                    : tab === 'referrals'
                      ? 'Referidos'
                      : tab === 'sales'
                        ? 'Ventas'
                        : 'Comisiones'}
                </button>
              ))}
            </div>

            {/* ALIADOS TAB */}
            {currentTab === 'allies' && (
              <div className="space-y-6">
                {/* Solicitudes */}
                <div className="bg-slate-800 border border-amber-200/20 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-amber-200 mb-4">Solicitudes de Registro</h2>
                  {data.registrations.length === 0 ? (
                    <p className="text-slate-400">No hay solicitudes</p>
                  ) : (
                    <div className="space-y-3">
                      {data.registrations.map(reg => (
                        <div key={reg.id} className="border border-amber-200/10 rounded p-4 bg-slate-700/30">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-400">Nombre</p>
                              <p className="font-semibold text-amber-200">{reg.full_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Email</p>
                              <p className="text-sm text-slate-200">{reg.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Ciudad</p>
                              <p className="text-sm text-slate-200">{reg.city || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Estado</p>
                              <StatusBadge status={reg.status} />
                            </div>
                          </div>
                          {reg.status === 'pending' && (
                            <button
                              onClick={() => handleApproveRegistration(reg.id)}
                              className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-sm rounded"
                            >
                              <CheckCircle className="inline w-4 h-4 mr-2" />
                              Aprobar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aliados Activos */}
                <div className="bg-slate-800 border border-amber-200/20 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-amber-200 mb-4">Aliados Activos ({data.allies.length})</h2>
                  {data.allies.length === 0 ? (
                    <p className="text-slate-400">No hay aliados</p>
                  ) : (
                    <div className="space-y-2">
                      {data.allies.map(ally => (
                        <div key={ally.user_id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded border border-amber-200/10">
                          <div>
                            <p className="font-semibold text-amber-200">{ally.display_name}</p>
                            <p className="text-xs text-slate-400">{ally.email}</p>
                          </div>
                          <StatusBadge status={ally.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REFERIDOS TAB */}
            {currentTab === 'referrals' && (
              <div className="bg-slate-800 border border-amber-200/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-amber-200 mb-4">Referidos ({data.referrals.length})</h2>
                {data.referrals.length === 0 ? (
                  <p className="text-slate-400">No hay referidos</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.referrals.map(ref => (
                      <div key={ref.id} className="border border-amber-200/10 rounded p-3 bg-slate-700/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <p className="text-xs text-slate-400">Nombre</p>
                            <p className="text-sm font-semibold text-amber-200">{ref.referred_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Email</p>
                            <p className="text-xs text-slate-300">{ref.referred_email || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Estado</p>
                            <StatusBadge status={ref.status} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Datos compartidos</p>
                            <p className="text-xs text-slate-200">{ref.data_share_authorized ? '✓' : '✗'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VENTAS TAB */}
            {currentTab === 'sales' && (
              <div className="bg-slate-800 border border-amber-200/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-amber-200 mb-4">Ventas ({data.sales.length})</h2>
                {data.sales.length === 0 ? (
                  <p className="text-slate-400">No hay ventas</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.sales.map(sale => {
                      const salePayments = data.payments.filter(p => p.sale_id === sale.id);
                      const totalPaid = salePayments.reduce((sum, p) => sum + p.amount_paid, 0);
                      const remaining = sale.amount_agreed - totalPaid;

                      return (
                        <div key={sale.id} className="border border-amber-200/10 rounded p-3 bg-slate-700/30">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div>
                              <p className="text-xs text-slate-400">Descripción</p>
                              <p className="text-sm font-semibold text-amber-200">
                                {sale.sale_description || 'Sin desc.'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Acordado</p>
                              <p className="text-sm text-slate-200">${sale.amount_agreed.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Pagado</p>
                              <p className="text-sm text-green-300">${totalPaid.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Pendiente</p>
                              <p className="text-sm text-orange-300">${remaining.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Pagos</p>
                              <p className="text-sm text-slate-200">{salePayments.length}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* COMISIONES TAB */}
            {currentTab === 'commissions' && (
              <div className="bg-slate-800 border border-amber-200/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-amber-200 mb-4">Comisiones ({data.commissions.length})</h2>
                {data.commissions.length === 0 ? (
                  <p className="text-slate-400">No hay comisiones</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.commissions.map(comm => {
                      const payments = data.commissionPayments.filter(p => p.commission_id === comm.id);
                      const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);
                      const remaining = comm.commission_amount - totalPaid;

                      return (
                        <div key={comm.id} className="border border-amber-200/10 rounded p-3 bg-slate-700/30">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div>
                              <p className="text-xs text-slate-400">%</p>
                              <p className="text-sm font-semibold text-amber-200">{comm.commission_percentage}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Monto</p>
                              <p className="text-sm text-slate-200">${comm.commission_amount.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Pagado</p>
                              <p className="text-sm text-green-300">${totalPaid.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Pendiente</p>
                              <p className="text-sm text-orange-300">${remaining.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Estado</p>
                              <StatusBadge status={comm.status} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
