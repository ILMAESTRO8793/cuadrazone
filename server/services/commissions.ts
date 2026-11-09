// Comisiones por venta (8% en la prueba gratuita, 5% después), de pedidos de
// productos entregados y de boletos de eventos pagados.
// El comprador paga directo al vendedor, así que la comisión es una deuda del
// vendedor con CuadraZone: se acumula con cada pedido entregado y se cobra por
// mes cerrado (ver shared/billing.ts). El vendedor la paga por Yappy,
// transferencia o tarjeta y avisa con «Ya pagué»; un administrador lo aprueba.
// Si pasan 15 días del cierre sin pagar, la tienda se oculta (holdReason
// "commission") y vuelve a mostrarse al registrarse el pago.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { panamaMonthStart, splitCommission } from "@shared/billing";
import { czStores, czTicketOrders } from "../../drizzle/catalog-schema";
import { czCommissionPayments, czOrders } from "../../drizzle/commerce-schema";
import {
  czApplications,
  czMembershipAudit,
  users,
  type User,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  isDuplicateKeyError,
  validateReceipt,
  type PaymentMethod,
} from "./subscriptions";
import { queueEmail, recipientFor } from "./email";
import { pendingTicketCommission } from "./events";
import {
  commissionPaymentReceipt,
  commissionReminder,
  commissionStatement,
  commissionSuspended,
} from "./emailMessages";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}

async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}

function affected(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}

/** Condición de pedidos entregados con comisión todavía sin pagar. */
const pendingCondition = and(
  eq(czOrders.status, "delivered"),
  isNull(czOrders.commissionPaymentId),
  gt(czOrders.commissionCents, 0)
);

export type PendingCommissionOrder = {
  /** «order»: pedido de productos entregado; «ticket»: venta de boletos pagada. */
  kind: "order" | "ticket";
  id: number;
  number: string;
  subtotalCents: number;
  commissionBps: number;
  commissionCents: number;
  deliveredAt: Date | null;
};

export async function pendingCommissionOrders(
  db: any,
  sellerUserId: number
): Promise<PendingCommissionOrder[]> {
  const orders: Omit<PendingCommissionOrder, "kind">[] = await db
      .select({
        id: czOrders.id,
        number: czOrders.number,
        subtotalCents: czOrders.subtotalCents,
        commissionBps: czOrders.commissionBps,
        commissionCents: czOrders.commissionCents,
        deliveredAt: czOrders.deliveredAt,
      })
      .from(czOrders)
      .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
      .where(and(eq(czStores.userId, sellerUserId), pendingCondition))
      // Sin límite: el total que se cobra tiene que coincidir con el que se salda al aprobar.
      .orderBy(czOrders.deliveredAt);
  // Boletos: la comisión se fija al marcar pagado; esa fecha hace de «entregado».
  const tickets: Array<{
    id: number;
    totalCents: number;
    commissionBps: number;
    commissionCents: number;
    paidAt: Date | null;
  }> = await db
    .select({
      id: czTicketOrders.id,
      totalCents: czTicketOrders.totalCents,
      commissionBps: czTicketOrders.commissionBps,
      commissionCents: czTicketOrders.commissionCents,
      paidAt: czTicketOrders.paidAt,
    })
    .from(czTicketOrders)
    .innerJoin(czStores, eq(czStores.id, czTicketOrders.storeId))
    .where(and(eq(czStores.userId, sellerUserId), pendingTicketCommission))
    .orderBy(czTicketOrders.paidAt);
  const time = (d: Date | null) => (d ? new Date(d).getTime() : 0);
  return [
    ...orders.map(order => ({ ...order, kind: "order" as const })),
    ...tickets.map(ticket => ({
      kind: "ticket" as const,
      id: ticket.id,
      number: `Boletos #${ticket.id}`,
      subtotalCents: ticket.totalCents,
      commissionBps: ticket.commissionBps,
      commissionCents: ticket.commissionCents,
      deliveredAt: ticket.paidAt,
    })),
  ].sort((a, b) => time(a.deliveredAt) - time(b.deliveredAt));
}

function summarize(orders: Array<{ commissionCents: number }>) {
  return {
    totalCents: orders.reduce((sum, order) => sum + order.commissionCents, 0),
    orderCount: orders.length,
  };
}

/** Lo que el propio vendedor debe de comisión: lo que ya hay que pagar y lo del mes en curso. */
export async function commissionForSeller(
  sellerUserId: number,
  now = new Date()
) {
  const db = await getDb();
  if (!db) return null;
  const orders = await pendingCommissionOrders(db, sellerUserId);
  const split = splitCommission(orders, now);
  return {
    ...summarize(orders),
    dueCents: split.dueCents,
    dueCount: split.dueCount,
    accruingCents: split.accruingCents,
    deadline: split.deadline,
    orders: orders.slice(-20),
  };
}

