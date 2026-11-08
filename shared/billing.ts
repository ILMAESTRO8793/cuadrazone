/*
 * Cobro de la plataforma a los vendedores: mensualidad del plan y comisión por
 * venta. Aquí vive la lógica pura (sin base de datos) que comparten el servidor,
 * el panel del vendedor y las pruebas.
 *
 * Comisión mensual con plazo (decisión del 07/11/2026):
 *   - La comisión de los pedidos entregados en un mes se cobra al cerrar ese mes.
 *   - El día 1 del mes siguiente se envía el estado de cuenta.
 *   - A los 7 días, si sigue sin pagarse, un recordatorio.
 *   - A los 15 días, la tienda se oculta hasta que se pague.
 * Los meses se cuentan en hora de Panamá (UTC−5, sin horario de verano).
 */
import { z } from "zod";
import { sellerPlanIds } from "./pricing";

/** Formas en que el vendedor le paga a CuadraZone desde su panel. */
export const PLATFORM_PAYMENT_METHODS = [
  "yappy",
  "transferencia",
  "tarjeta",
] as const;
export type PlatformPaymentMethod = (typeof PLATFORM_PAYMENT_METHODS)[number];
export const platformMethodLabels: Record<PlatformPaymentMethod, string> = {
  yappy: "Yappy",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta de crédito o débito",
};

/** Qué cubre un aviso de pago: la mensualidad, la comisión o las dos. */
export const PAYMENT_CONCEPTS = ["subscription", "commission", "both"] as const;
export type PaymentConcept = (typeof PAYMENT_CONCEPTS)[number];
export const conceptLabels: Record<PaymentConcept, string> = {
  subscription: "Mensualidad",
  commission: "Comisión",
  both: "Mensualidad y comisión",
};

export const CLAIM_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const COMMISSION_REMIND_DAYS = 7;
export const COMMISSION_GRACE_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Primer instante (en UTC) del mes de Panamá en que cae `date`. */
export function panamaMonthStart(date: Date): Date {
  const local = new Date(date.getTime() - PANAMA_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + PANAMA_OFFSET_MS
  );
}

/** Primer instante del mes de Panamá siguiente al de `date`. */
export function nextPanamaMonthStart(date: Date): Date {
  const local = new Date(date.getTime() - PANAMA_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) +
      PANAMA_OFFSET_MS
  );
}

/** «2026-10» del mes de Panamá de una fecha (sirve de clave para no repetir avisos). */
export function panamaMonthKey(date: Date): string {
  const local = new Date(date.getTime() - PANAMA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type CommissionStage = "accruing" | "due" | "reminder" | "overdue";

/**
 * Plazo de la comisión más antigua sin pagar, a partir de la fecha de entrega de
 * ese pedido:
 *   - accruing: el mes todavía no cerró; se sigue acumulando.
 *   - due:      el mes cerró; hay que pagar (se envía el estado de cuenta).
 *   - reminder: pasaron 7 días sin pagar (se envía un recordatorio).
 *   - overdue:  pasaron 15 días; la tienda se oculta.
 */
export function commissionDeadline(oldestUnpaidDeliveredAt: Date, now: Date) {
  const dueStart = nextPanamaMonthStart(oldestUnpaidDeliveredAt);
  const remindAt = new Date(
    dueStart.getTime() + COMMISSION_REMIND_DAYS * DAY_MS
  );
  const suspendAt = new Date(
    dueStart.getTime() + COMMISSION_GRACE_DAYS * DAY_MS
  );
  const stage: CommissionStage =
    now < dueStart
      ? "accruing"
      : now < remindAt
        ? "due"
        : now < suspendAt
          ? "reminder"
          : "overdue";
  return {
    stage,
    dueStart,
    remindAt,
    suspendAt,
    monthKey: panamaMonthKey(oldestUnpaidDeliveredAt),
  };
}

/**
 * Separa la comisión pendiente en la que ya hay que pagar (meses cerrados) y la
 * del mes en curso, que todavía se está acumulando.
 */
export function splitCommission(
  orders: ReadonlyArray<{
    commissionCents: number;
    deliveredAt: Date | string | null;
  }>,
  now: Date
) {
  const monthStart = panamaMonthStart(now);
  let dueCents = 0;
  let dueCount = 0;
  let accruingCents = 0;
  let oldestDue: Date | null = null;
  for (const order of orders) {
    const delivered = order.deliveredAt ? new Date(order.deliveredAt) : null;
    if (delivered && delivered < monthStart) {
      dueCents += order.commissionCents;
      dueCount += 1;
      if (!oldestDue || delivered < oldestDue) oldestDue = delivered;
    } else {
      accruingCents += order.commissionCents;
    }
  }
  return {
    dueCents,
    dueCount,
    accruingCents,
    cutoff: monthStart,
    deadline: oldestDue ? commissionDeadline(oldestDue, now) : null,
  };
}

/** Lo que el vendedor envía al pulsar «Ya pagué» (el comprobante va aparte, como archivo). */
export const paymentClaimInput = z
  .object({
    concept: z.enum(PAYMENT_CONCEPTS),
    planId: z.enum(sellerPlanIds).optional(),
    months: z.number().int().min(1).max(12).optional(),
    method: z.enum(PLATFORM_PAYMENT_METHODS),
    reference: z
      .string()
      .trim()
      .min(3, "Escribe el número de comprobante o referencia")
      .max(120),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de pago no válida"),
    note: z.string().trim().max(500).default(""),
  })
  .strict()
  .refine(
    value => value.concept === "commission" || (value.planId && value.months),
    {
      message: "Elige el plan y cuántos meses pagas",
      path: ["months"],
    }
  );
export type PaymentClaimInput = z.infer<typeof paymentClaimInput>;

/** Datos de pago de CuadraZone que ve el vendedor. Solo aparece lo configurado. */
export type PlatformPaymentDetails = {
  yappy: { number: string; name: string | null } | null;
  bank: {
    bank: string;
    accountType: string | null;
    account: string;
    holder: string;
  } | null;
  cardUrl: string | null;
  whatsapp: string | null;
};
