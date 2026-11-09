// Etapa 4 · Eventos y boletos con QR.
// El organizador (vendedor con tienda aprobada y plan activo) publica el evento
// con sus tipos de entrada. El comprador aparta boletos; si el evento es gratis
// recibe los boletos al instante, si no, paga directo al organizador (Yappy,
// transferencia o efectivo) y el organizador marca «pagado». Cada boleto tiene
// un código único que se escanea una sola vez en la entrada. La comisión de
// CuadraZone (8% en la prueba, 5% después) se fija al marcar pagado y se cobra
// junto con la de los pedidos (ver commissions.ts).
import { randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import {
  czEventTicketTypes,
  czEvents,
  czStores,
  czTicketOrders,
  czTickets,
} from "../../drizzle/catalog-schema";
import {
  czApplications,
  czMembershipProfiles,
  type User,
} from "../../drizzle/schema";
import {
  MAX_EVENT_IMAGES,
  MAX_TICKETS_PER_ORDER,
  RESERVATION_HOURS,
  TICKET_CODE_ALPHABET,
  eventDateLabel,
  moneyLabel,
  panamaLocalToDate,
  parseTicketScan,
  reserveTicketsInput,
  saveEventInput,
  type EventDTO,
  type EventFilters,
  type EventStatus,
  type OwnEventDTO,
  type TicketOrderStatus,
} from "@shared/events";
import { commissionBpsAt, commissionCents } from "@shared/pricing";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { validateCatalogImageBytes } from "./catalogImages";
import { queueEmail, recipientFor } from "./email";
import { slugify } from "./realEstate";
import { FEATURED_PLAN_ID, pickFeatured } from "@shared/featured";

const PAGE_SIZE = 24;
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
async function requireDb() {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  return db;
}
const affected = (r: unknown) =>
  Number(
    ((Array.isArray(r) ? r[0] : r) as { affectedRows?: number })
      ?.affectedRows ?? 0
  );
const changed = (r: unknown) => affected(r) > 0;
const insertId = (r: unknown) =>
  Number(
    ((Array.isArray(r) ? r[0] : r) as { insertId?: number })?.insertId ?? 0
  );
function list<T = string>(value: unknown): T[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as T[]) : [];
}
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;

// ───────────── Comisión y códigos ─────────────

/** Comisión de una venta de boletos: misma tasa que los productos (8% en la prueba, 5% después). */
export function ticketCommission(
  totalCents: number,
  trialEndsAt: Date | string | null | undefined,
  now = new Date()
) {
  const bps = commissionBpsAt(trialEndsAt, now);
  return { bps, cents: commissionCents(totalCents, bps) };
}

/** Código de 20 caracteres. 256 es múltiplo de 32, así que no hay sesgo. */
export function newTicketCode(): string {
  const bytes = randomBytes(20);
  let code = "";
  for (const byte of bytes)
    code += TICKET_CODE_ALPHABET[byte % TICKET_CODE_ALPHABET.length];
  return code;
}

async function issueTickets(
  tx: any,
  order: {
    id: number;
    eventId: number;
    ticketTypeId: number;
    buyerUserId: number;
    quantity: number;
  }
) {
  const codes = Array.from({ length: order.quantity }, newTicketCode);
  await tx.insert(czTickets).values(
    codes.map(code => ({
      orderId: order.id,
      eventId: order.eventId,
      ticketTypeId: order.ticketTypeId,
      holderUserId: order.buyerUserId,
      code,
    }))
  );
  return codes;
}

// ───────────── Tienda del organizador ─────────────

async function organizerStore(db: any, userId: number) {
  const rows = await db
    .select({ store: czStores, app: czApplications })
    .from(czStores)
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czStores.userId, userId))
    .limit(1);
  return rows[0] as { store: any; app: any } | undefined;
}

async function requireOrganizerStore(db: any, userId: number) {
  const found = await organizerStore(db, userId);
  if (!found)
    fail("PRECONDITION_FAILED", "Primero guarda la información de tu tienda");
  return found;
}

async function ownEvent(db: any, userId: number, id: number, lock = false) {
  let query = db
    .select()
    .from(czEvents)
    .where(and(eq(czEvents.id, id), eq(czEvents.userId, userId)))
    .limit(1);
  if (lock) query = query.for("update");
  const rows = await query;
  if (!rows[0]) fail("NOT_FOUND", "El evento no existe");
  return rows[0];
}

async function ticketTypesFor(db: any, eventIds: number[]) {
  if (!eventIds.length) return new Map<number, any[]>();
  const rows = await db
    .select()
    .from(czEventTicketTypes)
    .where(inArray(czEventTicketTypes.eventId, eventIds))
    .orderBy(asc(czEventTicketTypes.position), asc(czEventTicketTypes.id));
  const byEvent = new Map<number, any[]>();
  for (const row of rows) {
    const items = byEvent.get(row.eventId) ?? [];
    items.push(row);
    byEvent.set(row.eventId, items);
  }
  return byEvent;
}

