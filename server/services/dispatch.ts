/*
 * Despachadores: toman pedidos de comercio con envío gratis (vendedor y
 * comprador en la misma provincia), los recogen, se ven en vivo en el mapa del
 * comprador y los entregan con una foto. Ganan el 50 % de la comisión del
 * pedido, mínimo US$2 (shared/dispatch.ts).
 */
import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import {
  czNotifications,
  czOrderItems,
  czOrders,
} from "../../drizzle/commerce-schema";
import { czApplications } from "../../drizzle/schema";
import {
  czDispatcherDocuments,
  czDispatchers,
  czDispatchJobs,
} from "../../drizzle/dispatch-schema";
import { validateDocumentBytes } from "./membership";
import { czOrderPlaces, czPlaces } from "../../drizzle/location-schema";
import {
  DISPATCH_STALE_MS,
  dispatchEarningCents,
  type ApplyDispatcherInput,
} from "@shared/dispatch";
import { fromE6, pointInput, toE6, type Point } from "@shared/location";
import { shippingDeal } from "@shared/shippingRules";
import { commissionCents } from "@shared/pricing";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { transitionOrder } from "./commerce";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const toPoint = (lat: number | null, lng: number | null): Point | null =>
  lat === null || lng === null ? null : { lat: fromE6(lat), lng: fromE6(lng) };

async function notify(db: Db, userId: number, body: string, orderId: number) {
  await db.insert(czNotifications).values({
    userId,
    kind: "dispatch",
    body,
    payload: { orderId },
  });
}

// ── Perfil del despachador ──

