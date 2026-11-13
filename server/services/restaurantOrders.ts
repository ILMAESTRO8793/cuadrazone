/*
 * Pedidos de restaurante (parte 2). Se guardan como pedidos normales
 * (cz_orders) con entrega «a domicilio» por despachador, así reutilizan el
 * pago directo al vendedor, la comisión, los despachadores y el mapa. Los
 * precios se calculan aquí con el menú guardado; nunca se aceptan del navegador.
 */
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { czStores } from "../../drizzle/catalog-schema";
import {
  czNotifications,
  czOrderItems,
  czOrders,
} from "../../drizzle/commerce-schema";
import { czApplications } from "../../drizzle/schema";
import {
  czMenuItems,
  czRestaurantOrders,
  czRestaurants,
} from "../../drizzle/menu-schema";
import {
  describeLine,
  openStatus,
  priceFor,
  type PlaceRestaurantOrderInput,
  type PublicMenuItem,
  type WeekHours,
} from "@shared/menu";
import { paymentMethodLabels, paymentStatusFor } from "@shared/commerce";
import { isAllowedCardLink, storeAcceptsYappy } from "@shared/marketplace";
import { commissionBpsFor } from "@shared/pricing";
import { shippingDeal } from "@shared/shippingRules";
import { pointInput } from "@shared/location";
import { getDb } from "../db";
import { assertActiveStore } from "./catalog";
import { queueEmail, recipientFor } from "./email";
import { orderPlacedBuyer, orderPlacedSeller } from "./emailMessages";
import { saveOrderPlace } from "./places";

function fail(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}
const list = <T>(v: unknown): T[] => {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? (v as T[]) : [];
};
const MAX_TOTAL_CENTS = 5_000_000;

