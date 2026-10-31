import { z } from "zod";
import { bookInput, deliveryModes as catalogDeliveryModes, productKinds, provinceOptions } from "./marketplace";

export const deliveryModes = ["shipping", "pickup", "home"] as const;
/**
 * Métodos de pago directo al vendedor. CuadraZone no procesa tarjetas: con
 * "card_link" el comprador paga en el link de pago del vendedor (Tilopay,
 * PagueloFácil, PayPal); con "card_on_delivery" paga con el datáfono del
 * vendedor al retirar o recibir el pedido.
 */
export const paymentMethods = ["yappy", "transfer", "cod", "card_link", "card_on_delivery"] as const;

export const paymentMethodLabels: Record<(typeof paymentMethods)[number], string> = {
  yappy: "Yappy",
  transfer: "Transferencia bancaria",
  cod: "Efectivo contra entrega",
  card_link: "Tarjeta de crédito o débito (link de pago del vendedor)",
  card_on_delivery: "Tarjeta de crédito o débito al recibir",
};
export const orderStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export const paymentStatuses = ["awaiting_payment", "pending"] as const;

export const uuidSchema = z.string().uuid();
export const positiveId = z.number().int().positive();
export const MAX_MONEY_CENTS = 2_147_483_647;
export const moneyCents = z.number().int().min(0).max(MAX_MONEY_CENTS);

export const cartItemDto = z.object({
  id: positiveId,
  variantId: positiveId,
  quantity: z.number().int().min(1).max(20),
  productId: positiveId,
  title: z.string(),
  slug: z.string(),
  image: z.string().nullable(),
  storeId: positiveId,
  storeName: z.string(),
  storeShippingFeeCents: moneyCents.nullable(),
  storeHomeFeeCents: moneyCents.nullable(),
  storeDeliveryProvinces: z.array(z.string()),
  /** Precio de envío por provincia de la tienda (vacío si usa tarifa única). */
  storeShippingFees: z.record(z.string(), moneyCents).default({}),
  productDeliveryModes: z.array(z.enum(deliveryModes)).optional(),
  priceCents: moneyCents,
  stock: z.number().int().nonnegative(),
  available: z.boolean(),
  size: z.string().nullable(),
  color: z.string().nullable(),
});
export type CartItemDTO = z.infer<typeof cartItemDto>;

export const cartDto = z.object({ items: z.array(cartItemDto), subtotalCents: moneyCents });
export type CartDTO = z.infer<typeof cartDto>;

export const publicProductDto = z.object({
  id: positiveId,
  storeId: positiveId,
  storeName: z.string(),
  slug: z.string(),
  kind: z.enum(["product", "book"]),
  title: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  priceCents: moneyCents,
  image: z.string().nullable(),
  imageUrls: z.array(z.string()),
  deliveryModes: z.array(z.enum(deliveryModes)),
});
export type PublicProductDTO = z.infer<typeof publicProductDto>;

const publicStoreDto = z.object({
  id: positiveId, slug: z.string(), name: z.string(), description: z.string(), province: z.string(), city: z.string(),
  churchName: z.string(), shippingFeeCents: moneyCents.nullable(), homeFeeCents: moneyCents.nullable(),
  deliveryProvinces: z.array(z.string()), verified: z.literal(true), createdAt: z.string(), updatedAt: z.string(),
});
const publicVariantDto = z.object({
  id: positiveId, sku: z.string(), size: z.string().nullable(), color: z.string().nullable(),
  stock: z.number().int().nonnegative(), priceCents: moneyCents,
});
export const catalogPublicProductDto = z.object({
  id: positiveId, slug: z.string(), kind: z.enum(productKinds), title: z.string(), description: z.string(),
  category: z.string(), priceCents: moneyCents, soldCount: z.number().int().nonnegative(), images: z.array(z.string()),
  deliveryModes: z.array(z.enum(catalogDeliveryModes)), book: bookInput.nullable(), variants: z.array(publicVariantDto),
  store: publicStoreDto, rating: z.number(), reviewCount: z.number().int().nonnegative(), createdAt: z.string(), revision: z.number().int().positive(),
});
export const favoriteListDto = z.object({ items: z.array(catalogPublicProductDto) });