export async function myDispatcher(userId: number) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(czDispatchers)
    .where(eq(czDispatchers.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function applyDispatcher(
  userId: number,
  input: ApplyDispatcherInput
) {
  const db = await requireDb();
  const docs = await myDispatcherDocuments(userId);
  if (!docs.licencia || !docs.record)
    fail(
      "PRECONDITION_FAILED",
      "Sube tu licencia de conducir y tu récord policivo para poder aplicar."
    );
  const current = await myDispatcher(userId);
  if (current?.status === "suspended")
    fail(
      "FORBIDDEN",
      "Tu cuenta de despachador está suspendida. Escríbenos para revisarla."
    );
  const values = {
    fullName: input.fullName,
    phone: input.phone,
    province: input.province,
    vehicle: input.vehicle,
    plate: input.plate.toUpperCase(),
  };
  await db
    .insert(czDispatchers)
    .values({ userId, ...values, status: "pending" })
    .onDuplicateKeyUpdate({
      set: current?.status === "rejected" ? { ...values, status: "pending" } : values,
    });
  return myDispatcher(userId);
}

/** Pedidos que el despachador tiene sin entregar (por recoger o en camino). */
async function activeJobs(db: Db, userId: number) {
  return db
    .select({ orderId: czDispatchJobs.orderId, status: czOrders.status })
    .from(czDispatchJobs)
    .innerJoin(czOrders, eq(czOrders.id, czDispatchJobs.orderId))
    .where(
      and(
        eq(czDispatchJobs.dispatcherUserId, userId),
        isNull(czDispatchJobs.deliveredAt),
        inArray(czOrders.status, ["confirmed", "shipped"])
      )
    );
}

/** El despachador borra su cuenta. Antes debe cancelar o entregar sus pedidos. */
export async function deleteMyDispatcher(userId: number) {
  const db = await requireDb();
  if ((await activeJobs(db, userId)).length)
    fail(
      "PRECONDITION_FAILED",
      "Tienes pedidos sin entregar. Cancélalos o entrégalos antes de eliminar tu cuenta."
    );
  await db.delete(czDispatchers).where(eq(czDispatchers.userId, userId));
  return { ok: true };
}

async function requireApproved(db: Db, userId: number) {
  const [d] = await db
    .select()
    .from(czDispatchers)
    .where(eq(czDispatchers.userId, userId))
    .limit(1);
  if (!d || d.status !== "approved")
    fail("FORBIDDEN", "Tu cuenta de despachador todavía no está aprobada.");
  return d;
}

// ── Pedidos disponibles y tomados ──

/** Pedidos confirmados, con envío o a domicilio, en la misma provincia del vendedor y del despachador. */
export async function availableJobs(userId: number) {
  const db = await requireDb();
  const me = await requireApproved(db, userId);
  const rows = await db
    .select({
      id: czOrders.id,
      number: czOrders.number,
      subtotalCents: czOrders.subtotalCents,
      commissionBps: czOrders.commissionBps,
      buyerProvince: czOrders.province,
      buyerCity: czOrders.city,
      storeName: czStores.name,
      storeProvince: czStores.province,
      storeCity: czStores.city,
      sellerId: czStores.userId,
      buyerId: czOrders.userId,
      createdAt: czOrders.createdAt,
    })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .leftJoin(czDispatchJobs, eq(czDispatchJobs.orderId, czOrders.id))
    .where(
      and(
        eq(czOrders.status, "confirmed"),
        ne(czOrders.deliveryMode, "pickup"),
        isNull(czDispatchJobs.orderId)
      )
    )
    .orderBy(desc(czOrders.createdAt))
    .limit(100);
  return rows
    .filter(
      r =>
        shippingDeal(r.storeProvince, r.buyerProvince) === "free" &&
        shippingDeal(r.storeProvince, me.province) === "free" &&
        r.sellerId !== userId &&
        r.buyerId !== userId
    )
    .map(r => ({
      orderId: r.id,
      number: r.number,
      storeName: r.storeName,
      pickupCity: r.storeCity,
      dropCity: r.buyerCity,
      province: r.storeProvince,
      earningCents: dispatchEarningCents(
        commissionCents(r.subtotalCents, r.commissionBps)
      ),
      createdAt: new Date(r.createdAt).toISOString(),
    }));
}

export async function takeJob(userId: number, orderId: number) {
  const db = await requireDb();
  const me = await requireApproved(db, userId);
  const [row] = await db
    .select({
      status: czOrders.status,
      mode: czOrders.deliveryMode,
      buyerProvince: czOrders.province,
      storeProvince: czStores.province,
      sellerId: czStores.userId,
      buyerId: czOrders.userId,
      number: czOrders.number,
    })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czOrders.id, orderId))
    .limit(1);
  if (!row) fail("NOT_FOUND", "El pedido no existe");
  if (row.status !== "confirmed" || row.mode === "pickup")
    fail("CONFLICT", "Este pedido ya no está disponible");
  if (
    shippingDeal(row.storeProvince, row.buyerProvince) !== "free" ||
    shippingDeal(row.storeProvince, me.province) !== "free"
  )
    fail("FORBIDDEN", "Este pedido es de otra provincia");
  if (row.sellerId === userId || row.buyerId === userId)
    fail("FORBIDDEN", "No puedes llevar un pedido propio");
  try {
    await db
      .insert(czDispatchJobs)
      .values({ orderId, dispatcherUserId: userId });
  } catch {
    fail("CONFLICT", "Otro despachador ya tomó este pedido");
  }
  const msg = `${me.fullName} llevará el pedido ${row.number}`;
  await notify(
    db,
    row.sellerId,
    `${msg}. Entrégaselo y toca «Producto enviado».`,
    orderId
  );
  await notify(db, row.buyerId, msg, orderId);
  return { ok: true };
}

/** Soltar un pedido que todavía no recogió. */
export async function releaseJob(userId: number, orderId: number) {
  const db = await requireDb();
  const [row] = await db
    .select({
      status: czOrders.status,
      dispatcher: czDispatchJobs.dispatcherUserId,
    })
    .from(czDispatchJobs)
    .innerJoin(czOrders, eq(czOrders.id, czDispatchJobs.orderId))
    .where(eq(czDispatchJobs.orderId, orderId))
    .limit(1);
  if (!row || row.dispatcher !== userId)
    fail("NOT_FOUND", "No tienes este pedido");
  if (row.status !== "confirmed")
    fail(
      "CONFLICT",
      "Ya recogiste este pedido: entrégalo o escribe a soporte."
    );
  await db.delete(czDispatchJobs).where(eq(czDispatchJobs.orderId, orderId));
  await notifyCancel(db, orderId);
  return { ok: true };
}

async function notifyCancel(db: Db, orderId: number) {
  const [o] = await db
    .select({ number: czOrders.number, buyerId: czOrders.userId, sellerId: czStores.userId })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czOrders.id, orderId))
    .limit(1);
  if (!o) return;
  const msg = `El despachador canceló el pedido ${o.number}. Otro despachador podrá tomarlo.`;
  await notify(db, o.sellerId, msg, orderId);
  await notify(db, o.buyerId, msg, orderId);
}

