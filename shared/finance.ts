/*
 * Finanzas internas de CuadraZone: gastos, impuestos de Panamá y reparto entre
 * socios. Son cálculos de referencia para el Dashboard; la declaración final la
 * revisa un contador.
 */
import { z } from "zod";

export const expenseCategories = [
  "publicidad",
  "plataforma_ia",
  "servidores",
  "software",
  "legal_contable",
  "bancos",
  "miscelaneos",
  "otro",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  publicidad: "Publicidad",
  plataforma_ia: "Plataformas de IA",
  servidores: "Servidores y base de datos",
  software: "Dominio, correo y apps",
  legal_contable: "Legal y contabilidad",
  bancos: "Comisiones bancarias",
  miscelaneos: "Misceláneos",
  otro: "Otro",
};

export const expenseInput = z
  .object({
    category: z.enum(expenseCategories),
    description: z.string().trim().min(2).max(200),
    amountCents: z.number().int().positive().max(100_000_000),
    spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type ExpenseInput = z.infer<typeof expenseInput>;

export const entityTypes = ["personas_naturales", "sociedad_anonima"] as const;
export type EntityType = (typeof entityTypes)[number];

export const financeSettingsInput = z
  .object({
    entity: z.enum(entityTypes),
    /** Porcentaje de la utilidad que se deja como flujo de caja (0–100). */
    reservePct: z.number().min(0).max(100),
    /** true si los montos cobrados ya incluyen el ITBMS (7 %). */
    itbmsIncluded: z.boolean(),
    partners: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(60),
            sharePct: z.number().min(0).max(100),
          })
          .strict()
      )
      .min(1)
      .max(6),
  })
  .strict()
  .refine(
    s => Math.abs(s.partners.reduce((a, p) => a + p.sharePct, 0) - 100) < 0.01,
    { message: "Las acciones de los socios deben sumar 100 %" }
  );
export type FinanceSettings = z.infer<typeof financeSettingsInput>;

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  entity: "personas_naturales",
  reservePct: 10,
  itbmsIncluded: false,
  partners: [
    { name: "Salem", sharePct: 50 },
    { name: "Jonatan", sharePct: 50 },
  ],
};

/** ITBMS (Impuesto de Transferencia de Bienes Muebles y Servicios). */
export const ITBMS_RATE = 0.07;
/** Ingresos brutos anuales a partir de los cuales hay que inscribirse en el ITBMS. */
export const ITBMS_THRESHOLD_CENTS = 36_000_00;
/** ISR de personas jurídicas (S.A.). */
export const CORPORATE_ISR_RATE = 0.25;
/** Impuesto sobre dividendos de acciones nominativas (fuente panameña). */
export const DIVIDEND_TAX_RATE = 0.1;

/**
 * ISR anual de una persona natural en Panamá (art. 700 del Código Fiscal):
 * hasta US$11 000 exento; de 11 000 a 50 000, 15 % del excedente; más de
 * 50 000, US$5 850 + 25 % del excedente.
 */
export function naturalPersonIsrCents(annualCents: number): number {
  const income = Math.max(0, annualCents);
  if (income <= 11_000_00) return 0;
  if (income <= 50_000_00) return Math.round((income - 11_000_00) * 0.15);
  return Math.round(5_850_00 + (income - 50_000_00) * 0.25);
}

export type PartnerResult = {
  name: string;
  sharePct: number;
  /** Lo que le toca antes de impuestos personales (su «salario»). */
  grossCents: number;
  taxCents: number;
  netCents: number;
};

export type ProfitSplit = {
  grossIncomeCents: number;
  itbmsCents: number;
  netIncomeCents: number;
  expensesCents: number;
  /** Utilidad antes de impuestos: ingreso neto − gastos. */
  profitCents: number;
  corporateIsrCents: number;
  reserveCents: number;
  distributableCents: number;
  partners: PartnerResult[];
  /** Total de impuestos estimados (ITBMS + ISR + dividendos). */
  totalTaxCents: number;
};

/**
 * Reparto de un período. `monthsInPeriod` sirve para estimar el ISR anual de
 * cada socio cuando el período es un mes (se anualiza y se prorratea).
 */
export function splitProfit(
  grossIncomeCents: number,
  expensesCents: number,
  settings: FinanceSettings,
  monthsInPeriod = 12
): ProfitSplit {
  const itbmsCents = settings.itbmsIncluded
    ? Math.round((grossIncomeCents * ITBMS_RATE) / (1 + ITBMS_RATE))
    : 0;
  const netIncomeCents = grossIncomeCents - itbmsCents;
  const profitCents = netIncomeCents - expensesCents;
  const positive = Math.max(0, profitCents);
  const corporateIsrCents =
    settings.entity === "sociedad_anonima"
      ? Math.round(positive * CORPORATE_ISR_RATE)
      : 0;
  const afterCorporate = positive - corporateIsrCents;
  const reserveCents = Math.round((afterCorporate * settings.reservePct) / 100);
  const distributableCents = afterCorporate - reserveCents;
  const factor = 12 / Math.max(1, monthsInPeriod);
  const partners = settings.partners.map(p => {
    const grossCents = Math.round((distributableCents * p.sharePct) / 100);
    const taxCents =
      settings.entity === "sociedad_anonima"
        ? Math.round(grossCents * DIVIDEND_TAX_RATE)
        : Math.round(naturalPersonIsrCents(grossCents * factor) / factor);
    return {
      name: p.name,
      sharePct: p.sharePct,
      grossCents,
      taxCents,
      netCents: grossCents - taxCents,
    };
  });
  return {
    grossIncomeCents,
    itbmsCents,
    netIncomeCents,
    expensesCents,
    profitCents,
    corporateIsrCents,
    reserveCents,
    distributableCents,
    partners,
    totalTaxCents:
      itbmsCents +
      corporateIsrCents +
      partners.reduce((a, p) => a + p.taxCents, 0),
  };
}

const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
/** «2026-11-11»: fecha de Panamá de un instante. */
export function panamaDateKey(date: Date): string {
  return new Date(date.getTime() - PANAMA_OFFSET_MS).toISOString().slice(0, 10);
}

export const revenueSources = [
  "suscripciones",
  "comisiones",
  "anuncios",
] as const;
export type RevenueSource = (typeof revenueSources)[number];
export const revenueSourceLabels: Record<RevenueSource, string> = {
  suscripciones: "Suscripciones",
  comisiones: "Comisiones",
  anuncios: "Planes de anunciante",
};
