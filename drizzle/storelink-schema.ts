/*
 * Enlace del negocio (su web o su Instagram). Cualquier tienda puede ponerlo;
 * el nombre de la tienda en sus publicaciones lleva a ese enlace.
 */
import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { czStores } from "./catalog-schema";

export const czStoreLinks = mysqlTable("cz_store_links", {
  storeId: int("storeId")
    .primaryKey()
    .references(() => czStores.id, { onDelete: "cascade" }),
  /** Siempre https://, p. ej. «https://instagram.com/polytalk». */
  url: varchar("url", { length: 300 }).notNull().default(""),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
