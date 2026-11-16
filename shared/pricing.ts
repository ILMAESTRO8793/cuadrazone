import { z } from "zod";

/*
 * Planes de CuadraZone (16 de noviembre de 2026). Todo es mensual y depende de
 * cuántas publicaciones tiene activas cada cuenta:
 *
 * Comercios
 *   - Pymes: Normal US$19.99 y Mayor Visibilidad US$39.99, hasta 99 productos.
 *   - Empresas medianas US$79.99: de 100 a 300 productos.
 *   - Grandes empresas US$159.99: más de 300 productos.
 *   Medianas y grandes tienen las 5 estrellas desde que se registran.
 * Servicios: el plan de US$19.99 publica hasta 20 servicios; el de US$39.99, sin
 *   límite.
 * Restaurantes (platos del menú), Bienes raíces (inmuebles), Autos (vehículos)
 *   y Empleos (vacantes): hasta 20 por US$49.99, de 21 a 100 por US$79.99 y más
 *   de 100 por US$159.99.
 * Comisión por venta entregada, solo en comercios y restaurantes: 10% (pyme
 *   Normal y restaurante básico), 5% (Mayor Visibilidad, mediana y restaurante
 *   de 21 a 100) y 3% (grande y restaurante de más de 100). Servicios, bienes
 *   raíces, autos y empleos no pagan comisión.
 */
export const sellerPlanIds = [
  "normal",
  "mayor_visibilidad",
  "mediana",
  "grande",
  "rest_basico",
  "rest_medio",
  "rest_grande",
] as const;
export type SellerPlanId = (typeof sellerPlanIds)[number];
export const sellerPlanIdInput = z.enum(sellerPlanIds);

/** Para quién es cada plan de tienda. */
export type SellerPlanKind = "pyme" | "empresa" | "restaurante";

export type SellerPlan = {
  id: SellerPlanId;
  kind: SellerPlanKind;
  name: string;
  monthlyCents: number;
  /** Productos publicados a la vez; null = sin límite. */
  productLimit: number | null;
  /** Servicios publicados a la vez; null = sin límite. */
  serviceLimit: number | null;
  /** Platos del menú (solo restaurantes); null = sin límite. */
  dishLimit: number | null;
  /** Comisión por venta entregada, en puntos básicos (1000 = 10%). */
  commissionBps: number;
  /** Las 5 estrellas de verificación y los espacios «Destacados». */
  featured: boolean;
  description: string;
  benefits: readonly string[];
};

export const PYME_PRODUCT_LIMIT = 99;
export const MEDIANA_PRODUCT_LIMIT = 300;
export const NORMAL_SERVICE_LIMIT = 20;
export const TIER_LIMITS = { basico: 20, medio: 100 } as const;

