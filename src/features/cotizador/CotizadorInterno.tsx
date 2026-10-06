import React, { useEffect, useState } from 'react';
import { FileDown, Plus, Trash2, X } from 'lucide-react';
import { CharlitronLogo } from '../../components/CharlitronLogo';
import { calculateQuote, formatCurrency } from './calculations';
import type { QuoteConceptDraft, QuoteDraft } from './types';

interface CotizadorInternoProps {
  onClose: () => void;
}

const inputClass = 'mt-1.5 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40';
const labelClass = 'text-xs font-medium text-zinc-400';

function localDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createFolio(): string {
  const random = new Uint8Array(2);
  crypto.getRandomValues(random);
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `CH-${localDate().replaceAll('-', '')}-${suffix}`;
}

function createInitialQuote(): QuoteDraft {
  return {
    folio: createFolio(),
    date: localDate(),
    client: '',
    contact: '',
    city: '',
    phone: '',
    address: '',
    email: '',
    concepts: [{ id: crypto.randomUUID(), code: '', description: '', quantity: '1', unit: 'servicio', unitPrice: '' }],
    discountMode: 'amount',
    discountValue: '',
    ivaEnabled: false,
    observations: '',
  };
}

export const CotizadorInterno: React.FC<CotizadorInternoProps> = ({ onClose }) => {
  const [quote, setQuote] = useState<QuoteDraft>(createInitialQuote);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const totals = calculateQuote(quote);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const updateQuote = <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) => {
    setQuote((current) => ({ ...current, [key]: value }));
  };

  const updateConcept = (id: string, key: keyof QuoteConceptDraft, value: string) => {
    setQuote((current) => ({
      ...current,
      concepts: current.concepts.map((concept) => concept.id === id ? { ...concept, [key]: value } : concept),
    }));
  };

  const addConcept = () => {
    setQuote((current) => ({
      ...current,
      concepts: [...current.concepts, {
        id: crypto.randomUUID(), code: '', description: '', quantity: '1', unit: 'servicio', unitPrice: '',
      }],
    }));
  };

  const removeConcept = (id: string) => {
    setQuote((current) => ({
      ...current,
      concepts: current.concepts.length > 1
        ? current.concepts.filter((concept) => concept.id !== id)
        : current.concepts,
    }));
  };

  const handleGeneratePdf = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setPdfError('');
    try {
      const { downloadQuotePdf } = await import('./pdf');
      await downloadQuotePdf(quote, totals);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'No se pudo generar el PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <CharlitronLogo size="sm" showTagline={false} />
            <span className="hidden border-l border-zinc-700 pl-4 text-sm font-semibold text-zinc-300 sm:inline">Cotizador interno</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300 transition hover:border-amber-400/60 hover:text-white"
            aria-label="Cerrar cotizador y descartar datos"
            title="Cerrar y descartar datos"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <div className="mb-7 flex flex-col gap-1 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-400">Charlitron Digital</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Nueva cotización</h1>
          </div>
          <p className="text-xs text-zinc-500">Borrador temporal · se descarta al cerrar o recargar</p>
        </div>

        <form onSubmit={handleGeneratePdf} className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="quote-details-heading">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="quote-details-heading" className="text-sm font-bold text-white">Datos de la cotización</h2>
                <span className="font-mono text-xs text-amber-300">{quote.folio}</span>
              </div>
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <label className={labelClass}>Cliente<input className={inputClass} value={quote.client} onChange={(e) => updateQuote('client', e.target.value)} required maxLength={120} /></label>
                <label className={labelClass}>Contacto<input className={inputClass} value={quote.contact} onChange={(e) => updateQuote('contact', e.target.value)} maxLength={120} /></label>
                <label className={labelClass}>Fecha<input className={inputClass} type="date" value={quote.date} onChange={(e) => updateQuote('date', e.target.value)} required /></label>
                <label className={labelClass}>Ciudad<input className={inputClass} value={quote.city} onChange={(e) => updateQuote('city', e.target.value)} maxLength={100} /></label>
                <label className={labelClass}>Teléfono<input className={inputClass} type="tel" value={quote.phone} onChange={(e) => updateQuote('phone', e.target.value)} maxLength={40} /></label>
                <label className={labelClass}>Email<input className={inputClass} type="email" value={quote.email} onChange={(e) => updateQuote('email', e.target.value)} maxLength={160} /></label>
                <label className={`${labelClass} sm:col-span-2`}>Dirección<input className={inputClass} value={quote.address} onChange={(e) => updateQuote('address', e.target.value)} maxLength={200} /></label>
              </div>
            </section>

            <section aria-labelledby="concepts-heading">
              <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 id="concepts-heading" className="text-sm font-bold text-white">Conceptos</h2>
                <button type="button" onClick={addConcept} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-300">
                  <Plus className="h-4 w-4" /> Agregar concepto
                </button>
              </div>
              <div className="space-y-5">
                {quote.concepts.map((concept, index) => (
                  <div key={concept.id} className="border-b border-zinc-800 pb-5 last:border-0">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400">Concepto {index + 1}</span>
                      <button type="button" onClick={() => removeConcept(concept.id)} disabled={quote.concepts.length === 1} className="rounded p-1.5 text-zinc-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Eliminar concepto ${index + 1}`} title="Eliminar concepto">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-6">
                      <label className={`${labelClass} sm:col-span-1`}>Código<input className={inputClass} value={concept.code} onChange={(e) => updateConcept(concept.id, 'code', e.target.value)} required maxLength={30} /></label>
                      <label className={`${labelClass} sm:col-span-3`}>Descripción<input className={inputClass} value={concept.description} onChange={(e) => updateConcept(concept.id, 'description', e.target.value)} required maxLength={220} /></label>
                      <label className={`${labelClass} sm:col-span-1`}>Cantidad<input className={inputClass} type="number" min="0.001" step="0.001" value={concept.quantity} onChange={(e) => updateConcept(concept.id, 'quantity', e.target.value)} required /></label>
                      <label className={`${labelClass} sm:col-span-1`}>Unidad<input className={inputClass} value={concept.unit} onChange={(e) => updateConcept(concept.id, 'unit', e.target.value)} required maxLength={24} /></label>
                      <label className={`${labelClass} sm:col-span-2`}>Precio unitario (MXN)<input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" value={concept.unitPrice} onChange={(e) => updateConcept(concept.id, 'unitPrice', e.target.value)} required /></label>
                      <div className="sm:col-span-2"><p className={labelClass}>Total del concepto</p><p className="mt-3 font-mono text-sm text-zinc-200">{formatCurrency(totals.lineTotalsCents[index] ?? 0)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="adjustments-heading">
              <h2 id="adjustments-heading" className="mb-4 border-b border-zinc-800 pb-3 text-sm font-bold text-white">Ajustes y observaciones</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <span className={labelClass}>Descuento opcional</span>
                  <div className="mt-1.5 flex gap-2">
                    <div className="inline-flex shrink-0 rounded-md border border-zinc-700 p-1" role="group" aria-label="Tipo de descuento">
                      <button type="button" onClick={() => updateQuote('discountMode', 'percentage')} aria-pressed={quote.discountMode === 'percentage'} className={`rounded px-3 py-1.5 text-xs font-semibold ${quote.discountMode === 'percentage' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>%</button>
                      <button type="button" onClick={() => updateQuote('discountMode', 'amount')} aria-pressed={quote.discountMode === 'amount'} className={`rounded px-3 py-1.5 text-xs font-semibold ${quote.discountMode === 'amount' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>MXN</button>
                    </div>
                    <input className={`${inputClass} mt-0`} type="number" min="0" max={quote.discountMode === 'percentage' ? '100' : undefined} step="0.01" inputMode="decimal" value={quote.discountValue} onChange={(e) => updateQuote('discountValue', e.target.value)} aria-label={quote.discountMode === 'percentage' ? 'Descuento porcentual' : 'Descuento en pesos'} placeholder="0" />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">Se aplica antes del IVA y no puede superar el subtotal.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-3 self-start rounded-md border border-zinc-800 px-4 py-3.5 text-sm text-zinc-300">
                  <input type="checkbox" checked={quote.ivaEnabled} onChange={(e) => updateQuote('ivaEnabled', e.target.checked)} className="h-4 w-4 accent-amber-400" />
                  <span>Aplicar IVA <strong className="font-semibold text-white">16%</strong></span>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>Observaciones<textarea className={`${inputClass} min-h-24 resize-y`} value={quote.observations} onChange={(e) => updateQuote('observations', e.target.value)} maxLength={1000} /></label>
              </div>
            </section>
          </div>

          <aside className="border-t border-zinc-800 pt-5 lg:sticky lg:top-24 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="Resumen de cotización">
            <h2 className="text-sm font-bold text-white">Resumen</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-zinc-400"><span>Subtotal</span><span className="font-mono text-zinc-200">{formatCurrency(totals.subtotalCents)}</span></div>
              <div className="flex justify-between gap-4 text-zinc-400"><span>Descuento</span><span className="font-mono text-zinc-200">-{formatCurrency(totals.discountCents)}</span></div>
              {quote.ivaEnabled && <div className="flex justify-between gap-4 text-zinc-400"><span>IVA (16%)</span><span className="font-mono text-zinc-200">{formatCurrency(totals.ivaCents)}</span></div>}
              <div className="flex justify-between gap-4 border-t border-amber-400/50 pt-4 text-base font-bold text-white"><span>Total</span><span className="font-mono text-amber-300">{formatCurrency(totals.totalCents)}</span></div>
            </div>
            {pdfError && <p role="alert" className="mt-5 text-sm text-red-400">{pdfError}</p>}
            <button type="submit" disabled={isGenerating} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60">
              <FileDown className="h-4 w-4" />
              {isGenerating ? 'Generando PDF...' : 'Generar y descargar PDF'}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">El documento se genera en este navegador. Los datos no se guardan ni se envían.</p>
          </aside>
        </form>
      </div>
    </main>
  );
};