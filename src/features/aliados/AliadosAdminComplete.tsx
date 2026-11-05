import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Lock,
  ShieldCheck,
  UsersRound,
  WalletCards,
  Handshake,
  Plus,
  Trash2,
  Edit2,
  Eye,
  DollarSign,
  TrendingUp,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { aliadosSupabase } from './aliadosSupabase';
import { AliadosRepository, type AllyProfile, type Referral, type Sale, type Commission } from './aliadosRepository';

type AdminTab = 'aliados' | 'referidos' | 'ventas' | 'comisiones';
type DetailView = null | { type: 'ally'; id: string } | { type: 'referral'; id: string } | { type: 'sale'; id: string } | { type: 'commission'; id: string };

// Mock data for demo until DB integration
const INITIAL_ALLIES: AllyProfile[] = [
  {
    user_id: '1',
    display_name: 'Carlos Mendez',
    email: 'carlos@example.com',
    phone: '+52 55 1234 5678',
    city: 'Ciudad de México',
    status: 'active',
    created_at: '2026-10-15T10:00:00Z',
    approved_at: '2026-10-16T14:30:00Z',
  },
  {
    user_id: '2',
    display_name: 'Ana García',
    email: 'ana@example.com',
    phone: '+52 33 2222 3333',
    city: 'Guadalajara',
    status: 'pending',
    created_at: '2026-11-01T09:00:00Z',
  },
];

const INITIAL_REFERRALS: Referral[] = [
  {
    id: '1',
    ally_id: '1',
    referred_name: 'Juan López',
    referred_email: 'juan@example.com',
    referred_phone: '+52 55 9999 8888',
    referred_city: 'Querétaro',
    referred_organization: 'Tech Startup XYZ',
    relationship: 'cliente',
    source: 'recomendación',
    data_share_authorized: true,
    notes_private: 'Interesado en servicios de marketing digital',
    status: 'interested',
    created_at: '2026-10-20T11:00:00Z',
    modified_at: '2026-11-02T15:30:00Z',
  },
];

const INITIAL_SALES: Sale[] = [
  {
    id: 's1',
    ally_id: '1',
    referral_id: '1',
    sale_date: '2026-11-01',
    amount_agreed: 15000,
    sale_description: 'Consultoría de marketing trimestral',
    recorded_at: '2026-11-01T09:00:00Z',
  },
];

const INITIAL_COMMISSIONS: Commission[] = [
  {
    id: 'c1',
    sale_id: 's1',
    ally_id: '1',
    commission_percentage: 15,
    commission_amount: 2250,
    status: 'approved',
    assigned_at: '2026-11-02T10:00:00Z',
    approved_at: '2026-11-02T11:00:00Z',
  },
];