export const SELLER_PLANS: Record<SellerPlanId, SellerPlan> = {
  normal: {
    id: "normal",
    kind: "pyme",
    name: "Normal",
    monthlyCents: 1999,
    productLimit: PYME_PRODUCT_LIMIT,
    serviceLimit: NORMAL_SERVICE_LIMIT,
    dishLimit: null,
    commissionBps: 1000,
    featured: false,
    description: "Para pymes: tu negocio conectado con la comunidad.",
    benefits: [
      "Hasta 99 productos publicados",
      "Tienda y directorio por categorías y especialidades",
      "Productos y libros con inventario y pedidos",
      "Productos físicos: 10% de comisión por venta entregada",
      "Envío gratis cuando tú y el comprador están en la misma provincia",
      "Sin prioridad comercial de pago",
    ],
  },
  mayor_visibilidad: {
    id: "mayor_visibilidad",
    kind: "pyme",
    name: "Mayor Visibilidad",
    monthlyCents: 3999,
    productLimit: PYME_PRODUCT_LIMIT,
    serviceLimit: null,
    dishLimit: null,
    commissionBps: 500,
    featured: true,
    description: "Para pymes: más exposición para tu negocio.",
    benefits: [
      "Todos los beneficios del plan Normal",
      "Hasta 99 productos publicados",
      "Comisión más baja: 5% por venta entregada",
      "Espacios superiores destacados por categoría, con rotación",
      "Ubicación identificada como Destacado — ubicación de pago",
      "Las cinco estrellas de verificación desde el primer día: los compradores ven tu tienda con mayor credibilidad",
      "Tu marca: insignia «Tienda Destacada», foto de portada, lema y color propio en tu tienda",
    ],
  },
  mediana: {
    id: "mediana",
    kind: "empresa",
    name: "Empresa mediana",
    monthlyCents: 7999,
    productLimit: MEDIANA_PRODUCT_LIMIT,
    serviceLimit: null,
    dishLimit: null,
    commissionBps: 500,
    featured: true,
    description: "Para empresas con un catálogo de 100 a 300 productos.",
    benefits: [
      "De 100 a 300 productos publicados",
      "Las cinco estrellas de verificación desde que te registras",
      "Comisión de 5% por venta entregada",
      "Espacios «Destacados» y tu marca en la tienda, como Mayor Visibilidad",
    ],
  },
  grande: {
    id: "grande",
    kind: "empresa",
    name: "Gran empresa",
    monthlyCents: 15999,
    productLimit: null,
    serviceLimit: null,
    dishLimit: null,
    commissionBps: 300,
    featured: true,
    description: "Para grandes empresas con más de 300 productos.",
    benefits: [
      "Más de 300 productos publicados, sin límite",
      "Las cinco estrellas de verificación desde que te registras",
      "La comisión más baja: 3% por venta entregada",
      "Espacios «Destacados» y tu marca en la tienda, como Mayor Visibilidad",
    ],
  },
  rest_basico: {
    id: "rest_basico",
    kind: "restaurante",
    name: "Pyme",
    monthlyCents: 4999,
    productLimit: 0,
    serviceLimit: 0,
    dishLimit: TIER_LIMITS.basico,
    commissionBps: 1000,
    featured: false,
    description: "Para restaurantes pequeños: un menú de hasta 20 platos.",
    benefits: [
      "Hasta 20 platos en tu menú",
      "Pedidos a domicilio",
      "10% de comisión por pedido entregado",
    ],
  },
  rest_medio: {
    id: "rest_medio",
    kind: "restaurante",
    name: "Mediana empresa",
    monthlyCents: 7999,
    productLimit: 0,
    serviceLimit: 0,
    dishLimit: TIER_LIMITS.medio,
    commissionBps: 500,
    featured: false,
    description: "Para restaurantes medianos: un menú de 21 a 100 platos.",
    benefits: [
      "De 21 a 100 platos en tu menú",
      "Pedidos a domicilio",
      "5% de comisión por pedido entregado",
    ],
  },
  rest_grande: {
    id: "rest_grande",
    kind: "restaurante",
    name: "Gran empresa",
    monthlyCents: 15999,
    productLimit: 0,
    serviceLimit: 0,
    dishLimit: null,
    commissionBps: 300,
    featured: false,
    description:
      "Para cadenas grandes de comida rápida: un menú de más de 100 platos.",
    benefits: [
      "Más de 100 platos en tu menú, sin límite",
      "Pedidos a domicilio",
      "3% de comisión por pedido entregado",
    ],
  },
};
/** Beneficios de los planes cuando la tienda es de servicios. */
export const SERVICE_PLAN_BENEFITS: Partial<Record<SellerPlanId, readonly string[]>> = {
  normal: [
    "Hasta 20 servicios publicados",
    "Tienda y directorio por categorías y especialidades",
    "Solicitudes y agenda de citas con tus clientes",
    "Sin comisión: solo la mensualidad",
    "Sin prioridad comercial de pago",
  ],
  mayor_visibilidad: [
    "Servicios publicados sin límite",
    "Espacios superiores destacados por categoría, con rotación",
    "Ubicación identificada como Destacado — ubicación de pago",
    "Las cinco estrellas de verificación desde el primer día",
    "Tu marca: insignia «Tienda Destacada», foto de portada, lema y color propio en tu tienda",
    "Sin comisión: solo la mensualidad",
  ],
};
export const PLAN_CATALOG_VERSION = "2026-11-16-v2";
export function getSellerPlan(id: SellerPlanId): SellerPlan {
  return SELLER_PLANS[id];
}
export function isSellerPlanId(
  id: string | null | undefined
): id is SellerPlanId {
  return Boolean(id) && (sellerPlanIds as readonly string[]).includes(id!);
}
/** Planes que se ofrecen a cada tipo de tienda. */
export function plansForStoreKind(
  kind: string | null | undefined
): SellerPlanId[] {
  if (kind === "restaurante")
    return ["rest_basico", "rest_medio", "rest_grande"];
  if (kind === "servicios") return ["normal", "mayor_visibilidad"];
  return ["normal", "mayor_visibilidad", "mediana", "grande"];
}
/** ¿Este plan da las 5 estrellas y los espacios «Destacados»? */
export function isFeaturedPlan(id: string | null | undefined): boolean {
  return isSellerPlanId(id) && SELLER_PLANS[id].featured;
}
/** Planes con las 5 estrellas y «Destacados» (para filtrar en la base de datos). */
export const FEATURED_PLAN_IDS: SellerPlanId[] = sellerPlanIds.filter(
  id => SELLER_PLANS[id].featured
);