/** Mis pedidos en curso: dónde recoger, dónde entregar y con quién hablar. */
export async function myJobs(userId: number) {
  const db = await requireDb();
  await requireApproved(db, userId);
  const rows = await db
    .select({
      orderId: czOrders.id,
      number: czOrders.number,
      status: czOrders.status,
      subtotalCents: czOrders.subtotalCents,
      commissionBps: czOrders.commissionBps,
      recipientName: czOrders.recipientName,
      buyerPhone: czOrders.phone,
      city: czOrders.city,
      address: czOrders.address,
      storeId: czStores.id,
      storeName: czStores.name,
      storeCity: czStores.city,
      storePhone: czApplications.contactPhone,
      photoUrl: czDispatchJobs.photoUrl,
      dropLat: czOrderPlaces.latE6,
      dropLng: czOrderPlaces.lngE6,
    })
    .from(czDispatchJobs)
    .innerJoin(czOrders, eq(czOrders.id, czDispatchJobs.orderId))
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .leftJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .leftJoin(czOrderPlaces, eq(czOrderPlaces.orderId, czOrders.id))
    .where(
      and(
        eq(czDispatchJobs.dispatcherUserId, userId),
        isNull(czDispatchJobs.deliveredAt),
        inArray(czOrders.status, ["confirmed", "shipped"])
      )
    )
    .orderBy(desc(czDispatchJobs.takenAt));
  const storeIds = Array.from(new Set(rows.map(r => r.storeId)));
  const places = storeIds.length
    ? await db
        .select({
          refId: czPlaces.refId,
          lat: czPlaces.latE6,
          lng: czPlaces.lngE6,
        })
        .from(czPlaces)
        .where(
          and(eq(czPlaces.kind, "tienda"), inArray(czPlaces.refId, storeIds))
        )
    : [];
  const placeOf = new Map(places.map(p => [p.refId, toPoint(p.lat, p.lng)]));
  const ids = rows.map(r => r.orderId);
  const items = ids.length
    ? await db
        .select({
          orderId: czOrderItems.orderId,
          n: sql<number>`sum(${czOrderItems.quantity})`,
        })
        .from(czOrderItems)
        .where(inArray(czOrderItems.orderId, ids))
        .groupBy(czOrderItems.orderId)
    : [];
  const count = new Map(items.map(i => [i.orderId, Number(i.n) || 0]));
  return rows.map(r => ({
    orderId: r.orderId,
    number: r.number,
    status: r.status as "confirmed" | "shipped",
    items: count.get(r.orderId) ?? 0,
    earningCents: dispatchEarningCents(
      commissionCents(r.subtotalCents, r.commissionBps)
    ),
    pickup: {
      name: r.storeName,
      city: r.storeCity,
      phone: r.storePhone ?? "",
      point: placeOf.get(r.storeId) ?? null,
    },
    drop: {
      name: r.recipientName,
      phone: r.buyerPhone,
      city: r.city,
      address: r.address,
      point: toPoint(r.dropLat, r.dropLng),
    },
    photoUrl: r.photoUrl,
  }));
}

/** Ganancias: entregas hechas, total del mes y lo que falta por cobrar. */
export async function myEarnings(userId: number) {
  const db = await requireDb();
  await requireApproved(db, userId);
  const rows = await db
    .select({
      orderId: czDispatchJobs.orderId,
      number: czOrders.number,
      storeName: czStores.name,
      earningCents: czDispatchJobs.earningCents,
      deliveredAt: czDispatchJobs.deliveredAt,
      paidAt: czDispatchJobs.paidAt,
    })
    .from(czDispatchJobs)
    .innerJoin(czOrders, eq(czOrders.id, czDispatchJobs.orderId))
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(
      and(
        eq(czDispatchJobs.dispatcherUserId, userId),
        isNotNull(czDispatchJobs.deliveredAt)
      )
    )
    .orderBy(desc(czDispatchJobs.deliveredAt))
    .limit(200);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let month = 0;
  let unpaid = 0;
  let total = 0;
  for (const r of rows) {
    total += r.earningCents;
    if (r.deliveredAt && new Date(r.deliveredAt) >= monthStart)
      month += r.earningCents;
    if (!r.paidAt) unpaid += r.earningCents;
  }
  return {
    monthCents: month,
    unpaidCents: unpaid,
    totalCents: total,
    deliveries: rows.map(r => ({
      orderId: r.orderId,
      number: r.number,
      storeName: r.storeName,
      earningCents: r.earningCents,
      deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : null,
      paid: Boolean(r.paidAt),
    })),
  };
}

