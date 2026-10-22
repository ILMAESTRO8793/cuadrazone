// Suscripciones de vendedores activadas por un administrador (etapa 5, versión manual).
// El vendedor paga por Yappy, transferencia o efectivo; el administrador registra
// el pago y la tienda queda activa hasta el fin del período. Al vencer, la tienda
// se oculta sola (sweepExpiredSubscriptions). La pasarela automática podrá
// registrar pagos por esta misma vía más adelante.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getSellerPlan, sellerPlanIds, type SellerPlanId } from "@shared/pricing";
import {
  czApplications,
  czMembershipAudit,
  czMembershipProfiles,
  czPlanSelections,
  czSubscriptionPayments,
  users,
  type User,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { pendingTotalsBySeller } from "./commissions";

export const PAYMENT_METHODS = ["yappy", "transferencia", "efectivo", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const MAX_MONTHS_PER_PAYMENT = 12;

export type RecordPaymentInput = {
  applicationId: number;
  planId: SellerPlanId;
  months: number;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  note: string;
};

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}

async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

/** Suma meses de calendario; si el día no existe (31 de enero + 1), usa el último del mes. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Período que cubre un pago nuevo: continúa desde el vencimiento vigente para no
 * perder días pagados; si ya venció o nunca se activó, empieza ahora.
 */
export function computePeriod(
  current: { status: string; endsAt: Date | null },
  now: Date,
  months: number
): { start: Date; end: Date } {
  const stillActive = current.status === "active" && current.endsAt !== null && current.endsAt > now;
  const start = stillActive ? new Date(current.endsAt!.getTime()) : new Date(now.getTime());
  return { start, end: addMonths(start, months) };
}

export function expectedAmountCents(planId: SellerPlanId, months: number) {
  return getSellerPlan(planId).monthlyCents * months;
}

/** Valida y normaliza el pago antes de tocar la base de datos. */
export function validatePaymentInput(input: RecordPaymentInput, today: Date): RecordPaymentInput {
  if (!sellerPlanIds.includes(input.planId)) fail("BAD_REQUEST", "Plan no válido");
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > MAX_MONTHS_PER_PAYMENT)
    fail("BAD_REQUEST", `Los meses deben estar entre 1 y ${MAX_MONTHS_PER_PAYMENT}`);
  const expected = expectedAmountCents(input.planId, input.months);
  if (input.amountCents !== expected)
    fail(
      "BAD_REQUEST",
      `El monto debe ser US$${(expected / 100).toFixed(2)} (${input.months} × ${getSellerPlan(input.planId).name})`
    );
  return { ...input, ...validateReceipt(input, today) };
}

/** Método, comprobante, fecha y nota de un pago recibido (mensualidad o comisión). */
export function validateReceipt(
  input: { method: PaymentMethod; reference: string; paidOn: string; note: string },
  today: Date
) {
  if (!PAYMENT_METHODS.includes(input.method)) fail("BAD_REQUEST", "Método de pago no válido");
  const reference = input.reference.trim();
  if (input.method !== "efectivo" && reference.length < 3)
    fail("BAD_REQUEST", "Anota el número de comprobante o referencia del pago");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) fail("BAD_REQUEST", "Fecha de pago no válida");
  const paidOn = new Date(`${input.paidOn}T12:00:00Z`);
  if (Number.isNaN(paidOn.getTime()) || paidOn.toISOString().slice(0, 10) !== input.paidOn)
    fail("BAD_REQUEST", "Fecha de pago no válida");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (paidOn > tomorrow) fail("BAD_REQUEST", "La fecha de pago no puede ser futura");
  if (paidOn < new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000))
    fail("BAD_REQUEST", "La fecha de pago tiene más de 120 días");
  return { method: input.method, reference, paidOn: input.paidOn, note: input.note.trim().slice(0, 500) };
}

export function isDuplicateKeyError(error: unknown) {
  return isDuplicateKey(error);
}

function isDuplicateKey(error: unknown) {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

/** Registra un pago confirmado y activa o extiende la suscripción. */
export async function adminRecordPayment(admin: User, raw: RecordPaymentInput) {
  const now = new Date();
  const input = validatePaymentInput(raw, now);
  const db = await requireDb();
  try {
    return await db.transaction(async (tx: any) => {
      const rows = await tx
        .select()
        .from(czApplications)
        .where(eq(czApplications.id, input.applicationId))
        .for("update")
        .limit(1);
      const app = rows[0];
      if (!app) fail("NOT_FOUND", "La solicitud no existe");
      if (app.status !== "approved")
        fail("PRECONDITION_FAILED", "Solo se puede activar la suscripción de un vendedor aprobado");
      const period = computePeriod({ status: app.subscriptionStatus, endsAt: app.subscriptionEndsAt }, now, input.months);
      await tx.insert(czSubscriptionPayments).values({
        applicationId: app.id,
        userId: app.userId,
        planId: input.planId,
        months: input.months,
        amountCents: input.amountCents,
        method: input.method,
        reference: input.reference || null,
        paidOn: input.paidOn,
        periodStart: period.start,
        periodEnd: period.end,
        recordedBy: admin.id,
        note: input.note || null,
      });
      await tx
        .update(czApplications)
        .set({ subscriptionStatus: "active", subscriptionPlanId: input.planId, subscriptionEndsAt: period.end })
        .where(eq(czApplications.id, app.id));
      await tx.insert(czMembershipAudit).values({
        applicationId: app.id,
        userId: app.userId,
        actorUserId: admin.id,
        action: "subscription_payment_recorded",
        reason: input.note || null,
        metadata: {
          planId: input.planId,
          months: input.months,
          amountCents: input.amountCents,
          method: input.method,
          periodEnd: period.end.toISOString(),
        },
      });
      return { status: "active" as const, planId: input.planId, endsAt: period.end, periodStart: period.start };
    });
  } catch (error) {
    if (isDuplicateKey(error))
      fail("CONFLICT", "Ese comprobante ya fue registrado con el mismo método de pago");
    throw error;
  }
}

/** Oculta la tienda antes de tiempo (por ejemplo, pago revertido o conducta). */
export async function adminDeactivateSubscription(admin: User, applicationId: number, reason: string) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) fail("BAD_REQUEST", "Explica el motivo (mínimo 5 caracteres)");
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const rows = await tx.select().from(czApplications).where(eq(czApplications.id, applicationId)).for("update").limit(1);
    const app = rows[0];
    if (!app) fail("NOT_FOUND", "La solicitud no existe");
    if (app.subscriptionStatus !== "active") fail("CONFLICT", "La suscripción no está activa");
    await tx.update(czApplications).set({ subscriptionStatus: "cancelled" }).where(eq(czApplications.id, app.id));
    await tx.insert(czMembershipAudit).values({
      applicationId: app.id,
      userId: app.userId,
      actorUserId: admin.id,
      action: "subscription_deactivated",
      reason: cleanReason.slice(0, 500),
      metadata: { previousEndsAt: app.subscriptionEndsAt ? new Date(app.subscriptionEndsAt).toISOString() : null },
    });
    return { status: "cancelled" as const };
  });
}

