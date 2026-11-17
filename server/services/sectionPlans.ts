// Planes de anuncios por sección: Bienes raíces (inmuebles), Autos y Empleos.
// Cada sección se paga aparte, según cuántos anuncios publicados tiene la
// cuenta en ella: hasta 20 (US$49.99), de 21 a 100 (US$79.99) o más de 100
// (US$159.99). La primera vez que alguien publica en una sección empieza su
// mes gratis (como el plan Básico). Los planes de anunciante antiguos (Normal
// o Mayor Visibilidad) siguen valiendo, con el límite del Básico, hasta que
// vencen. Estas secciones no pagan comisión.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import {
  TRIAL_PLAN_ID,
  isListingPlanId,
  isSectionPlanId,
  limitReachedMessage,
  listingLimitFor,
  listingPlanAmountCents,
  listingSectionLabels,
  listingSections,
  listingUnits,
  trialEndsFor,
  type ListingPlanId,
  type ListingSection,
} from "@shared/pricing";
import { czAdvertiserPlans } from "../../drizzle/catalog-schema";
import {
  czSectionPlanPayments,
  czSectionPlans,
} from "../../drizzle/listingplan-schema";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  addMonths,
  isDuplicateKeyError,
  validateReceipt,
  type PaymentMethod,
} from "./subscriptions";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}

export type PublishPlan = {
  active: boolean;
  featured: boolean;
  source: "section" | "advertiser" | null;
  planId: string | null;
  endsAt: string | null;
  /** Anuncios publicados que permite; null = sin límite. */
  limit: number | null;
  /** ¿Ya usó su mes gratis en esta sección? */
  trialUsed: boolean;
};

export const NO_PLAN: PublishPlan = {
  active: false,
  featured: false,
  source: null,
  planId: null,
  endsAt: null,
  limit: 0,
  trialUsed: false,
};

/** Plan con el que cada usuario puede publicar en una sección, para varios usuarios a la vez. */
export async function publishPlans(
  db: any,
  userIds: number[],
  section: ListingSection,
  now = new Date()
): Promise<Map<number, PublishPlan>> {
  const plans = new Map<number, PublishPlan>();
  if (!userIds.length) return plans;
  const [rows, legacy] = await Promise.all([
    db
      .select({
        userId: czSectionPlans.userId,
        planId: czSectionPlans.planId,
        endsAt: czSectionPlans.endsAt,
        trialUsedAt: czSectionPlans.trialUsedAt,
      })
      .from(czSectionPlans)
      .where(
        and(
          inArray(czSectionPlans.userId, userIds),
          eq(czSectionPlans.section, section)
        )
      ),
    db
      .select({
        userId: czAdvertiserPlans.userId,
        planId: czAdvertiserPlans.planId,
        endsAt: czAdvertiserPlans.endsAt,
      })
      .from(czAdvertiserPlans)
      .where(
        and(
          inArray(czAdvertiserPlans.userId, userIds),
          gt(czAdvertiserPlans.endsAt, now)
        )
      ),
  ]);
  for (const row of rows) {
    const active = new Date(row.endsAt) > now;
    plans.set(row.userId, {
      active,
      featured: false,
      source: "section",
      planId: row.planId,
      endsAt: new Date(row.endsAt).toISOString(),
      limit: active ? listingLimitFor(row.planId, section) : 0,
      trialUsed: Boolean(row.trialUsedAt),
    });
  }
  for (const row of legacy) {
    const current = plans.get(row.userId);
    if (current?.active) continue;
    plans.set(row.userId, {
      active: true,
      featured: row.planId === "mayor_visibilidad",
      source: "advertiser",
      planId: row.planId,
      endsAt: new Date(row.endsAt).toISOString(),
      limit: listingLimitFor("basico", section),
      trialUsed: current?.trialUsed ?? false,
    });
  }
  return plans;
}

export async function myPublishPlan(
  db: any,
  userId: number,
  section: ListingSection
): Promise<PublishPlan> {
  return (await publishPlans(db, [userId], section)).get(userId) ?? NO_PLAN;
}

/**
 * Antes de publicar: si nunca tuvo plan en la sección, empieza su mes gratis.
 * Después revisa que el plan esté vigente y que no pase su límite.
 * `publishedCount` es cuántos anuncios ya tiene publicados (sin contar este).
 */
