// Suscripciones de vendedores activadas por un administrador (etapa 5, versión manual).
// El vendedor paga por Yappy, transferencia o efectivo; el administrador registra
// el pago y la tienda queda activa hasta el fin del período. Al vencer, la tienda
// se oculta sola (sweepExpiredSubscriptions). La pasarela automática podrá
// registrar pagos por esta misma vía más adelante.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import {
  TRIAL_MONTHS,
  TRIAL_PLAN_ID,
  getSellerPlan,
  planAmountCents,
  sellerPlanIds,
  sellerPlanLabel,
  type SellerPlanId,
} from "@shared/pricing";
import {
  czApplications,
  czMembershipAudit,
  czMembershipProfiles,
  czPlanSelections,
  czSubscriptionPayments,
  users,
  type User,
} from "../../drizzle/schema";
import { czStores } from "../../drizzle/catalog-schema";
import { getDb } from "../db";
import { queueEmail, recipientFor } from "./email";
import {
  subscriptionEndingSoon,
  subscriptionExpired,
  subscriptionPaymentReceipt,
  trialEndingSoon,
} from "./emailMessages";
import {
  hasOverdueCommission,
  pendingTotalsBySeller,
  sweepCommissionDeadlines,
} from "./commissions";
import { sweepExpiredReservations } from "./events";
import { sweepAppointmentReminders } from "./appointments";
import type { PlatformPaymentDetails } from "@shared/billing";

export const PAYMENT_METHODS = [
  "yappy",
  "transferencia",
  "tarjeta",
  "efectivo",
  "otro",
] as const;
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
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
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
  const stillActive =
    current.status === "active" &&
    current.endsAt !== null &&
    current.endsAt > now;
  const start = stillActive
    ? new Date(current.endsAt!.getTime())
    : new Date(now.getTime());
  return { start, end: addMonths(start, months) };
}

export function expectedAmountCents(planId: SellerPlanId, months: number) {
  return planAmountCents(planId, months);
}

/** Valida y normaliza el pago antes de tocar la base de datos. */
export function validatePaymentInput(
  input: RecordPaymentInput,
  today: Date
): RecordPaymentInput {
  if (!sellerPlanIds.includes(input.planId))
    fail("BAD_REQUEST", "Plan no válido");
  if (
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > MAX_MONTHS_PER_PAYMENT
  )
    fail(
      "BAD_REQUEST",
      `Los meses deben estar entre 1 y ${MAX_MONTHS_PER_PAYMENT}`
    );
  const expected = expectedAmountCents(input.planId, input.months);
  if (input.amountCents !== expected)
    fail(
      "BAD_REQUEST",
      `El monto debe ser US$${(expected / 100).toFixed(2)} (${input.months === 12 ? "1 año con 10 % de descuento" : `${input.months} × ${getSellerPlan(input.planId).name}`})`
    );
  return { ...input, ...validateReceipt(input, today) };
}

/** Método, comprobante, fecha y nota de un pago recibido (mensualidad o comisión). */
export function validateReceipt(
  input: {
    method: PaymentMethod;
    reference: string;
    paidOn: string;
    note: string;
  },
  today: Date
) {
  if (!PAYMENT_METHODS.includes(input.method))
    fail("BAD_REQUEST", "Método de pago no válido");
  const reference = input.reference.trim();
  if (input.method !== "efectivo" && reference.length < 3)
    fail("BAD_REQUEST", "Anota el número de comprobante o referencia del pago");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn))
    fail("BAD_REQUEST", "Fecha de pago no válida");
  const paidOn = new Date(`${input.paidOn}T12:00:00Z`);
  if (
    Number.isNaN(paidOn.getTime()) ||
    paidOn.toISOString().slice(0, 10) !== input.paidOn
  )
    fail("BAD_REQUEST", "Fecha de pago no válida");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (paidOn > tomorrow)
    fail("BAD_REQUEST", "La fecha de pago no puede ser futura");
  if (paidOn < new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000))
    fail("BAD_REQUEST", "La fecha de pago tiene más de 120 días");
  return {
    method: input.method,
    reference,
    paidOn: input.paidOn,
    note: input.note.trim().slice(0, 500),
  };
}