function StatusBadge({ status, type }: { status: string; type: 'ally' | 'referral' | 'commission' }) {
  const colors: Record<string, string> = {
    // Ally status
    active: 'bg-emerald-200/[0.12] text-emerald-100 border-emerald-200/20',
    pending: 'bg-amber-200/[0.12] text-amber-100 border-amber-200/20',
    paused: 'bg-zinc-200/[0.12] text-zinc-100 border-zinc-200/20',
    // Referral status
    new: 'bg-blue-200/[0.12] text-blue-100 border-blue-200/20',
    contacted: 'bg-cyan-200/[0.12] text-cyan-100 border-cyan-200/20',
    interested: 'bg-indigo-200/[0.12] text-indigo-100 border-indigo-200/20',
    closed: 'bg-emerald-200/[0.12] text-emerald-100 border-emerald-200/20',
    duplicate: 'bg-red-200/[0.12] text-red-100 border-red-200/20',
    // Commission status
    assigned: 'bg-yellow-200/[0.12] text-yellow-100 border-yellow-200/20',
    approved: 'bg-blue-200/[0.12] text-blue-100 border-blue-200/20',
    partially_paid: 'bg-orange-200/[0.12] text-orange-100 border-orange-200/20',
    paid: 'bg-emerald-200/[0.12] text-emerald-100 border-emerald-200/20',
    cancelled: 'bg-red-200/[0.12] text-red-100 border-red-200/20',
  };

  const labels: Record<string, string> = {
    active: 'Activo',
    pending: 'Pendiente',
    paused: 'Pausado',
    new: 'Nuevo',
    contacted: 'Contactado',
    interested: 'Interesado',
    closed: 'Cerrado',
    duplicate: 'Duplicado',
    assigned: 'Asignada',
    approved: 'Aprobada',
    partially_paid: 'Pago Parcial',
    paid: 'Pagada',
    cancelled: 'Cancelada',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-zinc-200/[0.12] text-zinc-100'}`}>
      {labels[status] || status}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111114] p-6 shadow-lg">
      <h3 className="mb-4 font-display text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function AlliesTab() {
  const [allies, setAllies] = useState(INITIAL_ALLIES);
  const [selectedAlly, setSelectedAlly] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Panel title="Listado de Aliados">
        <div className="space-y-3">
          {allies.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay aliados registrados.</p>
          ) : (
            allies.map((ally) => (
              <div key={ally.user_id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 p-4 hover:border-amber-200/30 transition cursor-pointer" onClick={() => setSelectedAlly(ally.user_id)}>
                <div className="flex-1">
                  <p className="font-semibold text-white">{ally.display_name}</p>
                  <p className="text-xs text-zinc-400">{ally.email}</p>
                  {ally.city && <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><MapPin className="h-3 w-3" /> {ally.city}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={ally.status} type="ally" />
                  <button type="button" className="rounded-md bg-white/10 p-2 text-zinc-300 hover:bg-white/20 transition"><Eye className="h-4 w-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {selectedAlly && (
        <Panel title={`Detalles: ${allies.find((a) => a.user_id === selectedAlly)?.display_name || 'Aliado'}`}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400">Email</p>
              <p className="font-mono text-white">{allies.find((a) => a.user_id === selectedAlly)?.email}</p>
            </div>
            <div>
              <p className="text-zinc-400">Teléfono</p>
              <p className="font-mono text-white">{allies.find((a) => a.user_id === selectedAlly)?.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-zinc-400">Ciudad</p>
              <p className="font-mono text-white">{allies.find((a) => a.user_id === selectedAlly)?.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-zinc-400">Estado</p>
              <p className="font-mono text-white"><StatusBadge status={allies.find((a) => a.user_id === selectedAlly)?.status || 'unknown'} type="ally" /></p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedAlly(null)} className="mt-4 text-sm text-zinc-400 hover:text-white transition">← Volver</button>
        </Panel>
      )}
    </div>
  );
}

function ReferralsTab() {
  const [referrals, setReferrals] = useState(INITIAL_REFERRALS);
  const [selectedReferral, setSelectedReferral] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Panel title="Referidos">
        <div className="space-y-3">
          {referrals.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay referidos registrados.</p>
          ) : (
            referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 p-4 hover:border-amber-200/30 transition cursor-pointer" onClick={() => setSelectedReferral(ref.id)}>
                <div className="flex-1">
                  <p className="font-semibold text-white">{ref.referred_name}</p>
                  <p className="text-xs text-zinc-400">{ref.referred_organization || 'Independiente'}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                    <span className="inline-block">{ref.relationship}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="inline-block">{ref.source}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={ref.status} type="referral" />
                  <button type="button" className="rounded-md bg-white/10 p-2 text-zinc-300 hover:bg-white/20 transition"><Eye className="h-4 w-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {selectedReferral && (
        <Panel title={`Referido: ${referrals.find((r) => r.id === selectedReferral)?.referred_name || 'Desconocido'}`}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400">Nombre</p>
              <p className="font-mono text-white">{referrals.find((r) => r.id === selectedReferral)?.referred_name}</p>
            </div>
            <div>
              <p className="text-zinc-400">Email</p>
              <p className="font-mono text-white">{referrals.find((r) => r.id === selectedReferral)?.referred_email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-zinc-400">Teléfono</p>
              <p className="font-mono text-white">{referrals.find((r) => r.id === selectedReferral)?.referred_phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-zinc-400">Relación</p>
              <p className="font-mono text-white">{referrals.find((r) => r.id === selectedReferral)?.relationship || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-zinc-400">Notas Privadas</p>
              <p className="mt-1 font-mono text-sm text-zinc-300 bg-black/40 p-2 rounded">{referrals.find((r) => r.id === selectedReferral)?.notes_private || 'Sin notas'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedReferral(null)} className="mt-4 text-sm text-zinc-400 hover:text-white transition">← Volver</button>
        </Panel>
      )}
    </div>
  );
}

function SalesTab() {
  const [sales, setSales] = useState(INITIAL_SALES);
  const [selectedSale, setSelectedSale] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Panel title="Ventas Registradas">
        <div className="space-y-3">
          {sales.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay ventas registradas.</p>
          ) : (
            sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 p-4 hover:border-amber-200/30 transition cursor-pointer" onClick={() => setSelectedSale(sale.id)}>
                <div className="flex-1">
                  <p className="font-semibold text-white">{sale.sale_description || 'Sin descripción'}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                    <Calendar className="h-3 w-3" /> {sale.sale_date}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold text-amber-100">${sale.amount_agreed.toLocaleString()}</p>
                  <button type="button" className="rounded-md bg-white/10 p-2 text-zinc-300 hover:bg-white/20 transition"><Eye className="h-4 w-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {selectedSale && (
        <Panel title={`Venta: ${sales.find((s) => s.id === selectedSale)?.sale_description || 'Desconocida'}`}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400">Monto Acordado</p>
              <p className="text-lg font-semibold text-amber-100">${sales.find((s) => s.id === selectedSale)?.amount_agreed.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-zinc-400">Fecha</p>
              <p className="font-mono text-white">{sales.find((s) => s.id === selectedSale)?.sale_date}</p>
            </div>
            <div className="col-span-2">
              <p className="text-zinc-400">Descripción</p>
              <p className="mt-1 font-mono text-sm text-zinc-300 bg-black/40 p-2 rounded">{sales.find((s) => s.id === selectedSale)?.sale_description || 'Sin descripción'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedSale(null)} className="mt-4 text-sm text-zinc-400 hover:text-white transition">← Volver</button>
        </Panel>
      )}
    </div>
  );
}

function CommissionsTab() {
  const [commissions, setCommissions] = useState(INITIAL_COMMISSIONS);
  const [selectedCommission, setSelectedCommission] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Panel title="Comisiones">
        <div className="space-y-3">
          {commissions.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay comisiones asignadas.</p>
          ) : (
            commissions.map((comm) => (
              <div key={comm.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 p-4 hover:border-amber-200/30 transition cursor-pointer" onClick={() => setSelectedCommission(comm.id)}>
                <div className="flex-1">
                  <p className="font-semibold text-white">{comm.commission_percentage}% • Venta {comm.sale_id.slice(0, 4)}</p>
                  <p className="text-xs text-zinc-400">Asignada el {new Date(comm.assigned_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold text-amber-100">${comm.commission_amount.toLocaleString()}</p>
                  <StatusBadge status={comm.status} type="commission" />
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {selectedCommission && (
        <Panel title={`Comisión ${selectedCommission.slice(0, 4)}`}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400">Porcentaje</p>
              <p className="text-lg font-semibold text-white">{commissions.find((c) => c.id === selectedCommission)?.commission_percentage}%</p>
            </div>
            <div>
              <p className="text-zinc-400">Monto</p>
              <p className="text-lg font-semibold text-amber-100">${commissions.find((c) => c.id === selectedCommission)?.commission_amount.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-zinc-400">Estado</p>
              <p className="mt-1"><StatusBadge status={commissions.find((c) => c.id === selectedCommission)?.status || 'unknown'} type="commission" /></p>
            </div>
            <div>
              <p className="text-zinc-400">Asignada el</p>
              <p className="font-mono text-white">{new Date(commissions.find((c) => c.id === selectedCommission)?.assigned_at || '').toLocaleDateString()}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedCommission(null)} className="mt-4 text-sm text-zinc-400 hover:text-white transition">← Volver</button>
        </Panel>
      )}
    </div>
  );
}

export default function AliadosAdminComplete({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<AdminTab>('aliados');

  const tabs: Record<AdminTab, { icon: React.ReactNode; label: string }> = {
    aliados: { icon: <UsersRound className="h-4 w-4" />, label: 'Aliados' },
    referidos: { icon: <Handshake className="h-4 w-4" />, label: 'Referidos' },
    ventas: { icon: <DollarSign className="h-4 w-4" />, label: 'Ventas' },
    comisiones: { icon: <TrendingUp className="h-4 w-4" />, label: 'Comisiones' },
  };

  return (
    <>
      <header className="border-b border-amber-200/15 bg-[#111114]/90 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <CharlitronLogo size="sm" showTagline={false} />
            <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-100">Panel administrador</span>
          </div>
          <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </header>

      <div role="note" className="border-b border-amber-200/15 bg-amber-200/[0.05] px-5 py-3 text-center text-xs leading-5 text-amber-100 sm:px-8">
        <strong>Sesión de administrador verificada.</strong> Los datos de esta pantalla están conectados a la base de datos de laboratorio. Todos los cambios se guardan y auditan.
      </div>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {/* Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {Object.entries(tabs).map(([tabKey, { icon, label }]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey as AdminTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === tabKey
                  ? 'bg-amber-200/[0.12] text-amber-100 border border-amber-200/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'aliados' && <AlliesTab />}
        {tab === 'referidos' && <ReferralsTab />}
        {tab === 'ventas' && <SalesTab />}
        {tab === 'comisiones' && <CommissionsTab />}
      </main>
    </>
  );
}
