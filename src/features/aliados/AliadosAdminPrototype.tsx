import { useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Check, Lock, ShieldCheck, UsersRound, WalletCards, Handshake } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';

type AllyStatus = 'Activo' | 'En revisión' | 'Pausado';
type DealStatus = 'Nuevo' | 'Contactado' | 'Cotización enviada' | 'Ganado' | 'Perdido';
type AdminTab = 'aliados' | 'referidos' | 'comisiones';

interface Ally { id: string; name: string; city: string; since: string; status: AllyStatus }
interface Payment { id: string; label: string; amount: number; confirmed: boolean }
interface Referral {
  id: string;
  business: string;
  contact: string;
  phone: string;
  city: string;
  service: string;
  allyId: string;
  status: DealStatus;
  saleAmount: number | null;
  payments: Payment[];
  commission: number | null;
  released: boolean;
  notes: string;
}

const ALLY_STATUSES: AllyStatus[] = ['Activo', 'En revisión', 'Pausado'];
const DEAL_STATUSES: DealStatus[] = ['Nuevo', 'Contactado', 'Cotización enviada', 'Ganado', 'Perdido'];

// Todos los datos son ficticios y viven solo en memoria.
const INITIAL_ALLIES: Ally[] = [
  { id: 'a1', name: 'Mariana Torres', city: 'San Luis Potosí', since: '12 mar 2026', status: 'Activo' },
  { id: 'a2', name: 'Rodrigo Salas', city: 'Querétaro', since: '28 abr 2026', status: 'Activo' },
  { id: 'a3', name: 'Daniela Ruiz', city: 'León', since: '03 jun 2026', status: 'En revisión' },
  { id: 'a4', name: 'Luis Herrera', city: 'Aguascalientes', since: '19 jun 2026', status: 'Pausado' },
];

const INITIAL_REFERRALS: Referral[] = [
  {
    id: 'r1', business: 'Taquería Don Pepe (ficticio)', contact: 'Contacto Uno', phone: '444 000 0101', city: 'San Luis Potosí',
    service: 'Páginas web', allyId: 'a1', status: 'Ganado', saleAmount: 18000,
    payments: [
      { id: 'p1', label: 'Anticipo 50%', amount: 9000, confirmed: true },
      { id: 'p2', label: 'Liquidación', amount: 9000, confirmed: true },
    ],
    commission: 1800, released: false, notes: 'Proyecto entregado. Comisión acordada de forma manual con la aliada.',
  },
  {
    id: 'r2', business: 'Clínica Dental Sonrisa (ficticio)', contact: 'Contacto Dos', phone: '444 000 0102', city: 'San Luis Potosí',
    service: 'Apps y sistemas', allyId: 'a1', status: 'Ganado', saleAmount: 32000,
    payments: [
      { id: 'p3', label: 'Anticipo 50%', amount: 16000, confirmed: true },
      { id: 'p4', label: 'Saldo', amount: 16000, confirmed: false },
    ],
    commission: 3200, released: false, notes: 'Falta el saldo. Revisar con administración antes de cualquier liberación.',
  },
  {
    id: 'r3', business: 'Ferretería El Tornillo (ficticio)', contact: 'Contacto Tres', phone: '442 000 0103', city: 'Querétaro',
    service: 'Automatización e IA', allyId: 'a2', status: 'Cotización enviada', saleAmount: 12000,
    payments: [], commission: null, released: false, notes: '',
  },
  {
    id: 'r4', business: 'Gimnasio Fuerza Norte (ficticio)', contact: 'Contacto Cuatro', phone: '477 000 0104', city: 'León',
    service: 'Activaciones BTL', allyId: 'a3', status: 'Nuevo', saleAmount: null,
    payments: [], commission: null, released: false, notes: '',
  },
  {
    id: 'r5', business: 'Gym Fuerza Norte (ficticio)', contact: 'Contacto Cinco', phone: '477-000-0104', city: 'León',
    service: 'Volanteo', allyId: 'a2', status: 'Contactado', saleAmount: null,
    payments: [], commission: null, released: false, notes: 'Llegó por otra aliada. Pendiente de definir a quién corresponde.',
  },
  {
    id: 'r6', business: 'Escuela Aprendiz (ficticio)', contact: 'Contacto Seis', phone: '449 000 0106', city: 'Aguascalientes',
    service: 'Producción audiovisual', allyId: 'a4', status: 'Ganado', saleAmount: 9500,
    payments: [{ id: 'p5', label: 'Anticipo', amount: 9500, confirmed: false }],
    commission: 950, released: false, notes: 'Comisión asignada, pero el cliente aún no confirma el pago.',
  },
];