export function isDuplicateKeyError(error: unknown) {
  return isDuplicateKey(error);
}

function isDuplicateKey(error: unknown) {
  const e = error as {
    code?: string;
    errno?: number;
    cause?: { code?: string; errno?: number };
  };
  return (
    e?.code === "ER_DUP_ENTRY" ||
    e?.errno === 1062 ||
    e?.cause?.code === "ER_DUP_ENTRY" ||
    e?.cause?.errno === 1062
  );
}

/** Registra un pago confirmado y activa o extiende la suscripción. */
export async function adminRecordPayment(admin: User, raw: RecordPaymentInput) {
  const now = new Date();
  const input = validatePaymentInput(raw, now);
  const db = await requireDb();
  try {
    return await db.transaction((tx: any) =>
      recordSubscriptionPaymentTx(tx, admin.id, input, now)
    );
  } catch (error) {
    if (isDuplicateKey(error))
      fail(
        "CONFLICT",
        "Ese comprobante ya fue registrado con el mismo método de pago"
      );
    throw error;
  }
}

/**
 * Registra un pago de mensualidad ya validado dentro de una transacción abierta.
 * La tienda queda activa, salvo que deba comisión vencida: entonces sigue
 * oculta por comisión hasta que la pague.
 */
export async function recordSubscriptionPaymentTx(
  tx: any,
  adminId: number,
  input: RecordPaymentInput,
  now = new Date()
) {
  const admin = { id: adminId };
  const rows = await tx
    .select()
    .from(czApplications)
    .where(eq(czApplications.id, input.applicationId))
    .for("update")
    .limit(1);
  const app = rows[0];
  if (!app) fail("NOT_FOUND", "La solicitud no existe");
  if (app.status !== "approved")
    fail(
      "PRECONDITION_FAILED",
      "Solo se puede activar la suscripción de un vendedor aprobado"
    );
  // Un período vigente pero oculto por comisión cuenta como vigente: sus días ya estaban pagados.
  const heldForCommission =
    app.subscriptionStatus === "past_due" && app.holdReason === "commission";
  // Una tienda suspendida por un administrador sigue oculta aunque pague: el
  // pago extiende su período, pero solo un administrador levanta la suspensión.
  const suspended = app.holdReason === "suspended";
  const keepsPaidDays =
    heldForCommission ||
    (suspended &&
      Boolean(
        app.subscriptionEndsAt && new Date(app.subscriptionEndsAt) > now
      ));
  const period = computePeriod(
    {
      status: keepsPaidDays ? "active" : app.subscriptionStatus,
      endsAt: app.subscriptionEndsAt,
    },
    now,
    input.months
  );
  const commissionOverdue = await hasOverdueCommission(tx, app.userId, now);
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
    .set(
      suspended
        ? {
            subscriptionStatus: "past_due",
            holdReason: "suspended",
            subscriptionPlanId: input.planId,
            subscriptionEndsAt: period.end,
          }
        : commissionOverdue
          ? {
              subscriptionStatus: "past_due",
              holdReason: "commission",
              subscriptionPlanId: input.planId,
              subscriptionEndsAt: period.end,
            }
          : {
              subscriptionStatus: "active",
              holdReason: null,
              subscriptionPlanId: input.planId,
              subscriptionEndsAt: period.end,
            }
    )
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
  await queueEmail(
    tx,
    `sub-payment:${app.id}:${period.end.toISOString()}`,
    await recipientFor(tx, app.userId),
    subscriptionPaymentReceipt(
      getSellerPlan(input.planId).name,
      input.months,
      input.amountCents,
      period.end
    )
  );
  return {
    status:
      suspended || commissionOverdue
        ? ("past_due" as const)
        : ("active" as const),
    planId: input.planId,
    endsAt: period.end,
    periodStart: period.start,
  };
}

