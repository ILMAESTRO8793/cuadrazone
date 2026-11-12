/*
 * Dashboard CuadraZone (solo administradores): ingresos diarios, mensuales y
 * anuales, suscripciones, tiendas, clientes, gastos, impuestos y reparto entre
 * socios. Solo se llama desde adminProcedure.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
import {
  czAdvertiserPayments,
  czProducts,
  czStores,
} from "../../drizzle/catalog-schema";
import {
  czCommissionPayments,
  czOrderItems,
  czOrders,
} from "../../drizzle/commerce-schema";
import {
  czApplications,
  czMembershipProfiles,
  czSubscriptionPayments,
  users,
} from "../../drizzle/schema";
import { czExpenses, czFinanceSettings } from "../../drizzle/finance-schema";
import { czServicePubPayments } from "../../drizzle/servicepub-schema";
import {
  DEFAULT_FINANCE_SETTINGS,
  ITBMS_THRESHOLD_CENTS,
  expenseCategories,
  financeSettingsInput,
  panamaDateKey,
  splitProfit,
  type ExpenseCategory,
  type ExpenseInput,
  type FinanceSettings,
  type RevenueSource,
} from "@shared/finance";
import { getDb } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

// ───────────── Configuración de finanzas ─────────────

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const db = await requireDb();
  const rows = await db
    .select({ settings: czFinanceSettings.settings })
    .from(czFinanceSettings)
    .where(eq(czFinanceSettings.id, 1))
    .limit(1);
  const parsed = financeSettingsInput.safeParse(rows[0]?.settings);
  return parsed.success ? parsed.data : DEFAULT_FINANCE_SETTINGS;
}

export async function saveFinanceSettings(
  adminId: number,
  settings: FinanceSettings
) {
  const db = await requireDb();
  await db
    .insert(czFinanceSettings)
    .values({ id: 1, settings, updatedBy: adminId })
    .onDuplicateKeyUpdate({ set: { settings, updatedBy: adminId } });
  return settings;
}

// ───────────── Gastos ─────────────

export async function listExpenses(year: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(czExpenses)
    .where(
      and(
        gte(czExpenses.spentOn, `${year}-01-01`),
        lt(czExpenses.spentOn, `${year + 1}-01-01`)
      )
    )
    .orderBy(desc(czExpenses.spentOn), desc(czExpenses.id));
  return rows.map(r => ({
    id: r.id,
    category: r.category as ExpenseCategory,
    description: r.description,
    amountCents: r.amountCents,
    spentOn: r.spentOn,
  }));
}

export async function addExpense(adminId: number, input: ExpenseInput) {
  const db = await requireDb();
  const [res] = await db
    .insert(czExpenses)
    .values({ ...input, recordedBy: adminId });
  return { id: Number((res as { insertId?: number }).insertId ?? 0) };
}

export async function deleteExpense(id: number) {
  const db = await requireDb();
  await db.delete(czExpenses).where(eq(czExpenses.id, id));
  return { deleted: true };
}

// ───────────── Resumen ─────────────

type Payment = {
  paidOn: string;
  amountCents: number;
  source: RevenueSource;
};

const emptySources = () => ({ suscripciones: 0, comisiones: 0, anuncios: 0 });

export async function dashboardOverview(year: number, now = new Date()) {
  const db = await requireDb();
  const today = panamaDateKey(now);
  const thisMonth = today.slice(0, 7);
  const thisYear = Number(today.slice(0, 4));
  const dailyFrom = panamaDateKey(new Date(now.getTime() - 29 * DAY_MS));
  const from = [`${year - 1}-01-01`, dailyFrom].sort()[0]!;
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    subs,
    commissions,
    ads,
    expenses,
    sellerRows,
    userTotals,
    pendingApps,
    sellerUsers,
    sales,
    recentSubs,
    pubs,
  ] = await Promise.all([
    db
      .select({
        paidOn: czSubscriptionPayments.paidOn,
        amountCents: czSubscriptionPayments.amountCents,
        planId: czSubscriptionPayments.planId,
      })
      .from(czSubscriptionPayments)
      .where(gte(czSubscriptionPayments.paidOn, from)),
    db
      .select({
        paidOn: czCommissionPayments.paidOn,
        amountCents: czCommissionPayments.amountCents,
      })
      .from(czCommissionPayments)
      .where(gte(czCommissionPayments.paidOn, from)),
    db
      .select({
        paidOn: czAdvertiserPayments.paidOn,
        amountCents: czAdvertiserPayments.amountCents,
      })
      .from(czAdvertiserPayments)
      .where(gte(czAdvertiserPayments.paidOn, from)),
    db
      .select({
        spentOn: czExpenses.spentOn,
        category: czExpenses.category,
        amountCents: czExpenses.amountCents,
      })
      .from(czExpenses)
      .where(
        and(
          gte(czExpenses.spentOn, `${year}-01-01`),
          lt(czExpenses.spentOn, `${year + 1}-01-01`)
        )
      ),
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
      .select({
        total: sql<number>`count(*)`,
        admins: sql<number>`sum(case when ${users.role} = 'admin' then 1 else 0 end)`,
        fresh: sql<number>`sum(case when ${gte(users.createdAt, since30)} then 1 else 0 end)`,
      })
      .from(users),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czApplications)
      .where(eq(czApplications.status, "pending")),
    db
      .select({ n: sql<number>`count(*)` })
      .from(czApplications)
      .innerJoin(users, eq(users.id, czApplications.userId))
      .where(
        and(eq(czApplications.status, "approved"), eq(users.role, "user"))
      ),
    db
      .select({
        n: sql<number>`count(*)`,
        subtotal: sql<number>`coalesce(sum(${czOrders.subtotalCents}), 0)`,
      })
      .from(czOrders)
      .where(
        and(
          eq(czOrders.status, "delivered"),
          gte(czOrders.deliveredAt, new Date(`${year}-01-01T05:00:00Z`)),
          lt(czOrders.deliveredAt, new Date(`${year + 1}-01-01T05:00:00Z`))
        )
      ),
    db
      .select({
        id: czSubscriptionPayments.id,
        planId: czSubscriptionPayments.planId,
        months: czSubscriptionPayments.months,
        amountCents: czSubscriptionPayments.amountCents,
        method: czSubscriptionPayments.method,
        paidOn: czSubscriptionPayments.paidOn,
        storeName: czStores.name,
        businessName: czApplications.businessName,
        logoUrl: czStores.logoUrl,
        sellerName: czApplications.legalGivenNames,
      })
      .from(czSubscriptionPayments)
      .leftJoin(
        czApplications,
        eq(czApplications.id, czSubscriptionPayments.applicationId)
      )
      .leftJoin(czStores, eq(czStores.userId, czSubscriptionPayments.userId))
      .orderBy(
        desc(czSubscriptionPayments.paidOn),
        desc(czSubscriptionPayments.id)
      )
      .limit(8),
    db
      .select({
        paidOn: czServicePubPayments.paidOn,
        amountCents: czServicePubPayments.amountCents,
      })
      .from(czServicePubPayments)
      .where(gte(czServicePubPayments.paidOn, from)),
  ]);

  const payments: Payment[] = [
    ...subs.map(p => ({ ...p, source: "suscripciones" as const })),
    ...commissions.map(p => ({ ...p, source: "comisiones" as const })),
    ...ads.map(p => ({ ...p, source: "anuncios" as const })),
    ...pubs.map(p => ({ ...p, source: "anuncios" as const })),
  ].map(p => ({
    paidOn: String(p.paidOn),
    amountCents: num(p.amountCents),
    source: p.source,
  }));

  // Diario: últimos 30 días.
  const daily = Array.from({ length: 30 }, (_, i) => ({
    date: panamaDateKey(new Date(now.getTime() - (29 - i) * DAY_MS)),
    ...emptySources(),
  }));
  // Mensual: los 12 meses del año elegido, con gastos.
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    ...emptySources(),
    gastos: 0,
  }));
  const totals = {
    todayCents: 0,
    monthCents: 0,
    prevMonthCents: 0,
    yearCents: 0,
    prevYearCents: 0,
    yearBySource: emptySources(),
  };
  const prevMonth = (() => {
    const [y, m] = thisMonth.split("-").map(Number) as [number, number];
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  for (const p of payments) {
    const day = daily.find(d => d.date === p.paidOn);
    if (day) day[p.source] += p.amountCents;
    const month = monthly.find(m => m.month === p.paidOn.slice(0, 7));
    if (month) month[p.source] += p.amountCents;
    if (p.paidOn === today) totals.todayCents += p.amountCents;
    if (p.paidOn.startsWith(thisMonth)) totals.monthCents += p.amountCents;
    if (p.paidOn.startsWith(prevMonth)) totals.prevMonthCents += p.amountCents;
    if (p.paidOn.startsWith(`${year}-`)) {
      totals.yearCents += p.amountCents;
      totals.yearBySource[p.source] += p.amountCents;
    }
    if (p.paidOn.startsWith(`${year - 1}-`))
      totals.prevYearCents += p.amountCents;
  }

  // Suscripciones vendidas en el año, por plan.
  const byPlan = new Map<string, { count: number; amountCents: number }>();
  for (const s of subs) {
    if (!String(s.paidOn).startsWith(`${year}-`)) continue;
    const row = byPlan.get(s.planId) ?? { count: 0, amountCents: 0 };
    row.count += 1;
    row.amountCents += num(s.amountCents);
    byPlan.set(s.planId, row);
  }

  // Gastos por categoría y por mes.
  const byCategory = new Map<string, number>();
  let expensesYear = 0;
  let expensesMonth = 0;
  for (const e of expenses) {
    const amount = num(e.amountCents);
    expensesYear += amount;
    if (e.spentOn.startsWith(thisMonth)) expensesMonth += amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    const month = monthly.find(m => m.month === e.spentOn.slice(0, 7));
    if (month) month.gastos += amount;
  }

  // Vendedores por plan.
  const sellers = {
    total: 0,
    trial: 0,
    normal: 0,
    mayorVisibilidad: 0,
    hidden: 0,
    suspended: 0,
    cancelled: 0,
    notStarted: 0,
  };
  for (const s of sellerRows) {
    const n = num(s.n);
    sellers.total += n;
    if (s.holdReason === "suspended") sellers.suspended += n;
    else if (s.status === "active") {
      if (s.planId === "prueba") sellers.trial += n;
      else if (s.planId === "mayor_visibilidad") sellers.mayorVisibilidad += n;
      else sellers.normal += n;
    } else if (s.status === "past_due") sellers.hidden += n;
    else if (s.status === "cancelled") sellers.cancelled += n;
    else sellers.notStarted += n;
  }
  const totalUsers = num(userTotals[0]?.total);
  const admins = num(userTotals[0]?.admins);
  const buyers = Math.max(0, totalUsers - admins - num(sellerUsers[0]?.n));

  // Finanzas: el mes en curso (si es del año elegido) y el año.
  const settings = await getFinanceSettings();
  const monthsElapsed =
    year < thisYear ? 12 : year > thisYear ? 1 : Number(thisMonth.slice(5, 7));
  const monthIncome = year === thisYear ? totals.monthCents : 0;
  const monthExpenses = year === thisYear ? expensesMonth : 0;

  return {
    year,
    today,
    month: thisMonth,
    totals,
    daily,
    monthly,
    subscriptions: {
      byPlan: Array.from(byPlan, ([planId, v]) => ({ planId, ...v })).sort(
        (a, b) => b.amountCents - a.amountCents
      ),
      recent: recentSubs.map(r => ({
        id: r.id,
        planId: r.planId,
        months: r.months,
        amountCents: r.amountCents,
        method: r.method,
        paidOn: r.paidOn,
        storeName: r.storeName || r.businessName || "Tienda sin nombre",
        logoUrl: r.logoUrl ?? null,
        sellerName: r.sellerName ?? "",
      })),
    },
    people: {
      users: totalUsers,
      buyers,
      admins,
      newUsers30: num(userTotals[0]?.fresh),
      pendingApplications: num(pendingApps[0]?.n),
      sellers,
    },
    sales: {
      orders: num(sales[0]?.n),
      gmvCents: num(sales[0]?.subtotal),
    },
    expenses: {
      yearCents: expensesYear,
      monthCents: expensesMonth,
      byCategory: expenseCategories
        .map(category => ({
          category,
          amountCents: byCategory.get(category) ?? 0,
        }))
        .filter(c => c.amountCents > 0)
        .sort((a, b) => b.amountCents - a.amountCents),
    },
    finance: {
      settings,
      monthsElapsed,
      itbmsThresholdReached: totals.yearCents >= ITBMS_THRESHOLD_CENTS,
      month: splitProfit(monthIncome, monthExpenses, settings, 1),
      year: splitProfit(
        totals.yearCents,
        expensesYear,
        settings,
        monthsElapsed
      ),
    },
  };
}

// ───────────── Tiendas ─────────────

export async function dashboardStores() {
  const db = await requireDb();
  const [stores, sales] = await Promise.all([
    db
      .select({
        id: czStores.id,
        userId: czStores.userId,
        slug: czStores.slug,
        name: czStores.name,
        kind: czStores.storeKind,
        province: czStores.province,
        logoUrl: czStores.logoUrl,
        createdAt: czStores.createdAt,
        sellerGiven: czApplications.legalGivenNames,
        sellerSurnames: czApplications.legalSurnames,
        email: czApplications.contactEmail,
        phone: czApplications.contactPhone,
        planId: czApplications.subscriptionPlanId,
        status: czApplications.subscriptionStatus,
        holdReason: czApplications.holdReason,
        accountName: users.name,
      })
      .from(czStores)
      .leftJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .leftJoin(users, eq(users.id, czStores.userId))
      .orderBy(czStores.name),
    db
      .select({
        storeId: czOrders.storeId,
        delivered: sql<number>`sum(case when ${czOrders.status} = 'delivered' then 1 else 0 end)`,
        soldCents: sql<number>`coalesce(sum(case when ${czOrders.status} = 'delivered' then ${czOrders.subtotalCents} else 0 end), 0)`,
        open: sql<number>`sum(case when ${czOrders.status} in ('pending','confirmed','shipped') then 1 else 0 end)`,
        commissionPendingCents: sql<number>`coalesce(sum(case when ${czOrders.status} = 'delivered' and ${czOrders.commissionPaymentId} is null then ${czOrders.commissionCents} else 0 end), 0)`,
      })
      .from(czOrders)
      .groupBy(czOrders.storeId),
  ]);
  const byStore = new Map(sales.map(s => [s.storeId, s]));
  return stores.map(s => {
    const sale = byStore.get(s.id);
    const seller = `${s.sellerGiven ?? ""} ${s.sellerSurnames ?? ""}`.trim();
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      kind: s.kind,
      province: s.province,
      logoUrl: s.logoUrl ?? null,
      createdAt: iso(s.createdAt),
      sellerName: seller || s.accountName || "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      planId: s.planId ?? null,
      status:
        s.holdReason === "suspended"
          ? "suspended"
          : (s.status ?? "not_started"),
      deliveredOrders: num(sale?.delivered),
      openOrders: num(sale?.open),
      soldCents: num(sale?.soldCents),
      commissionPendingCents: num(sale?.commissionPendingCents),
    };
  });
}

export async function dashboardStoreDetail(storeId: number, now = new Date()) {
  const db = await requireDb();
  const rows = await db
    .select({
      store: czStores,
      email: czApplications.contactEmail,
      phone: czApplications.contactPhone,
      sellerGiven: czApplications.legalGivenNames,
      sellerSurnames: czApplications.legalSurnames,
      planId: czApplications.subscriptionPlanId,
      status: czApplications.subscriptionStatus,
      endsAt: czApplications.subscriptionEndsAt,
      trialEndsAt: czApplications.trialEndsAt,
    })
    .from(czStores)
    .leftJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czStores.id, storeId))
    .limit(1);
  const row = rows[0];
  if (!row) fail("NOT_FOUND", "La tienda no existe");
  const store = row.store;
  const since = new Date(now.getTime() - 365 * DAY_MS);

  const [orders, delivery, payment, top, subPays, comPays] = await Promise.all([
    db
      .select({
        status: czOrders.status,
        subtotalCents: czOrders.subtotalCents,
        commissionCents: czOrders.commissionCents,
        createdAt: czOrders.createdAt,
        deliveredAt: czOrders.deliveredAt,
      })
      .from(czOrders)
      .where(
        and(eq(czOrders.storeId, storeId), gte(czOrders.createdAt, since))
      ),
    db
      .select({ mode: czOrders.deliveryMode, n: sql<number>`count(*)` })
      .from(czOrders)
      .where(eq(czOrders.storeId, storeId))
      .groupBy(czOrders.deliveryMode),
    db
      .select({ method: czOrders.paymentMethod, n: sql<number>`count(*)` })
      .from(czOrders)
      .where(eq(czOrders.storeId, storeId))
      .groupBy(czOrders.paymentMethod),
    db
      .select({
        title: czOrderItems.title,
        quantity: sql<number>`sum(${czOrderItems.quantity})`,
        revenueCents: sql<number>`sum(${czOrderItems.quantity} * ${czOrderItems.unitPriceCents})`,
      })
      .from(czOrderItems)
      .innerJoin(czOrders, eq(czOrders.id, czOrderItems.orderId))
      .where(
        and(eq(czOrders.storeId, storeId), eq(czOrders.status, "delivered"))
      )
      .groupBy(czOrderItems.title)
      .orderBy(
        desc(
          sql`sum(${czOrderItems.quantity} * ${czOrderItems.unitPriceCents})`
        )
      )
      .limit(5),
    db
      .select({
        paidOn: czSubscriptionPayments.paidOn,
        amountCents: czSubscriptionPayments.amountCents,
        planId: czSubscriptionPayments.planId,
        months: czSubscriptionPayments.months,
      })
      .from(czSubscriptionPayments)
      .where(eq(czSubscriptionPayments.userId, store.userId))
      .orderBy(desc(czSubscriptionPayments.paidOn))
      .limit(12),
    db
      .select({
        paidOn: czCommissionPayments.paidOn,
        amountCents: czCommissionPayments.amountCents,
      })
      .from(czCommissionPayments)
      .where(eq(czCommissionPayments.sellerUserId, store.userId))
      .orderBy(desc(czCommissionPayments.paidOn))
      .limit(12),
  ]);
  const products = await db
    .select({ n: sql<number>`count(*)` })
    .from(czProducts)
    .where(eq(czProducts.storeId, storeId));

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getTime());
    d.setUTCDate(15);
    d.setUTCMonth(d.getUTCMonth() - (11 - i));
    return { month: panamaDateKey(d).slice(0, 7), soldCents: 0, orders: 0 };
  });
  let soldCents = 0;
  let deliveredOrders = 0;
  let commissionCents = 0;
  const statusCounts: Record<string, number> = {};
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    if (o.status !== "delivered" || !o.deliveredAt) continue;
    deliveredOrders += 1;
    soldCents += num(o.subtotalCents);
    commissionCents += num(o.commissionCents);
    const m = months.find(
      x => x.month === panamaDateKey(new Date(o.deliveredAt!)).slice(0, 7)
    );
    if (m) {
      m.soldCents += num(o.subtotalCents);
      m.orders += 1;
    }
  }
  const byProvince = (store.shippingFeesByProvince ?? {}) as Record<
    string,
    number
  >;
  const seller = `${row.sellerGiven ?? ""} ${row.sellerSurnames ?? ""}`.trim();
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    kind: store.storeKind,
    logoUrl: store.logoUrl ?? null,
    province: store.province,
    city: store.city,
    sellerName: seller,
    email: row.email ?? "",
    phone: row.phone ?? "",
    planId: row.planId ?? null,
    status: row.status ?? "not_started",
    subscriptionEndsAt: iso(row.endsAt),
    trialEndsAt: iso(row.trialEndsAt),
    products: num(products[0]?.n),
    last12: { soldCents, deliveredOrders, commissionCents, statusCounts },
    monthly: months,
    shipping: {
      shippingFeeCents: store.shippingFeeCents ?? null,
      homeFeeCents: store.homeFeeCents ?? null,
      provinces: (store.deliveryProvinces ?? []) as string[],
      feesByProvince: byProvince,
      used: delivery.map(d => ({ mode: d.mode, orders: num(d.n) })),
    },
    payments: {
      yappyPhone: store.yappyPhone ?? null,
      yappyDirectory: store.yappyDirectory ?? null,
      cardPaymentUrl: store.cardPaymentUrl ?? null,
      cardOnDelivery: Boolean(store.cardOnDelivery),
      used: payment.map(p => ({ method: p.method, orders: num(p.n) })),
    },
    topProducts: top.map(t => ({
      title: t.title,
      quantity: num(t.quantity),
      revenueCents: num(t.revenueCents),
    })),
    subscriptionPayments: subPays,
    commissionPayments: comPays,
  };
}

// ───────────── Clientes ─────────────

export async function dashboardCustomers(search: string, page: number) {
  const db = await requireDb();
  const PAGE = 50;
  const q = search.trim();
  const filter = q
    ? or(
        like(users.name, `%${q}%`),
        like(users.email, `%${q}%`),
        like(users.phone, `%${q}%`),
        like(czMembershipProfiles.displayName, `%${q}%`),
        like(czMembershipProfiles.email, `%${q}%`),
        like(czMembershipProfiles.phone, `%${q}%`)
      )
    : undefined;
  const [rows, count] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        profileName: czMembershipProfiles.displayName,
        profileEmail: czMembershipProfiles.email,
        profilePhone: czMembershipProfiles.phone,
        appStatus: czApplications.status,
      })
      .from(users)
      .leftJoin(czMembershipProfiles, eq(czMembershipProfiles.userId, users.id))
      .leftJoin(czApplications, eq(czApplications.userId, users.id))
      .where(filter)
      .orderBy(desc(users.createdAt))
      .limit(PAGE)
      .offset(page * PAGE),
    db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .leftJoin(czMembershipProfiles, eq(czMembershipProfiles.userId, users.id))
      .where(filter),
  ]);
  const ids = rows.map(r => r.id);
  const [orders, lastPhones] = ids.length
    ? await Promise.all([
        db
          .select({
            userId: czOrders.userId,
            n: sql<number>`count(*)`,
            spentCents: sql<number>`coalesce(sum(case when ${czOrders.status} = 'delivered' then ${czOrders.totalCents} else 0 end), 0)`,
          })
          .from(czOrders)
          .where(inArray(czOrders.userId, ids))
          .groupBy(czOrders.userId),
        db
          .select({ userId: czOrders.userId, phone: czOrders.phone })
          .from(czOrders)
          .where(inArray(czOrders.userId, ids))
          .orderBy(desc(czOrders.createdAt)),
      ])
    : [[], []];
  const orderMap = new Map(orders.map(o => [o.userId, o]));
  const phoneMap = new Map<number, string>();
  for (const p of lastPhones)
    if (!phoneMap.has(p.userId)) phoneMap.set(p.userId, p.phone);
  return {
    total: num(count[0]?.n),
    pageSize: PAGE,
    customers: rows.map(r => ({
      id: r.id,
      name: r.profileName || r.name || "Sin nombre",
      email: r.profileEmail || r.email || "",
      phone: r.profilePhone || r.phone || phoneMap.get(r.id) || "",
      type:
        r.role === "admin"
          ? ("admin" as const)
          : r.appStatus === "approved"
            ? ("vendedor" as const)
            : ("comprador" as const),
      orders: num(orderMap.get(r.id)?.n),
      spentCents: num(orderMap.get(r.id)?.spentCents),
      createdAt: iso(r.createdAt),
      lastSignedIn: iso(r.lastSignedIn),
    })),
  };
}
