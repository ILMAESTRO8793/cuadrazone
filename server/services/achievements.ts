/*
 * Logros de cada vendedor o anunciante para las cinco estrellas. Se calculan
 * por dueño (userId), así sirven para tiendas, servicios, bienes raíces, autos
 * y empleos, también para quien anuncia sin tener tienda.
 */
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  czAdvertiserPayments,
  czAdvertiserPlans,
  czAppointments,
  czJobs,
  czProducts,
  czProperties,
  czStores,
  czTicketOrders,
  czVehicles,
} from "../../drizzle/catalog-schema";
import { czClaims, czOrders, czReviews } from "../../drizzle/commerce-schema";
import { czApplications, czSubscriptionPayments } from "../../drizzle/schema";
import { czListingReviews } from "../../drizzle/reviews-schema";
import { czStoreStars } from "../../drizzle/verification-schema";
import { czStoreLinks } from "../../drizzle/storelink-schema";
import { TRIAL_PLAN_ID } from "@shared/pricing";
import {
  MIN_DESCRIPTION,
  earnedStars,
  sortStars,
  type AchievementMetrics,
  type VerificationStar,
} from "@shared/stars";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const num = (v: unknown) => Number(v ?? 0) || 0;

function blank(): AchievementMetrics & { active: boolean } {
  return {
    featured: false,
    profileComplete: false,
    sales: 0,
    closedListings: 0,
    reviewCount: 0,
    reviewAverage: 0,
    lostClaims: 0,
    paidMonths: 0,
    upToDate: false,
    active: false,
  };
}