async function myActiveJob(db: Db, userId: number, orderId: number) {
  const [row] = await db
    .select({
      status: czOrders.status,
      dispatcher: czDispatchJobs.dispatcherUserId,
      deliveredAt: czDispatchJobs.deliveredAt,
      photoUrl: czDispatchJobs.photoUrl,
      sellerId: czStores.userId,
    })
    .from(czDispatchJobs)
    .innerJoin(czOrders, eq(czOrders.id, czDispatchJobs.orderId))
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czDispatchJobs.orderId, orderId))
    .limit(1);
  if (!row || row.dispatcher !== userId)
    fail("NOT_FOUND", "No tienes este pedido");
  return row;
}

/** Posición en vivo mientras va en camino (después de «Producto enviado»). */
export async function pingPosition(userId: number, orderId: number, p: Point) {
  const db = await requireDb();
  const parsed = pointInput.parse(p);
  const job = await myActiveJob(db, userId, orderId);
  if (job.status !== "shipped" || job.deliveredAt) return { ok: false };
  await db
    .update(czDispatchJobs)
    .set({
      lastLatE6: toE6(parsed.lat),
      lastLngE6: toE6(parsed.lng),
      lastAt: new Date(),
    })
    .where(eq(czDispatchJobs.orderId, orderId));
  return { ok: true };
}

/** «Entregado»: necesita la foto. Entrega el pedido y fija lo que gana. */
export async function deliverJob(userId: number, orderId: number) {
  const db = await requireDb();
  const job = await myActiveJob(db, userId, orderId);
  if (job.deliveredAt) fail("CONFLICT", "Este pedido ya está entregado");
  if (!job.photoUrl)
    fail("PRECONDITION_FAILED", "Primero toma la foto de la entrega");
  if (job.status !== "shipped")
    fail(
      "PRECONDITION_FAILED",
      "El vendedor todavía no marcó «Producto enviado»"
    );
  // La entrega la registra el vendedor del pedido: así se calculan la comisión,
  // las notificaciones y los correos igual que siempre.
  await transitionOrder(job.sellerId, orderId, "delivered");
  const [order] = await db
    .select({ commissionCents: czOrders.commissionCents })
    .from(czOrders)
    .where(eq(czOrders.id, orderId))
    .limit(1);
  await db
    .update(czDispatchJobs)
    .set({
      deliveredAt: new Date(),
      earningCents: dispatchEarningCents(order?.commissionCents ?? 0),
      lastLatE6: null,
      lastLngE6: null,
      lastAt: null,
    })
    .where(eq(czDispatchJobs.orderId, orderId));
  return { ok: true };
}

// ── Lo que ven el comprador y el vendedor en su pedido ──

export async function dispatchForOrder(
  userId: number,
  orderId: number,
  now = new Date()
) {
  const db = await requireDb();
  const [row] = await db
    .select({
      buyerId: czOrders.userId,
      sellerId: czStores.userId,
      status: czOrders.status,
      name: czDispatchers.fullName,
      vehicle: czDispatchers.vehicle,
      plate: czDispatchers.plate,
      lastLat: czDispatchJobs.lastLatE6,
      lastLng: czDispatchJobs.lastLngE6,
      lastAt: czDispatchJobs.lastAt,
      photoUrl: czDispatchJobs.photoUrl,
      deliveredAt: czDispatchJobs.deliveredAt,
    })
    .from(czOrders)
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .innerJoin(czDispatchJobs, eq(czDispatchJobs.orderId, czOrders.id))
    .innerJoin(
      czDispatchers,
      eq(czDispatchers.userId, czDispatchJobs.dispatcherUserId)
    )
    .where(eq(czOrders.id, orderId))
    .limit(1);
  if (!row) return null;
  if (row.buyerId !== userId && row.sellerId !== userId)
    fail("FORBIDDEN", "No autorizado para este pedido");
  const fresh =
    row.status === "shipped" &&
    row.lastAt !== null &&
    now.getTime() - new Date(row.lastAt).getTime() < DISPATCH_STALE_MS;
  return {
    name: row.name,
    vehicle: row.vehicle,
    plate: row.plate,
    live: fresh ? toPoint(row.lastLat, row.lastLng) : null,
    lastAt: row.lastAt ? new Date(row.lastAt).toISOString() : null,
    delivered: Boolean(row.deliveredAt),
    photoUrl: row.deliveredAt ? row.photoUrl : null,
  };
}