/** Marca como vencidas las suscripciones cuyo período terminó. Devuelve cuántas cambió. */
export async function sweepExpiredSubscriptions(now = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result: any = await db
    .update(czApplications)
    .set({ subscriptionStatus: "past_due" })
    .where(and(eq(czApplications.subscriptionStatus, "active"), lt(czApplications.subscriptionEndsAt, now)));
  const header = Array.isArray(result) ? result[0] : result;
  return Number(header?.affectedRows ?? 0);
}

/** Ejecuta el vencimiento al arrancar y cada 15 minutos (una sola instancia en Railway). */
export function startSubscriptionSweeper(intervalMs = 15 * 60 * 1000) {
  const run = () =>
    sweepExpiredSubscriptions()
      .then(count => { if (count > 0) console.log(`[Suscripciones] ${count} vencida(s)`); })
      .catch(error => console.error("[Suscripciones] Error al vencer:", error instanceof Error ? error.message : error));
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}

/** Vendedores aprobados con su estado de suscripción, para el panel del administrador. */
export async function adminListSubscriptions() {
  const db = await requireDb();
  const apps = await db
    .select({
      applicationId: czApplications.id,
      userId: czApplications.userId,
      status: czApplications.subscriptionStatus,
      planId: czApplications.subscriptionPlanId,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
      reviewedAt: czApplications.reviewedAt,
      contactEmail: czApplications.contactEmail,
      contactPhone: czApplications.contactPhone,
      displayName: czMembershipProfiles.displayName,
      accountName: users.name,
      chosenPlanId: czPlanSelections.planId,
    })
    .from(czApplications)
    .leftJoin(czMembershipProfiles, eq(czMembershipProfiles.userId, czApplications.userId))
    .leftJoin(users, eq(users.id, czApplications.userId))
    .leftJoin(czPlanSelections, eq(czPlanSelections.userId, czApplications.userId))
    .where(eq(czApplications.status, "approved"))
    .orderBy(desc(czApplications.reviewedAt))
    .limit(500);
  const owed = await pendingTotalsBySeller();
  return apps.map((row: any) => ({
    applicationId: row.applicationId,
    pendingCommissionCents: owed.get(row.userId) ?? 0,
    name: row.displayName || row.accountName || `Vendedor #${row.userId}`,
    email: row.contactEmail,
    phone: row.contactPhone,
    status: row.status as "not_started" | "active" | "past_due" | "cancelled",
    planId: (row.planId ?? null) as string | null,
    chosenPlanId: (row.chosenPlanId ?? null) as SellerPlanId | null,
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null,
  }));
}

export async function adminListPayments(applicationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: czSubscriptionPayments.id,
      planId: czSubscriptionPayments.planId,
      months: czSubscriptionPayments.months,
      amountCents: czSubscriptionPayments.amountCents,
      method: czSubscriptionPayments.method,
      reference: czSubscriptionPayments.reference,
      paidOn: czSubscriptionPayments.paidOn,
      periodStart: czSubscriptionPayments.periodStart,
      periodEnd: czSubscriptionPayments.periodEnd,
      note: czSubscriptionPayments.note,
      createdAt: czSubscriptionPayments.createdAt,
      recordedByName: users.name,
    })
    .from(czSubscriptionPayments)
    .leftJoin(users, eq(users.id, czSubscriptionPayments.recordedBy))
    .where(eq(czSubscriptionPayments.applicationId, applicationId))
    .orderBy(desc(czSubscriptionPayments.createdAt))
    .limit(200);
  return rows;
}

/** Estado visible para el propio vendedor. */
export async function subscriptionForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      applicationId: czApplications.id,
      status: czApplications.subscriptionStatus,
      planId: czApplications.subscriptionPlanId,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
    })
    .from(czApplications)
    .where(and(eq(czApplications.userId, userId), inArray(czApplications.status, ["approved"])))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    status: row.status as "not_started" | "active" | "past_due" | "cancelled",
    planId: (row.planId ?? null) as string | null,
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null,
  };
}

/** Contacto para pagos mostrado a los vendedores (variable PAYMENT_CONTACT, opcional). */
export function paymentContact() {
  const raw = (process.env.PAYMENT_CONTACT ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw ? { label: raw, whatsapp: digits.length >= 8 ? digits : null } : null;
}
