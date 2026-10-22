import {
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
    /** Yappy donde el vendedor recibe los pagos de sus compradores (celular +507). */
    yappyPhone: varchar("yappyPhone", { length: 20 }),
    /** Nombre en el Directorio de Yappy Comercial, si el vendedor tiene uno. */
    yappyDirectory: varchar("yappyDirectory", { length: 80 }),
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