/** ¿Tiene comisión de un mes cerrado con más de 15 días sin pagar? */
export async function hasOverdueCommission(
  db: any,
  sellerUserId: number,
  now = new Date()
) {
  const orders = await pendingCommissionOrders(db, sellerUserId);
  return splitCommission(orders, now).deadline?.stage === "overdue";
}

async function sellerForApplication(db: any, applicationId: number) {
  const rows = await db
    .select({ userId: czApplications.userId, status: czApplications.status })
    .from(czApplications)
    .where(eq(czApplications.id, applicationId))
    .limit(1);
  const app = rows[0];
  if (!app) fail("NOT_FOUND", "La solicitud no existe");
  return app as { userId: number; status: string };
}

/** Detalle para el administrador: pedidos pendientes y pagos anteriores. */
export async function adminCommissionDetail(applicationId: number) {
  const db = await requireDb();
  const app = await sellerForApplication(db, applicationId);
  const orders = await pendingCommissionOrders(db, app.userId);
  const payments = await db
    .select({
      id: czCommissionPayments.id,
      amountCents: czCommissionPayments.amountCents,
      orderCount: czCommissionPayments.orderCount,
      method: czCommissionPayments.method,
      reference: czCommissionPayments.reference,
      paidOn: czCommissionPayments.paidOn,
      note: czCommissionPayments.note,
      createdAt: czCommissionPayments.createdAt,
      recordedByName: users.name,
    })
    .from(czCommissionPayments)
    .leftJoin(users, eq(users.id, czCommissionPayments.recordedBy))
    .where(eq(czCommissionPayments.sellerUserId, app.userId))
    .orderBy(desc(czCommissionPayments.createdAt))
    .limit(100);
  return { ...summarize(orders), orders, payments };
}

export type RecordCommissionInput = {
  applicationId: number;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  note: string;
};

/**
 * Registra el pago de toda la comisión pendiente del vendedor. El monto debe
 * coincidir con lo pendiente al momento de registrar; si llegó un pedido nuevo
 * entretanto, se rechaza para que el administrador revise la cifra.
 */
export async function adminRecordCommissionPayment(
  admin: User,
  input: RecordCommissionInput
) {
  const receipt = validateReceipt(input, new Date());
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    fail("BAD_REQUEST", "Monto no válido");
  const db = await requireDb();
  try {
    return await db.transaction((tx: any) =>
      recordCommissionPaymentTx(tx, admin.id, {
        applicationId: input.applicationId,
        amountCents: input.amountCents,
        receipt,
      })
    );
  } catch (error) {
    if (isDuplicateKeyError(error))
      fail(
        "CONFLICT",
        "Ese comprobante ya fue registrado con el mismo método de pago"
      );
    throw error;
  }
}

/**
 * Registra un pago de comisión dentro de una transacción ya abierta. Con
 * `deliveredBefore` salda solo los pedidos entregados antes de esa fecha (los
 * meses cerrados que cubre un aviso «Ya pagué»); sin ella, todo lo pendiente.
 * Si la tienda estaba oculta por comisión y ya no queda nada vencido, vuelve a
 * mostrarse.
 */