/** Oculta la tienda antes de tiempo (por ejemplo, pago revertido o conducta). */
export async function adminDeactivateSubscription(
  admin: User,
  applicationId: number,
  reason: string
) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5)
    fail("BAD_REQUEST", "Explica el motivo (mínimo 5 caracteres)");
  const db = await requireDb();
  return await db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czApplications)
      .where(eq(czApplications.id, applicationId))
      .for("update")
      .limit(1);
    const app = rows[0];
    if (!app) fail("NOT_FOUND", "La solicitud no existe");
    // También se puede desactivar una tienda oculta por comisión.
    const heldForCommission =
      app.subscriptionStatus === "past_due" && app.holdReason === "commission";
    if (app.subscriptionStatus !== "active" && !heldForCommission)
      fail("CONFLICT", "La suscripción no está activa");
    await tx
      .update(czApplications)
      .set({ subscriptionStatus: "cancelled", holdReason: null })
      .where(eq(czApplications.id, app.id));
    await tx.insert(czMembershipAudit).values({
      applicationId: app.id,
      userId: app.userId,
      actorUserId: admin.id,
      action: "subscription_deactivated",
      reason: cleanReason.slice(0, 500),
      metadata: {
        previousEndsAt: app.subscriptionEndsAt
          ? new Date(app.subscriptionEndsAt).toISOString()
          : null,
      },
    });
    return { status: "cancelled" as const };
  });
}

export const REMINDER_DAYS = 7;
/** Avisos antes de que termine la prueba gratis y antes de que venza la mensualidad. */
export const TRIAL_REMINDER_STAGES = [15, 7, 1] as const;
export const PAID_REMINDER_STAGES = [7, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Qué aviso toca según los días que faltan: el menor escalón que ya se alcanzó
 * (15, 7 o 1 día antes). null si todavía falta más que el primer escalón.
 */
export function reminderStage(
  endsAt: Date,
  now: Date,
  inTrial: boolean
): number | null {
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) return null;
  const stages = inTrial ? TRIAL_REMINDER_STAGES : PAID_REMINDER_STAGES;
  let stage: number | null = null;
  for (const s of stages) if (daysLeft <= s) stage = s;
  return stage;
}

/** Clave del correo: el aviso de 7 días conserva la que ya se usaba. */
export function reminderKey(
  applicationId: number,
  endKey: string,
  stage: number
) {
  return stage === REMINDER_DAYS
    ? `sub-reminder:${applicationId}:${endKey}`
    : `sub-reminder:${applicationId}:${endKey}:${stage}`;
}

/**
 * Marca como vencidas las suscripciones cuyo período terminó y avisa por correo.
 * También avisa antes de que termine: la prueba gratis a los 15, 7 y 1 día, y la
 * mensualidad a los 7 y 1 día. Cada aviso se envía una sola vez.
 * Devuelve cuántas venció.
 */
export async function sweepExpiredSubscriptions(
  now = new Date()
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const expiring = await db
    .select({
      id: czApplications.id,
      userId: czApplications.userId,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
      planId: czApplications.subscriptionPlanId,
    })
    .from(czApplications)
    .where(
      and(
        eq(czApplications.subscriptionStatus, "active"),
        lt(
          czApplications.subscriptionEndsAt,
          new Date(now.getTime() + TRIAL_REMINDER_STAGES[0] * DAY_MS)
        )
      )
    )
    .limit(500);
  let expired = 0;
  for (const app of expiring) {
    if (!app.endsAt) continue;
    const endsAt = new Date(app.endsAt);
    const endKey = endsAt.toISOString().slice(0, 10);
    await db.transaction(async (tx: any) => {
      if (endsAt < now) {
        const result: any = await tx
          .update(czApplications)
          .set({ subscriptionStatus: "past_due" })
          .where(
            and(
              eq(czApplications.id, app.id),
              eq(czApplications.subscriptionStatus, "active"),
              lt(czApplications.subscriptionEndsAt, now)
            )
          );
        const header = Array.isArray(result) ? result[0] : result;
        if (Number(header?.affectedRows ?? 0) === 1) {
          expired++;
          await queueEmail(
            tx,
            `sub-expired:${app.id}:${endKey}`,
            await recipientFor(tx, app.userId),
            subscriptionExpired()
          );
        }
      } else {
        const inTrial = Boolean(
          app.trialEndsAt && new Date(app.trialEndsAt) > now
        );
        const stage = reminderStage(endsAt, now, inTrial);
        if (stage === null) return;
        // En la prueba vale el plan que el vendedor eligió; si no eligió, Normal.
        let plan: SellerPlanId = (sellerPlanIds as readonly string[]).includes(
          app.planId ?? ""
        )
          ? (app.planId as SellerPlanId)
          : "normal";
        if (inTrial) {
          const chosen = await tx
            .select({ planId: czPlanSelections.planId })
            .from(czPlanSelections)
            .where(eq(czPlanSelections.userId, app.userId))
            .limit(1);
          if (chosen[0]?.planId) plan = chosen[0].planId as SellerPlanId;
        }
        const daysLeft = Math.max(
          1,
          Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)
        );
        await queueEmail(
          tx,
          reminderKey(app.id, endKey, stage),
          await recipientFor(tx, app.userId),
          inTrial
            ? trialEndingSoon(
                endsAt,
                daysLeft,
                getSellerPlan(plan).name,
                sellerPlanLabel(plan)
              )
            : subscriptionEndingSoon(endsAt, false, sellerPlanLabel(plan))
        );
      }
    });
  }
  return expired;
}

