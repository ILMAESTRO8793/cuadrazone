import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { czApplications } from "../../drizzle/schema";
import { commissionBpsAt, commissionCents } from "@shared/pricing";
import { czProducts, czStores, czVariants } from "../../drizzle/catalog-schema";
import {
  czCarts, czCartItems, czFavorites, czOrders, czOrderItems, czReviews,
  czQuestions, czConversations, czMessages, czNotifications,
} from "../../drizzle/commerce-schema";
import {
  assertCheckoutTotal, assertSafeQuantity, calculateSubtotal, canTransitionOrder, deriveReviewEligibility, paymentStatusFor,
  sameCheckoutPayload, stableVariantOrder,
  MAX_MONEY_CENTS, type CartDTO, type CartItemDTO, type DeliveryMode, type OrderDTO, type OrderStatus, type ReviewSafeDTO,
  type PaymentMethod, type PublicProductDTO,
} from "@shared/commerce";
import type { PublicProduct } from "@shared/marketplace";
import { storeAcceptsYappy } from "@shared/marketplace";
import { assertActiveStore, assertSellerOwner } from "./catalog";
import { getPublicProduct } from "./catalog";

export type CommerceUser = { id: number; role: "user" | "admin" };
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type CatalogProduct = typeof czProducts.$inferSelect;
type CatalogStore = typeof czStores.$inferSelect;
type CatalogVariant = typeof czVariants.$inferSelect;

export class CommerceError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "PRECONDITION_FAILED" | "BAD_REQUEST", message: string) {
    super(message);
    this.name = "CommerceError";
  }
}

async function database(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La base de datos no está disponible" });
  return db as Db;
}

function fail(code: CommerceError["code"], message: string): never { throw new CommerceError(code, message); }
function assertServiceCheckoutTotal(expected: number, calculated: number): void {
  try {
    assertCheckoutTotal(expected, calculated);
  } catch {
    const validMoney = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_MONEY_CENTS;
    if (!validMoney(expected) || !validMoney(calculated)) fail("BAD_REQUEST", "El total del checkout no es válido");
    fail("CONFLICT", "Los precios o tarifas cambiaron. Actualiza el carrito y revisa el total antes de volver a enviar.");
  }
}
export function affectedRows(result: unknown): number {
  const row = Array.isArray(result) ? result[0] as { affectedRows?: unknown } | undefined : result as { affectedRows?: unknown } | undefined;
  const value = row?.affectedRows;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function idFromInsert(result: unknown): number {
  const row = Array.isArray(result) ? result[0] as { id?: unknown; insertId?: unknown } | undefined : result as { id?: unknown; insertId?: unknown } | undefined;
  const value = row?.id ?? row?.insertId;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) fail("PRECONDITION_FAILED", "No se pudo identificar el registro creado");
  return value;
}
function listInsertId(result: unknown): number {
  const resultAny = (Array.isArray(result) ? result[0] : result) as { insertId?: number } | undefined;
  if (typeof resultAny?.insertId === "number" && Number.isSafeInteger(resultAny.insertId) && resultAny.insertId > 0) return resultAny.insertId;
  return idFromInsert(result);
}
// MySQL 8 entrega las columnas JSON como arreglo; MariaDB y otros, como texto.
function parseJsonArray(value: unknown): string[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}
function parseModes(value: unknown): DeliveryMode[] { return parseJsonArray(value).filter((x): x is DeliveryMode => x === "shipping" || x === "pickup" || x === "home"); }

export function deliveryQuote(store: Pick<CatalogStore, "shippingFeeCents" | "homeFeeCents" | "deliveryProvinces">, mode: DeliveryMode, province: string): number {
  if (mode === "pickup") return 0;
  const fee = mode === "shipping" ? store.shippingFeeCents : store.homeFeeCents;
  if (fee === null || !Number.isInteger(fee) || fee < 0 || fee > MAX_MONEY_CENTS) fail("PRECONDITION_FAILED", "La tienda no tiene una tarifa válida para esta entrega");
  const provinces = parseJsonArray(store.deliveryProvinces);
  if (!provinces.includes(province)) fail("PRECONDITION_FAILED", "La tienda no cubre la provincia seleccionada");
  return fee;
}

async function activeStore(tx: Db | Tx, storeId: number): Promise<CatalogStore> {
  const rows = await tx.select().from(czStores).where(eq(czStores.id, storeId)).limit(1);
  const store = rows[0];
  if (!store) fail("NOT_FOUND", "La tienda no existe");
  try { await assertActiveStore(tx, storeId); }
  catch (error) { if (error instanceof Error) fail("PRECONDITION_FAILED", error.message); throw error; }
  return store;
}

async function ownerStore(tx: Db | Tx, userId: number, storeId: number): Promise<CatalogStore> {
  const rows = await tx.select().from(czStores).where(eq(czStores.id, storeId)).limit(1);
  const store = rows[0];
  if (!store) fail("NOT_FOUND", "La tienda no existe");
  try { await assertSellerOwner(tx, userId, storeId); }
  catch (error) { if (error instanceof Error) fail("FORBIDDEN", error.message); throw error; }
  return store;
}