const money = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const digits = (value: string) => value.replace(/\D/g, '');
const normalizeName = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(ficticio\)/g, '').replace(/[^a-z0-9]/g, '');

const confirmedTotal = (referral: Referral) =>
  referral.payments.filter((payment) => payment.confirmed).reduce((sum, payment) => sum + payment.amount, 0);

type CommissionKey = 'none' | 'blocked' | 'review' | 'ready' | 'released';

// Regla central: sin cobro confirmado la comisión nunca es liberable; el cobro parcial exige revisión manual.
function commissionState(referral: Referral): { key: CommissionKey; label: string } {
  if (referral.released) return { key: 'released', label: 'Liberada (simulada)' };
  if (referral.commission === null || referral.commission <= 0) return { key: 'none', label: 'Sin comisión asignada' };
  const confirmed = confirmedTotal(referral);
  if (confirmed <= 0) return { key: 'blocked', label: 'Bloqueada: sin cobro confirmado' };
  if (referral.status !== 'Ganado' || referral.saleAmount === null || confirmed < referral.saleAmount) {
    return { key: 'review', label: 'Revisión manual: cobro parcial' };
  }
  return { key: 'ready', label: 'Liberable' };
}

function findDuplicates(referral: Referral, all: Referral[]) {
  return all.filter((other) => {
    if (other.id === referral.id) return false;
    const samePhone = digits(other.phone) !== '' && digits(other.phone) === digits(referral.phone);
    const sameName = normalizeName(other.business) === normalizeName(referral.business);
    return samePhone || sameName;
  });
}

const stateTone: Record<CommissionKey, string> = {
  none: 'border-white/10 text-zinc-400',
  blocked: 'border-red-300/30 bg-red-300/[0.06] text-red-200',
  review: 'border-amber-200/30 bg-amber-200/[0.06] text-amber-100',
  ready: 'border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-200',
  released: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
};

const inputClass = 'mt-2 min-h-10 w-full rounded-md border border-white/10 bg-[#0b0b0d] px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/60 disabled:opacity-50 [color-scheme:dark]';
const optionClass = 'bg-[#0b0b0d] text-zinc-100';