function dto(row: any, store: any, types: any[]): EventDTO {
  const ticketTypes = types.map(t => ({
    id: t.id,
    name: t.name,
    priceCents: t.priceCents,
    capacity: t.capacity,
    available: Math.max(0, t.capacity - t.taken),
  }));
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    artist: row.artist ?? "",
    description: row.description,
    startsAt: new Date(row.startsAt).toISOString(),
    endsAt: iso(row.endsAt),
    venueName: row.venueName,
    address: row.address ?? "",
    province: row.province,
    city: row.city ?? "",
    mapUrl: row.mapUrl ?? "",
    images: list(row.images),
    ticketTypes,
    minPriceCents: ticketTypes.length
      ? Math.min(...ticketTypes.map(t => t.priceCents))
      : 0,
    soldOut:
      ticketTypes.length > 0 && ticketTypes.every(t => t.available === 0),
    store: { name: store.name, slug: store.slug },
  };
}

function cleanImages(id: number, images: string[]) {
  const prefix = `/media/catalog/events/${id}/`;
  return images
    .filter(u => u.startsWith(prefix) && /^[A-Za-z0-9/._-]+$/.test(u))
    .slice(0, MAX_EVENT_IMAGES);
}

function columns(v: ReturnType<typeof saveEventInput.parse>) {
  return {
    title: v.title,
    artist: v.artist,
    description: v.description,
    startsAt: panamaLocalToDate(v.startsAt)!,
    endsAt: v.endsAt ? panamaLocalToDate(v.endsAt) : null,
    venueName: v.venueName,
    address: v.address,
    province: v.province,
    city: v.city,
    mapUrl: v.mapUrl,
  };
}

// ───────────── Organizador: crear, editar, publicar ─────────────

export async function saveEvent(user: User, raw: unknown, now = new Date()) {
  const parsed = saveEventInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  const { store } = await requireOrganizerStore(db, user.id);
  const cols = columns(v);

  if (!v.id) {
    if (cols.startsAt <= now)
      fail("BAD_REQUEST", "La fecha del evento debe ser futura");
    return db.transaction(async (tx: any) => {
      const inserted = await tx.insert(czEvents).values({
        storeId: store.id,
        userId: user.id,
        slug: `tmp-${randomUUID()}`,
        ...cols,
        images: [],
      });
      const id = insertId(inserted);
      await tx
        .update(czEvents)
        .set({ slug: `${slugify(v.title)}-${id}` })
        .where(eq(czEvents.id, id));
      await tx.insert(czEventTicketTypes).values(
        v.ticketTypes.map((t, position) => ({
          eventId: id,
          name: t.name,
          priceCents: t.priceCents,
          capacity: t.capacity,
          position,
        }))
      );
      return { id };
    });
  }

  const eventId = v.id;
  return db.transaction(async (tx: any) => {
    const current = await ownEvent(tx, user.id, eventId, true);
    if (current.status === "cancelled")
      fail(
        "PRECONDITION_FAILED",
        "Este evento está cancelado y ya no se puede editar"
      );
    if (
      v.expectedRevision !== undefined &&
      v.expectedRevision !== current.revision
    )
      fail(
        "CONFLICT",
        "El evento cambió en otra ventana. Recarga y vuelve a intentarlo."
      );
    if (current.status === "published" && cols.startsAt <= now)
      fail("BAD_REQUEST", "Un evento publicado debe tener fecha futura");

    const existing = (await tx
      .select()
      .from(czEventTicketTypes)
      .where(eq(czEventTicketTypes.eventId, eventId))
      .for("update")) as any[];
    const byId = new Map(existing.map(t => [t.id, t]));
    const keep = new Set<number>();
    for (const [position, t] of v.ticketTypes.entries()) {
      if (!t.id) {
        await tx.insert(czEventTicketTypes).values({
          eventId,
          name: t.name,
          priceCents: t.priceCents,
          capacity: t.capacity,
          position,
        });
        continue;
      }
      const old = byId.get(t.id);
      if (!old)
        fail(
          "BAD_REQUEST",
          "Uno de los tipos de entrada no pertenece a este evento"
        );
      keep.add(t.id);
      if (t.capacity < old.taken)
        fail(
          "BAD_REQUEST",
          `La capacidad de «${old.name}» no puede ser menor que los ${old.taken} boletos ya apartados o vendidos`
        );
      if (t.priceCents !== old.priceCents && old.taken > 0)
        fail(
          "BAD_REQUEST",
          `No puedes cambiar el precio de «${old.name}»: ya tiene boletos apartados o vendidos`
        );
      const updated = await tx
        .update(czEventTicketTypes)
        .set({
          name: t.name,
          priceCents: t.priceCents,
          capacity: t.capacity,
          position,
        })
        .where(
          and(
            eq(czEventTicketTypes.id, t.id),
            sql`${czEventTicketTypes.taken} <= ${t.capacity}`
          )
        );
      if (!changed(updated))
        fail(
          "CONFLICT",
          `Se apartaron boletos de «${old.name}» mientras editabas. Recarga y vuelve a intentarlo.`
        );
    }
    for (const old of existing) {
      if (keep.has(old.id)) continue;
      const orders = await tx
        .select({ n: sql<number>`count(*)` })
        .from(czTicketOrders)
        .where(eq(czTicketOrders.ticketTypeId, old.id));
      if (Number(orders[0]?.n ?? 0) > 0)
        fail(
          "BAD_REQUEST",
          `No puedes quitar «${old.name}»: ya tiene reservas. Puedes dejar su capacidad en lo ya vendido.`
        );
      await tx
        .delete(czEventTicketTypes)
        .where(eq(czEventTicketTypes.id, old.id));
    }

    const result = await tx
      .update(czEvents)
      .set({
        ...cols,
        images: cleanImages(eventId, v.images),
        slug: `${slugify(v.title)}-${eventId}`,
        revision: current.revision + 1,
      })
      .where(
        and(eq(czEvents.id, eventId), eq(czEvents.revision, current.revision))
      );
    if (!changed(result))
      fail(
        "CONFLICT",
        "El evento cambió en otra ventana. Recarga y vuelve a intentarlo."
      );
    return { id: eventId };
  });
}

