export type DiscountMode = 'amount' | 'percentage';

export interface QuoteConceptDraft {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export interface QuoteDraft {
  folio: string;
  date: string;
  client: string;
  contact: string;
  city: string;
  phone: string;
  address: string;
  email: string;
  concepts: QuoteConceptDraft[];
  discountMode: DiscountMode;
  discountValue: string;
  ivaEnabled: boolean;
  observations: string;
}

export interface QuoteTotals {
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  taxableBaseCents: number;
  ivaCents: number;
  totalCents: number;
}