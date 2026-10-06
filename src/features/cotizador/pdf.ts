import { jsPDF } from 'jspdf';
import { amountToCents, formatCurrency, formatUnitLabel } from './calculations';
import type { QuoteDraft, QuoteTotals } from './types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const AMBER: [number, number, number] = [217, 119, 6];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];

function loadBrandLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar el logo Charlitron.'));
    image.src = '/charlitron-logo.png';
  });
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(date);
}

export async function downloadQuotePdf(quote: QuoteDraft, totals: QuoteTotals): Promise<void> {
  const logo = await loadBrandLogo();
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoHeight = 21;
  const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
  let cursorY = 52;

  const drawPageHeader = () => {
    document.setFillColor(9, 9, 11);
    document.rect(0, 0, PAGE_WIDTH, 47, 'F');
    document.addImage(logo, 'PNG', MARGIN, 8, logoWidth, logoHeight);
    document.setFont('helvetica', 'bold');
    document.setFontSize(17);
    document.setTextColor(255, 255, 255);
    document.text('COTIZACIÓN', PAGE_WIDTH - MARGIN, 16, { align: 'right' });
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(212, 212, 216);
    document.text('WhatsApp: 4444 23 7092', MARGIN, 33);
    document.text('integrandotugente@hotmail.com', MARGIN, 37);
    document.setFontSize(7);
    document.setTextColor(...AMBER);
    document.text('El brazo tecnológico de Charlitron', MARGIN, 41);
    document.setDrawColor(...AMBER);
    document.setLineWidth(0.8);
    document.line(MARGIN, 46, PAGE_WIDTH - MARGIN, 46);
  };

  const addPage = () => {
    document.addPage();
    drawPageHeader();
    cursorY = 52;
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height > PAGE_HEIGHT - MARGIN) addPage();
  };

  const drawTableHeader = () => {
    const widths = [19, 62, 15, 17, 33, 36];
    const labels = ['Código', 'Descripción', 'Cant.', 'Unidad', 'P. unitario', 'Importe'];
    document.setFillColor(...INK);
    document.rect(MARGIN, cursorY, CONTENT_WIDTH, 8, 'F');
    document.setFont('helvetica', 'bold');
    document.setFontSize(7.5);
    document.setTextColor(255, 255, 255);

    let x = MARGIN;
    labels.forEach((label, index) => {
      document.text(label, x + 2, cursorY + 5.3, { maxWidth: widths[index] - 4 });
      x += widths[index];
    });
    cursorY += 8;
  };

  drawPageHeader();
  document.setFont('helvetica', 'bold');
  document.setFontSize(9);
  document.setTextColor(...INK);
  document.text(`Folio: ${quote.folio}`, MARGIN, cursorY);
  document.setFont('helvetica', 'normal');
  document.text(`Fecha: ${formatDate(quote.date)}`, PAGE_WIDTH - MARGIN, cursorY, { align: 'right' });
  cursorY += 6;
  document.setFontSize(8);
  document.text('Vigencia: 7 días naturales', MARGIN, cursorY);
  cursorY += 7;

  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.text('DATOS DEL CLIENTE', MARGIN, cursorY);
  cursorY += 5;

  const drawDetail = (label: string, value: string, x: number, y: number, width: number) => {
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.setTextColor(...MUTED);
    document.text(label.toUpperCase(), x, y);
    document.setFontSize(8.5);
    document.setTextColor(...INK);
    const lines = document.splitTextToSize(value || '-', width);
    document.text(lines, x, y + 4);
    return Math.max(lines.length, 1) * 4 + 5;
  };

  const columnGap = 8;
  const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
  let rowHeight = Math.max(
    drawDetail('Cliente', quote.client, MARGIN, cursorY, columnWidth),
    drawDetail('Contacto', quote.contact, MARGIN + columnWidth + columnGap, cursorY, columnWidth),
  );
  cursorY += rowHeight + 2;
  rowHeight = Math.max(
    drawDetail('Ciudad', quote.city, MARGIN, cursorY, columnWidth),
    drawDetail('Teléfono', quote.phone, MARGIN + columnWidth + columnGap, cursorY, columnWidth),
  );
  cursorY += rowHeight + 2;
  rowHeight = Math.max(
    drawDetail('Email', quote.email, MARGIN, cursorY, columnWidth),
    drawDetail('Dirección', quote.address, MARGIN + columnWidth + columnGap, cursorY, columnWidth),
  );
  cursorY += rowHeight + 5;

  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.setTextColor(...INK);
  document.text('CONCEPTOS', MARGIN, cursorY);
  cursorY += 4;
  drawTableHeader();

  const widths = [19, 62, 15, 17, 33, 36];
  quote.concepts.forEach((concept, index) => {
    const descriptionLines = document.splitTextToSize(concept.description || '-', widths[1] - 4);
    const rowHeightForConcept = Math.max(descriptionLines.length * 4 + 4, 9);
    if (cursorY + rowHeightForConcept > PAGE_HEIGHT - MARGIN) {
      addPage();
      drawTableHeader();
    }

    const values = [
      concept.code,
      descriptionLines,
      concept.quantity,
      formatUnitLabel(concept.unit),
      formatCurrency(amountToCents(concept.unitPrice)),
      formatCurrency(totals.lineTotalsCents[index] ?? 0),
    ];
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(...INK);
    let x = MARGIN;
    values.forEach((value, column) => {
      const text = Array.isArray(value) ? value : String(value || '-');
      document.text(text, x + 2, cursorY + 5, { maxWidth: widths[column] - 4 });
      x += widths[column];
    });
    document.setDrawColor(228, 228, 231);
    document.setLineWidth(0.2);
    document.line(MARGIN, cursorY + rowHeightForConcept, PAGE_WIDTH - MARGIN, cursorY + rowHeightForConcept);
    cursorY += rowHeightForConcept;
  });

  cursorY += 7;
  ensureSpace(42);
  const totalsX = PAGE_WIDTH - MARGIN - 65;
  const drawTotal = (label: string, value: string, emphasis = false) => {
    document.setFont('helvetica', emphasis ? 'bold' : 'normal');
    document.setFontSize(emphasis ? 11 : 8.5);
    document.setTextColor(...(emphasis ? AMBER : INK));
    document.text(label, totalsX, cursorY);
    document.text(value, PAGE_WIDTH - MARGIN, cursorY, { align: 'right' });
    cursorY += emphasis ? 7 : 5.5;
  };

  drawTotal('Subtotal', formatCurrency(totals.subtotalCents));
  drawTotal(
    quote.discountMode === 'percentage'
      ? `Descuento (${quote.discountValue || '0'}%)`
      : 'Descuento',
    totals.discountCents > 0 ? `-${formatCurrency(totals.discountCents)}` : formatCurrency(0),
  );
  if (quote.ivaEnabled) drawTotal('IVA (16%)', formatCurrency(totals.ivaCents));
  cursorY += 3;
  ensureSpace(18);
  const totalTop = cursorY;
  document.setFillColor(255, 247, 224);
  document.roundedRect(totalsX - 3, totalTop, PAGE_WIDTH - MARGIN - totalsX + 3, 15, 1.5, 1.5, 'F');
  document.setFont('helvetica', 'bold');
  document.setFontSize(11.5);
  document.setTextColor(...INK);
  document.text('TOTAL', totalsX, totalTop + 9.5);
  document.setFontSize(12.5);
  document.setTextColor(...AMBER);
  document.text(formatCurrency(totals.totalCents), PAGE_WIDTH - MARGIN, totalTop + 9.5, { align: 'right' });
  cursorY += 20;

  ensureSpace(24);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.setTextColor(...INK);
  document.text('OBSERVACIONES Y CONDICIONES', MARGIN, cursorY);
  cursorY += 5;
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(...INK);
  const closingNotes = [
    quote.observations.trim() || 'Sin observaciones adicionales.',
    'Vigencia de 7 días naturales a partir de la fecha de emisión. Precios expresados en MXN.',
  ];
  document.splitTextToSize(closingNotes.join('\n'), CONTENT_WIDTH).forEach((line: string) => {
    ensureSpace(5);
    document.text(line, MARGIN, cursorY);
    cursorY += 4.5;
  });

  document.save(`${quote.folio}.pdf`);
}