/** Anula reservas y boletos de un conjunto de pedidos y devuelve el aforo. */
async function cancelOrdersTx(tx: any, orders: any[], now: Date) {
  for (const order of orders) {
    const result = await tx
      .update(czTicketOrders)
      .set({ status: "cancelled", cancelledAt: now })
      .where(
        and(
          eq(czTicketOrders.id, order.id),
          inArray(czTicketOrders.status, ["reserved", "paid"])
        )
      );
    if (!changed(result)) continue;
    await tx
      .update(czTickets)
      .set({ status: "cancelled" })
      .where(
        and(eq(czTickets.orderId, order.id), eq(czTickets.status, "valid"))
      );
    await tx
      .update(czEventTicketTypes)
      .set({
        taken: sql`greatest(${czEventTicketTypes.taken} - ${order.quantity}, 0)`,
      })
      .where(eq(czEventTicketTypes.id, order.ticketTypeId));
  }
}

export async function setEventStatus(
  user: User,
  id: number,
  status: EventStatus,
  now = new Date()
) {
  const db = await requireDb();
  if (status === "published") {
    const { app } = await requireOrganizerStore(db, user.id);
    if (app.status !== "approved")
      fail("PRECONDITION_FAILED", "Tu tienda todavía no está aprobada");
    if (app.subscriptionStatus !== "active")
      fail(
        "PRECONDITION_FAILED",
        "Tu plan no está activo. Renuévalo para publicar."
      );
  }
  return db.transaction(async (tx: any) => {
    const row = await ownEvent(tx, user.id, id, true);
    if (row.status === "cancelled")
      fail("PRECONDITION_FAILED", "Este evento ya está cancelado");
    if (row.status === status) return { status, cancelledOrders: 0 };
    const types = (await tx
      .select()
      .from(czEventTicketTypes)
      .where(eq(czEventTicketTypes.eventId, id))) as any[];
    if (status === "published" && row.moderatedAt)
      fail(
        "FORBIDDEN",
        `Un administrador ocultó esta publicación${row.moderationReason ? `: ${row.moderationReason}` : ""}. Escríbenos si ya lo corregiste.`
      );
    if (status === "published") {
      if (new Date(row.startsAt) <= now)
        fail(
          "PRECONDITION_FAILED",
          "La fecha del evento ya pasó. Cámbiala antes de publicar."
        );
      if (!types.length)
        fail("PRECONDITION_FAILED", "Agrega al menos un tipo de entrada");
    }
    if (status === "draft" && types.some(t => t.taken > 0))
      fail(
        "PRECONDITION_FAILED",
        "Ya hay boletos apartados o vendidos. Si no se hará, cancela el evento."
      );

    let cancelledOrders = 0;
    if (status === "cancelled") {
      const orders = (await tx
        .select()
        .from(czTicketOrders)
        .where(
          and(
            eq(czTicketOrders.eventId, id),
            inArray(czTicketOrders.status, ["reserved", "paid"])
          )
        )
        .for("update")) as any[];
      await cancelOrdersTx(tx, orders, now);
      cancelledOrders = orders.length;
      for (const order of orders)
        await queueEmail(
          tx,
          `event-cancelled:${id}:${order.id}`,
          await recipientFor(tx, order.buyerUserId),
          {
            subject: `Evento cancelado: ${row.title}`,
            title: "El evento fue cancelado",
            paragraphs: [
              `El organizador canceló «${row.title}» (${eventDateLabel(row.startsAt)}). Tus boletos ya no son válidos.`,
              order.status === "paid"
                ? "Si ya pagaste, comunícate con el organizador para tu reembolso: el pago se hizo directo a él."
                : "Tu reserva quedó anulada; no tienes que pagar nada.",
            ],
            cta: { label: "Ver mis boletos", path: "/mis-boletos" },
          }
        );
    }
    await tx
      .update(czEvents)
      .set({
        status,
        revision: row.revision + 1,
        ...(status === "published" && !row.publishedAt
          ? { publishedAt: now }
          : {}),
      })
      .where(eq(czEvents.id, id));
    return { status, cancelledOrders };
  });
}