export async function recordCommissionPaymentTx(
  tx: any,
  adminId: number,
  input: {
    applicationId: number;
    amountCents: number;
    receipt: {
      method: PaymentMethod;
      reference: string;
      paidOn: string;
      note: string;
    };
    deliveredBefore?: Date | null;
  },
  now = new Date()
) {
  const receipt = input.receipt;
  const app = await sellerForApplication(tx, input.applicationId);
  const stores = await tx
    .select({ id: czStores.id })
    .from(czStores)
    .where(eq(czStores.userId, app.userId));
  const storeIds = stores.map((store: { id: number }) => store.id);
  if (!storeIds.length)
    fail("PRECONDITION_FAILED", "El vendedor no tiene tienda");
  const pending = await tx
    .select({ id: czOrders.id, commissionCents: czOrders.commissionCents })
    .from(czOrders)
    .where(
      and(
        inArray(czOrders.storeId, storeIds),
        pendingCondition,
        ...(input.deliveredBefore
          ? [lt(czOrders.deliveredAt, input.deliveredBefore)]
          : [])
      )
    )
    .for("update");
  const pendingTickets = await tx
    .select({
      id: czTicketOrders.id,
      commissionCents: czTicketOrders.commissionCents,
    })
    .from(czTicketOrders)
    .where(
      and(
        inArray(czTicketOrders.storeId, storeIds),
        pendingTicketCommission,
        ...(input.deliveredBefore
          ? [lt(czTicketOrders.paidAt, input.deliveredBefore)]
          : [])
      )
    )
    .for("update");
  const { totalCents, orderCount } = summarize([...pending, ...pendingTickets]);
  if (!orderCount)
    fail("CONFLICT", "Este vendedor no tiene comisión pendiente");
  if (input.amountCents !== totalCents)
    fail(
      "CONFLICT",
      `La comisión pendiente es US$${(totalCents / 100).toFixed(2)}; actualiza y revisa el monto`
    );
  const inserted = await tx.insert(czCommissionPayments).values({
    sellerUserId: app.userId,
    amountCents: totalCents,
    orderCount,
    method: receipt.method,
    reference: receipt.reference || null,
    paidOn: receipt.paidOn,
    recordedBy: adminId,
    note: receipt.note || null,
  });
  const header = Array.isArray(inserted) ? inserted[0] : inserted;
  const paymentId = Number((header as { insertId?: number }).insertId);
  if (!paymentId) fail("INTERNAL_SERVER_ERROR", "No se pudo registrar el pago");
  const ids = pending.map((order: { id: number }) => order.id);
  const updated = ids.length
    ? affected(
        await tx
          .update(czOrders)
          .set({ commissionPaymentId: paymentId })
          .where(
            and(inArray(czOrders.id, ids), isNull(czOrders.commissionPaymentId))
          )
      )
    : 0;
  const ticketIds = pendingTickets.map((order: { id: number }) => order.id);
  const updatedTickets = ticketIds.length
    ? affected(
        await tx
          .update(czTicketOrders)
          .set({ commissionPaymentId: paymentId })
          .where(
            and(
              inArray(czTicketOrders.id, ticketIds),
              isNull(czTicketOrders.commissionPaymentId)
            )
          )
      )
    : 0;
  if (updated + updatedTickets !== orderCount)
    fail("CONFLICT", "Los pedidos cambiaron durante el registro");
  await tx.insert(czMembershipAudit).values({
    applicationId: input.applicationId,
    userId: app.userId,
    actorUserId: adminId,
    action: "commission_payment_recorded",
    reason: receipt.note || null,
    metadata: {
      amountCents: totalCents,
      orderCount,
      method: receipt.method,
      paymentId,
    },
  });
  await queueEmail(
    tx,
    `commission-payment:${paymentId}`,
    await recipientFor(tx, app.userId),
    commissionPaymentReceipt(totalCents, orderCount)
  );
  const released = await releaseCommissionHold(
    tx,
    input.applicationId,
    adminId,
    now
  );
  return { paymentId, amountCents: totalCents, orderCount, released };
}

/** Vuelve a mostrar una tienda oculta por comisión si ya no debe nada vencido y su período sigue vigente. */
async function releaseCommissionHold(
  tx: any,
  applicationId: number,
  actorId: number,
  now: Date
) {
  const rows = await tx
    .select()
    .from(czApplications)
    .where(eq(czApplications.id, applicationId))
    .for("update")
    .limit(1);
  const app = rows[0];
  if (
    !app ||
    app.subscriptionStatus !== "past_due" ||
    app.holdReason !== "commission"
  )
    return false;
  if (await hasOverdueCommission(tx, app.userId, now)) return false;
  const stillPaid = Boolean(
    app.subscriptionEndsAt && new Date(app.subscriptionEndsAt) > now
  );
  await tx
    .update(czApplications)
    .set(
      stillPaid
        ? { subscriptionStatus: "active", holdReason: null }
        : { holdReason: null }
    )
    .where(eq(czApplications.id, applicationId));
  await tx.insert(czMembershipAudit).values({
    applicationId,
    userId: app.userId,
    actorUserId: actorId,
    action: "commission_hold_released",
    reason: null,
    metadata: { reactivated: stillPaid },
  });
  return stillPaid;
}

/**
 * Plazos de la comisión mensual (cada 15 minutos, junto con las mensualidades):
 * estado de cuenta al cerrar el mes, recordatorio a los 7 días y, a los 15,
 * la tienda se oculta (past_due + holdReason "commission"). Cada correo se
 * envía una sola vez por vendedor y mes. Devuelve cuántas tiendas ocultó.
 */
