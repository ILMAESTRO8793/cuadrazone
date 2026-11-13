/*
 * Service Pub: publicidad personalizada (banner o bloque hecho a la medida)
 * que el vendedor pide aparte de su plan, por US$10 al mes. El pago lo
 * registra un administrador, como las mensualidades.
 */
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

export const czServicePub = mysqlTable("cz_service_pub", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  /** requested = lo pidió y falta el pago; active = pagado; cancelled = ya no lo quiere. */
  status: varchar("status", { length: 12 }).notNull().default("requested"),
  /** Lo que el vendedor quiere promocionar. */
  message: varchar("message", { length: 500 }).notNull().default(""),
  activeUntil: timestamp("activeUntil"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const czServicePubPayments = mysqlTable(
  "cz_service_pub_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    months: int("months").notNull(),
    amountCents: int("amountCents").notNull(),
    method: mysqlEnum("method", [
      "yappy",
      "transferencia",
      "tarjeta",
      "efectivo",
      "otro",
    ]).notNull(),
    reference: varchar("reference", { length: 120 }),
    paidOn: varchar("paidOn", { length: 10 }).notNull(),
    recordedBy: int("recordedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cz_service_pub_payment_reference_uq").on(
      table.method,
      table.reference
    ),
    index("cz_service_pub_payment_user_ix").on(table.userId, table.createdAt),
  ]
);

/**
 * Productos que un administrador activó en «Destacados» de /mercado. Solo se
 * muestran mientras la tienda tenga Service Pub pagado y vigente y el plan
 * Mayor Visibilidad.
 */
export const czServicePubProducts = mysqlTable("cz_service_pub_products", {
  productId: int("productId").primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  activatedBy: int("activatedBy")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Servicios que un administrador activó en «Destacados» de /servicios (mismas reglas que los productos). */
export const czServicePubServices = mysqlTable("cz_service_pub_services", {
  serviceId: int("serviceId").primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  activatedBy: int("activatedBy")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
