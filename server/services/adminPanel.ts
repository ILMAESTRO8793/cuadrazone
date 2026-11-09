// Etapa 6 · Panel del administrador: moderación de publicaciones y reseñas,
// suspensión de vendedores y reportes. Solo se llama desde adminProcedure.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import {
  czEvents,
  czProducts,
  czServices,
  czStores,
  czTicketOrders,
  czAppointments,
} from "../../drizzle/catalog-schema";
import {
  czClaims,
  czCommissionPayments,
  czOrderItems,
  czOrders,
  czReviews,
} from "../../drizzle/commerce-schema";
import {
  czApplications,
  czMembershipAudit,
  czSubscriptionPayments,
  users,
  type User,
} from "../../drizzle/schema";
import { panamaMonthKey } from "@shared/billing";
import { monthsAgoStart, REPORT_MONTHS } from "@shared/sellerDashboard";
import { isClaimOverdue } from "@shared/claims";
import { getDb } from "../db";
import { queueEmail, recipientFor } from "./email";
import { hasOverdueCommission } from "./commissions";

const DAY_MS = 24 * 60 * 60 * 1000;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
function cleanReason(reason: string) {
  const r = reason.trim();
  if (r.length < 5)
    fail("BAD_REQUEST", "Escribe el motivo (al menos 5 caracteres)");
  return r.slice(0, 300);
}
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

// ───────────── Moderación de publicaciones ─────────────

export const moderationKinds = ["product", "service", "event"] as const;
export type ModerationKind = (typeof moderationKinds)[number];
const kindLabel: Record<ModerationKind, string> = {
  product: "producto",
  service: "servicio",
  event: "evento",
};

const tables = {
  product: {
    table: czProducts,
    owner: czProducts.ownerUserId,
    path: (slug: string) => `/articulo/${slug}`,
    hiddenStatus: "archived",
  },
  service: {
    table: czServices,
    owner: czServices.userId,
    path: (slug: string) => `/servicio/${slug}`,
    hiddenStatus: "paused",
  },
  event: {
    table: czEvents,
    owner: czEvents.userId,
    path: (slug: string) => `/evento/${slug}`,
    hiddenStatus: "draft",
  },
} as const;