export const addCartInput = z.object({ variantId: positiveId, quantity: z.number().int().min(1).max(20) }).strict();
export const setCartQuantityInput = z.object({ id: positiveId, quantity: z.number().int().min(1).max(20) }).strict();
export const removeCartInput = z.object({ id: positiveId }).strict();
export const favoriteInput = z.object({ productId: positiveId }).strict();

export const deliveryChoice = z.object({
  storeId: positiveId,
  mode: z.enum(deliveryModes),
}).strict();
export const checkoutInput = z.object({
  checkoutKey: uuidSchema,
  expectedTotalCents: moneyCents,
  recipientName: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(7).max(30),
  province: z.string().trim().refine(value => (provinceOptions as readonly string[]).includes(value), "Provincia no válida"),
  city: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(500),
  deliveries: z.array(deliveryChoice).min(1).max(100),
  paymentMethod: z.enum(paymentMethods),
}).strict().superRefine((input, context) => {
  const seen = new Set<number>();
  for (const [index, delivery] of input.deliveries.entries()) {
    if (seen.has(delivery.storeId)) {
      context.addIssue({ code: "custom", path: ["deliveries", index, "storeId"], message: "Entrega repetida para una tienda" });
    }
    seen.add(delivery.storeId);
  }
});

export const orderItemDto = z.object({
  productId: positiveId,
  variantId: positiveId,
  title: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: moneyCents,
  size: z.string().nullable(),
  color: z.string().nullable(),
});
export type OrderItemDTO = z.infer<typeof orderItemDto>;
export const orderDto = z.object({
  id: positiveId,
  number: z.string(),
  storeId: positiveId,
  storeName: z.string(),
  status: z.enum(orderStatuses),
  totalCents: moneyCents,
  deliveryFeeCents: moneyCents,
  paymentMethod: z.enum(paymentMethods),
  paymentStatus: z.enum(paymentStatuses),
  createdAt: z.date(),
  recipientName: z.string(),
  phone: z.string(),
  province: z.string(),
  city: z.string(),
  address: z.string(),
  deliveryMode: z.enum(deliveryModes),
  items: z.array(orderItemDto),
  viewerRole: z.enum(["buyer", "seller"]),
  /** Dónde pagar por Yappy; solo en pedidos con Yappy como método de pago. */
  sellerYappy: z.object({ phone: z.string().nullable(), directory: z.string().nullable() }).nullable(),
  /** Link de pago con tarjeta del vendedor; solo en pedidos con ese método. */
  sellerCardLink: z.string().nullable(),
});
export type OrderDTO = z.infer<typeof orderDto>;

export const ordersQuery = z.object({ status: z.enum(["all", ...orderStatuses] as const).default("all"), limit: z.number().int().min(1).max(100).default(50) }).strict();
export const sellerOrdersQuery = ordersQuery;
export const orderQuery = z.object({ id: positiveId }).strict();
export const transitionOrderInput = z.object({ id: positiveId, status: z.enum(["confirmed", "shipped", "delivered", "cancelled"] as const) }).strict();

export const reviewsQuery = z.object({ productId: positiveId }).strict();
export const reviewInput = z.object({ productId: positiveId, rating: z.number().int().min(1).max(5), body: z.string().trim().min(1).max(4000) }).strict();
export const reviewSafeDto = z.object({ id: positiveId, rating: z.number().int().min(1).max(5), body: z.string(), createdAt: z.date() }).strict();
export type ReviewSafeDTO = z.infer<typeof reviewSafeDto>;
export const reviewEligibilityDto = z.object({
  canReview: z.boolean(),
  reason: z.enum(["own_store", "not_delivered", "already_reviewed", "eligible"]),
  review: reviewSafeDto.nullable(),
}).strict();
export type ReviewEligibilityDTO = z.infer<typeof reviewEligibilityDto>;
export const questionInput = z.object({ productId: positiveId, body: z.string().trim().min(1).max(4000) }).strict();
export const questionQuery = reviewsQuery;
export const answerQuestionInput = z.object({ id: positiveId, body: z.string().trim().min(1).max(4000) }).strict();