/*
 * Planes de anuncios: Bienes raíces, Autos y Empleos. Cada sección se paga por
 * separado, según cuántos anuncios publicados tiene la cuenta en esa sección.
 * No pagan comisión.
 */
export const listingSections = ["inmuebles", "autos", "empleos"] as const;
export type ListingSection = (typeof listingSections)[number];
export const listingSectionLabels: Record<ListingSection, string> = {
  inmuebles: "Bienes raíces",
  autos: "Autos",
  empleos: "Empleos",
};
export const listingUnits: Record<ListingSection, string> = {
  inmuebles: "inmuebles",
  autos: "vehículos",
  empleos: "vacantes",
};
export const listingPlanIds = ["basico", "medio", "grande"] as const;
export type ListingPlanId = (typeof listingPlanIds)[number];
export const LISTING_PLANS: Record<
  ListingPlanId,
  {
    id: ListingPlanId;
    name: string;
    monthlyCents: number;
    limit: number | null;
    range: string;
  }
> = {
  basico: {
    id: "basico",
    name: "Básico",
    monthlyCents: 4999,
    limit: TIER_LIMITS.basico,
    range: "Hasta 20",
  },
  medio: {
    id: "medio",
    name: "Mediano",
    monthlyCents: 7999,
    limit: TIER_LIMITS.medio,
    range: "De 21 a 100",
  },
  grande: {
    id: "grande",
    name: "Grande",
    monthlyCents: 15999,
    limit: null,
    range: "Más de 100",
  },
};
export function isListingPlanId(
  id: string | null | undefined
): id is ListingPlanId {
  return Boolean(id) && (listingPlanIds as readonly string[]).includes(id!);
}
/** Anuncios que permite el plan de una sección; la prueba gratis es como el Básico. */
export function listingLimitFor(
  planId: string | null | undefined
): number | null {
  return isListingPlanId(planId)
    ? LISTING_PLANS[planId].limit
    : LISTING_PLANS.basico.limit;
}
export function listingPlanName(planId: string | null | undefined): string {
  if (planId === TRIAL_PLAN_ID) return "Mes gratis";
  return isListingPlanId(planId) ? LISTING_PLANS[planId].name : "Sin plan";
}
export function moneyLabel(cents: number) {
  return `US$${(cents / 100).toFixed(2)}`;
}

/**
 * Límite de publicaciones de una tienda según su plan. Durante el mes gratis
 * vale el plan que eligió (o el más básico de su tipo si no eligió ninguno).
 */
export function storeLimits(
  planId: string | null | undefined,
  storeKind: string | null | undefined
): {
  productLimit: number | null;
  serviceLimit: number | null;
  dishLimit: number | null;
} {
  const plan = isSellerPlanId(planId)
    ? SELLER_PLANS[planId]
    : SELLER_PLANS[plansForStoreKind(storeKind)[0]];
  return {
    productLimit: plan.productLimit,
    serviceLimit: plan.serviceLimit,
    dishLimit: plan.dishLimit,
  };
}