export async function sweepCommissionDeadlines(
  now = new Date()
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let suspended = 0;
  let lastUserId = 0;
  // Por páginas de 200 vendedores, en orden, para llegar a todos.
  for (;;) {
    const fromOrders = (await db
      .selectDistinct({ userId: czStores.userId })
      .from(czOrders)
      .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
      .where(
        and(
          pendingCondition,
          lt(czOrders.deliveredAt, panamaMonthStart(now)),
          gt(czStores.userId, lastUserId)
        )
      )
      .orderBy(czStores.userId)
      .limit(200)) as Array<{ userId: number }>;
    const fromTickets = (await db
      .selectDistinct({ userId: czStores.userId })
      .from(czTicketOrders)
      .innerJoin(czStores, eq(czStores.id, czTicketOrders.storeId))
      .where(
        and(
          pendingTicketCommission,
          lt(czTicketOrders.paidAt, panamaMonthStart(now)),
          gt(czStores.userId, lastUserId)
        )
      )
      .orderBy(czStores.userId)
      .limit(200)) as Array<{ userId: number }>;
    const page = Array.from(
      new Set([...fromOrders, ...fromTickets].map(row => row.userId))
    )
      .sort((a, b) => a - b)
      .slice(0, 200)
      .map(userId => ({ userId }));
    if (!page.length) break;
    for (const { userId } of page) {
      lastUserId = userId;
      // Un error con un vendedor no detiene a los demás.
      try {
        if (await sweepSellerCommission(db, userId, now)) suspended++;
      } catch (error) {
        console.error(
          `[Comisiones] Error con el vendedor ${userId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
  return suspended;
}

/** Avisos y, si venció, ocultar la tienda de un vendedor. Devuelve true si la ocultó. */
async function sweepSellerCommission(db: any, userId: number, now: Date) {
  let suspended = false;
  {
    const split = splitCommission(
      await pendingCommissionOrders(db, userId),
      now
    );
    const deadline = split.deadline;
    if (!deadline || deadline.stage === "accruing" || split.dueCents <= 0)
      return false;
    await db.transaction(async (tx: any) => {
      const apps = await tx
        .select()
        .from(czApplications)
        .where(
          and(
            eq(czApplications.userId, userId),
            eq(czApplications.status, "approved")
          )
        )
        .for("update")
        .limit(1);
      const app = apps[0];
      if (!app) return;
      const to = await recipientFor(tx, userId);
      await queueEmail(
        tx,
        `commission-statement:${userId}:${deadline.monthKey}`,
        to,
        commissionStatement(split.dueCents, split.dueCount, deadline.suspendAt)
      );
      if (deadline.stage === "reminder" || deadline.stage === "overdue")
        await queueEmail(
          tx,
          `commission-reminder:${userId}:${deadline.monthKey}`,
          to,
          commissionReminder(split.dueCents, deadline.suspendAt)
        );
      if (deadline.stage !== "overdue" || app.subscriptionStatus !== "active")
        return;
      await tx
        .update(czApplications)
        .set({ subscriptionStatus: "past_due", holdReason: "commission" })
        .where(
          and(
            eq(czApplications.id, app.id),
            eq(czApplications.subscriptionStatus, "active")
          )
        );
      await tx.insert(czMembershipAudit).values({
        applicationId: app.id,
        userId,
        actorUserId: null,
        action: "commission_hold_applied",
        reason: null,
        metadata: { dueCents: split.dueCents, month: deadline.monthKey },
      });
      await queueEmail(
        tx,
        `commission-suspended:${userId}:${deadline.monthKey}`,
        to,
        commissionSuspended(split.dueCents)
      );
      suspended = true;
    });
  }
  return suspended;
}

/** Comisión pendiente por vendedor (userId → centavos), para la lista del administrador. */
export async function pendingTotalsBySeller(): Promise<Map<number, number>> {
  const db = await requireDb();
  const rows = await db
    .select({
      userId: czStores.userId,
      total: sql<number>`coalesce(sum(${czOrders.commissionCents}), 0)`,
    })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(pendingCondition)
    .groupBy(czStores.userId);
  const ticketRows = await db
    .select({
      userId: czStores.userId,
      total: sql<number>`coalesce(sum(${czTicketOrders.commissionCents}), 0)`,
    })
    .from(czTicketOrders)
    .innerJoin(czStores, eq(czStores.id, czTicketOrders.storeId))
    .where(pendingTicketCommission)
    .groupBy(czStores.userId);
  const totals = new Map<number, number>();
  for (const row of [...rows, ...ticketRows] as Array<{
    userId: number;
    total: number | string;
  }>)
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + Number(row.total));
  return totals;
}