function StateBadge({ state }: { state: { key: CommissionKey; label: string } }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${stateTone[state.key]}`}>{state.label}</span>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111114] p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

export default function AliadosAdminPrototype({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<AdminTab>('referidos');
  const [allies, setAllies] = useState(INITIAL_ALLIES);
  const [referrals, setReferrals] = useState(INITIAL_REFERRALS);
  const [selectedId, setSelectedId] = useState<string | null>('r2');

  const allyName = (id: string) => allies.find((ally) => ally.id === id)?.name ?? '—';
  const selected = referrals.find((referral) => referral.id === selectedId) ?? null;

  const updateReferral = (id: string, patch: Partial<Referral>) =>
    setReferrals((prev) => prev.map((referral) => (referral.id === id ? { ...referral, ...patch } : referral)));

  const confirmPayment = (referralId: string, paymentId: string) =>
    setReferrals((prev) => prev.map((referral) => (
      referral.id === referralId && !referral.released
        ? { ...referral, payments: referral.payments.map((payment) => (payment.id === paymentId ? { ...payment, confirmed: true } : payment)) }
        : referral
    )));

  // La condición se revalida sobre el estado más reciente, no solo en el botón.
  const releaseCommission = (id: string) =>
    setReferrals((prev) => prev.map((referral) => (
      referral.id === id && commissionState(referral).key === 'ready' ? { ...referral, released: true } : referral
    )));

  const reset = () => {
    setAllies(INITIAL_ALLIES);
    setReferrals(INITIAL_REFERRALS);
    setSelectedId('r2');
  };

  const tabs: { id: AdminTab; label: string; icon: typeof UsersRound }[] = [
    { id: 'aliados', label: 'Aliados', icon: UsersRound },
    { id: 'referidos', label: 'Referidos', icon: Handshake },
    { id: 'comisiones', label: 'Comisiones', icon: WalletCards },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-white/10 bg-[#0d0d0f]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
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
        <strong>Sesión de administrador verificada · datos ficticios.</strong> Los datos de esta pantalla no son reales: los cambios no se guardan ni modifican información; al recargar todo se restablece.
      </div>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Secciones del panel" className="flex gap-2 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm transition ${tab === id ? 'bg-amber-200/10 text-amber-100' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={reset} className="text-xs text-zinc-500 underline underline-offset-2 transition hover:text-zinc-300">Restablecer datos ficticios</button>
        </div>

        {tab === 'aliados' && (
          <Panel title="Aliados registrados">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr><th className="pb-3 font-medium">Aliado</th><th className="pb-3 font-medium">Ciudad</th><th className="pb-3 font-medium">Registro</th><th className="pb-3 font-medium">Referidos</th><th className="pb-3 font-medium">Estado</th></tr>
                </thead>
                <tbody>
                  {allies.map((ally) => (
                    <tr key={ally.id} className="border-t border-white/[0.07]">
                      <td className="py-3 text-zinc-200">{ally.name}</td>
                      <td className="py-3 text-zinc-400">{ally.city}</td>
                      <td className="py-3 text-zinc-500">{ally.since}</td>
                      <td className="py-3 text-zinc-400">{referrals.filter((referral) => referral.allyId === ally.id).length}</td>
                      <td className="py-3">
                        <select aria-label={`Estado de ${ally.name}`} value={ally.status} onChange={(event) => setAllies((prev) => prev.map((item) => (item.id === ally.id ? { ...item, status: event.target.value as AllyStatus } : item)))} className="min-h-9 rounded-md border border-white/10 bg-[#0b0b0d] px-2 text-sm text-zinc-100 [color-scheme:dark]">
                          {ALLY_STATUSES.map((status) => <option key={status} value={status} className={optionClass}>{status}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'referidos' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <Panel title="Referidos recibidos">
              <ul className="space-y-2">
                {referrals.map((referral) => {
                  const duplicates = findDuplicates(referral, referrals);
                  return (
                    <li key={referral.id}>
                      <button type="button" onClick={() => setSelectedId(referral.id)} aria-pressed={selectedId === referral.id} className={`w-full rounded-md border p-3 text-left transition ${selectedId === referral.id ? 'border-amber-200/40 bg-amber-200/[0.06]' : 'border-white/10 hover:border-white/20'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">{referral.business}</p>
                          {duplicates.length > 0 && <AlertTriangle aria-label="Posible duplicado" className="h-4 w-4 shrink-0 text-amber-200" />}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">Propietario: {allyName(referral.allyId)} · {referral.status}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {selected ? (
              <ReferralDetail
                referral={selected}
                allyName={allyName(selected.allyId)}
                duplicates={findDuplicates(selected, referrals)}
                allyNameOf={allyName}
                onChange={(patch) => updateReferral(selected.id, patch)}
                onConfirmPayment={(paymentId) => confirmPayment(selected.id, paymentId)}
                onRelease={() => releaseCommission(selected.id)}
              />
            ) : (
              <Panel title="Detalle"><p className="text-sm text-zinc-500">Selecciona un referido.</p></Panel>
            )}
          </div>
        )}

        {tab === 'comisiones' && (
          <Panel title="Comisiones">
            <p className="mb-4 flex items-start gap-2 text-xs leading-5 text-zinc-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Una comisión solo es liberable con el cobro del cliente confirmado. Los cobros parciales se revisan manualmente.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr><th className="pb-3 font-medium">Referido</th><th className="pb-3 font-medium">Aliado</th><th className="pb-3 font-medium">Venta</th><th className="pb-3 font-medium">Cobrado</th><th className="pb-3 font-medium">Comisión</th><th className="pb-3 font-medium">Estado</th><th className="pb-3" /></tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => {
                    const state = commissionState(referral);
                    return (
                      <tr key={referral.id} className="border-t border-white/[0.07]">
                        <td className="py-3 pr-3 text-zinc-200">{referral.business}</td>
                        <td className="py-3 pr-3 text-zinc-400">{allyName(referral.allyId)}</td>
                        <td className="py-3 pr-3 text-zinc-400">{money(referral.saleAmount)}</td>
                        <td className="py-3 pr-3 text-zinc-400">{money(confirmedTotal(referral))}</td>
                        <td className="py-3 pr-3 text-zinc-200">{money(referral.commission)}</td>
                        <td className="py-3 pr-3"><StateBadge state={state} /></td>
                        <td className="py-3 text-right"><ReleaseButton state={state} onRelease={() => releaseCommission(referral.id)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}

function ReleaseButton({ state, onRelease }: { state: { key: CommissionKey }; onRelease: () => void }) {
  if (state.key === 'released') return <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><Check className="h-3.5 w-3.5" /> Simulada</span>;
  const enabled = state.key === 'ready';
  return (
    <button type="button" disabled={!enabled} onClick={onRelease} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-amber-300 px-3 text-xs font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-600">
      {!enabled && <Lock className="h-3.5 w-3.5" />} Simular liberación
    </button>
  );
}

interface DetailProps {
  referral: Referral;
  allyName: string;
  duplicates: Referral[];
  allyNameOf: (id: string) => string;
  onChange: (patch: Partial<Referral>) => void;
  onConfirmPayment: (paymentId: string) => void;
  onRelease: () => void;
}

function ReferralDetail({ referral, allyName, duplicates, allyNameOf, onChange, onConfirmPayment, onRelease }: DetailProps) {
  const state = commissionState(referral);
  const confirmed = confirmedTotal(referral);
  const parseAmount = (value: string) => (value === '' ? null : Math.max(0, Number(value)));

  return (
    <div className="space-y-5">
      <Panel title={referral.business}>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-zinc-500">Propietario (aliado)</dt><dd className="text-zinc-200">{allyName}</dd></div>
          <div><dt className="text-xs text-zinc-500">Servicio</dt><dd className="text-zinc-200">{referral.service}</dd></div>
          <div><dt className="text-xs text-zinc-500">Contacto</dt><dd className="text-zinc-200">{referral.contact} · {referral.phone}</dd></div>
          <div><dt className="text-xs text-zinc-500">Ciudad</dt><dd className="text-zinc-200">{referral.city}</dd></div>
        </dl>
        <label className="mt-4 block text-sm text-zinc-300">
          Estado comercial
          <select value={referral.status} onChange={(event) => onChange({ status: event.target.value as DealStatus })} className={inputClass}>
            {DEAL_STATUSES.map((status) => <option key={status} value={status} className={optionClass}>{status}</option>)}
          </select>
        </label>
        {duplicates.length > 0 && (
          <div role="alert" className="mt-4 flex gap-3 rounded-md border border-amber-200/30 bg-amber-200/[0.06] p-3 text-xs leading-5 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Posible duplicado de {duplicates.map((duplicate) => `${duplicate.business} (aliado: ${allyNameOf(duplicate.allyId)})`).join('; ')}.
              Es solo una alerta: revisa manualmente a quién corresponde, no se rechaza nada automáticamente.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Venta y cobros del cliente">
        <label className="block text-sm text-zinc-300">
          Monto de venta (MXN)
          <input type="number" min={0} disabled={referral.released} value={referral.saleAmount ?? ''} onChange={(event) => onChange({ saleAmount: parseAmount(event.target.value) })} className={inputClass} placeholder="0" />
        </label>
        {referral.payments.length === 0 ? (
          <p className="mt-4 text-xs text-zinc-500">Sin cobros registrados.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {referral.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2 text-sm">
                <span className="text-zinc-300">{payment.label} · {money(payment.amount)}</span>
                {payment.confirmed ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><Check className="h-3.5 w-3.5" /> Cobro confirmado</span>
                ) : (
                  <button type="button" disabled={referral.released} onClick={() => onConfirmPayment(payment.id)} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-amber-200/50 hover:text-amber-100 disabled:opacity-40">
                    Simular confirmación de cobro
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">Cobrado y confirmado: {money(confirmed)}</p>
      </Panel>

      <Panel title="Comisión">
        <label className="block text-sm text-zinc-300">
          Comisión asignada manualmente (MXN)
          <input type="number" min={0} disabled={referral.released} value={referral.commission ?? ''} onChange={(event) => onChange({ commission: parseAmount(event.target.value) })} className={inputClass} placeholder="Sin asignar" />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <StateBadge state={state} />
          <ReleaseButton state={state} onRelease={onRelease} />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">Simulación: la liberación no mueve dinero ni se guarda.</p>
      </Panel>

      <Panel title="Notas internas">
        <textarea rows={3} value={referral.notes} onChange={(event) => onChange({ notes: event.target.value })} className={`${inputClass} py-2`} placeholder="Solo visibles para Charlitron (ficticio)" />
      </Panel>
    </div>
  );
}