/** Mensaje cuando ya se llegó al tope del plan. */
export function limitReachedMessage(limit: number, what: string) {
  return `Tu plan permite hasta ${limit} ${what} publicados. Para publicar más, sube de plan: escríbenos y lo activamos.`;
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
  "Elegir un plan no cobra nada. Si te registras antes de enero de 2027, no pagas nada hasta el 1 de febrero de 2027; desde enero, el primer mes es gratis. Después se paga la mensualidad del plan elegido.";

/*
 * Mes gratis (16 de noviembre de 2026):
 * - CuadraZone empieza a operar en enero de 2027. Quien se registra en
 *   noviembre o diciembre de 2026 no paga nada hasta el 1 de febrero de 2027
 *   (enero es su mes gratis).
 * - Desde el 1 de enero de 2027, cada cuenta nueva tiene 1 mes gratis.
 * - Durante el mes gratis no se paga mensualidad ni comisión.
 * - Después: mensualidad del plan y, solo en comercios y restaurantes,
 *   comisión por venta entregada (ver cada plan).
 * La comisión se calcula solo sobre los productos (sin envío) y queda fijada al
 * crear el pedido, aunque se entregue cuando ya cambió la tasa.
 */
export const TRIAL_PLAN_ID = "prueba";
export const TRIAL_MONTHS = 1;
/** Inicio de operaciones (1 de enero de 2027, medianoche en Panamá). */
export const LAUNCH_DATE = new Date("2027-01-01T05:00:00Z");
/** Primer cobro de quienes se registran antes del lanzamiento. */
export const FIRST_BILLING_DATE = new Date("2027-02-01T05:00:00Z");
export const TRIAL_COMMISSION_BPS = 0;
export const NORMAL_COMMISSION_BPS = 1000;
export const FEATURED_COMMISSION_BPS = 500;
/** Compatibilidad: la comisión del plan Normal. */
export const PAID_COMMISSION_BPS = NORMAL_COMMISSION_BPS;

/** Suma meses de calendario; si el día no existe (31 de enero + 1), usa el último del mes. */
function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Hasta cuándo dura el mes gratis de quien empieza hoy. */
export function trialEndsFor(now: Date = new Date()): Date {
  if (now < LAUNCH_DATE) return new Date(FIRST_BILLING_DATE.getTime());
  return addCalendarMonths(now, TRIAL_MONTHS);
}

/** Texto del mes gratis para avisos y correos. */
export function trialOfferLabel(now: Date = new Date()): string {
  return now < LAUNCH_DATE
    ? "No pagas nada hasta el 1 de febrero de 2027"
    : "Tu primer mes es gratis";
}

/** Etiqueta corta para avisos: cambia sola cuando empieza la operación. */
export function trialBadgeLabel(now: Date = new Date()): string {
  return now < LAUNCH_DATE
    ? "Gratis para vendedores hasta el 1 de febrero de 2027"
    : "1 mes gratis para vendedores";
}

export function isInTrial(
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!trialEndsAt) return false;
  const end = new Date(trialEndsAt);
  return !Number.isNaN(end.getTime()) && now < end;
}

/** Comisión del plan, sin contar la prueba (10% si el plan no se reconoce). */
export function planCommissionBps(planId: string | null | undefined): number {
  return isSellerPlanId(planId)
    ? SELLER_PLANS[planId].commissionBps
    : NORMAL_COMMISSION_BPS;
}

/**
 * Tasa en puntos básicos (1000 = 10%): 0 durante el mes gratis; después,
 * la del plan. La prueba depende de la fecha y no del pago.
 */
export function commissionBpsFor(
  planId: string | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (isInTrial(trialEndsAt, now) || planId === TRIAL_PLAN_ID)
    return TRIAL_COMMISSION_BPS;
  return planCommissionBps(planId);
}

/** Comisión en centavos sobre el subtotal de productos, redondeada al centavo. */
export function commissionCents(subtotalCents: number, bps: number): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0)
    throw new Error("Subtotal inválido");
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000)
    throw new Error("Tasa inválida");
  return Math.round((subtotalCents * bps) / 10_000);
}

export function commissionPercentLabel(bps: number) {
  return `${(bps / 100).toLocaleString("es-PA", { maximumFractionDigits: 2 })}%`;
}

/** Nombre visible de un plan vigente, incluida la prueba gratuita. */
export function subscriptionPlanName(
  planId: string | null | undefined
): string {
  if (planId === TRIAL_PLAN_ID) return "Mes gratis";
  if (isSellerPlanId(planId)) return getSellerPlan(planId).name;
  return "Sin plan";
}
