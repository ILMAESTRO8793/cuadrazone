import { z } from "zod";

/** Service Pub: publicidad personalizada aparte del plan. */
export const SERVICE_PUB_MONTHLY_CENTS = 1000;
export const SERVICE_PUB_NAME = "Service Pub";

export const servicePubStatuses = ["requested", "active", "cancelled"] as const;
export type ServicePubStatus = (typeof servicePubStatuses)[number];
export const servicePubStatusLabels: Record<
  ServicePubStatus | "expired",
  string
> = {
  requested: "Pedido · falta el pago",
  active: "Activo",
  cancelled: "Cancelado",
  expired: "Venció · falta renovar",
};

export const requestServicePubInput = z
  .object({
    message: z
      .string()
      .trim()
      .min(5, "Cuéntanos qué quieres promocionar")
      .max(500),
  })
  .strict();

export const recordServicePubPaymentInput = z
  .object({
    userId: z.number().int().positive(),
    months: z.number().int().min(1).max(12),
    method: z.enum(["yappy", "transferencia", "tarjeta", "efectivo", "otro"]),
    reference: z.string().trim().max(120).default(""),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type RecordServicePubPaymentInput = z.infer<
  typeof recordServicePubPaymentInput
>;

/** Nuevo vencimiento: se suma desde el vencimiento vigente o desde hoy si ya venció. */
export function extendServicePub(
  activeUntil: Date | null,
  months: number,
  now = new Date()
): Date {
  const base =
    activeUntil && activeUntil > now ? new Date(activeUntil) : new Date(now);
  const day = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate();
  base.setUTCDate(Math.min(day, last));
  return base;
}

/** Estado que se muestra: un «activo» con fecha pasada cuenta como vencido. */
export function servicePubDisplayStatus(
  status: string,
  activeUntil: Date | string | null,
  now = new Date()
) {
  if (status === "active" && activeUntil && new Date(activeUntil) <= now)
    return "expired" as const;
  return (servicePubStatuses as readonly string[]).includes(status)
    ? (status as ServicePubStatus)
    : "requested";
}