export async function searchContent(kind: ModerationKind, q: string) {
  const db = await requireDb();
  const t = tables[kind];
  const table: any = t.table;
  const term = `%${q.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const rows = await db
    .select({
      id: table.id,
      title: table.title,
      slug: table.slug,
      status: table.status,
      moderatedAt: table.moderatedAt,
      moderationReason: table.moderationReason,
      storeName: czStores.name,
    })
    .from(table)
    .innerJoin(czStores, eq(czStores.id, table.storeId))
    .where(
      q.trim()
        ? or(like(table.title, term), like(czStores.name, term))
        : undefined
    )
    .orderBy(desc(table.id))
    .limit(50);
  return rows.map((r: any) => ({
    ...r,
    kind,
    path: t.path(r.slug),
    moderatedAt: iso(r.moderatedAt),
  }));
}

export async function moderateContent(
  admin: User,
  kind: ModerationKind,
  id: number,
  hide: boolean,
  reason: string
) {
  const db = await requireDb();
  const t = tables[kind];
  const table: any = t.table;
  const why = hide ? cleanReason(reason) : reason.trim().slice(0, 300);
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(table)
      .where(eq(table.id, id))
      .for("update")
      .limit(1);
    const row = rows[0];
    if (!row) fail("NOT_FOUND", `El ${kindLabel[kind]} no existe`);
    const ownerId = kind === "product" ? row.ownerUserId : row.userId;
    if (hide) {
      await tx
        .update(table)
        .set({
          moderatedAt: new Date(),
          moderationReason: why,
          // Sale de la vista pública; el vendedor no puede volver a publicarlo.
          ...(row.status === "published" ? { status: t.hiddenStatus } : {}),
          revision: Number(row.revision ?? 0) + 1,
        })
        .where(eq(table.id, id));
    } else {
      if (!row.moderatedAt) return { hidden: false };
      await tx
        .update(table)
        .set({ moderatedAt: null, moderationReason: null })
        .where(eq(table.id, id));
    }
    await audit(
      tx,
      ownerId,
      admin.id,
      hide ? "content_hidden" : "content_restored",
      why || null,
      { kind, id, title: row.title }
    );
    await queueEmail(
      tx,
      `moderation:${kind}:${id}:${hide ? "hide" : "restore"}:${Date.now()}`,
      await recipientFor(tx, ownerId),
      {
        subject: hide
          ? `Ocultamos tu ${kindLabel[kind]}: ${row.title}`
          : `Ya puedes volver a publicar: ${row.title}`,
        title: hide
          ? `Ocultamos uno de tus ${kindLabel[kind]}s`
          : "Tu publicación quedó habilitada",
        paragraphs: hide
          ? [
              `«${row.title}» ya no se muestra en CuadraZone.`,
              `Motivo: ${why}`,
              "Si crees que es un error o ya lo corregiste, responde a este correo.",
            ]
          : [
              `Revisamos «${row.title}». Ya puedes volver a publicarlo desde tu tienda.`,
            ],
        cta: { label: "Ir a mi tienda", path: "/vendedor/panel" },
      }
    );
    return { hidden: hide };
  });
}

// ───────────── Reseñas ─────────────

export async function listReviewsForModeration(q: string) {
  const db = await requireDb();
  const term = `%${q.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const rows = await db
    .select({
      id: czReviews.id,
      rating: czReviews.rating,
      body: czReviews.body,
      createdAt: czReviews.createdAt,
      hiddenAt: czReviews.hiddenAt,
      hiddenReason: czReviews.hiddenReason,
      productTitle: czProducts.title,
      productSlug: czProducts.slug,
      storeName: czStores.name,
    })
    .from(czReviews)
    .innerJoin(czProducts, eq(czProducts.id, czReviews.productId))
    .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
    .where(
      q.trim()
        ? or(
            like(czReviews.body, term),
            like(czProducts.title, term),
            like(czStores.name, term)
          )
        : undefined
    )
    .orderBy(desc(czReviews.createdAt))
    .limit(50);
  return rows.map((r: any) => ({
    ...r,
    createdAt: new Date(r.createdAt).toISOString(),
    hiddenAt: iso(r.hiddenAt),
  }));
}

export async function moderateReview(
  admin: User,
  id: number,
  hide: boolean,
  reason: string
) {
  const db = await requireDb();
  const why = hide ? cleanReason(reason) : null;
  const rows = await db
    .select({ id: czReviews.id, userId: czReviews.userId })
    .from(czReviews)
    .where(eq(czReviews.id, id))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "La reseña no existe");
  await db
    .update(czReviews)
    .set(
      hide
        ? { hiddenAt: new Date(), hiddenReason: why }
        : { hiddenAt: null, hiddenReason: null }
    )
    .where(eq(czReviews.id, id));
  await db.transaction((tx: any) =>
    audit(
      tx,
      rows[0].userId,
      admin.id,
      hide ? "review_hidden" : "review_restored",
      why,
      { reviewId: id }
    )
  );
  return { hidden: hide };
}

// ───────────── Vendedores: suspender ─────────────

