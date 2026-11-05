import { useState, type FormEvent, type ReactNode } from 'react';
import type {
  AdminCommission,
  AdminReferral,
  AliadosRepository,
  AllyProfile,
  AllyRegistration,
  CommissionPayment,
  Payment,
  Sale,
} from './aliadosRepository';
import {
  COMMISSION_STATUS_LABELS,
  PAYMENT_METHODS,
  REFERRAL_STATUS_LABELS,
  formatDate,
  formatMoney,
  parseAmount,
  statusLabel,
} from './aliadosLabels';

export interface AdminPanelData {
  registrations: AllyRegistration[];
  allies: AllyProfile[];
  referrals: AdminReferral[];
  sales: Sale[];
  payments: Payment[];
  commissions: AdminCommission[];
  commissionPayments: CommissionPayment[];
}

// Ejecuta una accion contra la base, recarga los datos y muestra el resultado. Devuelve true si tuvo exito.
export type Run = (action: () => Promise<unknown>, success: string) => Promise<boolean>;

interface SectionProps {
  data: AdminPanelData;
  repo: AliadosRepository;
  run: Run;
  busy: boolean;
}

const inputClass =
  'w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-300 focus:outline-none';
const primaryButton =
  'rounded bg-amber-300 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton =
  'rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 transition hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-50';
const cardClass = 'rounded-lg border border-amber-200/10 bg-slate-700/30 p-4';

const BADGE_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-200',
  approved: 'bg-green-900/50 text-green-200',
  active: 'bg-green-900/50 text-green-200',
  paused: 'bg-gray-700/60 text-gray-200',
  rejected: 'bg-red-900/50 text-red-200',
  new: 'bg-blue-900/50 text-blue-200',
  contacted: 'bg-cyan-900/50 text-cyan-200',
  interested: 'bg-purple-900/50 text-purple-200',
  closed: 'bg-gray-700/60 text-gray-200',
  duplicate: 'bg-red-900/50 text-red-200',
  assigned: 'bg-blue-900/50 text-blue-200',
  authorized: 'bg-green-900/50 text-green-200',
  reversed: 'bg-red-900/50 text-red-200',
};

const BADGE_LABELS: Record<string, string> = {
  ...REFERRAL_STATUS_LABELS,
  ...COMMISSION_STATUS_LABELS,
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  active: 'Activo',
  paused: 'En pausa',
  reversed: 'Revertido',
};