// ── Administración ──

/** ¿Qué documentos ya subió? (sin enviar los archivos). */
export async function myDispatcherDocuments(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ kind: czDispatcherDocuments.kind, fileName: czDispatcherDocuments.fileName })
    .from(czDispatcherDocuments)
    .where(eq(czDispatcherDocuments.userId, userId));
  const by = new Map(rows.map(r => [r.kind, r.fileName]));
  return { licencia: by.get("licencia") ?? null, record: by.get("record") ?? null };
}

export async function adminDispatchers() {
  const db = await requireDb();
  const docRows = await db
    .select({ userId: czDispatcherDocuments.userId, kind: czDispatcherDocuments.kind })
    .from(czDispatcherDocuments);
  const docsOf = (userId: number) => ({
    licencia: docRows.some(r => r.userId === userId && r.kind === "licencia"),
    record: docRows.some(r => r.userId === userId && r.kind === "record"),
  });
  const people = await db
    .select()
    .from(czDispatchers)
    .orderBy(desc(czDispatchers.createdAt));
  const stats = await db
    .select({
      userId: czDispatchJobs.dispatcherUserId,
      delivered: sql<number>`sum(case when ${czDispatchJobs.deliveredAt} is not null then 1 else 0 end)`,
      unpaid: sql<number>`coalesce(sum(case when ${czDispatchJobs.deliveredAt} is not null and ${czDispatchJobs.paidAt} is null then ${czDispatchJobs.earningCents} else 0 end), 0)`,
    })
    .from(czDispatchJobs)
    .groupBy(czDispatchJobs.dispatcherUserId);
  const byUser = new Map(stats.map(s => [s.userId, s]));
  return people.map(p => ({
    userId: p.userId,
    fullName: p.fullName,
    phone: p.phone,
    province: p.province,
    vehicle: p.vehicle,
    plate: p.plate,
    status: p.status,
    createdAt: new Date(p.createdAt).toISOString(),
    documents: docsOf(p.userId),
    delivered: Number(byUser.get(p.userId)?.delivered ?? 0),
    unpaidCents: Number(byUser.get(p.userId)?.unpaid ?? 0),
  }));
}

export async function adminSetDispatcherStatus(
  adminId: number,
  userId: number,
  status: "approved" | "suspended" | "pending" | "rejected"
) {
  const db = await requireDb();
  await db
    .update(czDispatchers)
    .set({
      status,
      ...(status === "approved"
        ? { approvedBy: adminId, approvedAt: new Date() }
        : {}),
    })
    .where(eq(czDispatchers.userId, userId));
  return adminDispatchers();
}

/**
 * El administrador elimina a un despachador. Sus pedidos por recoger vuelven a
 * Disponibles; si lleva uno en camino, primero debe entregarlo. El historial de
 * entregas se conserva.
 */
export async function adminDeleteDispatcher(userId: number) {
  const db = await requireDb();
  const jobs = await activeJobs(db, userId);
  if (jobs.some(j => j.status === "shipped"))
    fail("PRECONDITION_FAILED", "Lleva un pedido en camino. Espera a que lo entregue.");
  for (const j of jobs) {
    await db.delete(czDispatchJobs).where(eq(czDispatchJobs.orderId, j.orderId));
    await notifyCancel(db, j.orderId);
  }
  await db.delete(czDispatchers).where(eq(czDispatchers.userId, userId));
  return adminDispatchers();
}

/** Marca como pagadas todas las entregas pendientes de cobro de un despachador. */
export async function adminMarkDispatcherPaid(userId: number) {
  const db = await requireDb();
  await db
    .update(czDispatchJobs)
    .set({ paidAt: new Date() })
    .where(
      and(
        eq(czDispatchJobs.dispatcherUserId, userId),
        isNotNull(czDispatchJobs.deliveredAt),
        isNull(czDispatchJobs.paidAt)
      )
    );
  return adminDispatchers();
}