export async function myEvents(user: User) {
  const db = await requireDb();
  const found = await organizerStore(db, user.id);
  if (!found) return { events: [] as OwnEventDTO[] };
  const rows = await db
    .select()
    .from(czEvents)
    .where(eq(czEvents.userId, user.id))
    .orderBy(desc(czEvents.startsAt))
    .limit(200);
  const ids = rows.map((r: any) => r.id);
  const types = await ticketTypesFor(db, ids);
  const orderStats = ids.length
    ? await db
        .select({
          eventId: czTicketOrders.eventId,
          reserved: sql<number>`coalesce(sum(case when ${czTicketOrders.status} = 'reserved' then ${czTicketOrders.quantity} else 0 end), 0)`,
          paid: sql<number>`coalesce(sum(case when ${czTicketOrders.status} = 'paid' then ${czTicketOrders.quantity} else 0 end), 0)`,
        })
        .from(czTicketOrders)
        .where(inArray(czTicketOrders.eventId, ids))
        .groupBy(czTicketOrders.eventId)
    : [];
  const usedStats = ids.length
    ? await db
        .select({ eventId: czTickets.eventId, used: sql<number>`count(*)` })
        .from(czTickets)
        .where(
          and(inArray(czTickets.eventId, ids), eq(czTickets.status, "used"))
        )
        .groupBy(czTickets.eventId)
    : [];
  const orders = new Map(orderStats.map((s: any) => [s.eventId, s]));
  const used = new Map(
    usedStats.map((s: any) => [s.eventId, Number(s.used ?? 0)])
  );
  return {
    events: rows.map((r: any): OwnEventDTO => {
      const eventTypes = types.get(r.id) ?? [];
      const o: any = orders.get(r.id);
      return {
        ...dto(r, found.store, eventTypes),
        revision: r.revision,
        stats: {
          reserved: Number(o?.reserved ?? 0),
          paid: Number(o?.paid ?? 0),
          used: used.get(r.id) ?? 0,
          capacity: eventTypes.reduce((sum, t) => sum + t.capacity, 0),
        },
      };
    }),
  };
}

export async function eventOrders(user: User, eventId: number) {
  const db = await requireDb();
  await ownEvent(db, user.id, eventId);
  const rows = await db
    .select({ order: czTicketOrders, typeName: czEventTicketTypes.name })
    .from(czTicketOrders)
    .innerJoin(
      czEventTicketTypes,
      eq(czEventTicketTypes.id, czTicketOrders.ticketTypeId)
    )
    .where(eq(czTicketOrders.eventId, eventId))
    .orderBy(desc(czTicketOrders.createdAt))
    .limit(1000);
  return rows.map((r: any) => ({
    id: r.order.id,
    typeName: r.typeName,
    quantity: r.order.quantity,
    totalCents: r.order.totalCents,
    status: r.order.status as TicketOrderStatus,
    buyerName: r.order.buyerName,
    buyerPhone: r.order.buyerPhone,
    expiresAt: iso(r.order.expiresAt),
    paidAt: iso(r.order.paidAt),
    createdAt: new Date(r.order.createdAt).toISOString(),
  }));
}

// ───────────── Comprador: reservar ─────────────

