/*
 * Etapa 6 · Reclamos. El comprador reclama un pedido, el vendedor tiene 48 horas
 * para responder y un administrador decide. El pago se hizo directo al vendedor:
 * la decisión queda registrada y, si favorece al comprador, el reembolso lo hace
 * el vendedor (si no cumple, el administrador puede suspender su tienda).
 */
import { z } from "zod";

export const CLAIM_RESPONSE_HOURS = 48;
/** Días desde la compra en que se puede abrir un reclamo. */
export const CLAIM_WINDOW_DAYS = 60;

export const claimReasons = [
  "not_received",
  "damaged",
  "not_as_described",
  "wrong_item",
  "other",
] as const;
export type ClaimReason = (typeof claimReasons)[number];
export const claimReasonLabels: Record<ClaimReason, string> = {
  not_received: "No me llegó el pedido",
  damaged: "Llegó dañado o defectuoso",
  not_as_described: "No es lo que se describía",
  wrong_item: "Me enviaron otro artículo",
  other: "Otro problema",
};

export const claimStatuses = ["open", "answered", "resolved"] as const;
export type ClaimStatus = (typeof claimStatuses)[number];
export const claimStatusLabels: Record<ClaimStatus, string> = {
  open: "Esperando respuesta del vendedor",
  answered: "El vendedor respondió · lo revisa CuadraZone",
  resolved: "Resuelto",
};

export const claimResolutions = [
  "buyer_favor",
  "seller_favor",
  "agreement",
  "withdrawn",
] as const;
export type ClaimResolution = (typeof claimResolutions)[number];
export const claimResolutionLabels: Record<ClaimResolution, string> = {
  buyer_favor: "A favor del comprador",
  seller_favor: "A favor del vendedor",
  agreement: "Acuerdo entre las partes",
  withdrawn: "Retirado por el comprador",
};

/** Estados del pedido en los que se puede reclamar. */
export const claimableOrderStatuses = [
  "confirmed",
  "shipped",
  "delivered",
] as const;

export const openClaimInput = z
  .object({
    orderId: z.number().int().positive(),
    reason: z.enum(claimReasons),
    description: z
      .string()
      .trim()
      .min(20, "Cuéntanos qué pasó (al menos 20 caracteres)")
      .max(2000),
  })
  .strict();

export const respondClaimInput = z
  .object({
    claimId: z.number().int().positive(),
    response: z
      .string()
      .trim()
      .min(10, "Escribe tu respuesta (al menos 10 caracteres)")
      .max(2000),
  })
  .strict();

export const resolveClaimInput = z
  .object({
    claimId: z.number().int().positive(),
    resolution: z.enum(["buyer_favor", "seller_favor", "agreement"]),
    note: z
      .string()
      .trim()
      .min(5, "Explica la decisión (al menos 5 caracteres)")
      .max(2000),
  })
  .strict();

/** ¿Venció el plazo de 48 horas del vendedor sin respuesta? */
export function isClaimOverdue(
  claim: { status: ClaimStatus; respondBy: Date | string },
  now: Date = new Date()
) {
  return claim.status === "open" && new Date(claim.respondBy) <= now;
}

/** El administrador decide cuando el vendedor respondió o se le venció el plazo. */
export function canAdminResolve(
  claim: { status: ClaimStatus; respondBy: Date | string },
  now: Date = new Date()
) {
  return claim.status === "answered" || isClaimOverdue(claim, now);
}
