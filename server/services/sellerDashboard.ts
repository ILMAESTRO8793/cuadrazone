// Etapa 6 · Panel del vendedor: resumen de lo que hay por atender y reportes de
// ventas de SU tienda. Cada consulta filtra por la tienda del usuario que entra;
// nunca se aceptan identificadores de tienda desde el cliente.
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import {
  czAppointments,
  czProducts,
  czStores,
  czTicketOrders,
  czVariants,
} from "../../drizzle/catalog-schema";
import {
  czNotifications,
  czOrderItems,
  czOrders,
  czQuestions,
  czReviews,
} from "../../drizzle/commerce-schema";
import { czApplications, type User } from "../../drizzle/schema";
import {
  LOW_STOCK_THRESHOLD,
  REPORT_MONTHS,
  TOP_PRODUCTS_DAYS,
  monthOverMonth,
  monthsAgoStart,
  summarizeSales,
} from "@shared/sellerDashboard";
import { getDb } from "../db";
import { commissionForSeller } from "./commissions";
import { openClaimsForSeller } from "./claims";

const DAY_MS = 24 * 60 * 60 * 1000;
const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

/** Inicio del día de hoy en Panamá. */
function panamaDayStart(now: Date) {
  const local = new Date(now.getTime() - PANAMA_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) +
      PANAMA_OFFSET_MS
  );
}