export async function reserveTickets(
  user: User,
  raw: unknown,
  now = new Date()
) {
  const parsed = reserveTicketsInput.safeParse(raw);
  if (!parsed.success)
    fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Datos inválidos");
  const v = parsed.data;
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const rows = await tx
      .select({
        type: czEventTicketTypes,
        event: czEvents,
        app: czApplications,
      })
      .from(czEventTicketTypes)
      .innerJoin(czEvents, eq(czEvents.id, czEventTicketTypes.eventId))
      .innerJoin(czStores, eq(czStores.id, czEvents.storeId))
      .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
      .where(eq(czEventTicketTypes.id, v.ticketTypeId))
      .limit(1);
    const found = rows[0];
    if (
      !found ||
      found.event.status !== "published" ||
      found.app.status !== "approved" ||
      found.app.subscriptionStatus !== "active"
    )
      fail("NOT_FOUND", "Este evento ya no recibe reservas");
    const { type, event } = found;
    if (new Date(event.startsAt) <= now)
      fail("PRECONDITION_FAILED", "Este evento ya empezó");
    if (event.userId === user.id)
      fail("BAD_REQUEST", "No puedes reservar boletos de tu propio evento");

    // Evita que una sola persona aparte muchos boletos sin pagar.
    const pending = await tx
      .select({ n: sql<number>`coalesce(sum(${czTicketOrders.quantity}), 0)` })
      .from(czTicketOrders)
      .where(
        and(
          eq(czTicketOrders.eventId, event.id),
          eq(czTicketOrders.buyerUserId, user.id),
          eq(czTicketOrders.status, "reserved")
        )
      );
    if (Number(pending[0]?.n ?? 0) + v.quantity > MAX_TICKETS_PER_ORDER)
      fail(
        "TOO_MANY_REQUESTS",
        `Ya tienes boletos apartados sin pagar. Puedes apartar hasta ${MAX_TICKETS_PER_ORDER} a la vez.`
      );

    // Paso atómico: solo aparta si cabe. Dos personas a la vez nunca sobrepasan el aforo.
    const took = await tx
      .update(czEventTicketTypes)
      .set({ taken: sql`${czEventTicketTypes.taken} + ${v.quantity}` })
      .where(
        and(
          eq(czEventTicketTypes.id, type.id),
          sql`${czEventTicketTypes.taken} + ${v.quantity} <= ${czEventTicketTypes.capacity}`
        )
      );
    if (!changed(took)) {
      const left = Math.max(0, type.capacity - type.taken);
      fail(
        "CONFLICT",
        left > 0 && left < v.quantity
          ? `Solo quedan ${left} boletos de «${type.name}»`
          : `Se agotaron los boletos de «${type.name}»`
      );
    }

    const free = type.priceCents === 0;
    const totalCents = type.priceCents * v.quantity;
    const expiresAt = free
      ? null
      : new Date(now.getTime() + RESERVATION_HOURS * 3600 * 1000);
    const inserted = await tx.insert(czTicketOrders).values({
      eventId: event.id,
      ticketTypeId: type.id,
      storeId: event.storeId,
      buyerUserId: user.id,
      quantity: v.quantity,
      unitPriceCents: type.priceCents,
      totalCents,
      status: free ? "paid" : "reserved",
      buyerName: v.buyerName,
      buyerPhone: v.buyerPhone,
      expiresAt,
      paidAt: free ? now : null,
    });
    const orderId = insertId(inserted);
    if (!orderId)
      fail("INTERNAL_SERVER_ERROR", "No se pudo guardar la reserva");

    if (free) {
      await issueTickets(tx, {
        id: orderId,
        eventId: event.id,
        ticketTypeId: type.id,
        buyerUserId: user.id,
        quantity: v.quantity,
      });
      await queueEmail(
        tx,
        `tickets-issued:${orderId}`,
        await recipientFor(tx, user.id),
        {
          subject: `Tus boletos: ${event.title}`,
          title: "¡Tus boletos están listos!",
          paragraphs: [
            `Tienes ${v.quantity} ${v.quantity === 1 ? "boleto" : "boletos"} «${type.name}» para «${event.title}», ${eventDateLabel(event.startsAt)}, en ${event.venueName}.`,
            "Muestra el código QR de cada boleto en la entrada. Cada código vale una sola vez.",
          ],
          cta: { label: "Ver mis boletos", path: "/mis-boletos" },
        }
      );
    } else {
      await queueEmail(
        tx,
        `ticket-reserved:${orderId}`,
        await recipientFor(tx, event.userId),
        {
          subject: `Nueva reserva: ${event.title}`,
          title: "Alguien apartó boletos de tu evento",
          paragraphs: [
            `${v.buyerName} (${v.buyerPhone}) apartó ${v.quantity} «${type.name}» para «${event.title}».`,
            `Cuando recibas el pago, márcalo como pagado y le llegarán sus boletos con QR. Si no paga en ${RESERVATION_HOURS} horas, la reserva se libera sola.`,
          ],
          details: [["Total a cobrar", moneyLabel(totalCents)]],
          cta: { label: "Ver reservas", path: "/vendedor/eventos" },
        }
      );
      await queueEmail(
        tx,
        `ticket-reserved-buyer:${orderId}`,
        await recipientFor(tx, user.id),
        {
          subject: `Boletos apartados: ${event.title}`,
          title: "Tus boletos están apartados",
          paragraphs: [
            `Apartaste ${v.quantity} «${type.name}» para «${event.title}». Paga directo al organizador en las próximas ${RESERVATION_HOURS} horas; en «Mis boletos» ves sus datos de pago.`,
            "Cuando el organizador confirme tu pago, recibirás tus boletos con código QR.",
          ],
          details: [["Total", moneyLabel(totalCents)]],
          cta: { label: "Ver cómo pagar", path: "/mis-boletos" },
        }
      );
    }
    return {
      orderId,
      status: (free ? "paid" : "reserved") as TicketOrderStatus,
      totalCents,
      expiresAt: iso(expiresAt),
    };
  });
}

// ───────────── Organizador: pagos y cancelaciones ─────────────

async function orderWithEvent(tx: any, orderId: number) {
  const rows = await tx
    .select({ order: czTicketOrders, event: czEvents })
    .from(czTicketOrders)
    .innerJoin(czEvents, eq(czEvents.id, czTicketOrders.eventId))
    .where(eq(czTicketOrders.id, orderId))
    .for("update")
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "La reserva no existe");
  return rows[0] as { order: any; event: any };
}

