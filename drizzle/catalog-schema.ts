import {
  bigint,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/mysql-core";
import { users, czApplications } from "./schema";
import type { BookMetadata, DeliveryMode, ProductKind, ProductStatus } from "@shared/marketplace";

export const czStores = mysqlTable(
  "cz_stores",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
    province: varchar("province", { length: 60 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    shippingFeeCents: int("shippingFeeCents"),
    homeFeeCents: int("homeFeeCents"),
    deliveryProvinces: json("deliveryProvinces").$type<string[]>(),
    /** Precio de envío por provincia en centavos: { "Chiriquí": 1200, … }. */
    shippingFeesByProvince: json("shippingFeesByProvince").$type<Record<string, number>>(),
    /** Yappy donde el vendedor recibe los pagos de sus compradores (celular +507). */
    yappyPhone: varchar("yappyPhone", { length: 20 }),
    /** Nombre en el Directorio de Yappy Comercial, si el vendedor tiene uno. */
    yappyDirectory: varchar("yappyDirectory", { length: 80 }),
    /** Link de pago con tarjeta (Tilopay, PagueloFácil, PayPal) del vendedor. */
    cardPaymentUrl: varchar("cardPaymentUrl", { length: 500 }),
    /** 1 si el vendedor cobra con datáfono al retirar o entregar. */
    cardOnDelivery: int("cardOnDelivery").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_stores_slug_uq").on(table.slug),
    uniqueIndex("cz_stores_user_uq").on(table.userId),
    index("cz_stores_province_ix").on(table.province),
    foreignKey({ name: "cz_stores_user_fk", columns: [table.userId], foreignColumns: [users.id] }),
    foreignKey({ name: "cz_stores_app_fk", columns: [table.userId], foreignColumns: [czApplications.userId] }),
  ],
);

export const czProducts = mysqlTable(
  "cz_products",
  {
    id: int("id").autoincrement().primaryKey(),
    storeId: int("storeId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    kind: mysqlEnum("kind", ["product", "book"]).$type<ProductKind>().notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    priceCents: int("priceCents").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).$type<ProductStatus>().notNull().default("draft"),
    revision: int("revision").notNull().default(1),
    bookMetadata: json("bookMetadata").$type<BookMetadata | null>(),
    imageUrls: json("imageUrls").$type<string[]>().notNull(),
    deliveryModes: json("deliveryModes").$type<DeliveryMode[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_products_slug_uq").on(table.slug),
    index("cz_products_store_ix").on(table.storeId),
    index("cz_products_owner_ix").on(table.ownerUserId),
    index("cz_products_status_ix").on(table.status),
    index("cz_products_category_ix").on(table.category),
    foreignKey({ name: "cz_products_store_fk", columns: [table.storeId], foreignColumns: [czStores.id] }),
    foreignKey({ name: "cz_products_owner_fk", columns: [table.ownerUserId], foreignColumns: [users.id] }),
  ],
);

export const czVariants = mysqlTable(
  "cz_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    sku: varchar("sku", { length: 80 }).notNull(),
    size: varchar("size", { length: 80 }),
    color: varchar("color", { length: 80 }),
    stock: int("stock").notNull().default(0),
    priceCents: int("priceCents").notNull(),
    active: int("active").notNull().default(1),
  },
  table => [
    uniqueIndex("cz_variants_product_sku_uq").on(table.productId, table.sku),
    index("cz_variants_product_ix").on(table.productId),
    foreignKey({ name: "cz_variants_product_fk", columns: [table.productId], foreignColumns: [czProducts.id] }),
  ],
);

/** Application-level photo index; objects remain durable storage assets. */
export const czProductImages = mysqlTable(
  "cz_product_images",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    ownerUserId: int("ownerUserId").notNull(),
    storageKey: varchar("storageKey", { length: 320 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    mimeType: varchar("mimeType", { length: 80 }).notNull(),
    size: int("size").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_product_images_key_uq").on(table.storageKey),
    index("cz_product_images_product_ix").on(table.productId),
    foreignKey({ name: "cz_product_images_product_fk", columns: [table.productId], foreignColumns: [czProducts.id] }),
    foreignKey({ name: "cz_product_images_owner_fk", columns: [table.ownerUserId], foreignColumns: [users.id] }),
  ],
);

export type Store = typeof czStores.$inferSelect;
export type Product = typeof czProducts.$inferSelect;
export type Variant = typeof czVariants.$inferSelect;
export type ProductImage = typeof czProductImages.$inferSelect;
export type NewStore = typeof czStores.$inferInsert;
export type NewProduct = typeof czProducts.$inferInsert;
export type NewVariant = typeof czVariants.$inferInsert;

/** Anuncios de bienes raíces (venta y alquiler). */
export const czProperties = mysqlTable(
  "cz_properties",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    slug: varchar("slug", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "paused", "closed"]).notNull().default("draft"),
    revision: int("revision").notNull().default(0),
    operation: mysqlEnum("operation", ["venta", "alquiler"]).notNull(),
    propertyType: mysqlEnum("propertyType", ["casa", "apartamento", "terreno", "local", "oficina"]).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    priceCents: bigint("priceCents", { mode: "number" }).notNull(),
    depositCents: bigint("depositCents", { mode: "number" }),
    minLeaseMonths: int("minLeaseMonths"),
    province: varchar("province", { length: 60 }).notNull(),
    district: varchar("district", { length: 80 }).notNull(),
    neighborhood: varchar("neighborhood", { length: 120 }).notNull().default(""),
    areaBuiltM2: int("areaBuiltM2"),
    areaLandM2: int("areaLandM2"),
    bedrooms: int("bedrooms"),
    bathrooms: int("bathrooms"),
    parking: int("parking"),
    floor: int("floor"),
    furnished: int("furnished").notNull().default(0),
    petsAllowed: int("petsAllowed").notNull().default(0),
    landUse: mysqlEnum("landUse", ["residencial", "comercial", "agricola", "mixto"]),
    hasTitle: int("hasTitle").notNull().default(0),
    hasWater: int("hasWater").notNull().default(0),
    hasPower: int("hasPower").notNull().default(0),
    amenities: json("amenities").$type<string[]>(),
    advertiserType: mysqlEnum("advertiserType", ["dueno", "agente"]).notNull().default("dueno"),
    contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
    showPhone: int("showPhone").notNull().default(1),
    images: json("images").$type<string[]>(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("cz_properties_slug_uq").on(table.slug),
    index("cz_properties_search_idx").on(table.status, table.operation, table.propertyType, table.province),
    index("cz_properties_owner_idx").on(table.userId, table.updatedAt),
  ]
);

/** Plan de anunciante: para publicar bienes raíces (y luego autos y empleos) sin tener tienda. */
export const czAdvertiserPlans = mysqlTable("cz_advertiser_plans", {
  userId: int("userId").primaryKey().references(() => users.id),
  planId: varchar("planId", { length: 40 }).notNull(),
  endsAt: timestamp("endsAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Pagos del plan de anunciante registrados por un administrador. */
export const czAdvertiserPayments = mysqlTable(
  "cz_advertiser_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    planId: varchar("planId", { length: 40 }).notNull(),
    months: int("months").notNull(),
    amountCents: int("amountCents").notNull(),
    method: mysqlEnum("method", ["yappy", "transferencia", "efectivo", "otro"]).notNull(),
    reference: varchar("reference", { length: 120 }),
    paidOn: varchar("paidOn", { length: 10 }).notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    recordedBy: int("recordedBy").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("cz_advertiser_payment_reference_uq").on(table.method, table.reference)]
);
