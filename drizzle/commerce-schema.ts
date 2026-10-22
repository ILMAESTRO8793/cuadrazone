import {
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { czProducts, czStores, czVariants } from "./catalog-schema";

export const czCarts = mysqlTable("cz_carts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("cz_cart_user_uq").on(table.userId)]);

export const czCartItems = mysqlTable("cz_cart_items", {
  id: int("id").autoincrement().primaryKey(),
  cartId: int("cartId").notNull().references(() => czCarts.id),
  variantId: int("variantId").notNull().references(() => czVariants.id),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("cz_cart_item_uq").on(table.cartId, table.variantId),
  index("cz_cart_item_cart_ix").on(table.cartId),
]);

export const czFavorites = mysqlTable("cz_favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  productId: int("productId").notNull().references(() => czProducts.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("cz_favorite_uq").on(table.userId, table.productId),
  index("cz_favorite_user_ix").on(table.userId),
]);

export const czOrders = mysqlTable("cz_orders", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 40 }).notNull().unique(),
  userId: int("userId").notNull().references(() => users.id),
  storeId: int("storeId").notNull().references(() => czStores.id),
  checkoutKey: varchar("checkoutKey", { length: 36 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "shipped", "delivered", "cancelled"]).notNull().default("pending"),
  paymentMethod: mysqlEnum("paymentMethod", ["yappy", "transfer", "cod"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["awaiting_payment", "pending"]).notNull().default("awaiting_payment"),
  subtotalCents: int("subtotalCents").notNull(),
  deliveryFeeCents: int("deliveryFeeCents").notNull().default(0),
  totalCents: int("totalCents").notNull(),
  deliveryMode: mysqlEnum("deliveryMode", ["shipping", "pickup", "home"]).notNull(),
  recipientName: varchar("recipientName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  province: varchar("province", { length: 80 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  stockRestored: int("stockRestored").notNull().default(0),
  /** Tasa de comisión fijada al crear el pedido (puntos básicos: 800 = 8%). */
  commissionBps: int("commissionBps").notNull().default(0),
  /** Comisión calculada al entregar, sobre el subtotal de productos. */
  commissionCents: int("commissionCents").notNull().default(0),
  deliveredAt: timestamp("deliveredAt"),
  /** Pago de comisión que la saldó; null mientras esté pendiente. */
  commissionPaymentId: int("commissionPaymentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("cz_order_checkout_uq").on(table.userId, table.checkoutKey, table.storeId),
  index("cz_order_commission_ix").on(table.storeId, table.status, table.commissionPaymentId),
  index("cz_order_user_ix").on(table.userId, table.createdAt),
  index("cz_order_store_ix").on(table.storeId, table.createdAt),
  index("cz_order_key_ix").on(table.userId, table.checkoutKey),
]);

export const czOrderItems = mysqlTable("cz_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => czOrders.id),
  productId: int("productId").notNull().references(() => czProducts.id),
  variantId: int("variantId").notNull().references(() => czVariants.id),
  title: varchar("title", { length: 240 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  size: varchar("size", { length: 80 }),
  color: varchar("color", { length: 80 }),
}, table => [index("cz_order_item_order_ix").on(table.orderId)]);

export const czReviews = mysqlTable("cz_reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => czProducts.id),
  userId: int("userId").notNull().references(() => users.id),
  rating: int("rating").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("cz_review_user_product_uq").on(table.userId, table.productId),
  index("cz_review_product_ix").on(table.productId, table.createdAt),
]);

export const czQuestions = mysqlTable("cz_questions", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => czProducts.id),
  askerId: int("askerId").notNull().references(() => users.id),
  body: text("body").notNull(),
  answerBody: text("answerBody"),
  answererId: int("answererId").references(() => users.id),
  answeredAt: timestamp("answeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("cz_question_product_ix").on(table.productId, table.createdAt)]);

export const czConversations = mysqlTable("cz_conversations", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyerId").notNull().references(() => users.id),
  sellerId: int("sellerId").notNull().references(() => users.id),
  orderId: int("orderId").references(() => czOrders.id),
  questionId: int("questionId").references(() => czQuestions.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("cz_convo_buyer_ix").on(table.buyerId, table.updatedAt),
  index("cz_convo_seller_ix").on(table.sellerId, table.updatedAt),
  uniqueIndex("cz_convo_order_uq").on(table.buyerId, table.sellerId, table.orderId),
  uniqueIndex("cz_convo_question_uq").on(table.buyerId, table.sellerId, table.questionId),
]);

export const czMessages = mysqlTable("cz_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => czConversations.id),
  senderId: int("senderId").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("cz_message_convo_ix").on(table.conversationId, table.createdAt)]);

export const czNotifications = mysqlTable("cz_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  kind: varchar("kind", { length: 80 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  payload: json("payload"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("cz_notification_user_ix").on(table.userId, table.createdAt)]);

export type Cart = typeof czCarts.$inferSelect;
export type CartItem = typeof czCartItems.$inferSelect;
export type Favorite = typeof czFavorites.$inferSelect;
export type Order = typeof czOrders.$inferSelect;
export type OrderItem = typeof czOrderItems.$inferSelect;
export type Review = typeof czReviews.$inferSelect;
export type Question = typeof czQuestions.$inferSelect;
export type Conversation = typeof czConversations.$inferSelect;
export type Message = typeof czMessages.$inferSelect;
export type Notification = typeof czNotifications.$inferSelect;

/** Pagos de comisión que el vendedor hace a CuadraZone, registrados por un administrador. */
export const czCommissionPayments = mysqlTable("cz_commission_payments", {
  id: int("id").autoincrement().primaryKey(),
  sellerUserId: int("sellerUserId").notNull().references(() => users.id),
  amountCents: int("amountCents").notNull(),
  orderCount: int("orderCount").notNull(),
  method: mysqlEnum("method", ["yappy", "transferencia", "efectivo", "otro"]).notNull(),
  reference: varchar("reference", { length: 120 }),
  paidOn: varchar("paidOn", { length: 10 }).notNull(),
  recordedBy: int("recordedBy").notNull().references(() => users.id),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("cz_commission_payment_reference_uq").on(table.method, table.reference),
  index("cz_commission_payment_seller_ix").on(table.sellerUserId, table.createdAt),
]);