export async function markOrderPaid(
  user: User,
  orderId: number,
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const { order, event } = await orderWithEvent(tx, orderId);
    if (event.userId !== user.id) fail("NOT_FOUND", "La reserva no existe");
    if (order.status === "paid")
      return {
        status: "paid" as const,
        commissionCents: order.commissionCents,
      };
    if (order.status !== "reserved")
      fail(
        "PRECONDITION_FAILED",
        "Esta reserva fue cancelada. Pide al comprador que aparte de nuevo."
      );
    const apps = await tx
      .select({ trialEndsAt: czApplications.trialEndsAt })
      .from(czApplications)
      .where(eq(czApplications.userId, user.id))
      .limit(1);
    const commission = ticketCommission(
      order.totalCents,
      apps[0]?.trialEndsAt ?? null,
      now
    );
    const result = await tx
      .update(czTicketOrders)
      .set({
        status: "paid",
        paidAt: now,
        expiresAt: null,
        commissionBps: commission.bps,
        commissionCents: commission.cents,
      })
      .where(
        and(
          eq(czTicketOrders.id, orderId),
          eq(czTicketOrders.status, "reserved")
        )
      );
    if (!changed(result))
      fail("CONFLICT", "La reserva cambió. Recarga la lista.");
    await issueTickets(tx, order);
    await queueEmail(
      tx,
      `tickets-issued:${orderId}`,
      await recipientFor(tx, order.buyerUserId),
      {
        subject: `Tus boletos: ${event.title}`,
        title: "¡Pago confirmado! Tus boletos están listos",
        paragraphs: [
          `El organizador confirmó tu pago de ${moneyLabel(order.totalCents)} para «${event.title}», ${eventDateLabel(event.startsAt)}.`,
          "Muestra el código QR de cada boleto en la entrada. Cada código vale una sola vez.",
        ],
        cta: { label: "Ver mis boletos", path: "/mis-boletos" },
      }
    );
    return { status: "paid" as const, commissionCents: commission.cents };
  });
}

export async function cancelOrder(
  user: User,
  orderId: number,
  now = new Date()
) {
  const db = await requireDb();
  return db.transaction(async (tx: any) => {
    const { order, event } = await orderWithEvent(tx, orderId);
    const organizer = event.userId === user.id;
    const buyer = order.buyerUserId === user.id;
    if (!organizer && !buyer) fail("NOT_FOUND", "La reserva no existe");
    if (order.status === "cancelled") return { status: "cancelled" as const };
    if (!organizer && order.status === "paid")
      fail(
        "PRECONDITION_FAILED",
        "Esta reserva ya está pagada. Para cancelarla habla con el organizador."
      );
    const used = await tx
      .select({ n: sql<number>`count(*)` })
      .from(czTickets)
      .where(and(eq(czTickets.orderId, orderId), eq(czTickets.status, "used")));
    if (Number(used[0]?.n ?? 0) > 0)
      fail(
        "PRECONDITION_FAILED",
        "Uno de estos boletos ya se usó en la entrada"
      );
    await cancelOrdersTx(tx, [order], now);
    const notify = organizer ? order.buyerUserId : event.userId;
    await queueEmail(
      tx,
      `ticket-order-cancelled:${orderId}`,
      await recipientFor(tx, notify),
      {
        subject: `Reserva cancelada: ${event.title}`,
        title: "Se canceló una reserva",
        paragraphs: [
          organizer
            ? `El organizador canceló tu reserva de ${order.quantity} boleto(s) para «${event.title}».`
            : `${order.buyerName} canceló su reserva de ${order.quantity} boleto(s) para «${event.title}». Los boletos vuelven a estar disponibles.`,
        ],
        cta: organizer
          ? { label: "Ver mis boletos", path: "/mis-boletos" }
          : { label: "Ver reservas", path: "/vendedor/eventos" },
      }
    );
    return { status: "cancelled" as const };
  });
}