// ── Foto de la entrega ──

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function uploadPhoto(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res
        .status(412)
        .json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0)
      return res.status(400).json({ error: "Pedido inválido" });
    const db = await requireDb();
    const job = await myActiveJob(db, user.id, orderId).catch(() => null);
    if (!job) return res.status(404).json({ error: "No tienes este pedido" });
    if (job.deliveredAt)
      return res.status(409).json({ error: "Este pedido ya está entregado" });
    if (job.status !== "shipped")
      return res
        .status(409)
        .json({ error: "El vendedor todavía no marcó «Producto enviado»" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    if (!EXT[mimeType])
      return res
        .status(400)
        .json({ error: "La foto debe ser PNG, JPEG o WEBP" });
    try {
      validateCatalogImageBytes(req.body, mimeType);
    } catch {
      return res
        .status(400)
        .json({ error: "La foto debe ser PNG, JPEG o WEBP" });
    }
    const saved = await storagePut(
      // Carpeta pública del catálogo, con nombre aleatorio imposible de adivinar.
      `catalog/dispatch/${orderId}/${randomUUID()}.${EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czDispatchJobs)
      .set({ photoUrl: saved.url })
      .where(eq(czDispatchJobs.orderId, orderId));
    return res.status(201).json({ photoUrl: saved.url });
  } catch (error) {
    console.error("[Despacho] foto", error);
    return res.status(500).json({ error: "No se pudo guardar la foto" });
  }
}

const DOC_KINDS = new Set(["licencia", "record"]);
const DOC_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_DOC_BYTES = 5 * 1024 * 1024;

async function uploadDocument(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res.status(412).json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const kind = String(req.params.kind);
    if (!DOC_KINDS.has(kind)) return res.status(400).json({ error: "Documento no válido" });
    const mimeType = String(req.headers["content-type"] ?? "").split(";", 1)[0]!.toLowerCase();
    if (!DOC_TYPES.has(mimeType))
      return res.status(400).json({ error: "Sube un PDF o una foto (PNG, JPEG o WEBP)" });
    try {
      validateDocumentBytes(req.body, mimeType, MAX_DOC_BYTES);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Archivo no válido" });
    }
    const fileName = String(req.headers["x-file-name"] ?? "documento")
      .replace(/[^\w.\- ]+/g, "")
      .slice(0, 180) || "documento";
    const db = await requireDb();
    const values = { fileName, mimeType, size: req.body.length, bytes: req.body as Buffer };
    await db
      .insert(czDispatcherDocuments)
      .values({ userId: user.id, kind: kind as "licencia" | "record", ...values })
      .onDuplicateKeyUpdate({ set: values });
    return res.status(201).json({ ok: true, kind, fileName });
  } catch (error) {
    console.error("[Despacho] documento", error);
    return res.status(500).json({ error: "No se pudo guardar el documento" });
  }
}

/** Solo el propio despachador o un administrador. Se descarga, nunca se muestra en la página. */
async function downloadDocument(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const ownerId = Number(req.params.userId);
    const kind = String(req.params.kind);
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !DOC_KINDS.has(kind))
      return res.status(404).json({ error: "Documento no disponible" });
    if (user.role !== "admin" && user.id !== ownerId)
      return res.status(403).json({ error: "Documento no disponible" });
    const db = await requireDb();
    const [row] = await db
      .select()
      .from(czDispatcherDocuments)
      .where(and(eq(czDispatcherDocuments.userId, ownerId), eq(czDispatcherDocuments.kind, kind as "licencia" | "record")))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Documento no disponible" });
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    });
    res.type(row.mimeType);
    return res.status(200).send(row.bytes);
  } catch (error) {
    console.error("[Despacho] descarga", error);
    return res.status(500).json({ error: "No se pudo abrir el documento" });
  }
}

export function registerDispatchRoutes(app: Express) {
  const rawDoc = (req: Request, res: Response, next: () => void) =>
    express.raw({ type: () => true, limit: MAX_DOC_BYTES })(req, res, error =>
      error ? res.status(413).json({ error: "El documento supera 5 MiB" }) : next()
    );
  app.post("/api/dispatch/documents/:kind", rawDoc, uploadDocument);
  app.get("/api/dispatch/documents/:userId/:kind", downloadDocument);
  const raw = (req: Request, res: Response, next: () => void) =>
    express.raw({ type: () => true, limit: MAX_PHOTO_BYTES })(
      req,
      res,
      error =>
        error ? res.status(413).json({ error: "La foto supera 8 MiB" }) : next()
    );
  app.post("/api/dispatch/:orderId/photo", raw, uploadPhoto);
}