export const conversationsQuery = z.object({ limit: z.number().int().min(1).max(100).default(50) }).strict();
export const messagesInput = z.object({ conversationId: positiveId, limit: z.number().int().min(1).max(100).default(100) }).strict();
export const sendMessageInput = z.object({ conversationId: positiveId.optional(), orderId: positiveId.optional(), body: z.string().trim().min(1).max(4000) }).strict().refine(v => v.conversationId || v.orderId, "conversationId u orderId es requerido");
export const notificationsQuery = z.object({ unreadOnly: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50) }).strict();
export const readNotificationInput = z.object({ id: positiveId }).strict();

export type DeliveryMode = (typeof deliveryModes)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type OrderStatus = (typeof orderStatuses)[number];

export function calculateSubtotal(lines: ReadonlyArray<{ priceCents: number; quantity: number }>): number {
  return lines.reduce((total, line) => {
    if (!Number.isSafeInteger(line.priceCents) || line.priceCents < 0 || line.priceCents > MAX_MONEY_CENTS ||
      !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new Error("Monto o cantidad inválidos");
    }
    const next = total + line.priceCents * line.quantity;
    if (!Number.isSafeInteger(next) || next > MAX_MONEY_CENTS) throw new Error("El total excede el límite permitido");
    return next;
  }, 0);
}

export function assertCheckoutTotal(expected: number, calculated: number): void {
  for (const [name, value] of [["esperado", expected], ["calculado", calculated]] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
      throw new Error(`Total ${name} inválido`);
    }
  }
  if (expected !== calculated) throw new Error("El total esperado no coincide con el calculado");
}

export function deriveReviewEligibility(ownsStore: boolean, hasDelivered: boolean, review: ReviewSafeDTO | null): ReviewEligibilityDTO {
  if (ownsStore) return { canReview: false, reason: "own_store", review: null };
  if (review) return { canReview: false, reason: "already_reviewed", review };
  if (!hasDelivered) return { canReview: false, reason: "not_delivered", review: null };
  return { canReview: true, reason: "eligible", review: null };
}

export function paymentStatusFor(method: PaymentMethod): "awaiting_payment" | "pending" {
  return method === "cod" || method === "card_on_delivery" ? "pending" : "awaiting_payment";
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, actor: "buyer" | "seller"): boolean {
  if (to === "cancelled") return (from === "pending" || from === "confirmed") && (actor === "buyer" || actor === "seller");
  if (actor === "buyer") return from === "shipped" && to === "delivered";
  return (from === "pending" && to === "confirmed") || (from === "confirmed" && to === "shipped") || (from === "shipped" && to === "delivered");
}

export function assertSafeQuantity(quantity: number, stock: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("La cantidad debe estar entre 1 y 20");
  if (quantity > stock) throw new Error("Inventario insuficiente");
}

export type CheckoutPayload = Pick<z.infer<typeof checkoutInput>, "recipientName" | "phone" | "province" | "city" | "address" | "paymentMethod">;
export type DeliveryChoice = z.infer<typeof deliveryChoice>;
export type ExistingCheckoutOrder = Pick<z.infer<typeof orderDto>, "storeId" | "deliveryMode" | "paymentMethod" | "recipientName" | "phone" | "province" | "city" | "address">;

export function checkoutFingerprint(input: Omit<CheckoutPayload, "province"> & { province: string }, mode: DeliveryMode): string {
  return [input.recipientName, input.phone, input.province, input.city, input.address, mode, input.paymentMethod].join("|");
}

/** Exact replay guard: same checkoutKey is idempotent only for the same stores and payload. */
export function sameCheckoutPayload(input: CheckoutPayload & { deliveries: ReadonlyArray<DeliveryChoice> }, previous: ReadonlyArray<ExistingCheckoutOrder>): boolean {
  const modes = new Map(input.deliveries.map(delivery => [delivery.storeId, delivery.mode]));
  const stores = [...new Set(previous.map(order => order.storeId))].sort((a, b) => a - b);
  const requested = [...modes.keys()].sort((a, b) => a - b);
  return stores.length === requested.length && stores.every((storeId, i) => storeId === requested[i]) && previous.every(order => checkoutFingerprint(input, modes.get(order.storeId)!) === checkoutFingerprint(order, order.deliveryMode));
}

export function stableVariantOrder(ids: ReadonlyArray<number>): number[] {
  return [...ids].sort((a, b) => a - b);
}