/** Libera las reservas sin pagar que vencieron. Devuelve cuántas liberó. */
export async function sweepExpiredReservations(
  now = new Date()
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const expired = (await db
    .select({ id: czTicketOrders.id })
    .from(czTicketOrders)
    .where(
      and(
        eq(czTicketOrders.status, "reserved"),
        isNotNull(czTicketOrders.expiresAt),
        lt(czTicketOrders.expiresAt, now)
      )
    )
    .limit(500)) as Array<{ id: number }>;
  let released = 0;
  for (const { id } of expired) {
    try {
      await db.transaction(async (tx: any) => {
        const { order, event } = await orderWithEvent(tx, id);
        if (
          order.status !== "reserved" ||
          !order.expiresAt ||
          new Date(order.expiresAt) >= now
        )
          return;
        await cancelOrdersTx(tx, [order], now);
        released++;
        await queueEmail(
          tx,
          `ticket-order-expired:${id}`,
          await recipientFor(tx, order.buyerUserId),
          {
            subject: `Reserva vencida: ${event.title}`,
            title: "Tu reserva venció",
            paragraphs: [
              `Pasaron ${RESERVATION_HOURS} horas sin que el organizador confirmara el pago de tus boletos para «${event.title}», así que se liberaron.`,
              "Si ya pagaste, comunícate con el organizador. Si aún quedan boletos, puedes apartar de nuevo.",
            ],
            cta: { label: "Ver el evento", path: `/evento/${event.slug}` },
          }
        );
      });
    } catch (error) {
      console.error(
        `[Eventos] No se pudo liberar la reserva ${id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return released;
}

// ───────────── Entrada: escanear ─────────────

export type ScanResult =
  | { ok: true; holderName: string; typeName: string; code: string }
  | { ok: false; reason: string; usedAt?: string | null };

export async function validateTicket(
  user: User,
  eventId: number,
  raw: string,
  now = new Date()
): Promise<ScanResult> {
  const db = await requireDb();
  await ownEvent(db, user.id, eventId);
  const code = parseTicketScan(raw);
  if (!code)
    return { ok: false, reason: "Ese código no es un boleto de CuadraZone" };
  const rows = await db
    .select({
      ticket: czTickets,
      typeName: czEventTicketTypes.name,
      holderName: czTicketOrders.buyerName,
    })
    .from(czTickets)
    .innerJoin(
      czEventTicketTypes,
      eq(czEventTicketTypes.id, czTickets.ticketTypeId)
    )
    .innerJoin(czTicketOrders, eq(czTicketOrders.id, czTickets.orderId))
    .where(eq(czTickets.code, code))
    .limit(1);
  const found = rows[0];
  if (!found) return { ok: false, reason: "Boleto no encontrado" };
  if (found.ticket.eventId !== eventId)
    return { ok: false, reason: "Este boleto es de otro evento" };
  if (found.ticket.status === "cancelled")
    return { ok: false, reason: "Boleto cancelado" };
  if (found.ticket.status === "used")
    return {
      ok: false,
      reason: "Este boleto ya se usó",
      usedAt: iso(found.ticket.usedAt),
    };
  // valid → used de forma atómica: si dos personas escanean a la vez, solo uno pasa.
  const result = await db
    .update(czTickets)
    .set({ status: "used", usedAt: now, usedByUserId: user.id })
    .where(
      and(eq(czTickets.id, found.ticket.id), eq(czTickets.status, "valid"))
    );
  if (!changed(result)) return { ok: false, reason: "Este boleto ya se usó" };
  return {
    ok: true,
    holderName: found.holderName,
    typeName: found.typeName,
    code,
  };
}

export async function eventAttendance(user: User, eventId: number) {
  const db = await requireDb();
  const event = await ownEvent(db, user.id, eventId);
  const types = (await ticketTypesFor(db, [eventId])).get(eventId) ?? [];
  const tickets = await db
    .select({
      ticketTypeId: czTickets.ticketTypeId,
      issued: sql<number>`sum(${czTickets.status} <> 'cancelled')`,
      used: sql<number>`sum(${czTickets.status} = 'used')`,
    })
    .from(czTickets)
    .where(eq(czTickets.eventId, eventId))
    .groupBy(czTickets.ticketTypeId);
  const byType = new Map(tickets.map((t: any) => [t.ticketTypeId, t]));
  const rowsOut = types.map(t => {
    const s: any = byType.get(t.id);
    return {
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      issued: Number(s?.issued ?? 0),
      used: Number(s?.used ?? 0),
    };
  });
  return {
    eventId,
    title: event.title,
    startsAt: new Date(event.startsAt).toISOString(),
    capacity: rowsOut.reduce((n, t) => n + t.capacity, 0),
    issued: rowsOut.reduce((n, t) => n + t.issued, 0),
    used: rowsOut.reduce((n, t) => n + t.used, 0),
    types: rowsOut,
  };
}

// ───────────── Público ─────────────

function publicConditions() {
  return [
    eq(czEvents.status, "published"),
    eq(czApplications.status, "approved"),
    eq(czApplications.subscriptionStatus, "active"),
    isNotNull(czMembershipProfiles.emailVerifiedAt),
  ];
}

function publicQuery(db: any) {
  return db
    .select({
      event: czEvents,
      store: czStores,
      planId: czApplications.subscriptionPlanId,
    })
    .from(czEvents)
    .innerJoin(czStores, eq(czStores.id, czEvents.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .innerJoin(
      czMembershipProfiles,
      eq(czMembershipProfiles.userId, czStores.userId)
    );
}

export async function publicEvents(filters: EventFilters) {
  const db = await requireDb();
  const conditions: any[] = [
    ...publicConditions(),
    // Siguen a la vista hasta que terminan (o 6 h después de empezar si no hay hora de fin).
    sql`coalesce(${czEvents.endsAt}, ${czEvents.startsAt} + interval 6 hour) > now()`,
  ];
  if (filters.province)
    conditions.push(eq(czEvents.province, filters.province));
  const rows = await publicQuery(db)
    .where(and(...conditions))
    .orderBy(asc(czEvents.startsAt))
    .limit(1000);
  const q = filters.q?.toLowerCase();
  const matching = rows.filter(
    (r: any) =>
      !q ||
      `${r.event.title} ${r.event.artist} ${r.event.venueName} ${r.event.city} ${r.store.name}`
        .toLowerCase()
        .includes(q)
  );
  const start = (filters.page - 1) * PAGE_SIZE;
  const pageRows = matching.slice(start, start + PAGE_SIZE);
  // Mayor Visibilidad: franja superior con los eventos que cumplen los filtros.
  const featuredRows = pickFeatured(
    matching.filter((r: any) => r.planId === FEATURED_PLAN_ID),
    (r: any) => r.store.id as number
  );
  const types = await ticketTypesFor(db, [
    ...new Set<number>(
      [...pageRows, ...featuredRows].map((r: any) => r.event.id)
    ),
  ]);
  return {
    total: matching.length,
    page: filters.page,
    pageSize: PAGE_SIZE,
    items: pageRows.map((r: any) =>
      dto(r.event, r.store, types.get(r.event.id) ?? [])
    ),
    featured: featuredRows.map((r: any) =>
      dto(r.event, r.store, types.get(r.event.id) ?? [])
    ),
  };
}

export async function publicEvent(slug: string) {
  const db = await requireDb();
  const rows = await publicQuery(db)
    .where(and(eq(czEvents.slug, slug), ...publicConditions()))
    .limit(1);
  if (!rows[0]) fail("NOT_FOUND", "Este evento ya no está disponible");
  const types = await ticketTypesFor(db, [rows[0].event.id]);
  return dto(rows[0].event, rows[0].store, types.get(rows[0].event.id) ?? []);
}

export async function myTickets(user: User) {
  const db = await requireDb();
  const rows = await db
    .select({
      order: czTicketOrders,
      event: czEvents,
      typeName: czEventTicketTypes.name,
      store: czStores,
      contactPhone: czApplications.contactPhone,
    })
    .from(czTicketOrders)
    .innerJoin(czEvents, eq(czEvents.id, czTicketOrders.eventId))
    .innerJoin(
      czEventTicketTypes,
      eq(czEventTicketTypes.id, czTicketOrders.ticketTypeId)
    )
    .innerJoin(czStores, eq(czStores.id, czTicketOrders.storeId))
    .innerJoin(czApplications, eq(czApplications.userId, czStores.userId))
    .where(eq(czTicketOrders.buyerUserId, user.id))
    .orderBy(desc(czTicketOrders.createdAt))
    .limit(100);
  const orderIds = rows.map((r: any) => r.order.id);
  const tickets = orderIds.length
    ? await db
        .select({
          orderId: czTickets.orderId,
          code: czTickets.code,
          status: czTickets.status,
          usedAt: czTickets.usedAt,
        })
        .from(czTickets)
        .where(inArray(czTickets.orderId, orderIds))
        .orderBy(asc(czTickets.id))
    : [];
  const byOrder = new Map<number, any[]>();
  for (const t of tickets)
    byOrder.set(t.orderId, [...(byOrder.get(t.orderId) ?? []), t]);
  return rows.map((r: any) => ({
    id: r.order.id,
    status: r.order.status as TicketOrderStatus,
    quantity: r.order.quantity,
    totalCents: r.order.totalCents,
    typeName: r.typeName,
    expiresAt: iso(r.order.expiresAt),
    createdAt: new Date(r.order.createdAt).toISOString(),
    event: {
      title: r.event.title,
      slug: r.event.slug,
      startsAt: new Date(r.event.startsAt).toISOString(),
      venueName: r.event.venueName,
      address: r.event.address ?? "",
      city: r.event.city ?? "",
      province: r.event.province,
      mapUrl: r.event.mapUrl ?? "",
      status: r.event.status as EventStatus,
      image: list(r.event.images)[0] ?? null,
    },
    organizer: {
      name: r.store.name,
      slug: r.store.slug,
      phone: r.contactPhone ?? null,
      yappyPhone: r.store.yappyPhone ?? null,
      yappyDirectory: r.store.yappyDirectory ?? null,
      cardPaymentUrl: r.store.cardPaymentUrl ?? null,
    },
    tickets: (byOrder.get(r.order.id) ?? []).map(t => ({
      code: t.code as string,
      status: t.status as "valid" | "used" | "cancelled",
      usedAt: iso(t.usedAt),
    })),
  }));
}

// ───────────── Fotos ─────────────

async function uploadImage(req: Request, res: Response) {
  try {
    if (req.headers["x-cz-request"] !== "1")
      return res
        .status(412)
        .json({ error: "Falta la cabecera x-cz-request: 1" });
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).json({ error: "Evento inválido" });
    const mimeType = String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    validateCatalogImageBytes(req.body, mimeType);
    const db = await requireDb();
    const row = await ownEvent(db, user.id, id);
    const images = list<string>(row.images);
    if (images.length >= MAX_EVENT_IMAGES)
      return res
        .status(409)
        .json({ error: `Máximo ${MAX_EVENT_IMAGES} fotos por evento` });
    const saved = await storagePut(
      `catalog/events/${id}/${randomUUID()}.${IMAGE_EXT[mimeType]}`,
      req.body,
      mimeType
    );
    await db
      .update(czEvents)
      .set({ images: [...images, saved.url], revision: row.revision + 1 })
      .where(eq(czEvents.id, id));
    return res.status(201).json({ url: saved.url });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return res
      .status(
        code === "NOT_FOUND" ? 404 : code === "PAYLOAD_TOO_LARGE" ? 413 : 400
      )
      .json({
        error:
          error instanceof Error ? error.message : "No se pudo subir la foto",
      });
  }
}

export function registerEventImageRoutes(app: Express) {
  app.post(
    "/api/events/:id/images",
    express.raw({ type: () => true, limit: 5 * 1024 * 1024 }),
    uploadImage
  );
}

// ───────────── Comisiones (para commissions.ts) ─────────────

/** Ventas de boletos pagadas con comisión todavía sin saldar. */
export const pendingTicketCommission = and(
  eq(czTicketOrders.status, "paid"),
  sql`${czTicketOrders.commissionPaymentId} is null`,
  gt(czTicketOrders.commissionCents, 0)
);
