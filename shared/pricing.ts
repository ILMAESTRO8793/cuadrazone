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
      "0% de comisión propia de CuadraZone",
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
  "Sin cobros activos. Guardar la selección no contrata ni activa una suscripción, prioridad o emblemas.";