export function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-semibold ${BADGE_COLORS[status] ?? 'bg-gray-900/50 text-gray-200'}`}>
      {statusLabel(BADGE_LABELS, status)}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-amber-200/20 bg-slate-800 p-6">
      <h2 className="mb-4 text-xl font-bold text-amber-200">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

// Una llave por envio del formulario: si el administrador reintenta, la base no duplica el movimiento.
function useIdempotencyKey(): [string, () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return [key, () => setKey(crypto.randomUUID())];
}

// Accion que exige motivo (rechazos y reversiones).
function ReasonAction({ label, confirmLabel, busy, onConfirm }: { label: string; confirmLabel: string; busy: boolean; onConfirm: (reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) {
    return <button type="button" className={ghostButton} onClick={() => setOpen(true)}>{label}</button>;
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onConfirm(reason.trim())) {
      setOpen(false);
      setReason('');
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <Field label="Motivo (obligatorio)">
          <input required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <button type="submit" disabled={busy} className={primaryButton}>{confirmLabel}</button>
      <button type="button" className={ghostButton} onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}

// Accion que pide confirmacion antes de ejecutarse.
function ConfirmAction({ label, question, confirmLabel, busy, primary, onConfirm }: {
  label: string;
  question: string;
  confirmLabel: string;
  busy: boolean;
  primary?: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" disabled={busy} className={primary ? primaryButton : ghostButton} onClick={() => setAsking(true)}>{label}</button>;
  }
  return (
    <div role="group" aria-label={question} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-200">{question}</span>
      <button
        type="button"
        disabled={busy}
        className={primaryButton}
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className={ghostButton} onClick={() => setAsking(false)}>Cancelar</button>
    </div>
  );
}

const ALLY_STATUS_ACTIONS: Record<string, { label: string; confirmLabel: string; target: 'active' | 'paused'; verb: string; done: string; primary: boolean } | undefined> = {
  pending: { label: 'Aprobar', confirmLabel: 'Sí, aprobar', target: 'active', verb: 'Aprobar', done: 'aprobado. Ya puede entrar a su panel', primary: true },
  active: { label: 'Pausar', confirmLabel: 'Sí, pausar', target: 'paused', verb: 'Pausar', done: 'pausado. Ya no puede entrar ni registrar referidos', primary: false },
  paused: { label: 'Reactivar', confirmLabel: 'Sí, reactivar', target: 'active', verb: 'Reactivar', done: 'reactivado. Vuelve a tener acceso', primary: true },
};

function MoneyForm({
  busy,
  submitLabel,
  withMethod,
  hint,
  onSubmit,
}: {
  busy: boolean;
  submitLabel: string;
  withMethod: boolean;
  hint?: string;
  onSubmit: (values: { amount: number; method: string; reference: string; key: string }) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState('');
  const [key, rotateKey] = useIdempotencyKey();
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setLocalError('Escribe un monto mayor a 0 con máximo 2 decimales.');
      return;
    }
    setLocalError('');
    if (await onSubmit({ amount: parsed, method, reference: reference.trim(), key })) {
      setAmount('');
      setReference('');
      rotateKey();
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="w-36">
        <Field label="Monto (MXN)">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
        </Field>
      </div>
      {withMethod && (
        <>
          <div className="w-40">
            <Field label="Método">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-44">
            <Field label="Referencia (opcional)">
              <input maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </>
      )}
      <button type="submit" disabled={busy} className={primaryButton}>{submitLabel}</button>
      {hint && <p className="w-full text-xs text-slate-400">{hint}</p>}
      {localError && <p role="alert" className="w-full text-xs text-red-300">{localError}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- Aliados

export function AlliesSection({ data, repo, run, busy }: SectionProps) {
  const pending = data.registrations.filter((reg) => reg.status === 'pending');
  const reviewed = data.registrations.filter((reg) => reg.status !== 'pending');
  return (
    <div className="space-y-6">
      <Section title={`Solicitudes pendientes (${pending.length})`}>
        {pending.length === 0 ? (
          <Empty text="No hay solicitudes pendientes." />
        ) : (
          <div className="space-y-3">
            {pending.map((reg) => (
              <div key={reg.id} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">{reg.full_name}</p>
                    <p className="text-sm text-slate-300">{reg.email}{reg.phone ? ` · ${reg.phone}` : ''}{reg.city ? ` · ${reg.city}` : ''}</p>
                    <p className="mt-1 text-xs text-slate-500">Recibida {formatDate(reg.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className={primaryButton}
                    onClick={() => run(() => repo.approveRegistration(reg.id), `Solicitud de ${reg.full_name} aprobada. Se envió una invitación a ${reg.email}.`)}
                  >
                    Aprobar y enviar invitación
                  </button>
                </div>
                <div className="mt-3">
                  <ReasonAction
                    label="Rechazar"
                    confirmLabel="Confirmar rechazo"
                    busy={busy}
                    onConfirm={(reason) => run(() => repo.rejectRegistration(reg.id, reason), 'Solicitud rechazada.')}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Aliados (${data.allies.length})`}>
        {data.allies.length === 0 ? (
          <Empty text="Todavía no hay aliados." />
        ) : (
          <div className="space-y-2">
            {data.allies.map((ally) => (
              <div key={ally.user_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{ally.display_name}</p>
                  <p className="text-xs text-slate-400">{ally.email}{ally.city ? ` · ${ally.city}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge status={ally.status} />
                  {ally.confirmed_at === null && (
                    <>
                      <span className="rounded bg-yellow-900/50 px-2 py-1 text-xs font-semibold text-yellow-200">Invitación sin aceptar</span>
                      <ConfirmAction
                        label="Reenviar invitación"
                        question={`¿Reenviar la invitación a ${ally.email}?`}
                        confirmLabel="Sí, reenviar"
                        busy={busy}
                        onConfirm={() => run(() => repo.resendInvitation(ally.user_id), `Invitación reenviada a ${ally.email}.`)}
                      />
                    </>
                  )}
                  {(() => {
                    const action = ALLY_STATUS_ACTIONS[ally.status];
                    if (!action) return null;
                    return (
                      <ConfirmAction
                        label={action.label}
                        question={`¿${action.verb} a ${ally.display_name}?`}
                        confirmLabel={action.confirmLabel}
                        busy={busy}
                        primary={action.primary}
                        onConfirm={() => run(() => repo.setAllyStatus(ally.user_id, action.target), `${ally.display_name} ${action.done}.`)}
                      />
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {reviewed.length > 0 && (
        <Section title="Solicitudes revisadas">
          <div className="space-y-2">
            {reviewed.map((reg) => (
              <div key={reg.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                <span>{reg.full_name} · {reg.email}</span>
                <Badge status={reg.status} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Referidos

function SaleForm({ referral, repo, run, busy }: { referral: AdminReferral } & Omit<SectionProps, 'data'>) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setLocalError('Escribe un monto mayor a 0 con máximo 2 decimales.');
      return;
    }
    setLocalError('');
    if (await run(() => repo.recordSale(referral.id, parsed, description.trim() || undefined, notes.trim() || undefined), 'Venta registrada.')) {
      setAmount('');
      setDescription('');
      setNotes('');
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-3">
      <Field label="Venta acordada (MXN)">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
      </Field>
      <Field label="Descripción (opcional)">
        <input maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Nota interna (opcional)">
        <input maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </Field>
      <div className="sm:col-span-3">
        <button type="submit" disabled={busy} className={primaryButton}>Registrar venta</button>
      </div>
      {localError && <p role="alert" className="text-xs text-red-300 sm:col-span-3">{localError}</p>}
    </form>
  );
}

function ReferralCard({ referral, data, repo, run, busy }: { referral: AdminReferral } & SectionProps) {
  const [status, setStatus] = useState<AdminReferral['status']>(referral.status);
  const [notes, setNotes] = useState(referral.internal_notes ?? '');
  const [original, setOriginal] = useState(referral.duplicate_of ?? '');
  const [saleOpen, setSaleOpen] = useState(false);
  const allyName = data.allies.find((ally) => ally.user_id === referral.ally_id)?.display_name ?? 'Aliado';
  const others = data.referrals.filter((item) => item.id !== referral.id);

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-100">
            {referral.referred_name}
            {referral.referred_organization ? ` · ${referral.referred_organization}` : ''}
          </p>
          <p className="text-sm text-slate-300">
            {[referral.referred_phone, referral.referred_email, referral.referred_city].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Recomendado por {allyName} · {formatDate(referral.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {referral.duplicate_review && <span className="rounded bg-orange-900/50 px-2 py-1 text-xs font-semibold text-orange-200">Posible duplicado: revisar</span>}
          <Badge status={referral.status} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as AdminReferral['status'])} className={inputClass}>
            {Object.entries(REFERRAL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {status === 'duplicate' && (
          <Field label="Referido original">
            <select value={original} onChange={(e) => setOriginal(e.target.value)} className={inputClass}>
              <option value="">Selecciona…</option>
              {others.map((item) => <option key={item.id} value={item.id}>{item.referred_name}</option>)}
            </select>
          </Field>
        )}
        <div className="sm:col-span-3">
          <Field label="Notas internas (el aliado no las ve)">
            <textarea rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className={primaryButton}
          onClick={() => run(() => repo.setReferralStatus(referral.id, status, notes, status === 'duplicate' ? original || undefined : undefined), 'Referido actualizado.')}
        >
          Guardar cambios
        </button>
        {referral.status !== 'duplicate' && (
          <button type="button" className={ghostButton} onClick={() => setSaleOpen((open) => !open)}>
            {saleOpen ? 'Ocultar venta' : 'Registrar venta'}
          </button>
        )}
      </div>
      {saleOpen && <SaleForm referral={referral} repo={repo} run={run} busy={busy} />}
    </div>
  );
}

export function ReferralsSection(props: SectionProps) {
  const { data } = props;
  return (
    <Section title={`Referidos (${data.referrals.length})`}>
      {data.referrals.length === 0 ? (
        <Empty text="Todavía no hay referidos." />
      ) : (
        <div className="space-y-3">
          {data.referrals.map((referral) => (
            <ReferralCard key={`${referral.id}-${referral.updated_at}`} referral={referral} {...props} />
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Ventas y cobros

function SaleCard({ sale, data, repo, run, busy }: { sale: Sale } & SectionProps) {
  const referral = data.referrals.find((item) => item.id === sale.referral_id);
  const allyName = data.allies.find((ally) => ally.user_id === sale.ally_id)?.display_name ?? 'Aliado';
  const payments = data.payments.filter((payment) => payment.sale_id === sale.id);
  const commission = data.commissions.find((item) => item.sale_id === sale.id);

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-100">{referral?.referred_name ?? 'Referido'} · {allyName}</p>
          <p className="text-sm text-slate-300">{sale.sale_description ?? 'Sin descripción'}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(sale.sale_date)}</p>
        </div>
        <p className="text-lg font-bold text-amber-200">{formatMoney(sale.amount_agreed)}</p>
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-200">Cobros</h3>
      {payments.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Sin cobros registrados.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-800/60 px-3 py-2 text-sm">
              <span className={payment.reversed_at ? 'text-slate-500 line-through' : 'text-slate-100'}>
                {formatMoney(payment.amount_paid)} · {payment.payment_method}
                {payment.reference_number ? ` · ${payment.reference_number}` : ''} · {formatDate(payment.payment_date)}
              </span>
              {payment.reversed_at ? (
                <Badge status="reversed" />
              ) : (
                <ReasonAction
                  label="Revertir"
                  confirmLabel="Confirmar reversión"
                  busy={busy}
                  onConfirm={(reason) => run(() => repo.reversePayment(payment.id, reason), 'Cobro revertido.')}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <MoneyForm
          busy={busy}
          withMethod
          submitLabel="Registrar cobro"
          onSubmit={({ amount, method, reference, key }) =>
            run(() => repo.recordPayment(sale.id, amount, key, method, reference || undefined), 'Cobro registrado.')
          }
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-200">Comisión</h3>
      {commission ? (
        <p className="mt-1 text-sm text-slate-300">
          {formatMoney(commission.commission_amount)} · <Badge status={commission.status} /> (se gestiona en la pestaña Comisiones)
        </p>
      ) : (
        <div className="mt-2">
          <MoneyForm
            busy={busy}
            withMethod={false}
            submitLabel="Asignar comisión"
            hint="La comisión queda pendiente de autorización; no se paga automáticamente."
            onSubmit={({ amount }) => run(() => repo.assignCommission(sale.id, amount), 'Comisión asignada. Queda pendiente de autorización.')}
          />
        </div>
      )}
    </div>
  );
}

export function SalesSection(props: SectionProps) {
  const { data } = props;
  return (
    <Section title={`Ventas (${data.sales.length})`}>
      {data.sales.length === 0 ? (
        <Empty text="No hay ventas. Registra una desde la pestaña Referidos." />
      ) : (
        <div className="space-y-3">
          {data.sales.map((sale) => (
            <SaleCard key={sale.id} sale={sale} {...props} />
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Comisiones

function CommissionCard({ commission, data, repo, run, busy }: { commission: AdminCommission } & SectionProps) {
  const sale = data.sales.find((item) => item.id === commission.sale_id);
  const referral = data.referrals.find((item) => item.id === sale?.referral_id);
  const allyName = data.allies.find((ally) => ally.user_id === commission.ally_id)?.display_name ?? 'Aliado';
  const payments = data.commissionPayments.filter((payment) => payment.commission_id === commission.id);

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-100">{allyName} · {referral?.referred_name ?? 'Referido'}</p>
          <p className="text-xs text-slate-500">Asignada {formatDate(commission.assigned_at)}</p>
        </div>
        <Badge status={commission.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Acordada" value={formatMoney(commission.commission_amount)} />
        <Stat label="Cobros netos de la venta" value={formatMoney(commission.net_collected)} />
        <Stat label="Liberable por cobros" value={formatMoney(commission.release_limit)} accent />
        <Stat label="Pagado" value={formatMoney(commission.paid_total)} />
      </div>

      {commission.status === 'assigned' ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            className={primaryButton}
            onClick={() => run(() => repo.authorizeCommission(commission.id), 'Comisión autorizada. Aún no se ha pagado.')}
          >
            Autorizar comisión
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <MoneyForm
            busy={busy}
            withMethod
            submitLabel="Registrar pago de comisión"
            hint="El sistema rechaza pagos que superen la comisión acordada o lo liberable por cobros netos."
            onSubmit={({ amount, method, reference, key }) =>
              run(() => repo.payCommission(commission.id, amount, key, method, reference || undefined), 'Pago de comisión registrado.')
            }
          />
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-3 space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-800/60 px-3 py-2 text-sm text-slate-100">
              <span>
                {formatMoney(payment.amount_paid)}
                {payment.payment_method ? ` · ${payment.payment_method}` : ''}
                {payment.reference_number ? ` · ${payment.reference_number}` : ''} · {formatDate(payment.payment_date)}
              </span>
              <ReasonAction
                label="Revertir"
                confirmLabel="Confirmar reversión"
                busy={busy}
                onConfirm={(reason) => run(() => repo.reverseCommissionPayment(payment.id, reason), 'Pago de comisión revertido.')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${accent ? 'text-amber-200' : 'text-slate-100'}`}>{value}</p>
    </div>
  );
}

export function CommissionsSection(props: SectionProps) {
  const { data } = props;
  return (
    <Section title={`Comisiones (${data.commissions.length})`}>
      {data.commissions.length === 0 ? (
        <Empty text="No hay comisiones. Asígnalas desde la pestaña Ventas." />
      ) : (
        <div className="space-y-3">
          {data.commissions.map((commission) => (
            <CommissionCard key={commission.id} commission={commission} {...props} />
          ))}
        </div>
      )}
    </Section>
  );
}