export async function searchSellers(q: string) {
  const db = await requireDb();
  const term = `%${q.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const rows = await db
    .select({
      applicationId: czApplications.id,
      userId: czApplications.userId,
      email: czApplications.contactEmail,
      phone: czApplications.contactPhone,
      status: czApplications.status,
      subscriptionStatus: czApplications.subscriptionStatus,
      holdReason: czApplications.holdReason,
      planId: czApplications.subscriptionPlanId,
      endsAt: czApplications.subscriptionEndsAt,
      storeName: czStores.name,
      storeSlug: czStores.slug,
    })
    .from(czApplications)
    .leftJoin(czStores, eq(czStores.userId, czApplications.userId))
    .where(
      and(
        eq(czApplications.status, "approved"),
        q.trim()
          ? or(
              like(czStores.name, term),
              like(czApplications.contactEmail, term),
              like(czApplications.contactPhone, term)
            )
          : undefined
      )
    )
    .orderBy(desc(czApplications.id))
    .limit(50);
  return rows.map((r: any) => ({
    ...r,
    endsAt: iso(r.endsAt),
    suspended: r.holdReason === "suspended",
  }));
}

/** Suspende la tienda: se oculta toda y ningún pago la reactiva hasta que un administrador lo decida. */
export async function suspendSeller(
  admin: User,
  applicationId: number,
  reason: string
) {
  const why = cleanReason(reason);
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czApplications)
      .where(eq(czApplications.id, applicationId))
      .for("update")
      .limit(1);
    const app = rows[0];
    if (!app || app.status !== "approved")
      fail("NOT_FOUND", "El vendedor no existe o no está aprobado");
    if (app.holdReason === "suspended")
      fail("CONFLICT", "Este vendedor ya está suspendido");
    await tx
      .update(czApplications)
      .set({ subscriptionStatus: "past_due", holdReason: "suspended" })
      .where(eq(czApplications.id, app.id));
    await tx.insert(czMembershipAudit).values({
      applicationId: app.id,
      userId: app.userId,
      actorUserId: admin.id,
      action: "seller_suspended",
      reason: why,
      metadata: {
        previousStatus: app.subscriptionStatus,
        previousHold: app.holdReason ?? null,
      },
    });
    await queueEmail(
      tx,
      `seller-suspended:${app.id}:${Date.now()}`,
      await recipientFor(tx, app.userId),
      {
        subject: "Tu tienda en CuadraZone fue suspendida",
        title: "Suspendimos tu tienda",
        paragraphs: [
          `Motivo: ${why}`,
          "Mientras dure la suspensión tu tienda y tus publicaciones no se muestran. Responde a este correo para resolverlo.",
        ],
      }
    );
    return { suspended: true };
  });
}

export async function unsuspendSeller(
  admin: User,
  applicationId: number,
  note: string,
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(czApplications)
      .where(eq(czApplications.id, applicationId))
      .for("update")
      .limit(1);
    const app = rows[0];
    if (!app) fail("NOT_FOUND", "El vendedor no existe");
    if (app.holdReason !== "suspended")
      fail("CONFLICT", "Este vendedor no está suspendido");
    const paid = Boolean(
      app.subscriptionEndsAt && new Date(app.subscriptionEndsAt) > now
    );
    const commission =
      paid && (await hasOverdueCommission(tx, app.userId, now));
    const next = !paid
      ? { subscriptionStatus: "past_due" as const, holdReason: null }
      : commission
        ? { subscriptionStatus: "past_due" as const, holdReason: "commission" }
        : { subscriptionStatus: "active" as const, holdReason: null };
    await tx
      .update(czApplications)
      .set(next)
      .where(eq(czApplications.id, app.id));
    await tx.insert(czMembershipAudit).values({
      applicationId: app.id,
      userId: app.userId,
      actorUserId: admin.id,
      action: "seller_unsuspended",
      reason: note.trim().slice(0, 300) || null,
      metadata: {
        status: next.subscriptionStatus,
        holdReason: next.holdReason,
      },
    });
    await queueEmail(
      tx,
      `seller-unsuspended:${app.id}:${Date.now()}`,
      await recipientFor(tx, app.userId),
      {
        subject: "Levantamos la suspensión de tu tienda",
        title: "Tu tienda ya no está suspendida",
        paragraphs: [
          next.subscriptionStatus === "active"
            ? "Tu tienda vuelve a mostrarse en CuadraZone."
            : next.holdReason === "commission"
              ? "Para que vuelva a mostrarse, paga la comisión pendiente."
              : "Para que vuelva a mostrarse, paga tu mensualidad.",
        ],
        cta: { label: "Ir a mi tienda", path: "/vendedor/panel" },
      }
    );
    return { status: next.subscriptionStatus };
  });
}

async function audit(
  tx: any,
  userId: number,
  actorId: number,
  action: string,
  reason: string | null,
  metadata: Record<string, unknown>
) {
  const apps = await tx
    .select({ id: czApplications.id })
    .from(czApplications)
    .where(eq(czApplications.userId, userId))
    .limit(1);
  if (!apps[0]) return;
  await tx
    .insert(czMembershipAudit)
    .values({
      applicationId: apps[0].id,
      userId,
      actorUserId: actorId,
      action,
      reason,
      metadata,
    });
}

// ───────────── Reportes ─────────────

export async function adminReports(now = new Date()) {
  const db = await requireDb();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since90 = new Date(now.getTime() - 90 * DAY_MS);
  const fromMonth = panamaMonthKey(monthsAgoStart(now, REPORT_MONTHS - 1));
  const [
    userTotals,
    sellers,
    pendingApps,
    subPayments,
    commissionPayments,
    sales,
    categories,
    tickets,
    appointments,
    claims,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${gte(users.lastSignedIn, since30)} then 1 else 0 end)`,
        fresh: sql<number>`sum(case when ${gte(users.createdAt, since30)} then 1 else 0 end)`,
      })
      .from(users),
    db
      .select({
        status: czApplications.subscriptionStatus,
        planId: czApplications.subscriptionPlanId,
        holdReason: czApplications.holdReason,
        n: sql<number>`count(*)`,
      })
      .from(czApplications)
      .where(eq(czApplications.status, "approved"))
      .groupBy(
        czApplications.subscriptionStatus,
        czApplications.subscriptionPlanId,
        czApplications.holdReason
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czApplications)
      .where(eq(czApplications.status, "pending")),
    db
      .select({
        paidOn: czSubscriptionPayments.paidOn,
        amountCents: czSubscriptionPayments.amountCents,
      })
      .from(czSubscriptionPayments)
      .where(gte(czSubscriptionPayments.paidOn, `${fromMonth}-01`)),
    db
      .select({
        paidOn: czCommissionPayments.paidOn,
        amountCents: czCommissionPayments.amountCents,
      })
      .from(czCommissionPayments)
      .where(gte(czCommissionPayments.paidOn, `${fromMonth}-01`)),
    db
      .select({
        n: sql<number>`count(*)`,
        subtotal: sql<number>`coalesce(sum(${czOrders.subtotalCents}), 0)`,
      })
      .from(czOrders)
      .where(
        and(
          eq(czOrders.status, "delivered"),
          gte(czOrders.deliveredAt, since90)
        )
      ),
    db
      .select({
        category: czProducts.category,
        quantity: sql<number>`sum(${czOrderItems.quantity})`,
        revenueCents: sql<number>`sum(${czOrderItems.quantity} * ${czOrderItems.unitPriceCents})`,
      })
      .from(czOrderItems)
      .innerJoin(czOrders, eq(czOrders.id, czOrderItems.orderId))
      .innerJoin(czProducts, eq(czProducts.id, czOrderItems.productId))
      .where(
        and(
          eq(czOrders.status, "delivered"),
          gte(czOrders.deliveredAt, since90)
        )
      )
      .groupBy(czProducts.category)
      .orderBy(
        desc(
          sql`sum(${czOrderItems.quantity} * ${czOrderItems.unitPriceCents})`
        )
      )
      .limit(15),
    db
      .select({
        n: sql<number>`coalesce(sum(${czTicketOrders.quantity}), 0)`,
        total: sql<number>`coalesce(sum(${czTicketOrders.totalCents}), 0)`,
      })
      .from(czTicketOrders)
      .where(
        and(
          eq(czTicketOrders.status, "paid"),
          gte(czTicketOrders.paidAt, since90)
        )
      ),
    db
      .select({ status: czAppointments.status, n: sql<number>`count(*)` })
      .from(czAppointments)
      .where(gte(czAppointments.startsAt, since90))
      .groupBy(czAppointments.status),
    db
      .select({
        status: czClaims.status,
        respondBy: czClaims.respondBy,
        createdAt: czClaims.createdAt,
        resolvedAt: czClaims.resolvedAt,
      })
      .from(czClaims)
      .where(
        or(
          inArray(czClaims.status, ["open", "answered"]),
          gte(czClaims.resolvedAt, since90)
        )
      ),
  ]);

  // Vendedores por situación.
  const sellerCounts = {
    trial: 0,
    normal: 0,
    mayorVisibilidad: 0,
    hiddenUnpaid: 0,
    hiddenCommission: 0,
    suspended: 0,
    cancelled: 0,
    notStarted: 0,
  };
  for (const s of sellers as any[]) {
    const n = Number(s.n);
    if (s.holdReason === "suspended") sellerCounts.suspended += n;
    else if (s.status === "active") {
      if (s.planId === "prueba") sellerCounts.trial += n;
      else if (s.planId === "mayor_visibilidad")
        sellerCounts.mayorVisibilidad += n;
      else sellerCounts.normal += n;
    } else if (s.status === "past_due")
      s.holdReason === "commission"
        ? (sellerCounts.hiddenCommission += n)
        : (sellerCounts.hiddenUnpaid += n);
    else if (s.status === "cancelled") sellerCounts.cancelled += n;
    else sellerCounts.notStarted += n;
  }

  // Ingresos de CuadraZone por mes (fecha del pago).
  const months: Array<{
    month: string;
    subscriptionsCents: number;
    commissionsCents: number;
  }> = [];
  for (let back = REPORT_MONTHS - 1; back >= 0; back--)
    months.push({
      month: panamaMonthKey(monthsAgoStart(now, back)),
      subscriptionsCents: 0,
      commissionsCents: 0,
    });
  for (const p of subPayments as any[]) {
    const m = months.find(x => x.month === String(p.paidOn).slice(0, 7));
    if (m) m.subscriptionsCents += Number(p.amountCents);
  }
  for (const p of commissionPayments as any[]) {
    const m = months.find(x => x.month === String(p.paidOn).slice(0, 7));
    if (m) m.commissionsCents += Number(p.amountCents);
  }

  const appt = new Map(
    (appointments as any[]).map(a => [a.status, Number(a.n)])
  );
  const claimRows = claims as any[];
  return {
    users: {
      total: Number(userTotals[0]?.total ?? 0),
      active30: Number(userTotals[0]?.active ?? 0),
      new30: Number(userTotals[0]?.fresh ?? 0),
    },
    sellers: {
      ...sellerCounts,
      pendingApplications: Number(pendingApps[0]?.n ?? 0),
    },
    revenue: months,
    sales90: {
      orders: Number(sales[0]?.n ?? 0),
      productsCents: Number(sales[0]?.subtotal ?? 0),
      tickets: Number(tickets[0]?.n ?? 0),
      ticketsCents: Number(tickets[0]?.total ?? 0),
      appointmentsCompleted: appt.get("completed") ?? 0,
      appointmentsTotal: Array.from(appt.values()).reduce((a, b) => a + b, 0),
    },
    categories: (categories as any[]).map(c => ({
      category: c.category as string,
      quantity: Number(c.quantity ?? 0),
      revenueCents: Number(c.revenueCents ?? 0),
    })),
    claims: {
      open: claimRows.filter(c => c.status === "open").length,
      overdue: claimRows.filter(c => isClaimOverdue(c, now)).length,
      toDecide: claimRows.filter(c => c.status === "answered").length,
      resolved90: claimRows.filter(c => c.status === "resolved").length,
    },
  };
}