/** Logros de varios dueños a la vez. `active` = puede mostrar estrellas (plan al día). */
export async function metricsForUsers(
  db: Db,
  userIds: number[],
  now = new Date()
) {
  const ids = Array.from(new Set(userIds)).slice(0, 60);
  const out = new Map<number, AchievementMetrics & { active: boolean }>();
  for (const id of ids) out.set(id, blank());
  if (!ids.length) return out;

  const [
    apps,
    ads,
    stores,
    links,
    orders,
    appointments,
    tickets,
    closed,
    productReviews,
    listingReviews,
    claims,
    subPaid,
    adPaid,
  ] = await Promise.all([
    db
      .select({
        userId: czApplications.userId,
        status: czApplications.subscriptionStatus,
        planId: czApplications.subscriptionPlanId,
        phone: czApplications.contactPhone,
      })
      .from(czApplications)
      .where(
        and(
          inArray(czApplications.userId, ids),
          eq(czApplications.status, "approved")
        )
      ),
    db
      .select({
        userId: czAdvertiserPlans.userId,
        planId: czAdvertiserPlans.planId,
      })
      .from(czAdvertiserPlans)
      .where(
        and(
          inArray(czAdvertiserPlans.userId, ids),
          gt(czAdvertiserPlans.endsAt, now)
        )
      ),
    db
      .select({
        userId: czStores.userId,
        logoUrl: czStores.logoUrl,
        description: czStores.description,
      })
      .from(czStores)
      .where(inArray(czStores.userId, ids)),
    db
      .select({ userId: czStores.userId, url: czStoreLinks.url })
      .from(czStoreLinks)
      .innerJoin(czStores, eq(czStores.id, czStoreLinks.storeId))
      .where(inArray(czStores.userId, ids)),
    db
      .select({ userId: czStores.userId, n: sql<number>`count(*)` })
      .from(czOrders)
      .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
      .where(
        and(inArray(czStores.userId, ids), eq(czOrders.status, "delivered"))
      )
      .groupBy(czStores.userId),
    db
      .select({
        userId: czAppointments.providerUserId,
        n: sql<number>`count(*)`,
      })
      .from(czAppointments)
      .where(
        and(
          inArray(czAppointments.providerUserId, ids),
          eq(czAppointments.status, "completed")
        )
      )
      .groupBy(czAppointments.providerUserId),
    db
      .select({ userId: czStores.userId, n: sql<number>`count(*)` })
      .from(czTicketOrders)
      .innerJoin(czStores, eq(czStores.id, czTicketOrders.storeId))
      .where(
        and(inArray(czStores.userId, ids), eq(czTicketOrders.status, "paid"))
      )
      .groupBy(czStores.userId),
    Promise.all(
      [czProperties, czVehicles, czJobs].map(t =>
        db
          .select({
            userId: (t as typeof czJobs).userId,
            n: sql<number>`count(*)`,
          })
          .from(t as typeof czJobs)
          .where(
            and(
              inArray((t as typeof czJobs).userId, ids),
              eq((t as typeof czJobs).status, "closed")
            )
          )
          .groupBy((t as typeof czJobs).userId)
      )
    ),
    db
      .select({
        userId: czStores.userId,
        n: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${czReviews.rating}), 0)`,
      })
      .from(czReviews)
      .innerJoin(czProducts, eq(czProducts.id, czReviews.productId))
      .innerJoin(czStores, eq(czStores.id, czProducts.storeId))
      .where(and(inArray(czStores.userId, ids), isNull(czReviews.hiddenAt)))
      .groupBy(czStores.userId),
    db
      .select({
        userId: czListingReviews.ownerUserId,
        n: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${czListingReviews.rating}), 0)`,
      })
      .from(czListingReviews)
      .where(
        and(
          inArray(czListingReviews.ownerUserId, ids),
          isNull(czListingReviews.hiddenAt)
        )
      )
      .groupBy(czListingReviews.ownerUserId),
    db
      .select({ userId: czClaims.sellerUserId, n: sql<number>`count(*)` })
      .from(czClaims)
      .where(
        and(
          inArray(czClaims.sellerUserId, ids),
          eq(czClaims.resolution, "buyer_favor")
        )
      )
      .groupBy(czClaims.sellerUserId),
    db
      .select({
        userId: czSubscriptionPayments.userId,
        months: sql<number>`coalesce(sum(${czSubscriptionPayments.months}), 0)`,
      })
      .from(czSubscriptionPayments)
      .where(inArray(czSubscriptionPayments.userId, ids))
      .groupBy(czSubscriptionPayments.userId),
    db
      .select({
        userId: czAdvertiserPayments.userId,
        months: sql<number>`coalesce(sum(${czAdvertiserPayments.months}), 0)`,
      })
      .from(czAdvertiserPayments)
      .where(inArray(czAdvertiserPayments.userId, ids))
      .groupBy(czAdvertiserPayments.userId),
  ]);

  for (const a of apps) {
    const m = out.get(a.userId)!;
    if (a.status === "active") {
      m.active = true;
      m.upToDate = a.planId !== TRIAL_PLAN_ID;
      if (a.planId === "mayor_visibilidad") m.featured = true;
    }
  }
  for (const a of ads) {
    const m = out.get(a.userId)!;
    m.active = true;
    m.upToDate = true;
    if (a.planId === "mayor_visibilidad") m.featured = true;
  }
  const phones = new Map(apps.map(a => [a.userId, (a.phone ?? "").trim()]));
  const linked = new Set(links.filter(l => l.url).map(l => l.userId));
  for (const s of stores)
    out.get(s.userId)!.profileComplete =
      Boolean(s.logoUrl) &&
      (s.description ?? "").trim().length >= MIN_DESCRIPTION &&
      Boolean(phones.get(s.userId)) &&
      linked.has(s.userId);
  for (const list of [orders, appointments, tickets])
    for (const r of list) out.get(r.userId)!.sales += num(r.n);
  for (const group of closed)
    for (const r of group) out.get(r.userId)!.closedListings += num(r.n);
  const totals = new Map<number, { n: number; sum: number }>();
  for (const list of [productReviews, listingReviews])
    for (const r of list) {
      const t = totals.get(r.userId) ?? { n: 0, sum: 0 };
      t.n += num(r.n);
      t.sum += num(r.total);
      totals.set(r.userId, t);
    }
  for (const [userId, t] of totals) {
    const m = out.get(userId)!;
    m.reviewCount = t.n;
    m.reviewAverage = t.n ? Math.round((t.sum / t.n) * 10) / 10 : 0;
  }
  for (const c of claims) out.get(c.userId)!.lostClaims = num(c.n);
  for (const list of [subPaid, adPaid])
    for (const r of list) out.get(r.userId)!.paidMonths += num(r.months);
  return out;
}

/** Estrellas que se muestran: logros + las otorgadas a mano, solo con el plan al día. */
export async function starsForUsers(db: Db, userIds: number[]) {
  const metrics = await metricsForUsers(db, userIds);
  const manual = userIds.length
    ? await db
        .select({ userId: czStores.userId, star: czStoreStars.star })
        .from(czStoreStars)
        .innerJoin(czStores, eq(czStores.id, czStoreStars.storeId))
        .where(inArray(czStores.userId, Array.from(new Set(userIds))))
    : [];
  const out = new Map<number, VerificationStar[]>();
  for (const [userId, m] of metrics) {
    if (!m.active) continue;
    const given = manual.filter(r => r.userId === userId).map(r => r.star);
    const stars = sortStars([...earnedStars(m), ...given]);
    if (stars.length) out.set(userId, stars);
  }
  return { stars: out, metrics };
}
