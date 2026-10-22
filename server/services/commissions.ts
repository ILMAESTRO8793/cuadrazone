// Comisiones por venta (8% en la prueba gratuita, 5% después).
// El comprador paga directo al vendedor, así que la comisión es una deuda del
// vendedor con CuadraZone: se acumula con cada pedido entregado y el vendedor la
// paga por Yappy, transferencia o efectivo. Un administrador registra el pago,
// que salda todos los pedidos entregados pendientes de ese vendedor.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import { czCommissionPayments, czOrders } from "../../drizzle/commerce-schema";
import { czApplications, czMembershipAudit, users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { isDuplicateKeyError, validateReceipt, type PaymentMethod } from "./subscriptions";

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
  id: number;
  number: string;
  subtotalCents: number;
  commissionBps: number;
  commissionCents: number;
  deliveredAt: Date | null;
};

export async function pendingCommissionOrders(db: any, sellerUserId: number): Promise<PendingCommissionOrder[]> {
  return db
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
    .orderBy(czOrders.deliveredAt)
    .limit(1000);
}

function summarize(orders: Array<{ commissionCents: number }>) {
  return { totalCents: orders.reduce((sum, order) => sum + order.commissionCents, 0), orderCount: orders.length };
}

/** Lo que el propio vendedor debe de comisión. */
export async function commissionForSeller(sellerUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const orders = await pendingCommissionOrders(db, sellerUserId);
  return { ...summarize(orders), orders: orders.slice(-20) };
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
export async function adminRecordCommissionPayment(admin: User, input: RecordCommissionInput) {
  const receipt = validateReceipt(input, new Date());
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) fail("BAD_REQUEST", "Monto no válido");
  const db = await requireDb();
  try {
    return await db.transaction(async (tx: any) => {
      const app = await sellerForApplication(tx, input.applicationId);
      const stores = await tx.select({ id: czStores.id }).from(czStores).where(eq(czStores.userId, app.userId));
      const storeIds = stores.map((store: { id: number }) => store.id);
      if (!storeIds.length) fail("PRECONDITION_FAILED", "El vendedor no tiene tienda");
      const pending = await tx
        .select({ id: czOrders.id, commissionCents: czOrders.commissionCents })
        .from(czOrders)
        .where(and(inArray(czOrders.storeId, storeIds), pendingCondition))
        .for("update");
      const { totalCents, orderCount } = summarize(pending);
      if (!orderCount) fail("CONFLICT", "Este vendedor no tiene comisión pendiente");
      if (input.amountCents !== totalCents)
        fail("CONFLICT", `La comisión pendiente es US$${(totalCents / 100).toFixed(2)}; actualiza y revisa el monto`);
      const inserted = await tx.insert(czCommissionPayments).values({
        sellerUserId: app.userId,
        amountCents: totalCents,
        orderCount,
        method: receipt.method,
        reference: receipt.reference || null,
        paidOn: receipt.paidOn,
        recordedBy: admin.id,
        note: receipt.note || null,
      });
      const header = Array.isArray(inserted) ? inserted[0] : inserted;
      const paymentId = Number((header as { insertId?: number }).insertId);
      if (!paymentId) fail("INTERNAL_SERVER_ERROR", "No se pudo registrar el pago");
      const ids = pending.map((order: { id: number }) => order.id);
      const updated = await tx
        .update(czOrders)
        .set({ commissionPaymentId: paymentId })
        .where(and(inArray(czOrders.id, ids), isNull(czOrders.commissionPaymentId)));
      if (affected(updated) !== orderCount) fail("CONFLICT", "Los pedidos cambiaron durante el registro");
      await tx.insert(czMembershipAudit).values({
        applicationId: input.applicationId,
        userId: app.userId,
        actorUserId: admin.id,
        action: "commission_payment_recorded",
        reason: receipt.note || null,
        metadata: { amountCents: totalCents, orderCount, method: receipt.method, paymentId },
      });
      return { paymentId, amountCents: totalCents, orderCount };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) fail("CONFLICT", "Ese comprobante ya fue registrado con el mismo método de pago");
    throw error;
  }
}

/** Comisión pendiente por vendedor (userId → centavos), para la lista del administrador. */
export async function pendingTotalsBySeller(): Promise<Map<number, number>> {
  const db = await requireDb();
  const rows = await db
    .select({ userId: czStores.userId, total: sql<number>`coalesce(sum(${czOrders.commissionCents}), 0)` })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(pendingCondition)
    .groupBy(czStores.userId);
  return new Map(rows.map((row: { userId: number; total: number | string }) => [row.userId, Number(row.total)]));
}
