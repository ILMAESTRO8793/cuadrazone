/*
 * Despachadores: llevan los pedidos de comercio con envío gratis (misma
 * provincia). Ganan el 50 % de la comisión del pedido, mínimo US$2.
 */
import {
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { czOrders } from "./commerce-schema";

export const czDispatchers = mysqlTable("cz_dispatchers", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("fullName", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  province: varchar("province", { length: 60 }).notNull(),
  vehicle: mysqlEnum("vehicle", [
    "moto",
    "carro",
    "bicicleta",
    "otro",
  ]).notNull(),
  plate: varchar("plate", { length: 20 }).notNull().default(""),
  status: mysqlEnum("status", ["pending", "approved", "suspended", "rejected"])
    .notNull()
    .default("pending"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Un pedido que tomó un despachador. Un pedido solo puede tener uno. */
export const czDispatchJobs = mysqlTable(
  "cz_dispatch_jobs",
  {
    orderId: int("orderId")
      .primaryKey()
      .references(() => czOrders.id, { onDelete: "cascade" }),
    dispatcherUserId: int("dispatcherUserId").notNull(),
    takenAt: timestamp("takenAt").defaultNow().notNull(),
    deliveredAt: timestamp("deliveredAt"),
    /** Foto de la entrega (/media/dispatch/<orderId>/…). */
    photoUrl: varchar("photoUrl", { length: 500 }),
    /** Lo que gana por esta entrega, fijado al entregar. */
    earningCents: int("earningCents").notNull().default(0),
    /** Cuándo el administrador le pagó esta entrega. */
    paidAt: timestamp("paidAt"),
    /** Última posición en vivo (millonésimas de grado), solo mientras va en camino. */
    lastLatE6: int("lastLatE6"),
    lastLngE6: int("lastLngE6"),
    lastAt: timestamp("lastAt"),
  },
  table => [index("cz_dispatch_jobs_dispatcher_ix").on(table.dispatcherUserId)]
);