export async function placeRestaurantOrder(
  userId: number,
  input: PlaceRestaurantOrderInput,
  buyerProvince: string,
  now = new Date()
) {
  const db = await getDb();
  if (!db) fail("INTERNAL_SERVER_ERROR", "La base de datos no está disponible");
  const point = pointInput.safeParse(input.point);
  if (!point.success)
    fail("BAD_REQUEST", "Marca en el mapa el punto exacto de entrega.");

  return db.transaction(async tx => {
    const [store] = await tx
      .select()
      .from(czStores)
      .where(eq(czStores.slug, input.slug))
      .limit(1);
    if (!store) fail("NOT_FOUND", "El restaurante no existe");
    if (store.userId === userId)
      fail("FORBIDDEN", "No puedes pedir en tu propio restaurante");
    try {
      await assertActiveStore(tx as never, store.id);
    } catch {
      fail(
        "PRECONDITION_FAILED",
        "Este restaurante no está recibiendo pedidos ahora"
      );
    }
    const [restaurant] = await tx
      .select()
      .from(czRestaurants)
      .where(eq(czRestaurants.storeId, store.id))
      .limit(1);
    if (!restaurant || restaurant.enabled !== 1)
      fail("PRECONDITION_FAILED", "Este negocio no tiene menú activo");
    const hours = (
      typeof restaurant.hours === "string"
        ? JSON.parse(restaurant.hours)
        : restaurant.hours
    ) as WeekHours;
    const status = openStatus(hours, now);
    if (!status.open)
      fail(
        "PRECONDITION_FAILED",
        `El restaurante está cerrado${status.opensLabel ? `; abre ${status.opensLabel}` : ""}.`
      );
    // Solo delivery con despachador, dentro de la misma provincia.
    if (shippingDeal(store.province, buyerProvince) !== "free")
      fail(
        "PRECONDITION_FAILED",
        `Este restaurante entrega solo en ${store.province}.`
      );

    if (input.paymentMethod === "yappy" && !storeAcceptsYappy(store))
      fail(
        "PRECONDITION_FAILED",
        `${store.name} todavía no recibe pagos por Yappy. Elige otro método.`
      );
    if (
      input.paymentMethod === "card_link" &&
      !(store.cardPaymentUrl && isAllowedCardLink(store.cardPaymentUrl))
    )
      fail(
        "PRECONDITION_FAILED",
        `${store.name} no tiene link de pago con tarjeta. Elige otro método.`
      );

    const ids = Array.from(new Set(input.lines.map(l => l.itemId)));
    const rows = await tx
      .select()
      .from(czMenuItems)
      .where(
        and(eq(czMenuItems.storeId, store.id), inArray(czMenuItems.id, ids))
      );
    const byId = new Map(rows.map(r => [r.id, r]));
    const lines = input.lines.map(line => {
      const r = byId.get(line.itemId);
      if (!r)
        fail("CONFLICT", "Un plato ya no está en el menú. Revisa tu pedido.");
      if (r.available !== 1)
        fail("CONFLICT", `«${r.name}» está agotado. Quítalo de tu pedido.`);
      const item: Pick<
        PublicMenuItem,
        "name" | "priceCents" | "sizes" | "optionGroups"
      > = {
        name: r.name,
        priceCents: r.priceCents,
        sizes: list(r.sizes),
        optionGroups: list(r.optionGroups),
      };
      const price = priceFor(item, line);
      if (!price.ok) fail("BAD_REQUEST", `«${r.name}»: ${price.errors[0]}`);
      const d = describeLine(item, line);
      return {
        title: d.text,
        size: d.size,
        qty: line.qty,
        unitCents: price.cents,
      };
    });
    const subtotalCents = lines.reduce(
      (sum, l) => sum + l.unitCents * l.qty,
      0
    );
    if (
      !Number.isSafeInteger(subtotalCents) ||
      subtotalCents <= 0 ||
      subtotalCents > MAX_TOTAL_CENTS
    )
      fail("BAD_REQUEST", "El total del pedido no es válido");

    const [app] = await tx
      .select({
        trialEndsAt: czApplications.trialEndsAt,
        planId: czApplications.subscriptionPlanId,
      })
      .from(czApplications)
      .where(eq(czApplications.userId, store.userId))
      .limit(1);
    const checkoutKey = randomUUID();
    const number = `CZ-${checkoutKey.slice(0, 8)}-${store.id}-R${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const result = await tx.insert(czOrders).values({
      number,
      userId,
      storeId: store.id,
      checkoutKey,
      status: "pending",
      paymentMethod: input.paymentMethod,
      paymentStatus: paymentStatusFor(input.paymentMethod),
      subtotalCents,
      deliveryFeeCents: 0,
      totalCents: subtotalCents,
      deliveryMode: "home",
      commissionBps: commissionBpsFor(
        app?.planId ?? null,
        app?.trialEndsAt ?? null,
        now
      ),
      recipientName: input.recipientName,
      phone: input.phone,
      province: store.province,
      city: input.city,
      address: input.address,
      stockRestored: 0,
    });
    const header = (Array.isArray(result) ? result[0] : result) as {
      insertId?: number;
    };
    const orderId = Number(header.insertId);
    if (!orderId)
      fail("INTERNAL_SERVER_ERROR", "No se pudo registrar el pedido");
    for (const l of lines)
      await tx.insert(czOrderItems).values({
        orderId,
        productId: null,
        variantId: null,
        title: l.title,
        quantity: l.qty,
        unitPriceCents: l.unitCents,
        size: l.size,
        color: null,
      });
    await tx
      .insert(czRestaurantOrders)
      .values({ orderId, prepMinutes: restaurant.prepMinutes });
    await saveOrderPlace(tx, orderId, point.data);
    await tx.insert(czNotifications).values({
      userId: store.userId,
      kind: "new_order",
      body: "Nuevo pedido de tu restaurante: acéptalo o recházalo",
      payload: { orderId },
    });
    await queueEmail(
      tx,
      `order-buyer:${orderId}`,
      await recipientFor(tx, userId),
      orderPlacedBuyer(
        number,
        store.name,
        subtotalCents,
        {
          method: input.paymentMethod,
          yappyPhone: store.yappyPhone,
          yappyDirectory: store.yappyDirectory,
          cardLink:
            store.cardPaymentUrl && isAllowedCardLink(store.cardPaymentUrl)
              ? store.cardPaymentUrl
              : null,
        },
        orderId
      )
    );
    await queueEmail(
      tx,
      `order-seller:${orderId}`,
      await recipientFor(tx, store.userId),
      orderPlacedSeller(
        number,
        subtotalCents,
        paymentMethodLabels[input.paymentMethod],
        orderId
      )
    );
    return { orderId };
  });
}

/** ¿Es un pedido de restaurante? Solo para el comprador o el vendedor. */
export async function restaurantOrderInfo(userId: number, orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      prepMinutes: czRestaurantOrders.prepMinutes,
      buyerId: czOrders.userId,
      sellerId: czStores.userId,
    })
    .from(czRestaurantOrders)
    .innerJoin(czOrders, eq(czOrders.id, czRestaurantOrders.orderId))
    .innerJoin(czStores, eq(czStores.id, czOrders.storeId))
    .where(eq(czRestaurantOrders.orderId, orderId))
    .limit(1);
  if (!row || (row.buyerId !== userId && row.sellerId !== userId)) return null;
  return { prepMinutes: row.prepMinutes };
}