async function publicProduct(tx: Db | Tx, productId: number): Promise<{ product: CatalogProduct; store: CatalogStore }> {
  const rows = await tx.select({ product: czProducts, store: czStores }).from(czProducts).innerJoin(czStores, eq(czProducts.storeId, czStores.id)).where(and(eq(czProducts.id, productId), eq(czProducts.status, "published"))).limit(1);
  const row = rows[0];
  if (!row) fail("NOT_FOUND", "La publicación no está disponible");
  await activeStore(tx, row.store.id);
  return row;
}

async function productWithVariant(tx: Db | Tx, variantId: number, buyerId?: number): Promise<{ product: CatalogProduct; store: CatalogStore; variant: CatalogVariant }> {
  const rows = await tx.select({ product: czProducts, store: czStores, variant: czVariants }).from(czVariants)
    .innerJoin(czProducts, eq(czVariants.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .where(and(eq(czVariants.id, variantId), eq(czVariants.active, 1), eq(czProducts.status, "published"))).limit(1);
  const row = rows[0];
  if (!row) fail("NOT_FOUND", "La variante no está disponible");
  if (buyerId !== undefined && row.store.userId === buyerId) fail("FORBIDDEN", "No puedes comprar artículos de tu propia tienda");
  await activeStore(tx, row.store.id);
  return row;
}

function publicProductDto(product: CatalogProduct, store: CatalogStore, variants: CatalogVariant[] = []): PublicProductDTO {
  const prices = variants.map(v => v.priceCents).filter(Number.isFinite);
  return {
    id: product.id, storeId: store.id, storeName: store.name, slug: product.slug,
    kind: product.kind, title: product.title, description: product.description,
    category: product.category || null, priceCents: prices.length ? Math.min(...prices) : product.priceCents,
    image: parseJsonArray(product.imageUrls)[0] ?? null, imageUrls: parseJsonArray(product.imageUrls),
    deliveryModes: parseModes(product.deliveryModes),
  };
}

async function cartFor(tx: Db | Tx, userId: number): Promise<CartDTO> {
  const cart = (await tx.select().from(czCarts).where(eq(czCarts.userId, userId)).limit(1))[0];
  if (!cart) return { items: [], subtotalCents: 0 };
  const rows = await tx.select({ item: czCartItems, variant: czVariants, product: czProducts, store: czStores })
    .from(czCartItems).innerJoin(czVariants, eq(czCartItems.variantId, czVariants.id))
    .innerJoin(czProducts, eq(czVariants.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .where(eq(czCartItems.cartId, cart.id)).orderBy(asc(czCartItems.id));
  const items: CartItemDTO[] = [];
  for (const row of rows) {
    const available = row.variant.active === 1 && row.product.status === "published";
    let active = false;
    if (available) { try { await activeStore(tx, row.store.id); active = true; } catch { active = false; } }
    const availableNow = active && row.variant.stock >= row.item.quantity;
    items.push({ id: row.item.id, variantId: row.variant.id, quantity: row.item.quantity, productId: row.product.id, title: row.product.title,
      slug: row.product.slug, image: parseJsonArray(row.product.imageUrls)[0] ?? null, storeId: row.store.id, storeName: row.store.name,
      storeShippingFeeCents: row.store.shippingFeeCents ?? null, storeHomeFeeCents: row.store.homeFeeCents ?? null,
      storeDeliveryProvinces: parseJsonArray(row.store.deliveryProvinces), productDeliveryModes: parseModes(row.product.deliveryModes),
      priceCents: row.variant.priceCents, stock: row.variant.stock, available: availableNow, size: row.variant.size, color: row.variant.color });
  }
  return { items, subtotalCents: calculateSubtotal(items.filter(i => i.available).map(i => ({ priceCents: i.priceCents, quantity: i.quantity }))) };
}

export async function getCart(userId: number): Promise<CartDTO> { return cartFor(await database(), userId); }

async function ensureCart(tx: Db | Tx, userId: number): Promise<number> {
  const existing = (await tx.select().from(czCarts).where(eq(czCarts.userId, userId)).limit(1))[0];
  if (existing) return existing.id;
  const result = await tx.insert(czCarts).values({ userId });
  return listInsertId(result);
}

export async function addCart(userId: number, variantId: number, quantity: number): Promise<CartDTO> {
  assertSafeQuantity(quantity, 20);
  const db = await database();
  return db.transaction(async tx => {
    const cartId = await ensureCart(tx, userId);
    const cart = (await tx.select().from(czCarts).where(and(eq(czCarts.id, cartId), eq(czCarts.userId, userId))).for("update").limit(1))[0];
    if (!cart) fail("CONFLICT", "No se pudo bloquear el carrito");
    const { variant } = await productWithVariant(tx, variantId, userId);
    if (quantity > variant.stock) fail("CONFLICT", "Inventario insuficiente");
    const existing = (await tx.select().from(czCartItems).where(and(eq(czCartItems.cartId, cartId), eq(czCartItems.variantId, variantId))).limit(1))[0];
    if (existing) {
      const next = existing.quantity + quantity;
      assertSafeQuantity(next, variant.stock);
      await tx.update(czCartItems).set({ quantity: next }).where(and(eq(czCartItems.id, existing.id), eq(czCartItems.cartId, cartId)));
    } else await tx.insert(czCartItems).values({ cartId, variantId, quantity });
    return cartFor(tx, userId);
  });
}

export async function setCartQuantity(userId: number, itemId: number, quantity: number): Promise<CartDTO> {
  const db = await database();
  return db.transaction(async tx => {
    const cart = (await tx.select().from(czCarts).where(eq(czCarts.userId, userId)).for("update").limit(1))[0];
    if (!cart) fail("NOT_FOUND", "La línea del carrito no existe");
    const row = (await tx.select({ item: czCartItems, variant: czVariants }).from(czCartItems).innerJoin(czVariants, eq(czCartItems.variantId, czVariants.id)).where(and(eq(czCartItems.id, itemId), eq(czCartItems.cartId, cart.id))).for("update").limit(1))[0];
    if (!row) fail("NOT_FOUND", "La línea del carrito no existe");
    assertSafeQuantity(quantity, row.variant.stock);
    await tx.update(czCartItems).set({ quantity }).where(and(eq(czCartItems.id, itemId), eq(czCartItems.cartId, row.item.cartId)));
    return cartFor(tx, userId);
  });
}

export async function removeCart(userId: number, itemId: number): Promise<CartDTO> {
  const db = await database();
  return db.transaction(async tx => {
    const cart = (await tx.select().from(czCarts).where(eq(czCarts.userId, userId)).for("update").limit(1))[0];
    if (!cart) fail("NOT_FOUND", "La línea del carrito no existe");
    const rows = await tx.select({ id: czCartItems.id }).from(czCartItems).where(and(eq(czCartItems.id, itemId), eq(czCartItems.cartId, cart.id))).for("update").limit(1);
    if (!rows[0]) fail("NOT_FOUND", "La línea del carrito no existe");
    await tx.delete(czCartItems).where(eq(czCartItems.id, itemId));
    return cartFor(tx, userId);
  });
}

export async function listFavorites(userId: number): Promise<{ items: PublicProduct[] }> {
  const db = await database();
  const rows = await db.select({ favorite: czFavorites, product: czProducts, store: czStores }).from(czFavorites).innerJoin(czProducts, eq(czFavorites.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id)).where(eq(czFavorites.userId, userId)).orderBy(desc(czFavorites.createdAt));
  const items: PublicProduct[] = [];
  for (const row of rows) {
    if (row.product.status !== "published") continue;
    const product = await getPublicProduct(row.product.slug);
    if (product) items.push(product);
  }
  return { items };
}

export async function toggleFavorite(userId: number, productId: number): Promise<{ saved: boolean }> {
  const db = await database();
  return db.transaction(async tx => {
    await publicProduct(tx, productId);
    const existing = (await tx.select().from(czFavorites).where(and(eq(czFavorites.userId, userId), eq(czFavorites.productId, productId))).limit(1))[0];
    if (existing) { await tx.delete(czFavorites).where(and(eq(czFavorites.id, existing.id), eq(czFavorites.userId, userId))); return { saved: false }; }
    await tx.insert(czFavorites).values({ userId, productId });
    return { saved: true };
  });
}

async function orderDto(tx: Db | Tx, orderId: number, viewerId: number): Promise<OrderDTO> {
  const row = (await tx.select({ order: czOrders, store: czStores }).from(czOrders).innerJoin(czStores, eq(czOrders.storeId, czStores.id)).where(eq(czOrders.id, orderId)).limit(1))[0];
  if (!row) fail("NOT_FOUND", "El pedido no existe");
  if (row.order.userId !== viewerId && row.store.userId !== viewerId) fail("FORBIDDEN", "No autorizado para este pedido");
  const items = await tx.select().from(czOrderItems).where(eq(czOrderItems.orderId, orderId)).orderBy(asc(czOrderItems.id));
  return { id: row.order.id, number: row.order.number, storeId: row.order.storeId, storeName: row.store.name, status: row.order.status as OrderStatus,
    totalCents: row.order.totalCents, deliveryFeeCents: row.order.deliveryFeeCents, paymentMethod: row.order.paymentMethod as PaymentMethod, paymentStatus: row.order.paymentStatus,
    createdAt: row.order.createdAt, recipientName: row.order.recipientName, phone: row.order.phone, province: row.order.province, city: row.order.city, address: row.order.address,
    deliveryMode: row.order.deliveryMode, items: items.map(i => ({ productId: i.productId, variantId: i.variantId, title: i.title, quantity: i.quantity, unitPriceCents: i.unitPriceCents, size: i.size, color: i.color })),
    viewerRole: row.order.userId === viewerId ? "buyer" : "seller",
    sellerYappy: row.order.paymentMethod === "yappy" ? { phone: row.store.yappyPhone ?? null, directory: row.store.yappyDirectory ?? null } : null };
}

export async function checkout(userId: number, input: { checkoutKey: string; expectedTotalCents: number; recipientName: string; phone: string; province: string; city: string; address: string; deliveries: Array<{ storeId: number; mode: DeliveryMode }>; paymentMethod: PaymentMethod }): Promise<{ orders: OrderDTO[] }> {
  const db = await database();
  return db.transaction(async tx => {
    if (new Set(input.deliveries.map(delivery => delivery.storeId)).size !== input.deliveries.length) fail("BAD_REQUEST", "Entrega repetida para una tienda");
    // Primero se comprueba la idempotencia; el lock posterior serializa dos primeros intentos concurrentes.
    let previous = await tx.select().from(czOrders).where(and(eq(czOrders.userId, userId), eq(czOrders.checkoutKey, input.checkoutKey))).orderBy(asc(czOrders.id));
    if (previous.length) {
      if (!sameCheckoutPayload(input, previous)) fail("CONFLICT", "checkoutKey ya fue usado con otro contenido");
      const persistedTotal = previous.reduce((total, order) => total + order.totalCents, 0);
      assertServiceCheckoutTotal(input.expectedTotalCents, persistedTotal);
      return { orders: await Promise.all(previous.map(o => orderDto(tx, o.id, userId))) };
    }
    const cart = (await tx.select().from(czCarts).where(eq(czCarts.userId, userId)).for("update").limit(1))[0];
    previous = await tx.select().from(czOrders).where(and(eq(czOrders.userId, userId), eq(czOrders.checkoutKey, input.checkoutKey))).for("update").orderBy(asc(czOrders.id));
    if (previous.length) {
      if (!sameCheckoutPayload(input, previous)) fail("CONFLICT", "checkoutKey ya fue usado con otro contenido");
      const persistedTotal = previous.reduce((total, order) => total + order.totalCents, 0);
      assertServiceCheckoutTotal(input.expectedTotalCents, persistedTotal);
      return { orders: await Promise.all(previous.map(o => orderDto(tx, o.id, userId))) };
    }
    if (!cart) fail("BAD_REQUEST", "El carrito está vacío");
    const raw = await tx.select({ item: czCartItems, variant: czVariants, product: czProducts, store: czStores }).from(czCartItems)
      .innerJoin(czVariants, eq(czCartItems.variantId, czVariants.id)).innerJoin(czProducts, eq(czVariants.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id))
      .where(eq(czCartItems.cartId, cart.id)).for("update");
    if (!raw.length) fail("BAD_REQUEST", "El carrito está vacío");
    const lockedProducts = new Map<number, CatalogProduct>();
    for (const productId of stableVariantOrder([...new Set(raw.map(line => line.product.id))])) {
      const product = (await tx.select().from(czProducts).where(eq(czProducts.id, productId)).for("update").limit(1))[0];
      if (!product) fail("CONFLICT", "Una publicación dejó de existir");
      lockedProducts.set(productId, product);
    }
    const sorted = stableVariantOrder(raw.map(line => line.variant.id)).map(id => raw.find(line => line.variant.id === id)!);
    const locked: typeof sorted = [];
    for (const line of sorted) {
      const lockedProduct = lockedProducts.get(line.product.id)!;
      const variant = (await tx.select().from(czVariants).where(eq(czVariants.id, line.variant.id)).for("update").limit(1))[0];
      if (!variant || variant.active !== 1 || variant.stock < line.item.quantity) fail("CONFLICT", "Inventario insuficiente o variante no disponible");
      if (!Number.isInteger(variant.priceCents) || variant.priceCents < 0 || variant.priceCents > MAX_MONEY_CENTS) fail("CONFLICT", "El precio de una variante no es válido");
      if (lockedProduct.status !== "published") fail("PRECONDITION_FAILED", "Una publicación ya no está disponible");
      if (line.store.userId === userId) fail("FORBIDDEN", "No puedes comprar artículos de tu propia tienda");
      await activeStore(tx, line.store.id);
      locked.push({ ...line, product: lockedProduct, variant });
    }
    const modes = new Map<number, DeliveryMode>();
    for (const d of input.deliveries) { if (modes.has(d.storeId)) fail("BAD_REQUEST", "Entrega repetida para una tienda"); modes.set(d.storeId, d.mode); }
    const lockedStoreIds = new Set(locked.map(line => line.store.id));
    if (modes.size !== lockedStoreIds.size || [...modes.keys()].some(storeId => !lockedStoreIds.has(storeId))) fail("BAD_REQUEST", "La selección de entregas no coincide con las tiendas del carrito");
    const groups = new Map<number, { lines: typeof locked; deliveryFeeCents: number }>();
    for (const line of locked) {
      const mode = modes.get(line.store.id);
      if (!mode) fail("BAD_REQUEST", "Falta elegir entrega para una tienda");
      if (!parseModes(line.product.deliveryModes).includes(mode)) fail("PRECONDITION_FAILED", "La publicación no ofrece la modalidad elegida");
      const existing = groups.get(line.store.id);
      if (existing) existing.lines.push(line);
      else groups.set(line.store.id, { lines: [line], deliveryFeeCents: deliveryQuote(line.store, mode, input.province) });
    }
    // Con Yappy el comprador paga directo al vendedor: cada tienda debe tener su Yappy registrado.
    if (input.paymentMethod === "yappy") {
      for (const group of groups.values()) {
        const store = group.lines[0]!.store;
        if (!storeAcceptsYappy(store)) fail("PRECONDITION_FAILED", `${store.name} todavía no recibe pagos por Yappy. Elige transferencia o pago contra entrega.`);
      }
    }
    let quotedTotal = 0;
    try {
      for (const group of groups.values()) {
        const subtotal = calculateSubtotal(group.lines.map(l => ({ priceCents: l.variant.priceCents, quantity: l.item.quantity })));
        quotedTotal += subtotal + group.deliveryFeeCents;
        if (!Number.isSafeInteger(quotedTotal) || quotedTotal > MAX_MONEY_CENTS) throw new Error("El total excede el límite permitido");
      }
    } catch (error) {
      if (error instanceof CommerceError) throw error;
      fail("BAD_REQUEST", error instanceof Error ? error.message : "Total inválido");
    }
    assertServiceCheckoutTotal(input.expectedTotalCents, quotedTotal);
    const created: number[] = [];
    for (const [storeId, group] of groups) {
      const lines = group.lines;
      let subtotalCents: number;
      try { subtotalCents = calculateSubtotal(lines.map(l => ({ priceCents: l.variant.priceCents, quantity: l.item.quantity }))); }
      catch (error) { fail("BAD_REQUEST", error instanceof Error ? error.message : "Total inválido"); }
      const mode = modes.get(storeId)!;
      const totalCents = subtotalCents + group.deliveryFeeCents;
      if (!Number.isSafeInteger(totalCents) || totalCents > MAX_MONEY_CENTS) fail("BAD_REQUEST", "El total excede el límite permitido");
      // La tasa de comisión del vendedor queda fijada al momento de la compra.
      const sellerUserId = (await tx.select({ userId: czStores.userId }).from(czStores).where(eq(czStores.id, storeId)).limit(1))[0]!.userId;
      const sellerTrialEndsAt = (await tx.select({ trialEndsAt: czApplications.trialEndsAt }).from(czApplications).where(eq(czApplications.userId, sellerUserId)).limit(1))[0]?.trialEndsAt ?? null;
      const result = await tx.insert(czOrders).values({ number: `CZ-${input.checkoutKey.slice(0, 8)}-${storeId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, userId, storeId, checkoutKey: input.checkoutKey,
        status: "pending", paymentMethod: input.paymentMethod, paymentStatus: paymentStatusFor(input.paymentMethod), subtotalCents, deliveryFeeCents: group.deliveryFeeCents, totalCents, deliveryMode: mode, commissionBps: commissionBpsAt(sellerTrialEndsAt),
        recipientName: input.recipientName, phone: input.phone, province: input.province, city: input.city, address: input.address, stockRestored: 0 });
      const orderId = listInsertId(result); created.push(orderId);
      for (const line of lines) {
        await tx.insert(czOrderItems).values({ orderId, productId: line.product.id, variantId: line.variant.id, title: line.product.title, quantity: line.item.quantity, unitPriceCents: line.variant.priceCents, size: line.variant.size, color: line.variant.color });
        const changed = await tx.update(czVariants).set({ stock: sql`${czVariants.stock} - ${line.item.quantity}` }).where(and(eq(czVariants.id, line.variant.id), sql`${czVariants.stock} >= ${line.item.quantity}`));
        if (affectedRows(changed) !== 1) fail("CONFLICT", "El inventario cambió durante el checkout");
      }
      await tx.insert(czNotifications).values({ userId: (await tx.select({ userId: czStores.userId }).from(czStores).where(eq(czStores.id, storeId)).limit(1))[0]!.userId, kind: "new_order", body: "Tienes un nuevo pedido pendiente", payload: { orderId } });
    }
    for (const productId of lockedProducts.keys()) {
      const changed = await tx.update(czProducts).set({ revision: sql`${czProducts.revision} + 1` }).where(eq(czProducts.id, productId));
      if (affectedRows(changed) !== 1) fail("CONFLICT", "La publicación cambió durante el checkout");
    }
    await tx.delete(czCartItems).where(eq(czCartItems.cartId, cart.id));
    return { orders: await Promise.all(created.map(id => orderDto(tx, id, userId))) };
  });
}

export async function listOrders(userId: number, status: string, seller = false, limit = 50): Promise<OrderDTO[]> {
  const db = await database();
  const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const rows = seller ? await db.select({ id: czOrders.id }).from(czOrders).innerJoin(czStores, eq(czOrders.storeId, czStores.id)).where(and(eq(czStores.userId, userId), status === "all" ? undefined : eq(czOrders.status, status as never))).orderBy(desc(czOrders.createdAt), desc(czOrders.id)).limit(boundedLimit)
    : await db.select({ id: czOrders.id }).from(czOrders).where(and(eq(czOrders.userId, userId), status === "all" ? undefined : eq(czOrders.status, status as never))).orderBy(desc(czOrders.createdAt), desc(czOrders.id)).limit(boundedLimit);
  return Promise.all(rows.map(r => orderDto(db, r.id, userId)));
}
export async function getOrder(userId: number, id: number): Promise<OrderDTO> { const db = await database(); const row = (await db.select({ order: czOrders, store: czStores }).from(czOrders).innerJoin(czStores, eq(czOrders.storeId, czStores.id)).where(eq(czOrders.id, id)).limit(1))[0]; if (!row) fail("NOT_FOUND", "El pedido no existe"); return orderDto(db, id, userId); }

export async function transitionOrder(userId: number, id: number, next: Exclude<OrderStatus, "pending">): Promise<OrderDTO> {
  const db = await database();
  return db.transaction(async tx => {
    const row = (await tx.select({ order: czOrders, store: czStores }).from(czOrders).innerJoin(czStores, eq(czOrders.storeId, czStores.id)).where(eq(czOrders.id, id)).for("update").limit(1))[0];
    if (!row) fail("NOT_FOUND", "El pedido no existe");
    const actor: "buyer" | "seller" = row.order.userId === userId ? "buyer" : row.store.userId === userId ? "seller" : (() => fail("FORBIDDEN", "No autorizado para este pedido"))();
    if (!canTransitionOrder(row.order.status as OrderStatus, next, actor)) fail("CONFLICT", "Transición de pedido no permitida");
    if (next === "cancelled" && row.order.stockRestored === 0) {
      const lines = await tx.select().from(czOrderItems).where(eq(czOrderItems.orderId, id));
      const productIds = stableVariantOrder([...new Set(lines.map(line => line.productId))]);
      for (const productId of productIds) {
        const product = (await tx.select({ id: czProducts.id }).from(czProducts).where(eq(czProducts.id, productId)).for("update").limit(1))[0];
        if (!product) fail("CONFLICT", "El producto del pedido no existe");
      }
      for (const line of [...lines].sort((a, b) => a.variantId - b.variantId)) {
        const variant = (await tx.select().from(czVariants).where(eq(czVariants.id, line.variantId)).for("update").limit(1))[0];
        if (!variant || !Number.isSafeInteger(variant.stock) || variant.stock > MAX_MONEY_CENTS - line.quantity) fail("CONFLICT", "El inventario excedería el límite permitido");
        const changed = await tx.update(czVariants).set({ stock: sql`${czVariants.stock} + ${line.quantity}` }).where(and(eq(czVariants.id, line.variantId), sql`${czVariants.stock} <= ${MAX_MONEY_CENTS - line.quantity}`));
        if (affectedRows(changed) !== 1) fail("CONFLICT", "No se pudo restaurar el inventario");
      }
      for (const productId of productIds) {
        const changed = await tx.update(czProducts).set({ revision: sql`${czProducts.revision} + 1` }).where(eq(czProducts.id, productId));
        if (affectedRows(changed) !== 1) fail("CONFLICT", "La publicación cambió durante la cancelación");
      }
      const changed = await tx.update(czOrders).set({ status: next, stockRestored: 1 }).where(and(eq(czOrders.id, id), eq(czOrders.stockRestored, 0)));
      if (affectedRows(changed) !== 1) fail("CONFLICT", "El inventario de este pedido ya fue restaurado");
    } else {
      // Al entregar se calcula la comisión sobre los productos (sin envío) con la tasa fijada en la compra.
      const delivery = next === "delivered"
        ? { deliveredAt: new Date(), commissionCents: commissionCents(row.order.subtotalCents, row.order.commissionBps) }
        : {};
      const changed = await tx.update(czOrders).set({ status: next, ...delivery }).where(eq(czOrders.id, id));
      if (affectedRows(changed) !== 1) fail("CONFLICT", "El pedido cambió durante la transición");
    }
    const recipient = actor === "buyer" ? row.store.userId : row.order.userId;
    await tx.insert(czNotifications).values({ userId: recipient, kind: "order_status", body: `El pedido ${row.order.number} cambió a ${next}`, payload: { orderId: id } });
    return orderDto(tx, id, userId);
  });
}

export async function listReviews(productId: number) { const db = await database(); await publicProduct(db, productId); const rows = await db.select({ id: czReviews.id, productId: czReviews.productId, rating: czReviews.rating, body: czReviews.body, createdAt: czReviews.createdAt }).from(czReviews).where(eq(czReviews.productId, productId)).orderBy(desc(czReviews.createdAt)); return rows.map(row => ({ ...row, author: "Compra verificada" })); }

export async function reviewEligibility(userId: number, productId: number) {
  const db = await database();
  return db.transaction(async tx => {
    const { store } = await publicProduct(tx, productId);
    const delivered = await tx.select({ id: czOrderItems.id }).from(czOrderItems)
      .innerJoin(czOrders, eq(czOrderItems.orderId, czOrders.id))
      .where(and(eq(czOrders.userId, userId), eq(czOrders.status, "delivered"), eq(czOrderItems.productId, productId))).limit(1);
    const existing = (await tx.select({ id: czReviews.id, rating: czReviews.rating, body: czReviews.body, createdAt: czReviews.createdAt })
      .from(czReviews).where(and(eq(czReviews.productId, productId), eq(czReviews.userId, userId))).limit(1))[0] as ReviewSafeDTO | undefined;
    return deriveReviewEligibility(store.userId === userId, Boolean(delivered[0]), existing ?? null);
  });
}

export async function createReview(userId: number, productId: number, rating: number, body: string) {
  const db = await database();
  return db.transaction(async tx => {
    const { store } = await publicProduct(tx, productId);
    if (store.userId === userId) fail("FORBIDDEN", "No puedes reseñar artículos de tu propia tienda");
    const delivered = await tx.select({ id: czOrderItems.id }).from(czOrderItems)
      .innerJoin(czOrders, eq(czOrderItems.orderId, czOrders.id))
      .where(and(eq(czOrders.userId, userId), eq(czOrders.status, "delivered"), eq(czOrderItems.productId, productId))).limit(1);
    if (!delivered[0]) fail("FORBIDDEN", "Solo puedes reseñar un producto realmente entregado");
    try {
      await tx.insert(czReviews).values({ productId, userId, rating, body });
    } catch (error) {
      const dbError = error as { code?: unknown; cause?: { code?: unknown } };
      if (dbError.code === "ER_DUP_ENTRY" || dbError.cause?.code === "ER_DUP_ENTRY") fail("CONFLICT", "Ya reseñaste este producto");
      throw error;
    }
    const review = (await tx.select({ id: czReviews.id, rating: czReviews.rating, body: czReviews.body, createdAt: czReviews.createdAt })
      .from(czReviews).where(and(eq(czReviews.productId, productId), eq(czReviews.userId, userId))).limit(1))[0];
    if (!review) fail("PRECONDITION_FAILED", "No se pudo leer la reseña creada");
    return review;
  });
}
const questionDtoFields = { id: czQuestions.id, productId: czQuestions.productId, body: czQuestions.body, answerBody: czQuestions.answerBody, answeredAt: czQuestions.answeredAt, createdAt: czQuestions.createdAt };

export async function listQuestions(productId: number) {
  const db = await database();
  await publicProduct(db, productId);
  return db.select(questionDtoFields).from(czQuestions).where(eq(czQuestions.productId, productId)).orderBy(asc(czQuestions.createdAt));
}

export async function askQuestion(userId: number, productId: number, body: string) {
  const db = await database();
  return db.transaction(async tx => {
    const { product, store } = await publicProduct(tx, productId);
    const result = await tx.insert(czQuestions).values({ productId, askerId: userId, body });
    const id = listInsertId(result);
    await tx.insert(czNotifications).values({ userId: store.userId, kind: "question", body: "Tienes una nueva pregunta sobre una publicación", payload: { questionId: id, productSlug: product.slug } });
    return (await tx.select(questionDtoFields).from(czQuestions).where(eq(czQuestions.id, id)).limit(1))[0]!;
  });
}

export async function answerQuestion(userId: number, id: number, body: string) {
  const db = await database();
  return db.transaction(async tx => {
    const row = (await tx.select({ question: czQuestions, product: czProducts, store: czStores })
      .from(czQuestions).innerJoin(czProducts, eq(czQuestions.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id))
      .where(eq(czQuestions.id, id)).limit(1))[0];
    if (!row) fail("NOT_FOUND", "La pregunta no existe");
    const { product } = await publicProduct(tx, row.product.id);
    await ownerStore(tx, userId, row.store.id);
    await tx.update(czQuestions).set({ answerBody: body, answererId: userId, answeredAt: new Date() }).where(eq(czQuestions.id, id));
    await tx.insert(czNotifications).values({ userId: row.question.askerId, kind: "question_answer", body: "Tu pregunta recibió una respuesta", payload: { questionId: id, productSlug: product.slug } });
    return (await tx.select(questionDtoFields).from(czQuestions).where(eq(czQuestions.id, id)).limit(1))[0]!;
  });
}

async function authorizedConversation(tx: Db | Tx, userId: number, conversationId: number) { const row = (await tx.select().from(czConversations).where(eq(czConversations.id, conversationId)).limit(1))[0]; if (!row) fail("NOT_FOUND", "La conversación no existe"); if (row.buyerId !== userId && row.sellerId !== userId) fail("FORBIDDEN", "No autorizado para esta conversación"); return row; }
export async function conversations(userId: number, limit = 50) { const db = await database(); const rows = await db.select({ conversation: czConversations, storeName: czStores.name }).from(czConversations).leftJoin(czOrders, eq(czConversations.orderId, czOrders.id)).leftJoin(czStores, eq(czOrders.storeId, czStores.id)).where(or(eq(czConversations.buyerId, userId), eq(czConversations.sellerId, userId))).orderBy(desc(czConversations.updatedAt)).limit(limit); return rows.map(row => ({ id: row.conversation.id, orderId: row.conversation.orderId, storeName: row.storeName ?? "Conversación", updatedAt: row.conversation.updatedAt })); }
export async function messages(userId: number, conversationId: number, limit = 100) { const db = await database(); await authorizedConversation(db, userId, conversationId); const rows = await db.select().from(czMessages).where(eq(czMessages.conversationId, conversationId)).orderBy(desc(czMessages.createdAt)).limit(limit); return rows.reverse().map(row => ({ id: row.id, body: row.body, isMine: row.senderId === userId, createdAt: row.createdAt })); }
export async function sendMessage(userId: number, input: { conversationId?: number; orderId?: number; body: string }) {
  const db = await database();
  return db.transaction(async tx => {
    let conversation = input.conversationId ? await authorizedConversation(tx, userId, input.conversationId) : undefined;
    if (!conversation && input.orderId) {
      const order = (await tx.select({ order: czOrders, store: czStores }).from(czOrders).innerJoin(czStores, eq(czOrders.storeId, czStores.id)).where(eq(czOrders.id, input.orderId)).limit(1))[0];
      if (!order || (order.order.userId !== userId && order.store.userId !== userId)) fail("FORBIDDEN", "La relación del pedido no autoriza mensajería");
      const buyerId = order.order.userId, sellerId = order.store.userId;
      conversation = (await tx.select().from(czConversations).where(and(eq(czConversations.buyerId, buyerId), eq(czConversations.sellerId, sellerId), eq(czConversations.orderId, input.orderId))).limit(1))[0];
      if (!conversation) { const result = await tx.insert(czConversations).values({ buyerId, sellerId, orderId: input.orderId }); conversation = (await tx.select().from(czConversations).where(eq(czConversations.id, listInsertId(result))).limit(1))[0]; }
    }
    if (!conversation) fail("BAD_REQUEST", "Se requiere una conversación o un pedido autorizado");
    await tx.insert(czMessages).values({ conversationId: conversation.id, senderId: userId, body: input.body }); await tx.update(czConversations).set({ updatedAt: new Date() }).where(eq(czConversations.id, conversation.id));
    const recipient = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
    await tx.insert(czNotifications).values({ userId: recipient, kind: "message", body: "Tienes un nuevo mensaje", payload: { conversationId: conversation.id } });
    return { conversationId: conversation.id };
  });
}
async function publicQuestionSlug(db: Db, questionId: number): Promise<string | undefined> {
  const row = (await db.select({ productId: czQuestions.productId })
    .from(czQuestions).innerJoin(czProducts, eq(czQuestions.productId, czProducts.id)).innerJoin(czStores, eq(czProducts.storeId, czStores.id))
    .where(eq(czQuestions.id, questionId)).limit(1))[0];
  if (!row) return undefined;
  try { return (await publicProduct(db, row.productId)).product.slug; } catch { return undefined; }
}

export async function notifications(userId: number, unreadOnly = false, limit = 50) {
  const db = await database();
  const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const rows = await db.select().from(czNotifications)
    .where(unreadOnly ? and(eq(czNotifications.userId, userId), isNull(czNotifications.readAt)) : eq(czNotifications.userId, userId))
    .orderBy(desc(czNotifications.createdAt), desc(czNotifications.id)).limit(boundedLimit);
  return Promise.all(rows.map(async row => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload as { orderId?: unknown; conversationId?: unknown; questionId?: unknown; productSlug?: unknown } : {};
    const orderId = typeof payload.orderId === "number" && Number.isSafeInteger(payload.orderId) && payload.orderId > 0 ? payload.orderId : undefined;
    const conversationId = typeof payload.conversationId === "number" && Number.isSafeInteger(payload.conversationId) && payload.conversationId > 0 ? payload.conversationId : undefined;
    const questionId = typeof payload.questionId === "number" && Number.isSafeInteger(payload.questionId) && payload.questionId > 0 ? payload.questionId : undefined;
    const payloadSlug = typeof payload.productSlug === "string" && payload.productSlug.length > 0 && payload.productSlug.length <= 220 && !/[\u0000-\u0020#?]/.test(payload.productSlug) ? payload.productSlug : undefined;
    const publicSlug = questionId ? await publicQuestionSlug(db, questionId) : undefined;
    const questionSlug = questionId ? (publicSlug && payloadSlug === publicSlug ? payloadSlug : publicSlug) : payloadSlug;
    const link = questionSlug ? `/articulo/${encodeURIComponent(questionSlug)}#preguntas` : orderId ? `/pedidos/${orderId}` : conversationId ? `/mensajes?conversacion=${conversationId}` : undefined;
    return { id: row.id, title: row.kind, body: row.body, read: Boolean(row.readAt), createdAt: row.createdAt, link };
  }));
}
export async function readNotification(userId: number, id: number) { const db = await database(); const changed = await db.update(czNotifications).set({ readAt: new Date() }).where(and(eq(czNotifications.id, id), eq(czNotifications.userId, userId))); if (affectedRows(changed) !== 1) fail("NOT_FOUND", "La notificación no existe"); return { id, read: true }; }