export async function sellerDashboard(user: User, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const found = (
    await db
      .select({ store: czStores, app: czApplications })
      .from(czStores)
      .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .where(eq(czStores.userId, user.id))
      .limit(1)
  )[0] as { store: any; app: any } | undefined;
  if (!found) return { hasStore: false as const };
  const { store, app } = found;
  const storeId = store.id as number;
  const salesFrom = monthsAgoStart(now, REPORT_MONTHS - 1);
  const today = panamaDayStart(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const weekAhead = new Date(today.getTime() + 8 * DAY_MS);

  const [
    orderCounts,
    deliveredOrders,
    paidTickets,
    reservedTickets,
    appointmentsToday,
    upcomingAppointments,
    unanswered,
    unansweredCount,
    unread,
    lowStock,
    topProducts,
    reviewStats,
    latestReviews,
    commission,
  ] = await Promise.all([
    db
      .select({ status: czOrders.status, n: sql<number>`count(*)` })
      .from(czOrders)
      .where(eq(czOrders.storeId, storeId))
      .groupBy(czOrders.status),
    db
      .select({
        deliveredAt: czOrders.deliveredAt,
        subtotalCents: czOrders.subtotalCents,
        commissionCents: czOrders.commissionCents,
      })
      .from(czOrders)
      .where(
        and(
          eq(czOrders.storeId, storeId),
          eq(czOrders.status, "delivered"),
          gte(czOrders.deliveredAt, salesFrom)
        )
      ),
    db
      .select({
        paidAt: czTicketOrders.paidAt,
        totalCents: czTicketOrders.totalCents,
        quantity: czTicketOrders.quantity,
        commissionCents: czTicketOrders.commissionCents,
      })
      .from(czTicketOrders)
      .where(
        and(
          eq(czTicketOrders.storeId, storeId),
          eq(czTicketOrders.status, "paid"),
          gte(czTicketOrders.paidAt, salesFrom)
        )
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czTicketOrders)
      .where(
        and(
          eq(czTicketOrders.storeId, storeId),
          eq(czTicketOrders.status, "reserved")
        )
      ),
    db
      .select({
        id: czAppointments.id,
        startsAt: czAppointments.startsAt,
        serviceTitle: czAppointments.serviceTitle,
        clientName: czAppointments.clientName,
      })
      .from(czAppointments)
      .where(
        and(
          eq(czAppointments.storeId, storeId),
          eq(czAppointments.status, "confirmed"),
          gte(czAppointments.startsAt, today),
          lt(czAppointments.startsAt, tomorrow)
        )
      )
      .orderBy(asc(czAppointments.startsAt))
      .limit(20),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czAppointments)
      .where(
        and(
          eq(czAppointments.storeId, storeId),
          eq(czAppointments.status, "confirmed"),
          gte(czAppointments.startsAt, now),
          lt(czAppointments.startsAt, weekAhead)
        )
      ),
    db
      .select({
        id: czQuestions.id,
        body: czQuestions.body,
        createdAt: czQuestions.createdAt,
        productTitle: czProducts.title,
        productSlug: czProducts.slug,
      })
      .from(czQuestions)
      .innerJoin(czProducts, eq(czProducts.id, czQuestions.productId))
      .where(
        and(eq(czProducts.storeId, storeId), isNull(czQuestions.answerBody))
      )
      .orderBy(desc(czQuestions.createdAt))
      .limit(5),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czQuestions)
      .innerJoin(czProducts, eq(czProducts.id, czQuestions.productId))
      .where(
        and(eq(czProducts.storeId, storeId), isNull(czQuestions.answerBody))
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czNotifications)
      .where(
        and(eq(czNotifications.userId, user.id), isNull(czNotifications.readAt))
      ),
    db
      .select({
        title: czProducts.title,
        slug: czProducts.slug,
        size: czVariants.size,
        color: czVariants.color,
        stock: czVariants.stock,
      })
      .from(czVariants)
      .innerJoin(czProducts, eq(czProducts.id, czVariants.productId))
      .where(
        and(
          eq(czProducts.storeId, storeId),
          eq(czProducts.status, "published"),
          eq(czVariants.active, 1),
          lte(czVariants.stock, LOW_STOCK_THRESHOLD)
        )
      )
      .orderBy(asc(czVariants.stock), asc(czProducts.title))
      .limit(10),
    db
      .select({
        title: czOrderItems.title,
        productId: czOrderItems.productId,
        slug: czProducts.slug,
        quantity: sql<number>`sum(${czOrderItems.quantity})`,
        revenueCents: sql<number>`sum(${czOrderItems.quantity} * ${czOrderItems.unitPriceCents})`,
      })
      .from(czOrderItems)
      .innerJoin(czOrders, eq(czOrders.id, czOrderItems.orderId))
      .leftJoin(czProducts, eq(czProducts.id, czOrderItems.productId))
      .where(
        and(
          eq(czOrders.storeId, storeId),
          eq(czOrders.status, "delivered"),
          gte(
            czOrders.deliveredAt,
            new Date(now.getTime() - TOP_PRODUCTS_DAYS * DAY_MS)
          )
        )
      )
      .groupBy(czOrderItems.productId, czOrderItems.title, czProducts.slug)
      .orderBy(desc(sql`sum(${czOrderItems.quantity})`))
      .limit(5),
    db
      .select({
        average: sql<number>`avg(${czReviews.rating})`,
        n: sql<number>`count(*)`,
      })
      .from(czReviews)
      .innerJoin(czProducts, eq(czProducts.id, czReviews.productId))
      .where(and(eq(czProducts.storeId, storeId), isNull(czReviews.hiddenAt))),
    db
      .select({
        id: czReviews.id,
        rating: czReviews.rating,
        body: czReviews.body,
        createdAt: czReviews.createdAt,
        productTitle: czProducts.title,
        productSlug: czProducts.slug,
      })
      .from(czReviews)
      .innerJoin(czProducts, eq(czProducts.id, czReviews.productId))
      .where(and(eq(czProducts.storeId, storeId), isNull(czReviews.hiddenAt)))
      .orderBy(desc(czReviews.createdAt))
      .limit(8),
    commissionForSeller(user.id, now),
  ]);

  const claims = await openClaimsForSeller(db, user.id, now);
  const counts = new Map(orderCounts.map((r: any) => [r.status, Number(r.n)]));
  const sales = summarizeSales(
    deliveredOrders as any[],
    paidTickets as any[],
    now
  );
  const reviews = reviewStats[0] as
    | { average: number | string | null; n: number | string }
    | undefined;
  return {
    hasStore: true as const,
    store: {
      name: store.name as string,
      slug: store.slug as string,
      kind: store.storeKind as "comercio" | "servicios",
    },
    plan: {
      applicationStatus: app.status as string,
      subscriptionStatus: app.subscriptionStatus as string,
      planId: (app.subscriptionPlanId ?? null) as string | null,
      endsAt: iso(app.subscriptionEndsAt),
      trialEndsAt: iso(app.trialEndsAt),
      inTrial: Boolean(app.trialEndsAt && new Date(app.trialEndsAt) > now),
      holdReason: (app.holdReason ?? null) as string | null,
      commissionDueCents: commission?.dueCents ?? 0,
      commissionAccruingCents: commission?.accruingCents ?? 0,
    },
    todo: {
      pendingOrders: counts.get("pending") ?? 0,
      toShip: counts.get("confirmed") ?? 0,
      shipped: counts.get("shipped") ?? 0,
      reservedTickets: Number(reservedTickets[0]?.n ?? 0),
      appointmentsWeek: Number(upcomingAppointments[0]?.n ?? 0),
      unansweredQuestions: Number(unansweredCount[0]?.n ?? 0),
      unreadNotifications: Number(unread[0]?.n ?? 0),
      lowStock: lowStock.length,
      openClaims: claims.length,
    },
    appointmentsToday: appointmentsToday.map((a: any) => ({
      ...a,
      startsAt: new Date(a.startsAt).toISOString(),
    })),
    questions: unanswered.map((q: any) => ({
      ...q,
      createdAt: new Date(q.createdAt).toISOString(),
    })),
    claims,
    lowStock: lowStock.map((v: any) => ({ ...v, stock: Number(v.stock) })),
    sales,
    salesChangePercent: monthOverMonth(sales),
    totals: {
      orders: Array.from(counts.values()).reduce((a, b) => a + b, 0),
      delivered: counts.get("delivered") ?? 0,
      cancelled: counts.get("cancelled") ?? 0,
    },
    topProducts: topProducts.map((p: any) => ({
      title: p.title as string,
      productId: (p.productId ?? null) as number | null,
      slug: (p.slug ?? null) as string | null,
      quantity: Number(p.quantity ?? 0),
      revenueCents: Number(p.revenueCents ?? 0),
    })),
    reviews: {
      average:
        reviews?.average === null || reviews?.average === undefined
          ? null
          : Math.round(Number(reviews.average) * 10) / 10,
      count: Number(reviews?.n ?? 0),
      latest: latestReviews.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    },
  };
}
