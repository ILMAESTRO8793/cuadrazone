import { z } from "zod";

export const sellerPlanIds = ["normal", "mayor_visibilidad"] as const;
export type SellerPlanId = (typeof sellerPlanIds)[number];
export const sellerPlanIdInput = z.enum(sellerPlanIds);
export const SELLER_PLANS = {
  normal: {
    id: "normal",
    name: "Normal",
    monthlyCents: 1999,
    description: "Tu negocio conectado con la comunidad.",
    benefits: [
      "Tienda y directorio por categorías y especialidades",
      "Productos y libros con inventario y pedidos",
      "Productos físicos: 10% de comisión por venta entregada. Servicios: sin comisión",
      "Envío gratis cuando tú y el comprador están en la misma provincia",
      "Sin prioridad comercial de pago",
    ],
  },
  mayor_visibilidad: {
    id: "mayor_visibilidad",
    name: "Mayor Visibilidad",
    monthlyCents: 3999,
    description: "Una opción para dar más exposición a tu negocio.",
    benefits: [
      "Todos los beneficios del plan Normal",
      "Comisión más baja: 5% por venta entregada",
      "Espacios superiores destacados por categoría, con rotación",
      "Ubicación identificada como Destacado — ubicación de pago",
      "La estrella roja «Tienda Destacada»: los compradores ven tu tienda con mayor credibilidad",
      "Tu marca: insignia «Tienda Destacada», foto de portada, lema y color propio en tu tienda",
    ],
  },
} as const;
export const PLAN_CATALOG_VERSION = "2026-10-10-v1";
export function getSellerPlan(id: SellerPlanId) {
  return SELLER_PLANS[id];
}
/** Pagar el año completo (12 meses) tiene 10 % de descuento. */
export const ANNUAL_DISCOUNT_PCT = 10;
export const ANNUAL_MONTHS = 12;

/** Lo que cuesta pagar `months` meses de un plan; 12 meses llevan el descuento anual. */
export function planAmountCents(id: SellerPlanId, months: number): number {
  const full = getSellerPlan(id).monthlyCents * months;
  return months === ANNUAL_MONTHS
    ? Math.round((full * (100 - ANNUAL_DISCOUNT_PCT)) / 100)
    : full;
}

/** Precio anual con descuento, p. ej. «US$215.89». */
export function sellerPlanAnnualLabel(id: SellerPlanId) {
  return `US$${(planAmountCents(id, ANNUAL_MONTHS) / 100).toFixed(2)}`;
}

export function sellerPlanLabel(id: SellerPlanId) {
  return `US$${(getSellerPlan(id).monthlyCents / 100).toFixed(2)}`;
}
export type PlanSelectionSnapshot = {
  planId: SellerPlanId;
  catalogVersion: string;
  revision: number;
  updatedAt: string;
};
export const selectSellerPlanInput = z
  .object({
    planId: sellerPlanIdInput,
    catalogVersion: z.literal(PLAN_CATALOG_VERSION),
    expectedRevision: z.number().int().nonnegative(),
    acknowledgePending: z.literal(true),
  })
  .strict();
export type SelectSellerPlanInput = z.infer<typeof selectSellerPlanInput>;

/** Compatibilidad: estas constantes siempre representan el plan Normal. */
export const SELLER_MONTHLY_FEE_CENTS = SELLER_PLANS.normal.monthlyCents;
export const SELLER_MONTHLY_FEE_USD = (SELLER_MONTHLY_FEE_CENTS / 100).toFixed(
  2
);
export const SELLER_MONTHLY_FEE_LABEL = `USD ${SELLER_MONTHLY_FEE_USD}`;
export const SELLER_MONTHLY_FEE_SHORT_LABEL = `$${SELLER_MONTHLY_FEE_USD}`;
export const PLAN_ACTIVATION_NOTICE =
  "Elegir un plan no cobra nada. Los primeros 3 meses son gratis; después se paga la mensualidad del plan elegido.";

/*
 * Modelo de cobro (12 de noviembre de 2026):
 * - Prueba: los primeros 3 meses desde la aprobación no pagan mensualidad ni
 *   comisión.
 * - Después: mensualidad del plan y comisión por venta entregada: 10% con el
 *   plan Normal, 5% con Mayor Visibilidad.
 * La comisión aplica solo a la venta de productos físicos; los servicios (clases,
 * cursos, trabajos a domicilio, consultas) no pagan comisión, solo la mensualidad
 * (decisión del 23/10/2026). Se calcula solo sobre los productos (sin envío) y queda fijada
 * al crear el pedido, aunque se entregue cuando ya cambió la tasa.
 */
export const TRIAL_PLAN_ID = "prueba";
export const TRIAL_MONTHS = 3;
export const TRIAL_COMMISSION_BPS = 0;
export const NORMAL_COMMISSION_BPS = 1000;
export const FEATURED_COMMISSION_BPS = 500;
/** Compatibilidad: la comisión del plan Normal. */
export const PAID_COMMISSION_BPS = NORMAL_COMMISSION_BPS;

export function isInTrial(trialEndsAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!trialEndsAt) return false;
  const end = new Date(trialEndsAt);
  return !Number.isNaN(end.getTime()) && now < end;
}

/** Comisión del plan, sin contar la prueba: 5% Mayor Visibilidad, 10% Normal. */
export function planCommissionBps(planId: string | null | undefined): number {
  return planId === "mayor_visibilidad" ? FEATURED_COMMISSION_BPS : NORMAL_COMMISSION_BPS;
}

/**
 * Tasa en puntos básicos (1000 = 10%): 0 durante la prueba gratuita; después,
 * la del plan. La prueba depende de la fecha y no del pago.
 */
export function commissionBpsFor(
  planId: string | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (isInTrial(trialEndsAt, now) || planId === TRIAL_PLAN_ID) return TRIAL_COMMISSION_BPS;
  return planCommissionBps(planId);
}

/** Comisión en centavos sobre el subtotal de productos, redondeada al centavo. */
export function commissionCents(subtotalCents: number, bps: number): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new Error("Subtotal inválido");
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error("Tasa inválida");
  return Math.round((subtotalCents * bps) / 10_000);
}

export function commissionPercentLabel(bps: number) {
  return `${(bps / 100).toLocaleString("es-PA", { maximumFractionDigits: 2 })}%`;
}

/** Nombre visible de un plan vigente, incluida la prueba gratuita. */
export function subscriptionPlanName(planId: string | null | undefined): string {
  if (planId === TRIAL_PLAN_ID) return `Prueba gratis (${TRIAL_MONTHS} meses)`;
  if (planId && (sellerPlanIds as readonly string[]).includes(planId)) return getSellerPlan(planId as SellerPlanId).name;
  return "Sin plan";
}
