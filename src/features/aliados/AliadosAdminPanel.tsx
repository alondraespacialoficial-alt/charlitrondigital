/**
 * Aliados Admin Panel — Conectado a Supabase
 * 4 tabs: Aliados (registro + aprobación), Referidos, Ventas, Comisiones
 * Datos REALES, sin ficticios.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Mail,
  MoreVertical,
  Phone,
  TrendingUp,
  Trash2,
  Save,
} from 'lucide-react';
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

interface TabViewState {
  tab: 'allies' | 'referrals' | 'sales' | 'commissions';
  selectedId?: string;
  loading: boolean;
  error?: string;
}

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
  const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    pending: 'default',
    approved: 'secondary',
    rejected: 'destructive',
    expired: 'destructive',
    active: 'secondary',
    new: 'default',
    contacted: 'outline',
    interested: 'secondary',
    closed: 'destructive',
    duplicate: 'destructive',
    assigned: 'default',
    approved: 'secondary',
    partially_paid: 'outline',
    paid: 'secondary',
    cancelled: 'destructive',
  };

  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
};

export function AliadosAdminPanel() {
  const [state, setState] = useState<TabViewState>({ tab: 'allies', loading: true });
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

  // Cargar datos al montar
  useEffect(() => {
    if (!repo) {
      setState(s => ({ ...s, error: 'Supabase no configurado', loading: false }));
      return;
    }

    const loadData = async () => {
      try {
        setState(s => ({ ...s, loading: true, error: undefined }));
        
        // Cargar todos los datos en paralelo
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

        setState(s => ({ ...s, loading: false }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error cargando datos';
        setState(s => ({ ...s, loading: false, error: message }));
      }
    };

    loadData();
  }, [repo]);

  const handleApproveRegistration = async (regId: string) => {
    if (!repo) return;
    try {
      await repo.approveRegistration(regId);
      // Recargar
      const updated = data.registrations.map(r =>
        r.id === regId ? { ...r, status: 'approved' as const } : r
      );
      setData(d => ({ ...d, registrations: updated }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error aprobando registro';
      setState(s => ({ ...s, error: message }));
    }
  };

  const handleRejectRegistration = async (regId: string, reason: string) => {
    if (!repo) return;
    try {
      await repo.rejectRegistration(regId, reason);
      const updated = data.registrations.map(r =>
        r.id === regId ? { ...r, status: 'rejected' as const } : r
      );
      setData(d => ({ ...d, registrations: updated }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error rechazando registro';
      setState(s => ({ ...s, error: message }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-amber-200 mb-2">
            Panel de Administrador
          </h1>
          <p className="text-slate-300">Gestión integral del programa Aliados Charlitron</p>
        </div>

        {state.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state.loading && (
          <Card className="bg-slate-800 border-amber-200/20">
            <CardContent className="p-8 text-center text-slate-300">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-amber-200" />
              Cargando datos...
            </CardContent>
          </Card>
        )}

        {!state.loading && (
          <Tabs value={state.tab} onValueChange={(tab: any) => setState(s => ({ ...s, tab }))}>
            <TabsList className="grid w-full grid-cols-4 bg-slate-800 border border-amber-200/20">
              <TabsTrigger value="allies" className="data-[state=active]:bg-amber-200 data-[state=active]:text-slate-950">
                <FileText className="w-4 h-4 mr-2" />
                Aliados
              </TabsTrigger>
              <TabsTrigger value="referrals" className="data-[state=active]:bg-amber-200 data-[state=active]:text-slate-950">
                <Mail className="w-4 h-4 mr-2" />
                Referidos
              </TabsTrigger>
              <TabsTrigger value="sales" className="data-[state=active]:bg-amber-200 data-[state=active]:text-slate-950">
                <TrendingUp className="w-4 h-4 mr-2" />
                Ventas
              </TabsTrigger>
              <TabsTrigger value="commissions" className="data-[state=active]:bg-amber-200 data-[state=active]:text-slate-950">
                <DollarSign className="w-4 h-4 mr-2" />
                Comisiones
              </TabsTrigger>
            </TabsList>

            {/* TAB: ALIADOS */}
            <TabsContent value="allies" className="space-y-4">
              <Card className="bg-slate-800 border-amber-200/20">
                <CardHeader>
                  <CardTitle className="text-amber-200">Solicitudes de Registro</CardTitle>
                  <CardDescription className="text-slate-300">
                    {data.registrations.length} solicitud(es)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.registrations.length === 0 ? (
                    <p className="text-slate-400">No hay solicitudes de registro</p>
                  ) : (
                    <div className="space-y-4">
                      {data.registrations.map(reg => (
                        <div key={reg.id} className="border border-amber-200/20 rounded-lg p-4 bg-slate-700/50">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <div className="mt-4 flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApproveRegistration(reg.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectRegistration(reg.id, 'Información incompleta')}
                              >
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-amber-200/20">
                <CardHeader>
                  <CardTitle className="text-amber-200">Aliados Activos</CardTitle>
                  <CardDescription className="text-slate-300">
                    {data.allies.length} aliado(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.allies.length === 0 ? (
                    <p className="text-slate-400">No hay aliados activos</p>
                  ) : (
                    <div className="space-y-2">
                      {data.allies.map(ally => (
                        <div key={ally.user_id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded border border-amber-200/10">
                          <div>
                            <p className="font-semibold text-amber-200">{ally.display_name}</p>
                            <p className="text-xs text-slate-400">{ally.email}</p>
                          </div>
                          <StatusBadge status={ally.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: REFERIDOS */}
            <TabsContent value="referrals" className="space-y-4">
              <Card className="bg-slate-800 border-amber-200/20">
                <CardHeader>
                  <CardTitle className="text-amber-200">Referidos ({data.referrals.length})</CardTitle>
                  <CardDescription className="text-slate-300">
                    Ver y gestionar referidos por aliado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.referrals.length === 0 ? (
                    <p className="text-slate-400">No hay referidos registrados</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {data.referrals.map(ref => (
                        <div key={ref.id} className="border border-amber-200/20 rounded p-3 bg-slate-700/50">
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
                              <p className="text-xs text-slate-400">Compartir datos</p>
                              <p className="text-xs text-slate-200">
                                {ref.data_share_authorized ? '✓' : '✗'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: VENTAS */}
            <TabsContent value="sales" className="space-y-4">
              <Card className="bg-slate-800 border-amber-200/20">
                <CardHeader>
                  <CardTitle className="text-amber-200">Ventas ({data.sales.length})</CardTitle>
                  <CardDescription className="text-slate-300">
                    Total acordado y pagos confirmados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.sales.length === 0 ? (
                    <p className="text-slate-400">No hay ventas registradas</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {data.sales.map(sale => {
                        const salePayments = data.payments.filter(p => p.sale_id === sale.id);
                        const totalPaid = salePayments.reduce((sum, p) => sum + p.amount_paid, 0);
                        const remaining = sale.amount_agreed - totalPaid;

                        return (
                          <div key={sale.id} className="border border-amber-200/20 rounded p-3 bg-slate-700/50">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div>
                                <p className="text-xs text-slate-400">Descripción</p>
                                <p className="text-sm font-semibold text-amber-200">
                                  {sale.sale_description || 'Sin descripción'}
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: COMISIONES */}
            <TabsContent value="commissions" className="space-y-4">
              <Card className="bg-slate-800 border-amber-200/20">
                <CardHeader>
                  <CardTitle className="text-amber-200">Comisiones ({data.commissions.length})</CardTitle>
                  <CardDescription className="text-slate-300">
                    Asignación, aprobación y pagos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.commissions.length === 0 ? (
                    <p className="text-slate-400">No hay comisiones registradas</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {data.commissions.map(comm => {
                        const payments = data.commissionPayments.filter(
                          p => p.commission_id === comm.id && !p.confirmed_at
                        );
                        const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);
                        const remaining = comm.commission_amount - totalPaid;

                        return (
                          <div key={comm.id} className="border border-amber-200/20 rounded p-3 bg-slate-700/50">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div>
                                <p className="text-xs text-slate-400">Porcentaje</p>
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
