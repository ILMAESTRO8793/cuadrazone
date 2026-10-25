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
      "Productos físicos: 5% de comisión por venta entregada (sin el envío). Servicios: sin comisión",
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
      "Espacios superiores destacados por categoría, con rotación",
      "Ubicación identificada como Destacado — ubicación de pago",
      "Cuatro emblemas solo con acreditación y autorización institucional",
    ],
  },
} as const;
export const PLAN_CATALOG_VERSION = "2026-10-10-v1";
export function getSellerPlan(id: SellerPlanId) {
  return SELLER_PLANS[id];
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
 * Modelo de cobro (22 de octubre de 2026):
 * - Prueba: los primeros 3 meses desde la aprobación no pagan mensualidad y la
 *   comisión es de 8% por venta entregada.
 * - Después: mensualidad del plan y comisión de 5% por venta entregada.
 * La comisión aplica solo a la venta de productos físicos; los servicios (clases,
 * cursos, trabajos a domicilio, consultas) no pagan comisión, solo la mensualidad
 * (decisión del 23/10/2026). Se calcula solo sobre los productos (sin envío) y queda fijada
 * al crear el pedido, aunque se entregue cuando ya cambió la tasa.
 */
export const TRIAL_PLAN_ID = "prueba";
export const TRIAL_MONTHS = 3;
export const TRIAL_COMMISSION_BPS = 800;
export const PAID_COMMISSION_BPS = 500;

/**
 * Tasa en puntos básicos (800 = 8%) según la fecha: 8% mientras dure la prueba
 * gratuita, 5% después. Depende de la fecha y no del pago, para que pagar la
 * mensualidad por adelantado no baje la comisión de los meses gratis.
 */
export function commissionBpsAt(trialEndsAt: Date | string | null | undefined, now: Date = new Date()): number {
  if (!trialEndsAt) return PAID_COMMISSION_BPS;
  const end = new Date(trialEndsAt);
  return !Number.isNaN(end.getTime()) && now < end ? TRIAL_COMMISSION_BPS : PAID_COMMISSION_BPS;
}

export function isInTrial(trialEndsAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  return commissionBpsAt(trialEndsAt, now) === TRIAL_COMMISSION_BPS;
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