export async function assertCanPublish(
  db: any,
  userId: number,
  section: ListingSection,
  publishedCount: number,
  now = new Date()
): Promise<PublishPlan> {
  let plan = await myPublishPlan(db, userId, section);
  if (!plan.active && !plan.trialUsed && plan.source !== "section") {
    const endsAt = trialEndsFor(now);
    await db
      .insert(czSectionPlans)
      .values({
        userId,
        section,
        planId: TRIAL_PLAN_ID,
        endsAt,
        trialUsedAt: now,
      })
      .onDuplicateKeyUpdate({ set: { userId } });
    plan = await myPublishPlan(db, userId, section);
  }
  if (!plan.active)
    fail(
      "PRECONDITION_FAILED",
      `Tu plan de ${listingSectionLabels[section]} venció. Para seguir publicando, escríbenos y activamos tu plan.`
    );
  if (plan.limit !== null && publishedCount >= plan.limit)
    fail(
      "PRECONDITION_FAILED",
      section === "empleos"
        ? `Tu plan permite publicar hasta ${plan.limit} vacantes al mes. Para publicar más, sube de plan: escríbenos y lo activamos.`
        : limitReachedMessage(plan.limit, listingUnits[section])
    );
  return plan;
}

// ───────────── Administración ─────────────

export async function adminSectionPlans() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  const rows = await db
    .select({
      userId: czSectionPlans.userId,
      section: czSectionPlans.section,
      planId: czSectionPlans.planId,
      endsAt: czSectionPlans.endsAt,
      email: users.email,
      name: users.name,
      phone: users.phone,
    })
    .from(czSectionPlans)
    .leftJoin(users, eq(users.id, czSectionPlans.userId))
    .orderBy(desc(czSectionPlans.endsAt))
    .limit(500);
  const now = new Date();
  return rows.map((r: any) => ({
    ...r,
    endsAt: new Date(r.endsAt).toISOString(),
    active: new Date(r.endsAt) > now,
  }));
}

export type RecordSectionPaymentInput = {
  account: string;
  section: ListingSection;
  planId: string;
  months: number;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  note: string;
};

/** El administrador registra el pago de un plan de anuncios y lo activa. */
export async function adminRecordSectionPayment(
  admin: User,
  input: RecordSectionPaymentInput
) {
  const receipt = validateReceipt(input, new Date());
  if (!(listingSections as readonly string[]).includes(input.section))
    fail("BAD_REQUEST", "Sección no válida");
  if (!isSectionPlanId(input.planId, input.section as ListingSection)) fail("BAD_REQUEST", "Plan no válido para esa sección");
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 12)
    fail("BAD_REQUEST", "Entre 1 y 12 meses");
  const expected = listingPlanAmountCents(input.planId, input.months);
  if (input.amountCents !== expected)
    fail(
      "BAD_REQUEST",
      `El monto debe ser US$${(expected / 100).toFixed(2)} (${input.months === 12 ? "1 año con 10 % de descuento" : `${input.months} × plan`})`
    );
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  const account = input.account.trim().toLowerCase();
  const phone = account.replace(/\D/g, "");
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(
      account.includes("@")
        ? eq(users.email, account)
        : eq(users.phone, phone.length === 8 ? `+507${phone}` : `+${phone}`)
    )
    .limit(1);
  if (!found[0])
    fail(
      "NOT_FOUND",
      "No hay ninguna cuenta con ese correo o celular. La persona debe entrar a CuadraZone primero."
    );
  const userId = found[0].id;
  try {
    return await db.transaction(async (tx: any) => {
      const current = await tx
        .select()
        .from(czSectionPlans)
        .where(
          and(
            eq(czSectionPlans.userId, userId),
            eq(czSectionPlans.section, input.section)
          )
        )
        .limit(1);
      const now = new Date();
      // Un pago continúa desde el vencimiento de un plan pagado vigente; el
      // mes gratis no se suma: el pago empieza cuando termina la prueba.
      const base =
        current[0] && new Date(current[0].endsAt) > now
          ? new Date(current[0].endsAt)
          : now;
      const periodEnd = addMonths(base, input.months);
      await tx.insert(czSectionPlanPayments).values({
        userId,
        section: input.section,
        planId: input.planId,
        months: input.months,
        amountCents: expected,
        method: receipt.method,
        reference: receipt.reference || null,
        paidOn: receipt.paidOn,
        periodEnd,
        recordedBy: admin.id,
      });
      await tx
        .insert(czSectionPlans)
        .values({
          userId,
          section: input.section,
          planId: input.planId,
          endsAt: periodEnd,
          trialUsedAt: current[0]?.trialUsedAt ?? now,
        })
        .onDuplicateKeyUpdate({
          set: { planId: input.planId, endsAt: periodEnd },
        });
      return {
        userId,
        section: input.section,
        planId: input.planId,
        endsAt: periodEnd.toISOString(),
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error))
      fail("CONFLICT", "Ese comprobante ya fue registrado");
    throw error;
  }
}