/**
 * Aprobado = activo al instante: los primeros 3 meses son gratis, así que una
 * tienda aprobada nunca debe quedar inactiva por «no haber pagado». Si alguna
 * quedó aprobada sin su prueba gratuita (aprobaciones antiguas o por otra vía),
 * se la activa ahora con sus 3 meses completos. Devuelve cuántas activó.
 */
export async function startMissingTrials(now = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const trialEndsAt = addMonths(now, TRIAL_MONTHS);
  const result: any = await db
    .update(czApplications)
    .set({
      subscriptionStatus: "active",
      subscriptionPlanId: TRIAL_PLAN_ID,
      subscriptionEndsAt: trialEndsAt,
      trialEndsAt,
      holdReason: null,
    })
    .where(
      and(
        eq(czApplications.status, "approved"),
        eq(czApplications.subscriptionStatus, "not_started")
      )
    );
  const header = Array.isArray(result) ? result[0] : result;
  return Number(header?.affectedRows ?? 0);
}

/**
 * Ejecuta el vencimiento al arrancar y cada 15 minutos (una sola instancia en
 * Railway): mensualidades vencidas y plazos de la comisión mensual.
 */
export function startSubscriptionSweeper(intervalMs = 15 * 60 * 1000) {
  // Los dos barridos son independientes: si uno falla, el otro corre igual.
  const run = () => {
    void startMissingTrials()
      .then(count => {
        if (count > 0)
          console.log(
            `[Suscripciones] ${count} tienda(s) aprobada(s) activada(s) con su prueba gratis`
          );
      })
      .catch(error =>
        console.error(
          "[Suscripciones] Error al activar pruebas:",
          error instanceof Error ? error.message : error
        )
      );
    void sweepExpiredSubscriptions()
      .then(count => {
        if (count > 0) console.log(`[Suscripciones] ${count} vencida(s)`);
      })
      .catch(error =>
        console.error(
          "[Suscripciones] Error al vencer:",
          error instanceof Error ? error.message : error
        )
      );
    void sweepExpiredReservations()
      .then(count => {
        if (count > 0)
          console.log(`[Eventos] ${count} reserva(s) vencida(s) liberada(s)`);
      })
      .catch(error =>
        console.error(
          "[Eventos] Error al liberar reservas:",
          error instanceof Error ? error.message : error
        )
      );
    void sweepAppointmentReminders()
      .then(count => {
        if (count > 0) console.log(`[Citas] ${count} recordatorio(s) enviados`);
      })
      .catch(error =>
        console.error(
          "[Citas] Error en los recordatorios:",
          error instanceof Error ? error.message : error
        )
      );
    void sweepCommissionDeadlines()
      .then(count => {
        if (count > 0)
          console.log(
            `[Comisiones] ${count} tienda(s) oculta(s) por comisión vencida`
          );
      })
      .catch(error =>
        console.error(
          "[Comisiones] Error en los plazos:",
          error instanceof Error ? error.message : error
        )
      );
  };
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
      holdReason: czApplications.holdReason,
      planId: czApplications.subscriptionPlanId,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
      reviewedAt: czApplications.reviewedAt,
      contactEmail: czApplications.contactEmail,
      contactPhone: czApplications.contactPhone,
      displayName: czMembershipProfiles.displayName,
      accountName: users.name,
      chosenPlanId: czPlanSelections.planId,
      businessName: czApplications.businessName,
      storeName: czStores.name,
      storeSlug: czStores.slug,
      logoUrl: czStores.logoUrl,
    })
    .from(czApplications)
    .leftJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czApplications.userId)
    )
    .leftJoin(users, eq(users.id, czApplications.userId))
    .leftJoin(
      czPlanSelections,
      eq(czPlanSelections.userId, czApplications.userId)
    )
    .leftJoin(czStores, eq(czStores.userId, czApplications.userId))
    .where(eq(czApplications.status, "approved"))
    .orderBy(desc(czApplications.reviewedAt))
    .limit(500);
  const owed = await pendingTotalsBySeller();
  return apps.map((row: any) => ({
    applicationId: row.applicationId,
    pendingCommissionCents: owed.get(row.userId) ?? 0,
    name: row.displayName || row.accountName || `Vendedor #${row.userId}`,
    /** Nombre de la tienda publicada; si aún no la creó, el de su solicitud. */
    storeName: (row.storeName || row.businessName || "") as string,
    storeSlug: (row.storeSlug ?? null) as string | null,
    logoUrl: (row.logoUrl ?? null) as string | null,
    email: row.contactEmail,
    phone: row.contactPhone,
    status: row.status as "not_started" | "active" | "past_due" | "cancelled",
    holdReason: (row.holdReason ?? null) as "commission" | null,
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
      holdReason: czApplications.holdReason,
      planId: czApplications.subscriptionPlanId,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
    })
    .from(czApplications)
    .where(
      and(
        eq(czApplications.userId, userId),
        inArray(czApplications.status, ["approved"])
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    applicationId: row.applicationId as number,
    status: row.status as "not_started" | "active" | "past_due" | "cancelled",
    holdReason: (row.holdReason ?? null) as "commission" | null,
    planId: (row.planId ?? null) as string | null,
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null,
  };
}

/** Contacto para pagos mostrado a los vendedores (variable PAYMENT_CONTACT, opcional). */
export function paymentContact() {
  const raw = (process.env.PAYMENT_CONTACT ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw
    ? { label: raw, whatsapp: digits.length >= 8 ? digits : null }
    : null;
}

/**
 * Datos de pago de CuadraZone que ve el vendedor, leídos de variables de entorno
 * (Railway). Solo se muestra cada forma de pago si está completa:
 *   PAYMENT_YAPPY            número o nombre en el directorio de Yappy
 *   PAYMENT_YAPPY_NAME       a nombre de quién aparece (opcional)
 *   PAYMENT_BANK_NAME        banco
 *   PAYMENT_BANK_ACCOUNT     número de cuenta
 *   PAYMENT_BANK_HOLDER      titular
 *   PAYMENT_BANK_ACCOUNT_TYPE  Ahorros o Corriente (opcional)
 *   PAYMENT_CARD_URL         enlace de cobro con tarjeta (https, de una pasarela)
 *   PAYMENT_CONTACT          WhatsApp para dudas (opcional)
 * La tarjeta se paga en la página de la pasarela: CuadraZone nunca ve ni guarda
 * los datos de la tarjeta.
 */
export function platformPaymentDetails(
  env: Record<string, string | undefined> = process.env
): PlatformPaymentDetails {
  const read = (name: string) => (env[name] ?? "").trim();
  const yappy = read("PAYMENT_YAPPY");
  const bank = read("PAYMENT_BANK_NAME");
  const account = read("PAYMENT_BANK_ACCOUNT");
  const holder = read("PAYMENT_BANK_HOLDER");
  const cardUrl = read("PAYMENT_CARD_URL");
  const contactDigits = read("PAYMENT_CONTACT").replace(/\D/g, "");
  return {
    yappy: yappy
      ? { number: yappy, name: read("PAYMENT_YAPPY_NAME") || null }
      : null,
    bank:
      bank && account && holder
        ? {
            bank,
            account,
            holder,
            accountType: read("PAYMENT_BANK_ACCOUNT_TYPE") || null,
          }
        : null,
    cardUrl: isSafeHttpsUrl(cardUrl) ? cardUrl : null,
    whatsapp: contactDigits.length >= 8 ? contactDigits : null,
  };
}

function isSafeHttpsUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
